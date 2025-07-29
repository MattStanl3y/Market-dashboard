'use client'

import { useState } from 'react'
import { Search, TrendingUp } from 'lucide-react'
import MarketInsights from '@/components/MarketInsights'
import SearchBar from '@/components/SearchBar'
import StockCard from '@/components/StockCard'
import AIInsights from '@/components/AIInsights'
import StockChart from '@/components/StockChart'
import WatchList from '@/components/WatchList'
import { apiClient, type StockData } from '@/lib/api'

export default function Home() {
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [currentSymbol, setCurrentSymbol] = useState<string | null>(null)
  const [currentPeriod, setCurrentPeriod] = useState<string>('1y')
  const [chartData, setChartData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showStockAnalysis, setShowStockAnalysis] = useState(false)

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

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl p-4">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <TrendingUp className="w-8 h-8 mr-3 text-blue-600" />
                Market Intelligence
              </h1>
              <p className="text-gray-600">AI-powered insights to stay ahead of the market</p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Quick Stock Search */}
              <div className="relative">
                <SearchBar onSearch={handleSearch} loading={loading} />
              </div>
              
              <button
                onClick={() => setShowStockAnalysis(!showStockAnalysis)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showStockAnalysis 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Search className="w-4 h-4 inline mr-2" />
                Stock Analysis
              </button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main Content - Market Insights */}
          <div className={`${showStockAnalysis ? 'xl:col-span-2' : 'xl:col-span-4'} transition-all duration-300`}>
            <MarketInsights onSymbolSelect={handleSymbolSelect} />
          </div>

          {/* Stock Analysis Panel - Only show when active */}
          {showStockAnalysis && (
            <div className="xl:col-span-2 space-y-6 transition-all duration-300">
              {/* Error Display */}
              {error && (
                <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                  Error: {error}
                </div>
              )}

              {/* Stock Data Display */}
              {(stockData || loading) && (
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
              )}
              
              {/* Watchlist */}
              <WatchList 
                onSymbolSelect={handleSearch}
                currentSymbol={currentSymbol || undefined}
              />
              
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
          )}
        </div>
      </div>
    </main>
  )
}