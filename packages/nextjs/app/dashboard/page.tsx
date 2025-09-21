"use client";

import { useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { getAvalancheMainnetTokenAddresses, useAGIToken, useFundContract } from "~~/hooks/useContracts";
import { updateFundWeights, useUserFunds, useUserInvestments } from "~~/hooks/useSupabase";
import { Fund, FundToken } from "~~/lib/supabase";

// Component for individual created fund cards with rebalance functionality
const CreatedFundCard = ({
  fund,
  onUpdated,
}: {
  fund: Fund & { fund_tokens?: FundToken[] };
  onUpdated?: () => void;
}) => {
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [newWeights, setNewWeights] = useState<{ [tokenAddress: string]: number }>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const { rebalanceFund } = useFundContract(fund.fund_address);
  const mainnetTokens = getAvalancheMainnetTokenAddresses();

  // Initialize weights from fund tokens
  const initializeWeights = () => {
    if (!fund.fund_tokens) return;
    const weights: { [tokenAddress: string]: number } = {};
    fund.fund_tokens.forEach(token => {
      weights[token.token_address] = token.weight_percentage;
    });
    setNewWeights(weights);
  };

  // Handle rebalance button click
  const handleRebalanceClick = () => {
    setIsRebalancing(true);
    initializeWeights();
  };

  // Handle weight change
  const handleWeightChange = (tokenAddress: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setNewWeights(prev => ({
      ...prev,
      [tokenAddress]: numValue,
    }));
  };

  // Calculate total weight
  const totalWeight = Object.values(newWeights).reduce((sum, weight) => sum + weight, 0);

  // Handle save rebalance
  const handleSaveRebalance = async () => {
    if (Math.abs(totalWeight - 100) > 0.01) {
      alert("Total weight must equal 100%");
      return;
    }

    setIsUpdating(true);
    try {
      // Prepare tokens and weights for on-chain call
      const tokensOrdered = (fund.fund_tokens || []).map(t => t.token_address);
      const tokenAddrs: string[] = tokensOrdered.map(id => {
        if (id?.startsWith("0x") && id.length === 42) return id;
        const mapped = mainnetTokens[(id as keyof typeof mainnetTokens) || ("" as any)];
        return mapped || id;
      });
      const weightsPercent = tokensOrdered.map(id => newWeights[id] ?? 0);

      const res = await rebalanceFund(tokenAddrs as `0x${string}`[], weightsPercent);
      if (!res.success) {
        alert(`Rebalance failed: ${res.error}`);
        return;
      }

      alert(`Fund rebalance successful! TX: ${res.txHash}`);

      // Mirror new weights into Supabase for immediate UI consistency
      await updateFundWeights(fund.fund_address, newWeights);
      // Optimistically update local fund token weights for instant UI feedback
      if (fund.fund_tokens) {
        fund.fund_tokens = fund.fund_tokens.map(t => ({
          ...t,
          weight_percentage: newWeights[t.token_address] ?? t.weight_percentage,
        }));
      }
      setIsRebalancing(false);
      onUpdated?.();
    } catch (error) {
      console.error("Error updating fund weights:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Cancel rebalancing
  const handleCancelRebalance = () => {
    setIsRebalancing(false);
    setNewWeights({});
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-lg">{fund.name}</h3>
          <p className="text-sm text-gray-600">{fund.ticker}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/fund/${fund.fund_address}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            View
          </Link>
          {!isRebalancing && (
            <button onClick={handleRebalanceClick} className="text-green-600 hover:text-green-800 text-sm font-medium">
              Rebalance
            </button>
          )}
        </div>
      </div>

      {/* Token allocation display/edit */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Token Allocation:</h4>
        {fund.fund_tokens?.map(token => {
          // Convert token address to readable name
          const getTokenName = (address: string) => {
            if (address === "0x152b9d0FdC40C096757F570A51E494bd4b943E50") return "WBTC";
            if (address === "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB") return "WETH";
            return address.slice(0, 8) + "...";
          };

          return (
            <div key={token.token_address} className="flex justify-between items-center">
              <span className="text-sm font-medium">{getTokenName(token.token_address)}</span>
              {isRebalancing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={newWeights[token.token_address] || 0}
                    onChange={e => handleWeightChange(token.token_address, e.target.value)}
                    className="w-16 px-2 py-1 text-xs border rounded"
                  />
                  <span className="text-xs">%</span>
                </div>
              ) : (
                <span className="text-sm font-medium">{token.weight_percentage}%</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Rebalance controls */}
      {isRebalancing && (
        <div className="mt-4 pt-3 border-t">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium">Total: {totalWeight.toFixed(1)}%</span>
            <span className={`text-xs ${Math.abs(totalWeight - 100) < 0.01 ? "text-green-600" : "text-red-600"}`}>
              {Math.abs(totalWeight - 100) < 0.01 ? "✓ Valid" : "⚠ Must equal 100%"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveRebalance}
              disabled={Math.abs(totalWeight - 100) > 0.01 || isUpdating}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
            >
              {isUpdating ? "Updating..." : "Save"}
            </button>
            <button
              onClick={handleCancelRebalance}
              disabled={isUpdating}
              className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 py-2 px-3 rounded text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Dashboard: NextPage = () => {
  const { isConnected, address } = useAccount();
  const [timeframe, setTimeframe] = useState("1W");

  // Get real data from Supabase and contracts
  const { funds: createdFunds, refetch: refetchUserFunds } = useUserFunds(address);
  const { investments } = useUserInvestments(address);
  const { agiBalance } = useAGIToken();

  // Calculate portfolio data from real investments
  const portfolioData = {
    totalValue: investments.reduce((sum, inv) => sum + (inv.share_balance || 0), 0), // Sum of share balances
    agiBalance: agiBalance || 0, // Real AGI balance from contract
    totalPL: 0, // Will be calculated when we have price data
    plPercentage: 0, // Will be calculated when we have price data
  };

  // Transform data for display
  const myFunds = [
    ...createdFunds.map(fund => ({
      id: fund.fund_address,
      name: fund.name,
      type: "Created" as const,
      value: 0, // Will be calculated from fund TVL
      change24h: 0, // Will be calculated when we have price data
      totalPL: 0, // Will be calculated when we have price data
      status: "active" as const,
      ticker: fund.ticker,
    })),
    ...investments.map(inv => ({
      id: inv.fund?.fund_address || "",
      name: inv.fund?.name || "Unknown Fund",
      type: "Invested" as const,
      value: inv.share_balance || 0, // Share balance
      change24h: 0, // Will be calculated when we have price data
      totalPL: 0, // Will be calculated when we have price data
      status: "active" as const,
      ticker: inv.fund?.ticker || "",
    })),
  ];

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600">Please connect your wallet to view your dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Portfolio Overview */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Portfolio Value</h3>
          <p className="text-2xl font-bold">${portfolioData.totalValue.toLocaleString()}</p>
          <p className="text-sm text-green-600">+{portfolioData.plPercentage}% vs last month</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-gray-600 mb-2">AGI Balance</h3>
          <p className="text-2xl font-bold">{portfolioData.agiBalance.toLocaleString()}</p>
          {/* <p className="text-sm text-gray-500">≈ ${(portfolioData.agiBalance * 10.345).toFixed(2)} USD</p> */}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total P/L</h3>
          <p className="text-2xl font-bold text-green-600">+${portfolioData.totalPL.toLocaleString()}</p>
          <p className="text-sm text-gray-500">All time</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Actions</h3>
          <div className="space-y-2">
            <Link
              href="/create"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium text-center transition-colors"
            >
              Create New Fund
            </Link>
            <Link
              href="/invest"
              className="block w-full border border-gray-300 hover:bg-gray-50 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium text-center transition-colors"
            >
              Invest in a Fund
            </Link>
          </div>
        </div>
      </div>

      {/* Portfolio Performance Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Portfolio Performance</h2>
          <div className="flex gap-2">
            {["1D", "1W", "1M", "1Y", "ALL"].map(period => (
              <button
                key={period}
                onClick={() => setTimeframe(period)}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  timeframe === period ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        {/* Placeholder for chart */}
        <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Portfolio performance chart will be displayed here</p>
        </div>
      </div>

      {/* Created Funds & My Funds */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Created Funds */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h2 className="text-xl font-semibold mb-6">Created Funds</h2>

          <div className="space-y-4">
            {createdFunds.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">You haven&apos;t created any funds yet.</p>
                <Link
                  href="/create"
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                >
                  Create Your First Fund
                </Link>
              </div>
            ) : (
              createdFunds.map(fund => (
                <CreatedFundCard key={fund.fund_address} fund={fund} onUpdated={() => refetchUserFunds()} />
              ))
            )}
          </div>
        </div>

        {/* My Funds */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h2 className="text-xl font-semibold mb-6">My Funds</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-600 border-b">
                  <th className="pb-3">Fund Name</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Value</th>
                  <th className="pb-3">24h Change</th>
                  <th className="pb-3">Total P/L</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {myFunds.map((fund, index) => (
                  <tr key={index} className="border-b last:border-b-0">
                    <td className="py-4 font-medium">{fund.name}</td>
                    <td className="py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          fund.type === "Created" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                        }`}
                      >
                        {fund.type}
                      </span>
                    </td>
                    <td className="py-4">${fund.value.toLocaleString()}</td>
                    <td className="py-4">
                      <span className={fund.change24h >= 0 ? "text-green-600" : "text-red-600"}>
                        {fund.change24h >= 0 ? "+" : ""}
                        {fund.change24h}%
                      </span>
                    </td>
                    <td className="py-4 text-green-600">+${fund.totalPL.toLocaleString()}</td>
                    <td className="py-4">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        {fund.type === "Created" ? "Manage" : "Details"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
