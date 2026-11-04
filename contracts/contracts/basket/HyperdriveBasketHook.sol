// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, toBeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {HyperdriveBasket} from "./HyperdriveBasket.sol";

/// @title HyperdriveBasketHook
/// @notice Uniswap v4 hook that turns a USDC <-> basket pool into a mint/redeem gateway for a
///         HyperdriveBasket. A swap of USDC into the pool buys every component and mints basket
///         shares to the swapper; a swap of basket shares into the pool redeems them to USDC.
/// @dev Custom-curve hook (beforeSwap + beforeSwapReturnsDelta): the hook takes the input currency
///      from the PoolManager, runs the basket mint/redeem, settles the output currency and returns
///      a delta that fully satisfies the swap, so the pool's own AMM never trades and needs no
///      liquidity. Adding liquidity is disabled. Exact-input swaps only.
///      Stateless (immutables only), so the deployed bytecode can live at a flag-mined address.
///
///      hookData:
///        buy  (USDC in):   abi.encode(uint256[] legUsdc, bytes[] legData, uint256 minShares, address refundTo)
///        sell (basket in): abi.encode(bytes[] legData, uint256 minUsdcOut, address refundTo)
contract HyperdriveBasketHook is IHooks {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;
    using SafeCast for int256;

    IPoolManager public immutable poolManager;
    HyperdriveBasket public immutable basket;
    IERC20 public immutable usdc;

    error NotPoolManager();
    error HookNotImplemented();
    error WrongPool();
    error ExactInputOnly();
    error LiquidityDisabled();

    /// Flags this hook needs; the deployed address's low 14 bits must equal exactly this.
    uint160 public constant FLAGS =
        Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG
            | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG;

    constructor(IPoolManager poolManager_, HyperdriveBasket basket_) {
        poolManager = poolManager_;
        basket = basket_;
        usdc = basket_.usdc();
    }

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    /// @notice Only the USDC/basket pair can be created with this hook.
    function beforeInitialize(address, PoolKey calldata key, uint160) external view onlyPoolManager returns (bytes4) {
        _checkPair(key);
        return IHooks.beforeInitialize.selector;
    }

    /// @notice Liquidity comes from the basket vault, not LPs.
    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        view
        onlyPoolManager
        returns (bytes4)
    {
        revert LiquidityDisabled();
    }

    function beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        _checkPair(key);
        if (params.amountSpecified >= 0) revert ExactInputOnly();
        uint256 amountIn = uint256(-params.amountSpecified);

        (Currency inC, Currency outC) = params.zeroForOne ? (key.currency0, key.currency1) : (key.currency1, key.currency0);
        bool buying = Currency.unwrap(inC) == address(usdc);

        // Pull the swapper's input out of the PoolManager into the hook.
        poolManager.take(inC, address(this), amountIn);

        uint256 amountOut;
        if (buying) {
            (uint256[] memory legUsdc, bytes[] memory legData, uint256 minShares, address refundTo) =
                abi.decode(hookData, (uint256[], bytes[], uint256, address));
            usdc.forceApprove(address(basket), amountIn);
            amountOut = basket.mint(amountIn, legUsdc, legData, minShares, address(this), refundTo);
        } else {
            (bytes[] memory legData, uint256 minUsdcOut, address refundTo) =
                abi.decode(hookData, (bytes[], uint256, address));
            amountOut = basket.redeemToUsdc(amountIn, legData, minUsdcOut, address(this), refundTo);
        }

        // Pay the output into the PoolManager; the swapper takes it from there.
        poolManager.sync(outC);
        IERC20(Currency.unwrap(outC)).safeTransfer(address(poolManager), amountOut);
        poolManager.settle();

        // Specified (input) fully absorbed by the hook; unspecified (output) provided by the hook.
        BeforeSwapDelta delta = toBeforeSwapDelta(amountIn.toInt256().toInt128(), -amountOut.toInt256().toInt128());
        return (IHooks.beforeSwap.selector, delta, 0);
    }

    function _checkPair(PoolKey calldata key) private view {
        if (address(key.hooks) != address(this)) revert WrongPool();
        address a = Currency.unwrap(key.currency0);
        address b = Currency.unwrap(key.currency1);
        bool ok = (a == address(usdc) && b == address(basket)) || (a == address(basket) && b == address(usdc));
        if (!ok) revert WrongPool();
    }

    // ------------------------------------------------------------------
    // Unused hook entry points (their flags are not set, so the PoolManager never calls them).
    // ------------------------------------------------------------------

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
        external
        pure
        returns (bytes4, BalanceDelta)
    {
        revert HookNotImplemented();
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert HookNotImplemented();
    }

    function afterRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata)
        external
        pure
        returns (bytes4, BalanceDelta)
    {
        revert HookNotImplemented();
    }

    function afterSwap(address, PoolKey calldata, SwapParams calldata, BalanceDelta, bytes calldata)
        external
        pure
        returns (bytes4, int128)
    {
        revert HookNotImplemented();
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        revert HookNotImplemented();
    }
}
