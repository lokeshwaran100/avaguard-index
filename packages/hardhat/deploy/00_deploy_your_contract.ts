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
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("🚀 Deploying Avanguard Index contracts...");

  // Deploy AGI Token
  console.log("📝 Deploying AGI Token...");
  const agiToken = await deploy("AGIToken", {
    from: deployer,
    args: [deployer],
    log: true,
    autoMine: true,
  });

  // Deploy Mock Oracle
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
    args: [agiToken.address, mockOracle.address, deployer, deployer],
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
  console.log("🏭 Fund Factory:", fundFactory.address);
  console.log("🪙 Mock USDC:", mockUSDC.address);
  console.log("🪙 Mock USDT:", mockUSDT.address);
  console.log("🪙 Mock WBTC:", mockWBTC.address);
};

export default deployAvanguardIndex;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags AvanguardIndex
deployAvanguardIndex.tags = ["AvanguardIndex"];
