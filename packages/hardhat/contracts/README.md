# Avalanche Index Fund & Rebalancing Contracts

This folder contains the full set of Solidity contracts and a Foundry script to deploy, manage, and rebalance a simple two-asset index fund on the Avalanche C-Chain.

## Contracts

- `Fund.sol`: The core contract for the index fund. Manages deposits, withdrawals, and rebalancing logic.
- `FundFactory.sol`: Deploys new instances of the `Fund` contract.
- `ChainlinkOracle.sol`: An on-chain oracle that fetches token prices from Chainlink data feeds.
- `AGIToken.sol`: An ERC20 token used for paying fund creation fees.
- `IOracle.sol`: The interface for the price oracle.

## Deployment Script

- `FullFlow.s.sol`: A Foundry script that handles the entire end-to-end process:
    1.  Deploys all necessary contracts (`AGIToken`, `ChainlinkOracle`, `FundFactory`).
    2.  Configures the oracle with the correct mainnet price feeds.
    3.  Creates a new `Fund` instance with WBTC and WETH.
    4.  Simulates a user buying into the fund.
    5.  Executes a rebalance to a 70/30 (WBTC/WETH) allocation.
    6.  Simulates the user selling their shares.

## How to Use

### Prerequisites

1.  **Foundry:** You must have Foundry installed. Follow the instructions [here](https://book.getfoundry.sh/getting-started/installation).
2.  **Node.js/npm:** Required for managing dependencies.
3.  **Avalanche Wallet:** An account with AVAX to pay for gas fees.

### Setup

1.  **Install Dependencies:** From the root of this project, run the following commands to install the necessary contract libraries (OpenZeppelin and Chainlink):
    ```bash
    forge install OpenZeppelin/openzeppelin-contracts
    forge install smartcontractkit/chainlink-brownie-contracts
    ```

2.  **Configure Environment:** Rename the included `.env.example` file to `.env` and fill in the following values:
    ```
    MAINNET_RPC_URL=https://api.avax.network/ext/bc/C/rpc
    PRIVATE_KEY=YOUR_WALLET_PRIVATE_KEY
    ```
    **IMPORTANT:** The `PRIVATE_KEY` is for the wallet you will use to deploy the contracts and pay for gas.

3.  **Configure Foundry Remappings:** Create or update a `foundry.toml` file in the root of the project with the following content to ensure the compiler can find the installed libraries:
    ```toml
    [profile.default]
    src = "."
    out = "out"
    libs = ["lib"]
    optimizer = true
    optimizer_runs = 200
    via_ir = true
    remappings = [
        "@chainlink/contracts/=lib/chainlink-brownie-contracts/contracts/",
        "@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/"
    ]
    ```

### Run the Script

Execute the full flow on the Avalanche mainnet with the following command:

```bash
source .env && forge script FullFlow.s.sol --rpc-url $MAINNET_RPC_URL -vvvv --broadcast --private-key $PRIVATE_KEY --verify
```

This command will compile the contracts, deploy them to the mainnet, run through all the steps in the script, and automatically verify the contracts on Snowtrace.
