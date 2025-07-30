'use client'

import { useState, useEffect } from 'react'
import { Search, TrendingUp, X, BarChart3, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import MarketInsights from '@/components/MarketInsights'
import SearchBar from '@/components/SearchBar'
import StockCard from '@/components/StockCard'
import AIInsights from '@/components/AIInsights'
import StockChart from '@/components/StockChart'
import WatchList from '@/components/WatchList'
import { apiClient, type StockData, type MarketInsights as MarketInsightsType } from '@/lib/api'

export default function Home() {
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [currentSymbol, setCurrentSymbol] = useState<string | null>(null)
  const [currentPeriod, setCurrentPeriod] = useState<string>('1y')
  const [chartData, setChartData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showStockAnalysis, setShowStockAnalysis] = useState(false)
  const [marketInsights, setMarketInsights] = useState<MarketInsightsType | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [daysBack, setDaysBack] = useState(1)

  const handleSearch = async (symbol: string) => {
    setLoading(true)
    setError(null)
    setCurrentSymbol(symbol.toUpperCase())
    setShowStockAnalysis(true)
    
    try {
      const data = await apiClient.getStock(symbol)
      setStockData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stock data')
      setStockData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSymbolSelect = (symbol: string) => {
    handleSearch(symbol)
  }

  const fetchMarketInsights = async (days: number = daysBack) => {
    setInsightsLoading(true)
    
    try {
      const data = await apiClient.getMarketInsights(days)
      setMarketInsights(data)
    } catch (err) {
      console.error('Failed to fetch market insights:', err)
    } finally {
      setInsightsLoading(false)
    }
  }

  useEffect(() => {
    fetchMarketInsights()
  }, [daysBack])

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return <TrendingUp className="w-5 h-5 text-green-400" />
      case 'bearish':
        return <TrendingDown className="w-5 h-5 text-red-400" />
      default:
        return <Minus className="w-5 h-5 text-gray-400" />
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return 'text-green-400 bg-green-500/20 border-green-500/30'
      case 'bearish':
        return 'text-red-400 bg-red-500/20 border-red-500/30'
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500/30'
    }
  }

  const handleDaysBackChange = (days: number) => {
    setDaysBack(days)
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-slate-900">
      <div className="mx-auto max-w-7xl p-4">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center">
                  <TrendingUp className="w-8 h-8 mr-3 text-blue-400" />
                  Market Intelligence
                </h1>
                <p className="text-gray-300">AI-powered insights to stay ahead of the market</p>
              </div>
              
              {/* Market Sentiment Icon */}
              {marketInsights && !insightsLoading && (
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getSentimentColor(marketInsights.analysis.market_sentiment)}`}>
                  {getSentimentIcon(marketInsights.analysis.market_sentiment)}
                  <span className="ml-2 capitalize">{marketInsights.analysis.market_sentiment}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              {/* Time Filter Buttons */}
              <div className="flex bg-gray-700/50 rounded-lg p-1">
                <button
                  onClick={() => handleDaysBackChange(1)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    daysBack === 1 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => handleDaysBackChange(7)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    daysBack === 7 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => handleDaysBackChange(30)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    daysBack === 30 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
                  }`}
                >
                  Monthly
                </button>
              </div>
              
              <button
                onClick={() => fetchMarketInsights()}
                disabled={insightsLoading}
                className="p-2 hover:bg-gray-700/50 rounded-full disabled:opacity-50 text-gray-300 hover:text-white transition-colors"
                title="Refresh insights"
              >
                <RefreshCw className={`w-4 h-4 ${insightsLoading ? 'animate-spin' : ''}`} />
              </button>
              
              {/* Quick Stock Search */}
              <div className="relative">
                <SearchBar onSearch={handleSearch} loading={loading} />
              </div>
            </div>
          </div>
        </header>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 text-red-300 rounded-lg backdrop-blur-sm">
            Error: {error}
          </div>
        )}

        {/* Stock Data Display */}
        {(stockData || loading) && (
          <div className="mb-8 transition-all duration-300 ease-in-out transform">
            <StockCard 
              data={stockData || {
                symbol: '',
                company_name: '',
                current_price: 0,
                change: 0,
                change_percent: 0
              }} 
              period={currentPeriod}
              chartData={chartData}
              loading={loading}
            />
          </div>
        )}
        
        {/* Split Screen Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-4 lg:grid-cols-3 gap-6">
          {/* Left Panel - Watchlist */}
          <div className="xl:col-span-1 lg:col-span-1 order-1 lg:order-1">
            <WatchList 
              onSymbolSelect={handleSearch}
              currentSymbol={currentSymbol || undefined}
            />
          </div>
          
          {/* Center Panel - Market Insights */}
          <div className="xl:col-span-2 lg:col-span-2 order-2 lg:order-2">
            <MarketInsights onSymbolSelect={handleSymbolSelect} />
          </div>
          
          {/* Right Panel - Stock Analysis */}
          <div className="xl:col-span-1 lg:col-span-3 order-3 lg:order-3 space-y-6">
            {/* Chart */}
            <StockChart 
              symbol={currentSymbol || undefined} 
              onPeriodChange={(period, data) => {
                setCurrentPeriod(period)
                setChartData(data)
              }}
            />
            
            {/* Stock-specific AI Insights */}
            <AIInsights symbol={currentSymbol || undefined} />
          </div>
        </div>
      </div>
    </main>
  )
}