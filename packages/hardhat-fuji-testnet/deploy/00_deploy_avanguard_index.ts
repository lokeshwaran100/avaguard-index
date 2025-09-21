import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

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

  // Use real Pangolin Router and WAVAX on Avalanche Fuji when targeting fuji
  // https://docs.pangolin.exchange/
  const isFuji = hre.network.name === "fuji";
  const PANGOLIN_ROUTER = "0x2D99ABD9008Dc933ff5c0CD271B88309593aB921"; // Fuji Pangolin Router
  const WAVAX_ADDRESS = "0xd00ae08403B9bbb9124bB305C09058E32C39A48c"; // Fuji WAVAX

  // Deploy AGI Token
  console.log("📝 Deploying AGI Token...");
  const agiToken = await deploy("AGIToken", {
    from: deployer,
    args: [deployer],
    log: true,
    autoMine: true,
  });

  // Deploy Mock Oracle (used as price feed source)
  console.log("🔮 Deploying Mock Oracle...");
  const mockOracle = await deploy("MockOracle", {
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
    args: [
      agiToken.address,
      mockOracle.address,
      deployer,
      isFuji ? PANGOLIN_ROUTER : PANGOLIN_ROUTER,
      isFuji ? WAVAX_ADDRESS : WAVAX_ADDRESS,
      deployer,
    ],
    log: true,
    autoMine: true,
  });

  // Deploy some mock tokens for testing
  console.log("🪙 Deploying Mock Tokens...");
  const mockUSDC = await deploy("MockERC20", {
    from: deployer,
    args: ["USD Coin", "USDC", deployer],
    log: true,
    autoMine: true,
  });

  const mockUSDT = await deploy("MockERC20", {
    from: deployer,
    args: ["Tether USD", "USDT", deployer],
    log: true,
    autoMine: true,
  });

  const mockWBTC = await deploy("MockERC20", {
    from: deployer,
    args: ["Wrapped Bitcoin", "WBTC", deployer],
    log: true,
    autoMine: true,
  });

  // Set some mock prices in the oracle
  console.log("💰 Setting mock token prices...");
  const oracleContract = await hre.ethers.getContract<Contract>("MockOracle", deployer);

  // Set prices in USD with 8 decimals
  await oracleContract.setTokenPrice(mockUSDC.address, 100000000); // $1.00
  await oracleContract.setTokenPrice(mockUSDT.address, 100000000); // $1.00
  await oracleContract.setTokenPrice(mockWBTC.address, 30000000000); // $30,000.00

  console.log("✅ Avanguard Index contracts deployed successfully!");
  console.log("📊 AGI Token:", agiToken.address);
  console.log("🔮 Mock Oracle:", mockOracle.address);
  console.log("🔄 DEX Router:", PANGOLIN_ROUTER);
  console.log("🌊 WAVAX:", WAVAX_ADDRESS);
  console.log("🏭 Fund Factory:", fundFactory.address);
  console.log("🪙 Mock USDC:", mockUSDC.address);
  console.log("🪙 Mock USDT:", mockUSDT.address);
  console.log("🪙 Mock WBTC:", mockWBTC.address);
};

export default deployAvanguardIndex;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags AvanguardIndex
deployAvanguardIndex.tags = ["AvanguardIndex"];
