// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/AggregatorV3Interface.sol";
import "./IOracle.sol";

contract ChainlinkOracle is IOracle {
    mapping(address => address) public priceFeeds;

    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    function setPriceFeed(address token, address feed) external onlyOwner {
        priceFeeds[token] = feed;
    }

    function getPrice(address token) external view override returns (uint256 price) {
        address feedAddress = priceFeeds[token];
        require(feedAddress != address(0), "Price feed not found");

        AggregatorV3Interface priceFeed = AggregatorV3Interface(feedAddress);
        (
            ,
            int256 latestPrice,
            ,
            ,
            
        ) = priceFeed.latestRoundData();

        // Chainlink prices can have different decimals, we need to convert to 8
        uint8 decimals = priceFeed.decimals();
        if (decimals > 8) {
            return uint256(latestPrice) / (10**(uint256(decimals) - 8));
        } else {
            return uint256(latestPrice) * (10**(8 - uint256(decimals)));
        }
    }
}
