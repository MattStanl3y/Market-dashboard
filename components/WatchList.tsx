'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, X, RefreshCw, AlertCircle } from 'lucide-react'
import { apiClient, type StockData } from '@/lib/api'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface WatchListProps {
  onSymbolSelect?: (symbol: string) => void
  currentSymbol?: string
  onAddSymbol?: (addFn: (symbol: string) => Promise<void>) => void
}

interface WatchedStock {
  symbol: string
  data?: StockData
  loading?: boolean
  error?: string
}

export default function WatchList({ onSymbolSelect, currentSymbol, onAddSymbol }: WatchListProps) {
  const [watchedStocks, setWatchedStocks] = useState<WatchedStock[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)

  // Load watchlist from localStorage on component mount
  useEffect(() => {
    const savedWatchlist = localStorage.getItem('market-dashboard-watchlist')
    if (savedWatchlist) {
      try {
        const symbols = JSON.parse(savedWatchlist)
        const initialStocks = symbols.map((symbol: string) => ({
          symbol: symbol.toUpperCase(),
          loading: true
        }))
        setWatchedStocks(initialStocks)
        // Fetch data for each symbol
        initialStocks.forEach((stock: WatchedStock) => fetchStockData(stock.symbol))
      } catch (error) {
        console.error('Error loading watchlist from localStorage:', error)
      }
    }
  }, [])

  // Auto-refresh watchlist prices every 30 seconds
  useEffect(() => {
    if (!autoRefreshEnabled || watchedStocks.length === 0) return

    const interval = setInterval(() => {
      // Only refresh if not currently refreshing and we have stocks to refresh
      if (!refreshing && watchedStocks.length > 0) {
        refreshAll()
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [autoRefreshEnabled, watchedStocks.length, refreshing])

  // Pass addSymbol function to parent component
  useEffect(() => {
    if (onAddSymbol) {
      onAddSymbol(addSymbol)
    }
  }, [onAddSymbol])

  // Save watchlist to localStorage whenever it changes
  const saveWatchlist = (stocks: WatchedStock[]) => {
    const symbols = stocks.map(stock => stock.symbol)
    localStorage.setItem('market-dashboard-watchlist', JSON.stringify(symbols))
  }

  const fetchStockData = async (symbol: string) => {
    setWatchedStocks(prev => prev.map(stock => 
      stock.symbol === symbol 
        ? { ...stock, loading: true, error: undefined }
        : stock
    ))

    try {
      const data = await apiClient.getStock(symbol)
      setWatchedStocks(prev => prev.map(stock =>
        stock.symbol === symbol
          ? { ...stock, data, loading: false, error: undefined }
          : stock
      ))
    } catch (error) {
      setWatchedStocks(prev => prev.map(stock =>
        stock.symbol === symbol
          ? { ...stock, loading: false, error: error instanceof Error ? error.message : 'Failed to fetch data' }
          : stock
      ))
    }
  }

  const addSymbol = async (symbol: string) => {
    const upperSymbol = symbol.trim().toUpperCase()
    
    // Check if symbol already exists
    if (watchedStocks.some(stock => stock.symbol === upperSymbol)) {
      return
    }
    
    const newStock: WatchedStock = {
      symbol: upperSymbol,
      loading: true
    }

    const updatedStocks = [...watchedStocks, newStock]
    setWatchedStocks(updatedStocks)
    saveWatchlist(updatedStocks)
    
    try {
      await fetchStockData(upperSymbol)
    } catch (error) {
      console.error('Error adding symbol to watchlist:', error)
    }
  }

  const removeSymbol = (symbol: string) => {
    const updatedStocks = watchedStocks.filter(stock => stock.symbol !== symbol)
    setWatchedStocks(updatedStocks)
    saveWatchlist(updatedStocks)
  }

  const refreshAll = async () => {
    if (watchedStocks.length === 0 || refreshing) return
    
    setRefreshing(true)
    
    // Fetch data for all symbols
    const fetchPromises = watchedStocks.map(stock => fetchStockData(stock.symbol))
    
    try {
      await Promise.all(fetchPromises)
    } catch (error) {
      console.error('Error refreshing watchlist:', error)
    }
    
    setRefreshing(false)
  }

  const handleSymbolClick = (symbol: string) => {
    if (onSymbolSelect) {
      onSymbolSelect(symbol)
    }
  }


  return (
    <div className="bg-slate-800/60 backdrop-blur-sm rounded-lg shadow-lg border border-slate-600 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-100">Watchlist</h2>
        <button
          onClick={refreshAll}
          disabled={refreshing || watchedStocks.length === 0}
          className="p-1 hover:bg-slate-700/50 rounded-full disabled:opacity-50 text-slate-400 hover:text-slate-200 transition-colors"
          title="Refresh all prices"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Watchlist Items */}
      <div className="space-y-2">
        {watchedStocks.length === 0 ? (
          <p className="text-slate-400 text-center py-4 text-sm">
            Use the ❤️ button on stock cards to add to watchlist
          </p>
        ) : (
          watchedStocks.map((stock) => (
            <div
              key={stock.symbol}
              className={`p-3 border rounded-lg transition-all duration-200 cursor-pointer hover:bg-slate-700/50 hover:shadow-md transform hover:scale-[1.02] ${
                currentSymbol === stock.symbol ? 'border-blue-500 bg-blue-600/20 shadow-md' : 'border-slate-600'
              }`}
              onClick={() => handleSymbolClick(stock.symbol)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-slate-100">{stock.symbol}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeSymbol(stock.symbol)
                      }}
                      className="p-1 hover:bg-slate-600/50 rounded-full transition-colors"
                      title="Remove from watchlist"
                    >
                      <X className="w-3 h-3 text-slate-400 hover:text-slate-200" />
                    </button>
                  </div>
                  
                  {stock.loading ? (
                    <div className="flex items-center text-xs text-slate-400">
                      <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                      Loading...
                    </div>
                  ) : stock.error ? (
                    <div className="flex items-center text-xs text-red-400">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Error
                    </div>
                  ) : stock.data ? (
                    <div>
                      <div className="text-sm font-medium text-slate-100">
                        {formatCurrency(stock.data.current_price)}
                      </div>
                      <div className={`flex items-center text-xs ${
                        stock.data.change >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {stock.data.change >= 0 ? (
                          <TrendingUp className="w-3 h-3 mr-1" />
                        ) : (
                          <TrendingDown className="w-3 h-3 mr-1" />
                        )}
                        <span>
                          {stock.data.change >= 0 ? '+' : ''}{formatCurrency(stock.data.change)} 
                          ({formatPercent(stock.data.change_percent)})
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {watchedStocks.length > 0 && (
        <div className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-600">
          {watchedStocks.length} stock{watchedStocks.length !== 1 ? 's' : ''} watched • Click to view details
        </div>
      )}
    </div>
  )
}