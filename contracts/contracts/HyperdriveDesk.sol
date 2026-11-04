// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title HyperdriveDesk
/// @notice Inventory-backed desk that swaps USDC for Nasdaq xStocks on Monad (and back)
///         at a price signed off-chain by the Hyperdrive quote service.
/// @dev Flow: the backend reads the live xStocks price, signs an EIP-712 `Quote` bound to one
///      trader, one token, one side and one input amount, with a short deadline and a single-use
///      nonce. The trader submits it with a slippage floor. Settlement is atomic: USDC in and
///      xStock out (or the reverse) in the same transaction, from the desk's own inventory.
///
///      Price unit: USDC base units (6 decimals) per ONE whole xStock token (10**decimals units).
///      e.g. AAPLx at $332.285 => price = 332_285_000.
contract HyperdriveDesk is Ownable2Step, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    enum Side {
        Buy,
        Sell
    }

    struct Quote {
        address trader;
        address token;
        Side side;
        /// Buy: USDC paid in (6 decimals). Sell: xStock shares paid in (token decimals).
        uint256 amountIn;
        /// USDC base units per one whole xStock token.
        uint256 price;
        uint256 deadline;
        bytes32 nonce;
    }

    struct Listing {
        bool listed;
        uint8 decimals;
    }

    bytes32 public constant QUOTE_TYPEHASH = keccak256(
        "Quote(address trader,address token,uint8 side,uint256 amountIn,uint256 price,uint256 deadline,bytes32 nonce)"
    );

    /// Hard ceiling on the desk fee: 1%.
    uint16 public constant MAX_FEE_BPS = 100;

    IERC20 public immutable usdc;

    address public quoteSigner;
    address public feeRecipient;
    uint16 public feeBps;

    mapping(address token => Listing) public listings;
    mapping(bytes32 nonce => bool) public usedNonces;

    /// @param usdcAmount Buy: USDC the trader paid (fee included). Sell: USDC the trader received (fee deducted).
    /// @param shares     xStock units the trader received (buy) or delivered (sell).
    event Trade(
        address indexed trader,
        address indexed token,
        Side indexed side,
        uint256 usdcAmount,
        uint256 shares,
        uint256 price,
        uint256 fee,
        bytes32 nonce
    );
    event TokenListed(address indexed token, uint8 decimals);
    event TokenDelisted(address indexed token);
    event QuoteSignerUpdated(address indexed signer);
    event FeeUpdated(uint16 feeBps, address indexed recipient);
    event InventoryWithdrawn(address indexed token, address indexed to, uint256 amount);
    event NonceCancelled(bytes32 indexed nonce);

    error ZeroAddress();
    error NotAuthorized();
    error ZeroAmount();
    error NotListed(address token);
    error WrongSide();
    error NotQuoteTrader();
    error QuoteExpired();
    error QuoteAlreadyUsed();
    error BadSignature();
    error InvalidPrice();
    error FeeTooHigh();
    error Slippage(uint256 out, uint256 minOut);
    error InsufficientInventory(address token, uint256 available, uint256 needed);

    constructor(address usdc_, address quoteSigner_, address feeRecipient_, uint16 feeBps_, address owner_)
        Ownable(owner_)
        EIP712("HyperdriveDesk", "1")
    {
        if (usdc_ == address(0) || quoteSigner_ == address(0) || feeRecipient_ == address(0)) {
            revert ZeroAddress();
        }
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        usdc = IERC20(usdc_);
        quoteSigner = quoteSigner_;
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
        emit QuoteSignerUpdated(quoteSigner_);
        emit FeeUpdated(feeBps_, feeRecipient_);
    }

    // ---------------------------------------------------------------------
    // Trading
    // ---------------------------------------------------------------------

    /// @notice Pay USDC, receive xStock shares at the signed price.
    /// @return sharesOut xStock units sent to the trader.
    function buy(Quote calldata quote, bytes calldata signature, uint256 minSharesOut)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 sharesOut)
    {
        if (quote.side != Side.Buy) revert WrongSide();
        Listing memory listing = _consume(quote, signature);

        uint256 fee = (quote.amountIn * feeBps) / 10_000;
        uint256 net = quote.amountIn - fee;
        sharesOut = (net * (10 ** listing.decimals)) / quote.price;
        if (sharesOut == 0 || sharesOut < minSharesOut) revert Slippage(sharesOut, minSharesOut);

        uint256 inventory = IERC20(quote.token).balanceOf(address(this));
        if (inventory < sharesOut) revert InsufficientInventory(quote.token, inventory, sharesOut);

        usdc.safeTransferFrom(msg.sender, address(this), quote.amountIn);
        if (fee > 0) usdc.safeTransfer(feeRecipient, fee);
        IERC20(quote.token).safeTransfer(msg.sender, sharesOut);

        emit Trade(msg.sender, quote.token, Side.Buy, quote.amountIn, sharesOut, quote.price, fee, quote.nonce);
    }

    /// @notice Deliver xStock shares, receive USDC at the signed price.
    /// @return usdcOut USDC sent to the trader (after fee).
    function sell(Quote calldata quote, bytes calldata signature, uint256 minUsdcOut)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 usdcOut)
    {
        if (quote.side != Side.Sell) revert WrongSide();
        Listing memory listing = _consume(quote, signature);

        // Measure what actually arrived, so a token with transfer hooks can't over-credit the trader.
        IERC20 token = IERC20(quote.token);
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), quote.amountIn);
        uint256 received = token.balanceOf(address(this)) - before;

        uint256 gross = (received * quote.price) / (10 ** listing.decimals);
        uint256 fee = (gross * feeBps) / 10_000;
        usdcOut = gross - fee;
        if (usdcOut == 0 || usdcOut < minUsdcOut) revert Slippage(usdcOut, minUsdcOut);

        uint256 inventory = usdc.balanceOf(address(this));
        if (inventory < gross) revert InsufficientInventory(address(usdc), inventory, gross);

        if (fee > 0) usdc.safeTransfer(feeRecipient, fee);
        usdc.safeTransfer(msg.sender, usdcOut);

        emit Trade(msg.sender, quote.token, Side.Sell, usdcOut, received, quote.price, fee, quote.nonce);
    }

    /// @notice EIP-712 digest the quote signer signs. Exposed so off-chain code can cross-check.
    function hashQuote(Quote calldata quote) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    QUOTE_TYPEHASH,
                    quote.trader,
                    quote.token,
                    quote.side,
                    quote.amountIn,
                    quote.price,
                    quote.deadline,
                    quote.nonce
                )
            )
        );
    }

    function _consume(Quote calldata quote, bytes calldata signature) private returns (Listing memory listing) {
        if (msg.sender != quote.trader) revert NotQuoteTrader();
        if (block.timestamp > quote.deadline) revert QuoteExpired();
        if (quote.amountIn == 0) revert ZeroAmount();
        if (quote.price == 0) revert InvalidPrice();
        listing = listings[quote.token];
        if (!listing.listed) revert NotListed(quote.token);
        if (usedNonces[quote.nonce]) revert QuoteAlreadyUsed();
        if (ECDSA.recover(hashQuote(quote), signature) != quoteSigner) revert BadSignature();
        usedNonces[quote.nonce] = true;
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function listTokens(address[] calldata tokens) external onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            if (token == address(0) || token == address(usdc)) revert ZeroAddress();
            uint8 decimals = IERC20Metadata(token).decimals();
            listings[token] = Listing({listed: true, decimals: decimals});
            emit TokenListed(token, decimals);
        }
    }

    function delistTokens(address[] calldata tokens) external onlyOwner {
        for (uint256 i = 0; i < tokens.length; i++) {
            delete listings[tokens[i]];
            emit TokenDelisted(tokens[i]);
        }
    }

    function setQuoteSigner(address signer) external onlyOwner {
        if (signer == address(0)) revert ZeroAddress();
        quoteSigner = signer;
        emit QuoteSignerUpdated(signer);
    }

    function setFee(uint16 feeBps_, address recipient) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (recipient == address(0)) revert ZeroAddress();
        feeBps = feeBps_;
        feeRecipient = recipient;
        emit FeeUpdated(feeBps_, recipient);
    }

    /// @notice Pull USDC or xStock inventory out of the desk. Inventory is topped up with plain transfers.
    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit InventoryWithdrawn(token, to, amount);
    }

    /// @notice Revoke signed-but-unfilled quotes (e.g. signed off a bad price). Owner or quote signer.
    function cancelNonces(bytes32[] calldata nonces) external {
        if (msg.sender != owner() && msg.sender != quoteSigner) revert NotAuthorized();
        for (uint256 i = 0; i < nonces.length; i++) {
            usedNonces[nonces[i]] = true;
            emit NonceCancelled(nonces[i]);
        }
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
