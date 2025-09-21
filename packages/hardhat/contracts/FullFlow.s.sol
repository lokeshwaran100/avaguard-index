// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.20;

// import "forge-std/Script.sol";
// import "forge-std/console.sol";
// import "../src/FundFactory.sol";
// import "../src/Fund.sol";
// import "../src/AGIToken.sol";
// import "../src/ChainlinkOracle.sol";

// contract FullFlow is Script {
//     function run() external {
//         vm.startBroadcast();
//         console.log("======== Starting Full Flow Test on Mainnet ========");

//         // ======== 1. DEPLOYMENT ========
//         console.log("\n[1/4] Deploying contracts...");

//         // Deploy AGI Token
//         AGIToken agi = new AGIToken(msg.sender);

//         // Deploy Oracle
//         ChainlinkOracle oracle = new ChainlinkOracle();

//         // Setup system addresses for Mainnet
//         address wavax = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
//         address dex = 0x60aE616a2155Ee3d9A68541Ba4544862310933d4; // Trader Joe V1 Router
//         address treasury = msg.sender; // Use sender as treasury for test

//         // Deploy FundFactory
//         FundFactory factory = new FundFactory(
//             address(agi),
//             address(oracle),
//             treasury,
//             dex,
//             wavax,
//             msg.sender
//         );

//         console.log("  - AGI Token deployed at:", address(agi));
//         console.log("  - ChainlinkOracle deployed at:", address(oracle));
//         console.log("  - FundFactory deployed at:", address(factory));
//         console.log("Deployment complete.");

//         // ======== X. CONFIGURE ORACLE ========
//         console.log("\n[X/4] Configuring Chainlink oracle...");
//         address wbtc = 0x152b9d0FdC40C096757F570A51E494bd4b943E50;
//         address weth = 0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB;

//         oracle.setPriceFeed(address(0), 0x0A77230d17318075983913bC2145DB16C7366156); // AVAX/USD
//         oracle.setPriceFeed(wbtc, 0x2779D32d5166BAaa2B2b658333bA7e6Ec0C65743); // BTC/USD
//         oracle.setPriceFeed(weth, 0x976B3D034E162d8bD72D6b9C989d545b839003b0); // ETH/USD
//         console.log("  - Price feeds set for AVAX, WBTC, and WETH.");


//         // ======== 2. FUND CREATION ========
//         console.log("\n[2/4] Creating a new fund...");

//         // Mint some AGI for the user to pay creation fee
//         agi.mint(msg.sender, 1000 * 1e18);
        
//         // Approve factory to spend AGI
//         agi.approve(address(factory), factory.creationFee());
//         console.log("  - Minted and approved AGI for fund creation fee.");

//         // Define underlying tokens for the fund
//         address[] memory tokens = new address[](2);
//         tokens[0] = wbtc;
//         tokens[1] = weth;

//         // Create the fund
//         factory.createFund("Test Fund BTC/ETH", "TFBE", tokens);
//         console.log("  - createFund transaction sent.");

//         // Get the new fund's address
//         uint256 totalFunds = factory.getTotalFunds();
//         address fundAddr = address(factory.funds(totalFunds - 1));
//         Fund fund = Fund(payable(fundAddr));
//         console.log("  - Fund successfully created at:", fundAddr);
//         console.log("Fund creation complete.");

//         // ======== 3. BUY FUND TOKENS ========
//         console.log("\n[3/4] Buying fund tokens...");
        
//         // Buy with 0.0001 AVAX
//         fund.buy{value: 0.0001 ether}();
//         console.log("  - Bought fund tokens with 0.0001 AVAX.");
//         uint256 balance = fund.balanceOf(msg.sender);
//         console.log("  - New fund token balance:", balance);
//         console.log("Buy complete.");

//         // ======== 4. REBALANCE FUND ========
//         console.log("\n[4/5] Rebalancing fund...");
//         console.log("  - Initial WBTC proportion:", fund.targetProportions(wbtc));
//         console.log("  - Initial WETH proportion:", fund.targetProportions(weth));
//         console.log("  - Balance WBTC before:", fund.getTokenBalance(wbtc));
//         console.log("  - Balance WETH before:", fund.getTokenBalance(weth));

//         address[] memory newTokens = new address[](2);
//         newTokens[0] = wbtc;
//         newTokens[1] = weth;
//         uint256[] memory newProportions = new uint256[](2);
//         newProportions[0] = 70;
//         newProportions[1] = 30;

//         fund.setProportions(newTokens, newProportions);

//         console.log("  - Rebalance complete.");
//         console.log("  - New WBTC proportion:", fund.targetProportions(wbtc));
//         console.log("  - New WETH proportion:", fund.targetProportions(weth));
//         console.log("  - Balance WBTC after:", fund.getTokenBalance(wbtc));
//         console.log("  - Balance WETH after:", fund.getTokenBalance(weth));

//         // ======== 5. SELL FUND TOKENS ========
//         console.log("\n[5/5] Selling fund tokens...");

//         // Approve and Sell all fund tokens
//         fund.approve(fundAddr, balance);
//         fund.sell(balance);
//         console.log("  - Sold all fund tokens.");
//         uint256 finalBalance = fund.balanceOf(msg.sender);
//         console.log("  - Final fund token balance:", finalBalance);
//         console.log("Sell complete.");

//         vm.stopBroadcast();
//         console.log("\n======== Full Flow Test Completed ========");
//     }
// }
