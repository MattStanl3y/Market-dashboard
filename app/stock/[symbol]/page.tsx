'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, BarChart3, AlertCircle, Activity } from 'lucide-react'
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
      <main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-100 mb-4">Invalid Stock Symbol</h1>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-slate-600 text-white rounded-xl hover:from-blue-700 hover:to-slate-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Back to Home
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950">
      <div className="mx-auto max-w-7xl p-4 lg:p-6">
        {/* Header with Back Button */}
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <button
              onClick={() => router.push('/')}
              className="flex items-center px-5 py-3 bg-gradient-to-r from-slate-800/80 to-slate-700/80 hover:from-slate-700/80 hover:to-slate-600/80 text-slate-300 hover:text-white rounded-xl border border-slate-600/50 hover:border-blue-500/50 transition-all duration-200 backdrop-blur-sm mb-4 sm:mb-0 w-fit"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </button>
            <div className="flex items-center">
              <div className="relative mr-4">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-slate-600 rounded-lg blur-sm opacity-50"></div>
                <div className="relative bg-gradient-to-r from-blue-600 to-slate-700 p-2 rounded-lg">
                  <Activity className="w-5 h-5 text-white" />
                </div>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-slate-300 to-blue-400 bg-clip-text text-transparent">
                {symbol} Analysis
              </h1>
            </div>
          </div>
        </header>

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-5 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl backdrop-blur-md animate-in slide-in-from-top duration-300">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-3 text-red-400" />
              <span className="font-medium">Error: {error}</span>
            </div>
          </div>
        )}

        {/* Main Content - Vertical Stack Layout */}
        <div className="space-y-8">
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