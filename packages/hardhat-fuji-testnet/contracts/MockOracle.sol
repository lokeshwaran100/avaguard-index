//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "./IOracle.sol";

/**
 * Mock Oracle for testing - provides fixed prices for tokens
 * @author Avanguard Index
 */
contract MockOracle is IOracle {
    mapping(address => uint256) public tokenPrices;
    
    constructor() {
        // Set some default prices for testing (in USD with 8 decimals)
        // Example: $1 = 100000000 (8 decimals)
        tokenPrices[address(0)] = 100000000; // AVAX at $1
    }
    
    /**
     * @dev Set a token price for testing
     * @param token The token address
     * @param price The price in USD (8 decimals)
     */
    function setTokenPrice(address token, uint256 price) external {
        tokenPrices[token] = price;
    }
    
    /**
     * @dev Get the current price of a token
     * @param token The token address
     * @return price The current price in USD (8 decimals)
     */
    function getPrice(address token) external view override returns (uint256 price) {
        require(tokenPrices[token] > 0, "Price not available for token");
        return tokenPrices[token];
    }
}
