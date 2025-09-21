import { decodeEventLog, parseEther } from "viem";
import type { Abi } from "viem";
import { useAccount } from "wagmi";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { useScaffoldContract, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

// Hook to interact with FundFactory contract
export const useFundFactory = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  // Get the FundFactory contract instance
  const { data: fundFactory } = useScaffoldContract({
    contractName: "FundFactory",
  });

  // Read total funds count
  const { data: totalFunds } = useScaffoldReadContract({
    contractName: "FundFactory",
    functionName: "getTotalFunds",
  });

  // We'll write with a minimal ABI to support the updated signature (with weightages)
  const { writeContractAsync, isPending: isCreatingFund } = useWriteContract();

  // Function to create a new fund
  const createNewFund = async (fundName: string, fundTicker: string, tokens: string[]) => {
    if (!address) throw new Error("Wallet not connected");

    try {
      if (!fundFactory?.address) throw new Error("FundFactory address not found");

      // The FundFactory createFund function only takes fundName, fundTicker, and tokens
      // Weightages are set to equal proportions by default in the contract
      const fundFactoryAbi = [
        {
          inputs: [
            { internalType: "string", name: "fundName", type: "string" },
            { internalType: "string", name: "fundTicker", type: "string" },
            { internalType: "address[]", name: "tokens", type: "address[]" },
          ],
          name: "createFund",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
      ] as const;

      console.log("fund inputs", fundName, fundTicker, tokens as `0x${string}`[]);

      const result = await writeContractAsync({
        address: fundFactory.address as `0x${string}`,
        abi: fundFactoryAbi,
        functionName: "createFund",
        args: [fundName, fundTicker, tokens as `0x${string}`[]],
      });

      if (!result) {
        alert("Error creating fund");
        return { success: false, error: "Error creating fund" };
      }

      // If we have a public client and contract metadata, parse FundCreated from the receipt
      if (publicClient && fundFactory?.address && fundFactory?.abi) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: result });

        let createdFundAddress: string | undefined;
        let createdFundId: number | undefined;

        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== fundFactory.address.toLowerCase()) continue;
          try {
            const decoded = decodeEventLog({
              abi: fundFactory.abi as Abi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === "FundCreated") {
              const args = decoded.args as unknown as {
                fundId: bigint;
                creator: string;
                fundName: string;
                fundTicker: string;
                fundAddress: string;
                underlyingTokens: string[];
              };
              createdFundAddress = args.fundAddress;
              createdFundId = Number(args.fundId);
              break;
            }
          } catch (error) {
            console.log("error parsing event", error);
          }
        }

        return { success: true, txHash: result, fundAddress: createdFundAddress, fundId: createdFundId };
      }

      // Fallback: return only tx hash
      return { success: true, txHash: result };
    } catch (error) {
      console.error("Error creating fund:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  };

  return {
    fundFactory,
    totalFunds: totalFunds ? Number(totalFunds) : 0,
    createNewFund,
    isCreatingFund,
  };
};

// Hook to interact with AGI Token contract
export const useAGIToken = () => {
  const { address } = useAccount();

  // Also get FundFactory to use its live address for allowance/approve
  const { data: fundFactory } = useScaffoldContract({ contractName: "FundFactory" });
  const fundFactoryAddress = fundFactory?.address || "0x0000000000000000000000000000000000000000";

  // Read AGI balance
  const { data: agiBalance } = useScaffoldReadContract({
    contractName: "AGIToken",
    functionName: "balanceOf",
    args: [address || "0x0000000000000000000000000000000000000000"] as const,
  });

  // Read AGI allowance for FundFactory
  const { data: agiAllowance } = useScaffoldReadContract({
    contractName: "AGIToken",
    functionName: "allowance",
    args: [address || "0x0000000000000000000000000000000000000000", fundFactoryAddress] as const,
  });

  // Write function to approve AGI spending
  const { writeContractAsync: approveAGI, isPending: isApprovingAGI } = useScaffoldWriteContract("AGIToken");

  // Function to approve AGI spending for fund creation
  const approveAGIForFundCreation = async () => {
    if (!address) throw new Error("Wallet not connected");

    try {
      if (!fundFactory || !fundFactory.address) throw new Error("FundFactory address not found");
      const result = await approveAGI({
        functionName: "approve",
        args: [fundFactory.address, BigInt("1000000000000000000000")] as const, // 1000 AGI
      });
      return { success: true, txHash: result };
    } catch (error) {
      console.error("Error approving AGI:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  };

  return {
    agiBalance: address && agiBalance ? Number(agiBalance) / 1e18 : 0, // Convert from wei
    agiAllowance: address && agiAllowance ? Number(agiAllowance) / 1e18 : 0,
    approveAGIForFundCreation,
    isApprovingAGI,
  };
};

// Hook to interact with individual Fund contracts
export const useFundContract = (fundAddress?: string) => {
  const { address } = useAccount();

  // Fund contract ABI (simplified - just the functions we need)
  const fundABI = [
    {
      inputs: [],
      name: "buy",
      outputs: [],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [{ internalType: "uint256", name: "fundTokenAmount", type: "uint256" }],
      name: "sell",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "account", type: "address" }],
      name: "balanceOf",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "getCurrentFundValue",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        { internalType: "address[]", name: "_tokens", type: "address[]" },
        { internalType: "uint256[]", name: "_proportions", type: "uint256[]" },
      ],
      name: "setProportions",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [],
      name: "totalSupply",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
  ] as const;

  // Read fund token balance for user
  const { data: fundTokenBalance, refetch: refetchBalance } = useReadContract({
    address: fundAddress as `0x${string}`,
    abi: fundABI,
    functionName: "balanceOf",
    args: [address || "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!(fundAddress && address) },
  });

  // Read current fund value
  const { data: currentFundValue, refetch: refetchFundValue } = useReadContract({
    address: fundAddress as `0x${string}`,
    abi: fundABI,
    functionName: "getCurrentFundValue",
    query: { enabled: !!fundAddress },
  });

  // Read total supply
  const { data: totalSupply, refetch: refetchTotalSupply } = useReadContract({
    address: fundAddress as `0x${string}`,
    abi: fundABI,
    functionName: "totalSupply",
    query: { enabled: !!fundAddress },
  });

  // Write contract hook for transactions
  const { writeContractAsync, isPending: isBuyingTokens } = useWriteContract();

  // Function to buy fund tokens
  const buyFundTokens = async (avaxAmount: string) => {
    if (!address || !fundAddress) throw new Error("Wallet not connected or fund address missing");

    try {
      const result = await writeContractAsync({
        address: fundAddress as `0x${string}`,
        abi: fundABI,
        functionName: "buy",
        value: parseEther(avaxAmount),
      });
      // Wait briefly and refetch reads to update UI without reload
      setTimeout(() => {
        refetchBalance();
        refetchFundValue();
        refetchTotalSupply();
      }, 500);
      return { success: true, txHash: result };
    } catch (error) {
      console.error("Error buying fund tokens:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  };

  // Function to sell fund tokens
  const sellFundTokens = async (fundTokenAmount: string) => {
    if (!address || !fundAddress) throw new Error("Wallet not connected or fund address missing");

    try {
      const result = await writeContractAsync({
        address: fundAddress as `0x${string}`,
        abi: fundABI,
        functionName: "sell",
        args: [parseEther(fundTokenAmount)],
      });
      setTimeout(() => {
        refetchBalance();
        refetchFundValue();
        refetchTotalSupply();
      }, 500);
      return { success: true, txHash: result };
    } catch (error) {
      console.error("Error selling fund tokens:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  };

  // Function to rebalance fund weights (owner only)
  const rebalanceFund = async (tokens: string[], weightagesPercent: number[]) => {
    if (!address || !fundAddress) throw new Error("Wallet not connected or fund address missing");
    try {
      // setProportions expects percentages (0-100), not basis points
      const result = await writeContractAsync({
        address: fundAddress as `0x${string}`,
        abi: fundABI,
        functionName: "setProportions",
        args: [tokens as `0x${string}`[], weightagesPercent.map(w => BigInt(Math.round(w)))],
      });
      setTimeout(() => {
        refetchBalance();
        refetchFundValue();
        refetchTotalSupply();
      }, 500);
      return { success: true, txHash: result };
    } catch (error) {
      console.error("Error rebalancing fund:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  };

  return {
    fundTokenBalance: fundTokenBalance ? Number(fundTokenBalance) / 1e18 : 0,
    currentFundValue: currentFundValue ? Number(currentFundValue) / 1e18 : 0,
    totalSupply: totalSupply ? Number(totalSupply) / 1e18 : 0,
    buyFundTokens,
    sellFundTokens,
    rebalanceFund,
    isBuyingTokens,
    refresh: () => {
      refetchBalance();
      refetchFundValue();
      refetchTotalSupply();
    },
  };
};

// Helper function to get real Avalanche Fuji testnet token addresses
export const getAvalancheFujiTokenAddresses = () => {
  return {
    ELK: "0x20E65F58Fca6D9442189d66B779A0A4FC5eDc3DD",
    COW: "0xf0D530cD6612b95c388c07C1BED5fe0B835cBF4c",
    TUR: "0xED29d041160060de2d540decD271D085Fec3e450",
    PNG: "0xa79FD4Aa2bdD5Df395Ad82FA61dB2B2201244188",
    WAVAX: "0xd00ae08403B9bbb9124bB305C09058E32C39A48c",
    JOE: "0xEa81F6972aDf76765Fd1435E119Acc0Aafc80BeA",
    UNI: "0xf4E0A9224e8827dE91050b528F34e2F99C82Fbf6",
    SUSHI: "0x72C14f7fB8B14040dA6E5b1B9D1B9438ebD85F58",
  };
};

// Helper function to get real Avalanche Mainnet token addresses
export const getAvalancheMainnetTokenAddresses = () => {
  return {
    WAVAX: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    WBTC: "0x152b9d0FdC40C096757F570A51E494bd4b943E50",
    WETH: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB",
  };
};
