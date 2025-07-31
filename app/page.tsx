'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, AlertCircle } from 'lucide-react'
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
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 animate-in fade-in duration-500">
      <div className="mx-auto max-w-7xl p-4 lg:p-6">
        <header className="mb-8 text-center">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-slate-100 flex items-center justify-center mb-2">
              <TrendingUp className="w-10 h-10 mr-4 text-blue-400" />
              MarketPulse
            </h1>
            <p className="text-slate-400 text-lg">Real-time financial insights and market analysis</p>
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
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 text-red-300 rounded-lg backdrop-blur-sm animate-in slide-in-from-top duration-300">
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