'use client'

import { useState } from 'react'
import SearchBar from '@/components/SearchBar'
import StockCard from '@/components/StockCard'
import { apiClient, type StockData } from '@/lib/api'

export default function Home() {
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (symbol: string) => {
    setLoading(true)
    setError(null)
    
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

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Market Dashboard</h1>
          <p className="text-gray-600">AI-Powered Financial Market Analysis</p>
        </header>

        {/* Search Section */}
        <div className="mb-8 flex justify-center">
          <SearchBar onSearch={handleSearch} loading={loading} />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            Error: {error}
          </div>
        )}

        {/* Stock Data Display */}
        {stockData && !loading && (
          <div className="mb-8">
            <StockCard data={stockData} />
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Panel - Watchlist */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Watchlist</h2>
              <p className="text-gray-500">Coming soon...</p>
            </div>
          </div>
          
          {/* Center Panel - Charts */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Stock Chart</h2>
              <p className="text-gray-500">Interactive charts coming soon...</p>
            </div>
          </div>
          
          {/* Right Panel - AI Insights */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">AI Insights</h2>
              <p className="text-gray-500">AI-powered analysis coming soon...</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}