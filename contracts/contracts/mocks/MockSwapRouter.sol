// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "./MockERC20.sol";

/// @notice Test-only stand-in for a DEX aggregator: pulls `amountIn` of tokenIn from the caller
///         (needs allowance, like a real router) and mints `amountOut` of tokenOut to `to`.
contract MockSwapRouter {
    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, address to) external {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        MockERC20(tokenOut).mint(to, amountOut);
    }
}
