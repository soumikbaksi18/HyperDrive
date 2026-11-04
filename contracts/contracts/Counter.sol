// SPDX-License-Identifier: MIT
pragma solidity ^0.8.31;

/// @title Counter
/// @notice Minimal sample contract for Monad (EVM Osaka). Replace with app-specific contracts.
contract Counter {
    uint256 public count;

    event Incremented(uint256 newCount);

    function increment() external {
        count += 1;
        emit Incremented(count);
    }
}
