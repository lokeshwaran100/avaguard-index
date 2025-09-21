//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/**
 * Oracle Interface for fetching token prices
 * @author Avanguard Index
 */
interface IOracle {
    /**
     * @dev Get the current price of a token in USD with 8 decimals
     * @param token The token address to get price for
     * @return price The current price in USD (8 decimals)
     */
    function getPrice(address token) external view returns (uint256 price);
}
