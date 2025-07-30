'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, AlertCircle } from 'lucide-react'
import StockCard from '@/components/StockCard'
import StockChart from '@/components/StockChart'
import AIInsights from '@/components/AIInsights'
import { apiClient, type StockData } from '@/lib/api'

export default function StockPage() {
  const params = useParams()
  const router = useRouter()
  const symbol = typeof params.symbol === 'string' ? params.symbol.toUpperCase() : ''
  
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [currentPeriod, setCurrentPeriod] = useState<string>('1y')
  const [chartData, setChartData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return

    const fetchStockData = async () => {
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

    fetchStockData()
  }, [symbol])

  if (!symbol) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-100 mb-4">Invalid Stock Symbol</h1>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950">
      <div className="mx-auto max-w-7xl p-4 lg:p-6">
        {/* Header with Back Button */}
        <header className="mb-6">
          <div className="flex items-center mb-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center px-4 py-2 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-slate-100 rounded-lg border border-slate-600 transition-colors mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </button>
            <div className="flex items-center">
              <TrendingUp className="w-6 h-6 mr-3 text-blue-400" />
              <h1 className="text-2xl font-bold text-slate-100">
                Stock Analysis: {symbol}
              </h1>
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

        {/* Main Content - Vertical Stack Layout */}
        <div className="space-y-6">
          {/* Stock Card - Full Width */}
          <div className="w-full">
            <StockCard 
              data={stockData || {
                symbol: symbol,
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
          
          {/* Stock Chart - Full Width */}
          <div className="w-full">
            <StockChart 
              symbol={symbol} 
              onPeriodChange={(period, data) => {
                setCurrentPeriod(period)
                setChartData(data)
              }}
            />
          </div>
          
          {/* AI Insights - Full Width */}
          <div className="w-full">
            <AIInsights symbol={symbol} />
          </div>
        </div>
      </div>
    </main>
  )
}