'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, AlertCircle, Zap } from 'lucide-react'
import MarketInsights from '@/components/MarketInsights'
import SearchBar from '@/components/SearchBar'
import AIStockPicks from '@/components/AIStockPicks'

export default function Home() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSearch = async (symbol: string) => {
    setLoading(true)
    // Navigate to the dedicated stock page
    router.push(`/stock/${symbol.toUpperCase()}`)
    setLoading(false)
  }

  const handleSymbolSelect = (symbol: string) => {
    handleSearch(symbol)
  }


  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 animate-in fade-in duration-500">
      <div className="mx-auto max-w-7xl p-4 lg:p-6">
        <header className="mb-12 text-center">
          <div className="mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-slate-600 rounded-full blur-lg opacity-30 animate-pulse"></div>
                <div className="relative bg-gradient-to-r from-blue-600 to-slate-700 p-3 rounded-full">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-slate-300 to-blue-400 bg-clip-text text-transparent mb-3">
              MarketPulse
            </h1>
            <p className="text-gray-300 text-xl font-light">Real-time financial insights and market analysis</p>
            <div className="flex items-center justify-center mt-4 gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-slate-400 font-medium">Live Market Data</span>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
          </div>
          
          {/* Centered Stock Search */}
          <div className="flex justify-center">
            <div className="w-full max-w-2xl">
              <SearchBar onSearch={handleSearch} loading={loading} />
            </div>
          </div>
        </header>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl backdrop-blur-sm animate-in slide-in-from-top duration-300">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-red-400" />
              <span>Error: {error}</span>
            </div>
          </div>
        )}

        {/* AI Stock Picks Carousel */}
        <AIStockPicks 
          onSymbolSelect={handleSymbolSelect}
        />

        {/* Main Content - News Feed */}
        <div className="w-full">
          <MarketInsights onSymbolSelect={handleSymbolSelect} />
        </div>
      </div>
    </main>
  )
}