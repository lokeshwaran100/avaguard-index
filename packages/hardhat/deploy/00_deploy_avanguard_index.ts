import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract, ethers } from "ethers";

/**
 * Deploys the Avanguard Index contracts
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployAvanguardIndex: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  /*
    On localhost, the deployer account is the one that comes with Hardhat, which is already funded.

    When deploying to live networks (e.g `yarn deploy --network sepolia`), the deployer account
    should have sufficient balance to pay for the gas fees for contract creation.

    You can generate a random account with `yarn generate` or `yarn account:import` to import your
    existing PK which will fill DEPLOYER_PRIVATE_KEY_ENCRYPTED in the .env file (then used on hardhat.config.ts)
    You can run the `yarn account` command to check your balance in every network.
  */

  console.log("🔍 Getting named accounts...");
  const namedAccounts = await hre.getNamedAccounts();
  console.log("📋 Named accounts:", namedAccounts);

  const { deployer } = namedAccounts;

  if (!deployer) {
    throw new Error("Deployer account is undefined. Check your hardhat configuration.");
  }

  console.log("👤 Deployer address:", deployer);

  const { deploy } = hre.deployments;

  console.log("🚀 Deploying Avanguard Index contracts...");

  // Network-specific addresses for Avalanche Fuji and Mainnet
  // For hardhat fork of mainnet, we should use mainnet addresses
  const isAvalanche =
    hre.network.name === "avalanche" ||
    hre.network.name === "avalancheMainnet" ||
    (hre.network.name === "hardhat" && hre.network.config.forking?.enabled) ||
    hre.network.name === "localhost";

  // DEX Router addresses
  const PANGOLIN_ROUTER = "0x2D99ABD9008Dc933ff5c0CD271B88309593aB921"; // Fuji Pangolin Router
  const TRADER_JOE_ROUTER = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4"; // Avalanche Mainnet Trader Joe Router

  // WAVAX addresses
  const WAVAX_FUJI = "0xd00ae08403B9bbb9124bB305C09058E32C39A48c"; // Fuji WAVAX
  const WAVAX_MAINNET = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"; // Mainnet WAVAX

  // Token addresses for mainnet
  const WBTC_MAINNET = "0x152b9d0FdC40C096757F570A51E494bd4b943E50";
  const WETH_MAINNET = "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB";

  // Chainlink Price Feed addresses on Avalanche
  const AVAX_USD_FEED = "0x0A77230d17318075983913bC2145DB16C7366156"; // Mainnet
  const BTC_USD_FEED = "0x2779D32d5166BAaa2B2b658333bA7e6Ec0C65743"; // Mainnet
  const ETH_USD_FEED = "0x976B3D034E162d8bD72D6b9C989d545b839003b0"; // Mainnet

  // Use appropriate addresses based on network
  const DEX_ROUTER = isAvalanche ? TRADER_JOE_ROUTER : PANGOLIN_ROUTER;
  const WAVAX_ADDRESS = isAvalanche ? WAVAX_MAINNET : WAVAX_FUJI;

  // Deploy AGI Token
  console.log("📝 Deploying AGI Token...");
  const agiToken = await deploy("AGIToken", {
    from: deployer,
    args: [deployer],
    log: true,
    autoMine: true,
  });

  // Deploy Chainlink Oracle (used as price feed source)
  console.log("🔮 Deploying Chainlink Oracle...");
  const chainlinkOracle = await deploy("ChainlinkOracle", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  // Deploy Fund Factory
  console.log("🏭 Deploying Fund Factory...");
  const fundFactory = await deploy("FundFactory", {
    from: deployer,
    // FundFactory(agi, oracle, treasury, dex, wavax, initialOwner)
    args: [agiToken.address, chainlinkOracle.address, deployer, DEX_ROUTER, WAVAX_ADDRESS, deployer],
    log: true,
    autoMine: true,
  });

  // Configure Chainlink price feeds
  console.log("💰 Configuring Chainlink price feeds...");
  const oracleContract = await hre.ethers.getContract<Contract>("ChainlinkOracle", deployer);

  if (isAvalanche) {
    // Configure price feeds for Avalanche mainnet
    await oracleContract.setPriceFeed(ethers.ZeroAddress, AVAX_USD_FEED); // AVAX/USD
    await oracleContract.setPriceFeed(WBTC_MAINNET, BTC_USD_FEED); // WBTC/USD
    await oracleContract.setPriceFeed(WETH_MAINNET, ETH_USD_FEED); // WETH/USD
    console.log("  - Configured price feeds for AVAX, WBTC, and WETH on Avalanche mainnet");
  } else {
    // For Fuji testnet, we could deploy mock price feeds or use existing ones
    console.log("  - ChainlinkOracle deployed on Fuji testnet (price feeds need manual configuration)");
  }

  console.log("✅ Avanguard Index contracts deployed successfully!");
  console.log("📊 AGI Token:", agiToken.address);
  console.log("🔮 Chainlink Oracle:", chainlinkOracle.address);
  console.log("🔄 DEX Router:", DEX_ROUTER);
  console.log("🌊 WAVAX:", WAVAX_ADDRESS);
  console.log("🏭 Fund Factory:", fundFactory.address);
  console.log("🌐 Network:", hre.network.name);
  console.log("📋 Deployer:", deployer);
};

export default deployAvanguardIndex;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags AvanguardIndex
deployAvanguardIndex.tags = ["AvanguardIndex"];
