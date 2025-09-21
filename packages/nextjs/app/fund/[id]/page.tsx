"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ArrowLeftIcon, CheckCircleIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { useCopyToClipboard } from "~~/hooks/scaffold-eth/useCopyToClipboard";
import { useFundContract } from "~~/hooks/useContracts";
import { investInFund, useFund } from "~~/hooks/useSupabase";

const FundDetail = (props: any) => {
  const { params } = props as { params: Promise<{ id: string }> };
  const resolvedParams = use(params);
  const { isConnected, address } = useAccount();
  const [activeTab, setActiveTab] = useState("overview");
  const [amount, setAmount] = useState("");
  const [action, setAction] = useState("buy");
  const [isInvesting, setIsInvesting] = useState(false);

  // Get real fund data from Supabase using fund address
  const { fund, loading } = useFund(resolvedParams.id); // resolvedParams.id is now the fund address
  const isLoadingBalance = !fund || loading; // simple loading flag for balance section

  // Get real contract data using the fund address
  const { fundTokenBalance, currentFundValue, totalSupply, buyFundTokens, sellFundTokens, isBuyingTokens, refresh } =
    useFundContract(resolvedParams.id);

  // Copy functionality
  const { copyToClipboard, isCopiedToClipboard } = useCopyToClipboard();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading fund details...</p>
        </div>
      </div>
    );
  }

  if (!fund) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Fund Not Found</h2>
          <p className="text-gray-600 mb-4">The fund you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/invest" className="text-blue-600 hover:text-blue-800">
            ← Back to Browse Funds
          </Link>
        </div>
      </div>
    );
  }

  // Transform real data for display
  const fundData = {
    id: fund.fund_address,
    name: fund.name,
    description: fund.description || `description not available creator: ${fund.creator_address.slice(0, 6)}`,
    creator: fund.creator_address.slice(0, 6) + "..." + fund.creator_address.slice(-4),
    tvl: currentFundValue * totalSupply, // Real TVL calculation
    currentPrice: totalSupply > 0 ? currentFundValue / totalSupply : 0, // Real price per share
    totalSupply: totalSupply, // Real total supply from contract
    userBalance: fundTokenBalance, // Real user balance from contract
    holdings:
      fund.fund_tokens?.map(token => ({
        token: token.token_address,
        allocation: token.weight_percentage,
        price: "Coming Soon" as string | number, // Price data integration pending
        value: "Coming Soon" as string | number, // Value calculation integration pending
      })) || [],
    ticker: fund.ticker,
    fundAddress: fund.fund_address,
  };

  const estimatedFees = parseFloat(amount) * 0.01 || 0;
  const total = parseFloat(amount) + estimatedFees || 0;

  const handleInvest = async () => {
    if (!address || !amount || parseFloat(amount) <= 0) return;

    setIsInvesting(true);
    try {
      let result;

      if (action === "buy") {
        // Buy fund tokens with AVAX
        result = await buyFundTokens(amount);

        if (result.success) {
          // Also record in Supabase for tracking
          await investInFund(address, fund.fund_address, parseFloat(amount));
          alert(`Successfully invested ${amount} AVAX!`);
        }
      } else {
        // Sell fund tokens
        result = await sellFundTokens(amount);

        if (result.success) {
          alert(`Successfully sold ${amount} fund tokens!`);
        }
      }

      if (result.success) {
        setAmount("");
        // ensure UI updates immediately
        refresh();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Error investing:", error);
      alert("An unexpected error occurred");
    } finally {
      setIsInvesting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/invest" className="flex items-center text-blue-600 hover:text-blue-800 mb-4">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Browse / Index Fund Details
        </Link>
      </div>

      {/* Fund Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{fundData.name}</h1>
        <p className="text-gray-600 mb-4">{fundData.description}</p>

        {/* Fund Address with Copy */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-700">Fund Address: </span>
            <span className="text-sm font-mono text-gray-800">{fundData.fundAddress}</span>
          </div>
          <button
            onClick={() => copyToClipboard(fundData.fundAddress)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors text-sm font-medium"
          >
            {isCopiedToClipboard ? (
              <>
                <CheckCircleIcon className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <DocumentDuplicateIcon className="h-4 w-4" />
                Copy Address
              </>
            )}
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Value Locked</h3>
          <p className="text-2xl font-bold">${fundData.tvl.toLocaleString()}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Current Price</h3>
          <p className="text-2xl font-bold">${fundData.currentPrice}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Supply</h3>
          <p className="text-2xl font-bold">{fundData.totalSupply.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="border-b">
              <nav className="flex">
                {[
                  { id: "overview", label: "Overview" },
                  { id: "holdings", label: "Holdings" },
                  { id: "performance", label: "Performance" },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-6 py-4 font-medium text-sm border-b-2 ${
                      activeTab === tab.id
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-6">
              {activeTab === "overview" && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Fund Overview</h3>
                  <p className="text-gray-600 mb-4">{fundData.description}</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Fund Creator</h4>
                      <p className="text-gray-600">{fundData.creator}</p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Strategy</h4>
                      <p className="text-gray-600">Equal-weighted index of top DeFi tokens</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "holdings" && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Holdings</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-gray-600 border-b">
                          <th className="pb-3">Token</th>
                          <th className="pb-3">Allocation</th>
                          <th className="pb-3">Price</th>
                          <th className="pb-3">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fundData.holdings.map((holding, index) => (
                          <tr key={index} className="border-b last:border-b-0">
                            <td className="py-4 font-medium">{holding.token}</td>
                            <td className="py-4">{holding.allocation}%</td>
                            <td className="py-4">
                              {typeof holding.price === "string"
                                ? holding.price
                                : `$${(holding.price as number).toFixed(2)}`}
                            </td>
                            <td className="py-4">
                              {typeof holding.value === "string"
                                ? holding.value
                                : `$${(holding.value as number).toLocaleString()}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === "performance" && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Performance</h3>
                  <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500">Performance chart will be displayed here</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Buy/Sell Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border p-6 sticky top-8">
            <h3 className="text-lg font-semibold mb-4">Buy / Sell</h3>

            {!isConnected ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">Connect your wallet to trade</p>
              </div>
            ) : (
              <>
                {/* Action Tabs */}
                <div className="flex mb-4">
                  <button
                    onClick={() => setAction("buy")}
                    className={`flex-1 py-2 px-4 rounded-l-lg font-medium ${
                      action === "buy" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setAction("sell")}
                    className={`flex-1 py-2 px-4 rounded-r-lg font-medium ${
                      action === "sell" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Sell
                  </button>
                </div>

                {/* Amount Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount ({action === "buy" ? "AVAX" : "Fund Tokens"})
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder={action === "buy" ? "Enter AVAX amount" : "Enter fund tokens to sell"}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Balance */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600">Your Balance</p>
                  {isLoadingBalance ? (
                    <p className="text-sm text-gray-500">Fetching balance...</p>
                  ) : (
                    <p className="font-semibold">
                      {fundData.userBalance.toFixed(4)} {fund.ticker}
                    </p>
                  )}
                </div>

                {/* Fee Breakdown */}
                {amount && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Estimated Fees</span>
                      <span>{estimatedFees.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>{total.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <button
                  onClick={handleInvest}
                  disabled={!amount || parseFloat(amount) <= 0 || isInvesting || isBuyingTokens}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                    action === "buy"
                      ? "bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300"
                      : "bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-300"
                  } disabled:cursor-not-allowed`}
                >
                  {isInvesting || isBuyingTokens ? "Processing..." : action === "buy" ? "Buy" : "Sell"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FundDetail;
