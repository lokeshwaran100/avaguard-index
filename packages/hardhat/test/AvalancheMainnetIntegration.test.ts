import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AGIToken, ChainlinkOracle, FundFactory, Fund } from "../typechain-types";

describe("Avalanche Mainnet Integration Test", function () {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let treasury: SignerWithAddress;

  let agiToken: AGIToken;
  let oracle: ChainlinkOracle;
  let factory: FundFactory;
  let fund: Fund;

  // Avalanche Mainnet addresses
  const WAVAX = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
  const TRADER_JOE_ROUTER = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4";
  const WBTC = "0x152b9d0FdC40C096757F570A51E494bd4b943E50";
  const WETH = "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB";

  // Chainlink Price Feed addresses on Avalanche
  const AVAX_USD_FEED = "0x0A77230d17318075983913bC2145DB16C7366156";
  const BTC_USD_FEED = "0x2779D32d5166BAaa2B2b658333bA7e6Ec0C65743";
  const ETH_USD_FEED = "0x976B3D034E162d8bD72D6b9C989d545b839003b0";

  before(async function () {
    // This test requires forking Avalanche mainnet
    console.log("======== Starting Avalanche Mainnet Integration Test ========");

    [deployer, user, treasury] = await ethers.getSigners();

    // Give the user some AVAX for testing
    await deployer.sendTransaction({
      to: user.address,
      value: ethers.parseEther("10"),
    });

    console.log("Test accounts prepared with AVAX");
  });

  describe("1. Contract Deployment", function () {
    it("Should deploy all contracts successfully", async function () {
      console.log("\n[1/4] Deploying contracts...");

      // Deploy AGI Token
      const AGITokenFactory = await ethers.getContractFactory("AGIToken");
      agiToken = await AGITokenFactory.deploy(deployer.address);
      await agiToken.waitForDeployment();

      // Deploy Oracle
      const ChainlinkOracleFactory = await ethers.getContractFactory("ChainlinkOracle");
      oracle = await ChainlinkOracleFactory.deploy();
      await oracle.waitForDeployment();

      // Deploy FundFactory
      const FundFactoryFactory = await ethers.getContractFactory("FundFactory");
      factory = await FundFactoryFactory.deploy(
        await agiToken.getAddress(),
        await oracle.getAddress(),
        treasury.address,
        TRADER_JOE_ROUTER,
        WAVAX,
        deployer.address,
      );
      await factory.waitForDeployment();

      console.log("  - AGI Token deployed at:", await agiToken.getAddress());
      console.log("  - ChainlinkOracle deployed at:", await oracle.getAddress());
      console.log("  - FundFactory deployed at:", await factory.getAddress());

      // Configure Oracle with price feeds
      await oracle.setPriceFeed(ethers.ZeroAddress, AVAX_USD_FEED); // AVAX/USD
      await oracle.setPriceFeed(WBTC, BTC_USD_FEED); // BTC/USD
      await oracle.setPriceFeed(WETH, ETH_USD_FEED); // ETH/USD

      console.log("  - Price feeds configured for AVAX, WBTC, and WETH");
      console.log("Deployment complete.");

      expect(await agiToken.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await oracle.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await factory.getAddress()).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("2. Fund Creation", function () {
    it("Should create a new fund successfully", async function () {
      console.log("\n[2/4] Creating a new fund...");

      // Mint AGI tokens for fund creation fee
      const creationFee = await factory.creationFee();
      await agiToken.mint(user.address, creationFee);

      // Approve factory to spend AGI
      await agiToken.connect(user).approve(await factory.getAddress(), creationFee);

      console.log("  - Minted and approved AGI for fund creation fee");

      // Define underlying tokens for the fund
      const tokens = [WBTC, WETH];

      // Create the fund
      const tx = await factory.connect(user).createFund("Test Fund BTC/ETH", "TFBE", tokens);
      await tx.wait();

      console.log("  - createFund transaction completed");

      // Get the new fund's address
      const totalFunds = await factory.getTotalFunds();
      const fundAddress = await factory.funds(totalFunds - 1n);
      fund = await ethers.getContractAt("Fund", fundAddress);

      console.log("  - Fund successfully created at:", fundAddress);
      console.log("Fund creation complete.");

      expect(totalFunds).to.equal(1);
      expect(await fund.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await fund.creator()).to.equal(user.address);
      expect(await fund.fundName()).to.equal("Test Fund BTC/ETH");
      expect(await fund.fundTicker()).to.equal("TFBE");
    });
  });

  describe("3. Buy Fund Tokens", function () {
    it("Should buy fund tokens with AVAX", async function () {
      console.log("\n[3/4] Buying fund tokens...");

      const buyAmount = ethers.parseEther("0.1"); // 0.1 AVAX
      const initialBalance = await fund.balanceOf(user.address);

      // Buy fund tokens
      const tx = await fund.connect(user).buy({ value: buyAmount });
      await tx.wait();

      const finalBalance = await fund.balanceOf(user.address);

      console.log("  - Bought fund tokens with 0.1 AVAX");
      console.log("  - New fund token balance:", ethers.formatEther(finalBalance));
      console.log("Buy complete.");

      expect(finalBalance).to.be.gt(initialBalance);
      expect(finalBalance).to.be.gt(0);

      // Check that the fund has underlying tokens
      const wbtcBalance = await fund.getTokenBalance(WBTC);
      const wethBalance = await fund.getTokenBalance(WETH);

      console.log("  - WBTC balance in fund:", wbtcBalance.toString());
      console.log("  - WETH balance in fund:", wethBalance.toString());

      expect(wbtcBalance).to.be.gt(0);
      expect(wethBalance).to.be.gt(0);
    });
  });

  describe("4. Rebalance Fund", function () {
    it("Should rebalance fund proportions", async function () {
      console.log("\n[4/4] Rebalancing fund...");

      // Get initial proportions and balances
      const initialWbtcProportion = await fund.targetProportions(WBTC);
      const initialWethProportion = await fund.targetProportions(WETH);
      const initialWbtcBalance = await fund.getTokenBalance(WBTC);
      const initialWethBalance = await fund.getTokenBalance(WETH);

      console.log("  - Initial WBTC proportion:", initialWbtcProportion.toString());
      console.log("  - Initial WETH proportion:", initialWethProportion.toString());
      console.log("  - Balance WBTC before:", initialWbtcBalance.toString());
      console.log("  - Balance WETH before:", initialWethBalance.toString());

      // Set new proportions: 70% WBTC, 30% WETH
      const newTokens = [WBTC, WETH];
      const newProportions = [70, 30];

      const tx = await fund.connect(user).setProportions(newTokens, newProportions);
      await tx.wait();

      // Get final proportions and balances
      const finalWbtcProportion = await fund.targetProportions(WBTC);
      const finalWethProportion = await fund.targetProportions(WETH);
      const finalWbtcBalance = await fund.getTokenBalance(WBTC);
      const finalWethBalance = await fund.getTokenBalance(WETH);

      console.log("  - Rebalance complete");
      console.log("  - New WBTC proportion:", finalWbtcProportion.toString());
      console.log("  - New WETH proportion:", finalWethProportion.toString());
      console.log("  - Balance WBTC after:", finalWbtcBalance.toString());
      console.log("  - Balance WETH after:", finalWethBalance.toString());

      expect(finalWbtcProportion).to.equal(70);
      expect(finalWethProportion).to.equal(30);
      expect(finalWbtcProportion).to.not.equal(initialWbtcProportion);
      expect(finalWethProportion).to.not.equal(initialWethProportion);
    });
  });

  describe("5. Sell Fund Tokens", function () {
    it("Should sell fund tokens for AVAX", async function () {
      console.log("\n[5/5] Selling fund tokens...");

      const fundTokenBalance = await fund.balanceOf(user.address);
      const initialAvaxBalance = await ethers.provider.getBalance(user.address);

      console.log("  - Fund token balance to sell:", ethers.formatEther(fundTokenBalance));

      // Approve fund contract to spend fund tokens
      await fund.connect(user).approve(await fund.getAddress(), fundTokenBalance);

      // Sell all fund tokens
      const tx = await fund.connect(user).sell(fundTokenBalance);
      const receipt = await tx.wait();

      const finalFundTokenBalance = await fund.balanceOf(user.address);
      const finalAvaxBalance = await ethers.provider.getBalance(user.address);

      // Calculate gas cost
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const netAvaxReceived = finalAvaxBalance + gasUsed - initialAvaxBalance;

      console.log("  - Sold all fund tokens");
      console.log("  - Final fund token balance:", ethers.formatEther(finalFundTokenBalance));
      console.log("  - Net AVAX received:", ethers.formatEther(netAvaxReceived));
      console.log("Sell complete.");

      expect(finalFundTokenBalance).to.equal(0);
      expect(netAvaxReceived).to.be.gt(0);
    });
  });

  after(function () {
    console.log("\n======== Avalanche Mainnet Integration Test Completed ========");
  });
});
