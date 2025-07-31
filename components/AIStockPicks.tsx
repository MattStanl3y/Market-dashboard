'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, Eye, Star, ArrowUpRight } from 'lucide-react'
import { apiClient, type StockData } from '@/lib/api'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface AIStockPicksProps {
  onSymbolSelect?: (symbol: string) => void
}

interface StockPick {
  symbol: string
  sentiment: 'bullish' | 'bearish' | 'neutral'
  reason: string
  data?: StockData
  loading?: boolean
  error?: boolean
}

const FEATURED_STOCKS: Omit<StockPick, 'data' | 'loading' | 'error'>[] = [
  { symbol: 'AAPL', sentiment: 'bullish', reason: 'Strong iPhone sales and AI integration' },
  { symbol: 'TSLA', sentiment: 'bullish', reason: 'Leading EV market position' },
  { symbol: 'NVDA', sentiment: 'bullish', reason: 'AI chip demand continues growing' },
  { symbol: 'MSFT', sentiment: 'bullish', reason: 'Cloud and AI services expansion' },
  { symbol: 'GOOGL', sentiment: 'neutral', reason: 'Search dominance with AI competition' },
  { symbol: 'AMZN', sentiment: 'bullish', reason: 'AWS growth and retail efficiency' },
  { symbol: 'META', sentiment: 'neutral', reason: 'Metaverse investments vs core ads' },
  { symbol: 'NFLX', sentiment: 'bearish', reason: 'Streaming competition intensifying' }
]

export default function AIStockPicks({ onSymbolSelect }: AIStockPicksProps) {
  const [stocks, setStocks] = useState<StockPick[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStockData = async () => {
      setLoading(true)
      const initialStocks = FEATURED_STOCKS.map(stock => ({
        ...stock,
        loading: true,
        error: false
      }))
      setStocks(initialStocks)

      // Fetch data for all stocks in parallel
      const promises = FEATURED_STOCKS.map(async (stock) => {
        try {
          const data = await apiClient.getStock(stock.symbol)
          return { ...stock, data, loading: false, error: false }
        } catch (error) {
          console.error(`Failed to fetch data for ${stock.symbol}:`, error)
          return { ...stock, loading: false, error: true }
        }
      })

      try {
        const results = await Promise.all(promises)
        setStocks(results)
      } catch (error) {
        console.error('Error loading stock picks:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStockData()
  }, [])

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return <TrendingUp className="w-4 h-4 text-green-400" />
      case 'bearish':
        return <TrendingDown className="w-4 h-4 text-red-400" />
      default:
        return <Minus className="w-4 h-4 text-yellow-400" />
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return 'text-green-400 bg-green-500/20 border-green-500/30'
      case 'bearish':
        return 'text-red-400 bg-red-500/20 border-red-500/30'
      default:
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
    }
  }

  const handleStockClick = (symbol: string) => {
    if (onSymbolSelect) {
      onSymbolSelect(symbol)
    }
  }


  return (
    <div className="bg-gradient-to-r from-slate-800/80 via-gray-800/60 to-slate-900/80 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/50 p-6 mb-8">
      <div className="flex items-center mb-6">
        <div className="relative mr-3">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-slate-600 rounded-lg blur-sm opacity-50"></div>
          <div className="relative bg-gradient-to-r from-blue-600 to-slate-700 p-2 rounded-lg">
            <Star className="w-5 h-5 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-slate-300 bg-clip-text text-transparent">Featured Picks</h2>
        <span className="ml-3 px-3 py-1 text-xs bg-gradient-to-r from-blue-600/30 to-slate-600/30 text-blue-300 rounded-full border border-blue-500/30 font-medium">
          TRENDING
        </span>
      </div>

      {/* Mobile: Horizontal scroll, Desktop: Grid */}
      <div className="lg:grid lg:grid-cols-2 xl:grid-cols-4 lg:gap-4 lg:overflow-visible">
        <div className="flex lg:hidden gap-4 overflow-x-auto pb-2 -mx-2 px-2">
          {stocks.map((stock) => (
            <div
              key={stock.symbol}
              className="min-w-[300px] bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-600/50 rounded-xl p-5 hover:from-slate-700/90 hover:to-slate-800/90 cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.03] hover:border-blue-500/50 flex-shrink-0 backdrop-blur-sm"
              onClick={() => handleStockClick(stock.symbol)}
            >
              {/* Mobile card content */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <span className="font-bold text-slate-100 text-lg">{stock.symbol}</span>
                  <div className={`ml-2 flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getSentimentColor(stock.sentiment)}`}>
                    {getSentimentIcon(stock.sentiment)}
                    <span className="ml-1 capitalize">{stock.sentiment}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStockClick(stock.symbol)
                    }}
                    className="p-2 rounded-full bg-gradient-to-r from-blue-600/20 to-slate-600/20 text-slate-400 hover:from-blue-600/40 hover:to-slate-600/40 hover:text-blue-300 transition-all duration-200 border border-blue-500/20"
                    title="View details"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {stock.loading ? (
                <div className="space-y-2">
                  <div className="h-6 bg-slate-600/50 rounded animate-pulse"></div>
                  <div className="h-4 bg-slate-600/50 rounded w-3/4 animate-pulse"></div>
                </div>
              ) : stock.error ? (
                <div className="text-red-400 text-sm">Unable to load data</div>
              ) : stock.data ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-100 font-semibold">
                      {formatCurrency(stock.data.current_price)}
                    </span>
                    <span className={`text-sm font-medium ${
                      stock.data.change >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatPercent(stock.data.change_percent)}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm line-clamp-2">
                    {stock.reason}
                  </p>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Desktop grid */}
        <div className="hidden lg:contents">
          {stocks.map((stock) => (
            <div
              key={stock.symbol}
              className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-600/50 rounded-xl p-5 hover:from-slate-700/90 hover:to-slate-800/90 cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.03] hover:border-blue-500/50 backdrop-blur-sm"
              onClick={() => handleStockClick(stock.symbol)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <span className="font-bold text-slate-100 text-lg">{stock.symbol}</span>
                  <div className={`ml-2 flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getSentimentColor(stock.sentiment)}`}>
                    {getSentimentIcon(stock.sentiment)}
                    <span className="ml-1 capitalize">{stock.sentiment}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStockClick(stock.symbol)
                    }}
                    className="p-2 rounded-full bg-gradient-to-r from-blue-600/20 to-slate-600/20 text-slate-400 hover:from-blue-600/40 hover:to-slate-600/40 hover:text-blue-300 transition-all duration-200 border border-blue-500/20"
                    title="View details"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {stock.loading ? (
                <div className="space-y-2">
                  <div className="h-6 bg-slate-600/50 rounded animate-pulse"></div>
                  <div className="h-4 bg-slate-600/50 rounded w-3/4 animate-pulse"></div>
                </div>
              ) : stock.error ? (
                <div className="text-red-400 text-sm">Unable to load data</div>
              ) : stock.data ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-100 font-semibold">
                      {formatCurrency(stock.data.current_price)}
                    </span>
                    <span className={`text-sm font-medium ${
                      stock.data.change >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatPercent(stock.data.change_percent)}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm line-clamp-2">
                    {stock.reason}
                  </p>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-slate-400 mt-6 pt-4 border-t border-slate-600/50 text-center">
        <span className="bg-gradient-to-r from-blue-400 to-slate-300 bg-clip-text text-transparent font-medium">Curated picks</span> based on market trends • Click to explore
      </div>
    </div>
  )
}