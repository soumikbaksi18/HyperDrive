// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

/// @title BasketRouter
/// @notice Minimal Uniswap v4 swap router for basket pools: one wallet transaction to swap USDC into
///         a basket (or back) through the PoolManager, with the hook doing the mint/redeem.
contract BasketRouter is IUnlockCallback {
    using SafeERC20 for IERC20;

    IPoolManager public immutable poolManager;

    struct CallbackData {
        address payer;
        address recipient;
        PoolKey key;
        bool zeroForOne;
        uint256 amountIn;
        bytes hookData;
    }

    error NotPoolManager();
    error Slippage(uint256 out, uint256 minOut);
    error Expired();
    error PartialFill();

    constructor(IPoolManager poolManager_) {
        poolManager = poolManager_;
    }

    /// @notice Exact-input swap through a basket pool. Approve `tokenIn` to this router first.
    function swapExactIn(
        PoolKey calldata key,
        bool zeroForOne,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata hookData,
        address recipient,
        uint256 deadline
    ) external returns (uint256 amountOut) {
        if (block.timestamp > deadline) revert Expired();
        bytes memory result = poolManager.unlock(
            abi.encode(CallbackData(msg.sender, recipient, key, zeroForOne, amountIn, hookData))
        );
        amountOut = abi.decode(result, (uint256));
        if (amountOut < minAmountOut) revert Slippage(amountOut, minAmountOut);
    }

    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        CallbackData memory d = abi.decode(raw, (CallbackData));
        (Currency inC, Currency outC) = d.zeroForOne ? (d.key.currency0, d.key.currency1) : (d.key.currency1, d.key.currency0);

        // Pre-pay the input so the PoolManager actually holds it when the hook takes it in beforeSwap
        // (the hook spends it on the basket mint/redeem). The swap's input debt then nets this credit to zero.
        poolManager.sync(inC);
        IERC20(Currency.unwrap(inC)).safeTransferFrom(d.payer, address(poolManager), d.amountIn);
        poolManager.settle();

        BalanceDelta delta = poolManager.swap(
            d.key,
            SwapParams({
                zeroForOne: d.zeroForOne,
                amountSpecified: -int256(d.amountIn),
                sqrtPriceLimitX96: d.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            d.hookData
        );

        int128 inDelta = d.zeroForOne ? delta.amount0() : delta.amount1();
        int128 outDelta = d.zeroForOne ? delta.amount1() : delta.amount0();
        // Exact input is always fully consumed by the hook.
        if (uint256(int256(-inDelta)) != d.amountIn) revert PartialFill();

        // Take what we're owed (positive delta) straight to the recipient.
        uint256 out = uint256(int256(outDelta));
        poolManager.take(outC, d.recipient, out);
        return abi.encode(out);
    }
}
