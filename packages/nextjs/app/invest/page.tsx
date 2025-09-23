"use client";

import { useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useFunds } from "~~/hooks/useSupabase";

const Invest: NextPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("performance");
  const [category, setCategory] = useState("all");
  const [riskLevel, setRiskLevel] = useState("all");

  // Get real funds data from Supabase
  const { funds: realFunds, loading } = useFunds();

  // Transform real data to match UI expectations
  const funds = realFunds.map(fund => ({
    id: fund.fund_address, // Use fund address as ID
    name: fund.name,
    creator: fund.creator_address.slice(0, 6) + "..." + fund.creator_address.slice(-4),
    category: "DeFi", // This could be derived from fund tokens or stored separately
    riskLevel: "Medium Risk", // This could be calculated based on token volatility
    yearReturn: 0, // Will be calculated when we have price data
    assets:
      fund.fund_tokens?.map(token => {
        // Convert token addresses to readable names
        if (token.token_address === "0x152b9d0FdC40C096757F570A51E494bd4b943E50") return "BTC.b";
        if (token.token_address === "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB") return "WETH.e";
        if (token.token_address === "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E") return "USDC";
        if (token.token_address === "0xc7198437980c041c805A1EDcbA50c1Ce5db95118") return "USDT.e";
        return token.token_address.slice(0, 6);
      }) || [],
    apy: 0, // Will be calculated when we have performance data
    tvl: 0, // Will be calculated when we have fund value data
    description: fund.description || `A diversified index fund created by ${fund.creator_address.slice(0, 6)}...`,
    ticker: fund.ticker,
    fundAddress: fund.fund_address, // Add fund address for routing
  }));

  // Only use real funds from Supabase
  const displayFunds = funds;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading funds...</p>
        </div>
      </div>
    );
  }

  const filteredFunds = displayFunds.filter(fund => {
    const matchesSearch =
      fund.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fund.creator.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = category === "all" || fund.category.toLowerCase() === category.toLowerCase();
    const matchesRisk = riskLevel === "all" || fund.riskLevel.toLowerCase().includes(riskLevel.toLowerCase());

    return matchesSearch && matchesCategory && matchesRisk;
  });

  const sortedFunds = [...filteredFunds].sort((a, b) => {
    switch (sortBy) {
      case "performance":
        return b.yearReturn - a.yearReturn;
      case "tvl":
        return b.tvl - a.tvl;
      case "apy":
        return b.apy - a.apy;
      default:
        return 0;
    }
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Explore Indexes</h1>
        <p className="text-gray-600">
          Discover, analyze, and invest in a diverse range of cryptocurrency index funds created by the community.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm border mb-8">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, symbol, or creator"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="performance">Sort by Performance</option>
              <option value="tvl">Sort by TVL</option>
              <option value="apy">Sort by APY</option>
            </select>

            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              <option value="defi">DeFi</option>
              <option value="ai">AI</option>
              <option value="gaming">Gaming</option>
              <option value="nft">NFT</option>
              <option value="metaverse">Metaverse</option>
            </select>

            <select
              value={riskLevel}
              onChange={e => setRiskLevel(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* Fund Cards */}
      {sortedFunds.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No funds available</h3>
          <p className="text-gray-500 mb-4">Be the first to create an index fund!</p>
          <Link
            href="/create"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            Create Fund
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedFunds.map(fund => (
            <div key={fund.id} className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow">
              <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{fund.name}</h3>
                    <p className="text-sm text-gray-600">Created by {fund.creator}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                      {fund.category}
                    </span>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        fund.riskLevel.includes("Low")
                          ? "bg-green-100 text-green-800"
                          : fund.riskLevel.includes("Medium")
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {fund.riskLevel}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">1Y Return</p>
                    <p className={`font-semibold ${fund.yearReturn >= 0 ? "text-green-600" : "text-green-600"}`}>
                      coming soon
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">APY</p>
                    <p className="font-semibold">coming soon</p>
                  </div>
                </div>

                {/* Assets */}
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Assets</p>
                  <div className="flex gap-2">
                    {fund.assets.map((asset, index) => (
                      <div key={index} className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium">{asset.slice(0, 2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-4">{fund.description}</p>

                {/* Action Button */}
                <Link
                  href={`/fund/${fund.id}`}
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-center font-medium transition-colors"
                >
                  View Index
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center mt-12">
        <div className="flex gap-2">
          <button className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">←</button>
          <button className="px-3 py-2 bg-blue-600 text-white rounded-lg">1</button>
          <button className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">2</button>
          <button className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">3</button>
          <button className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">...</button>
          <button className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">8</button>
          <button className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">→</button>
        </div>
      </div>
    </div>
  );
};

export default Invest;
