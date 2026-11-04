// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title HyperdriveBasket
/// @notice ERC-20 index token fully backed by a fixed set of xStock components (e.g. NVDAx + TSLAx)
///         held by this contract. One share is a pro-rata claim on every component balance.
/// @dev Oracle-free, in-kind accounting (like an ETF creation/redemption basket):
///      - mint: USDC is swapped into each component through an allow-listed aggregator router
///        (calldata built off-chain per leg). Shares are minted against the *smallest* proportional
///        contribution: shares = supply * min_i(received_i / reserve_i). On the first mint,
///        `initialUnits` (component amount per 1e18 shares) defines the share scale.
///      - redeem: burn shares for the pro-rata slice of every component, in kind or swapped to USDC.
///      Any over-contribution in one leg stays in the reserves and accrues to all holders.
contract HyperdriveBasket is ERC20, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    /// Swap router the legs are executed against (KyberSwap MetaAggregationRouterV2 on Monad).
    address public immutable router;

    address[] private _components;
    /// Component amount per 1e18 shares, used only to size the very first mint.
    uint256[] private _initialUnits;

    event Minted(address indexed payer, address indexed to, uint256 usdcIn, uint256 shares, uint256[] received);
    event Redeemed(address indexed owner, address indexed to, uint256 shares, uint256[] amounts, uint256 usdcOut);

    error LengthMismatch();
    error ZeroAmount();
    error LegSumMismatch(uint256 legs, uint256 usdcIn);
    error SwapFailed(uint256 leg, bytes reason);
    error ComponentNotReceived(uint256 leg);
    error Slippage(uint256 out, uint256 minOut);
    error RouterOverspent(uint256 leg);

    constructor(
        string memory name_,
        string memory symbol_,
        address usdc_,
        address router_,
        address[] memory components_,
        uint256[] memory initialUnits_,
        address owner_
    ) ERC20(name_, symbol_) Ownable(owner_) {
        if (components_.length == 0 || components_.length != initialUnits_.length) revert LengthMismatch();
        usdc = IERC20(usdc_);
        router = router_;
        for (uint256 i = 0; i < components_.length; i++) {
            if (initialUnits_[i] == 0) revert ZeroAmount();
        }
        _components = components_;
        _initialUnits = initialUnits_;
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function components() external view returns (address[] memory) {
        return _components;
    }

    function initialUnits() external view returns (uint256[] memory) {
        return _initialUnits;
    }

    /// @notice Component balances backing the whole supply.
    function reserves() public view returns (uint256[] memory out) {
        out = new uint256[](_components.length);
        for (uint256 i = 0; i < _components.length; i++) {
            out[i] = IERC20(_components[i]).balanceOf(address(this));
        }
    }

    /// @notice Component amounts one full share (1e18) is redeemable for right now.
    function componentsPerShare() external view returns (uint256[] memory out) {
        uint256 supply = totalSupply();
        out = reserves();
        for (uint256 i = 0; i < out.length; i++) {
            out[i] = supply == 0 ? _initialUnits[i] : (out[i] * 1e18) / supply;
        }
    }

    /// @notice Component amounts `shares` redeem for (what `redeem*` will pay out).
    function previewRedeem(uint256 shares) public view returns (uint256[] memory out) {
        uint256 supply = totalSupply();
        out = reserves();
        for (uint256 i = 0; i < out.length; i++) {
            out[i] = supply == 0 ? 0 : (out[i] * shares) / supply;
        }
    }

    // ------------------------------------------------------------------
    // Mint with USDC
    // ------------------------------------------------------------------

    /// @param usdcIn     USDC pulled from msg.sender.
    /// @param legUsdc    USDC allotted to each component leg (must sum to usdcIn).
    /// @param legData    Router calldata per leg (USDC -> component, recipient = this contract).
    /// @param minShares  Slippage floor.
    /// @param to         Receives the shares.
    /// @param refundTo   Receives any USDC a leg did not spend.
    function mint(
        uint256 usdcIn,
        uint256[] calldata legUsdc,
        bytes[] calldata legData,
        uint256 minShares,
        address to,
        address refundTo
    ) external nonReentrant whenNotPaused returns (uint256 shares) {
        uint256 n = _components.length;
        if (legUsdc.length != n || legData.length != n) revert LengthMismatch();
        if (usdcIn == 0) revert ZeroAmount();
        uint256 sum;
        for (uint256 i = 0; i < n; i++) sum += legUsdc[i];
        if (sum != usdcIn) revert LegSumMismatch(sum, usdcIn);

        uint256 usdcBefore = usdc.balanceOf(address(this));
        uint256[] memory before = reserves();
        uint256 supply = totalSupply();

        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);
        for (uint256 i = 0; i < n; i++) {
            if (legUsdc[i] == 0) continue;
            usdc.forceApprove(router, legUsdc[i]);
            (bool ok, bytes memory reason) = router.call(legData[i]);
            if (!ok) revert SwapFailed(i, reason);
        }
        usdc.forceApprove(router, 0);

        uint256[] memory received = new uint256[](n);
        shares = type(uint256).max;
        for (uint256 i = 0; i < n; i++) {
            received[i] = IERC20(_components[i]).balanceOf(address(this)) - before[i];
            if (received[i] == 0) revert ComponentNotReceived(i);
            uint256 s = supply == 0 ? (received[i] * 1e18) / _initialUnits[i] : (received[i] * supply) / before[i];
            if (s < shares) shares = s;
        }
        if (shares == 0 || shares < minShares) revert Slippage(shares, minShares);

        uint256 unspent = usdc.balanceOf(address(this)) - usdcBefore;
        if (unspent > 0) usdc.safeTransfer(refundTo, unspent);

        _mint(to, shares);
        emit Minted(msg.sender, to, usdcIn - unspent, shares, received);
    }

    // ------------------------------------------------------------------
    // Redeem
    // ------------------------------------------------------------------

    /// @notice Burn shares for the pro-rata components, in kind. Always available, even when paused.
    function redeem(uint256 shares, address to) external nonReentrant returns (uint256[] memory amounts) {
        if (shares == 0) revert ZeroAmount();
        amounts = previewRedeem(shares);
        _burn(msg.sender, shares);
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] > 0) IERC20(_components[i]).safeTransfer(to, amounts[i]);
        }
        emit Redeemed(msg.sender, to, shares, amounts, 0);
    }

    /// @notice Burn shares and swap the pro-rata components back to USDC.
    /// @param legData  Router calldata per leg (component -> USDC, recipient = this contract), sized
    ///                 to `previewRedeem(shares)`.
    /// @param refundTo Receives any component amount a leg did not spend.
    function redeemToUsdc(
        uint256 shares,
        bytes[] calldata legData,
        uint256 minUsdcOut,
        address to,
        address refundTo
    ) external nonReentrant whenNotPaused returns (uint256 usdcOut) {
        uint256 n = _components.length;
        if (legData.length != n) revert LengthMismatch();
        if (shares == 0) revert ZeroAmount();
        uint256[] memory amounts = previewRedeem(shares);
        _burn(msg.sender, shares);

        uint256 usdcBefore = usdc.balanceOf(address(this));
        for (uint256 i = 0; i < n; i++) {
            if (amounts[i] == 0) continue;
            IERC20 token = IERC20(_components[i]);
            uint256 balBefore = token.balanceOf(address(this));
            token.forceApprove(router, amounts[i]);
            (bool ok, bytes memory reason) = router.call(legData[i]);
            if (!ok) revert SwapFailed(i, reason);
            token.forceApprove(router, 0);
            uint256 spent = balBefore - token.balanceOf(address(this));
            if (spent > amounts[i]) revert RouterOverspent(i);
            if (amounts[i] > spent) token.safeTransfer(refundTo, amounts[i] - spent);
        }
        usdcOut = usdc.balanceOf(address(this)) - usdcBefore;
        if (usdcOut < minUsdcOut) revert Slippage(usdcOut, minUsdcOut);
        usdc.safeTransfer(to, usdcOut);
        emit Redeemed(msg.sender, to, shares, amounts, usdcOut);
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
