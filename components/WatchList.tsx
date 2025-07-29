'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Plus, X, RefreshCw, AlertCircle } from 'lucide-react'
import { apiClient, type StockData } from '@/lib/api'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface WatchListProps {
  onSymbolSelect?: (symbol: string) => void
  currentSymbol?: string
}

interface WatchedStock {
  symbol: string
  data?: StockData
  loading?: boolean
  error?: string
}

export default function WatchList({ onSymbolSelect, currentSymbol }: WatchListProps) {
  const [watchedStocks, setWatchedStocks] = useState<WatchedStock[]>([])
  const [newSymbol, setNewSymbol] = useState('')
  const [isAdding, setIsAdding] = useState(false)
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

  const addSymbol = async () => {
    if (!newSymbol.trim()) return
    
    const symbol = newSymbol.trim().toUpperCase()
    
    // Check if symbol already exists
    if (watchedStocks.some(stock => stock.symbol === symbol)) {
      setNewSymbol('')
      return
    }

    setIsAdding(true)
    
    const newStock: WatchedStock = {
      symbol,
      loading: true
    }

    const updatedStocks = [...watchedStocks, newStock]
    setWatchedStocks(updatedStocks)
    saveWatchlist(updatedStocks)
    
    try {
      await fetchStockData(symbol)
    } catch (error) {
      console.error('Error adding symbol to watchlist:', error)
    }
    
    setNewSymbol('')
    setIsAdding(false)
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addSymbol()
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Watchlist</h2>
        <button
          onClick={refreshAll}
          disabled={refreshing || watchedStocks.length === 0}
          className="p-1 hover:bg-gray-100 rounded-full disabled:opacity-50"
          title="Refresh all prices"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Add Symbol Input */}
      <div className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            placeholder="Add symbol (e.g., AAPL)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isAdding}
          />
          <button
            onClick={addSymbol}
            disabled={isAdding || !newSymbol.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Watchlist Items */}
      <div className="space-y-2">
        {watchedStocks.length === 0 ? (
          <p className="text-gray-500 text-center py-4 text-sm">
            Add stocks to your watchlist to track prices
          </p>
        ) : (
          watchedStocks.map((stock) => (
            <div
              key={stock.symbol}
              className={`p-3 border rounded-lg transition-all duration-200 cursor-pointer hover:bg-gray-50 hover:shadow-md transform hover:scale-[1.02] ${
                currentSymbol === stock.symbol ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200'
              }`}
              onClick={() => handleSymbolClick(stock.symbol)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{stock.symbol}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeSymbol(stock.symbol)
                      }}
                      className="p-1 hover:bg-gray-200 rounded-full"
                      title="Remove from watchlist"
                    >
                      <X className="w-3 h-3 text-gray-500" />
                    </button>
                  </div>
                  
                  {stock.loading ? (
                    <div className="flex items-center text-xs text-gray-500">
                      <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                      Loading...
                    </div>
                  ) : stock.error ? (
                    <div className="flex items-center text-xs text-red-600">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Error
                    </div>
                  ) : stock.data ? (
                    <div>
                      <div className="text-sm font-medium">
                        {formatCurrency(stock.data.current_price)}
                      </div>
                      <div className={`flex items-center text-xs ${
                        stock.data.change >= 0 ? 'text-green-600' : 'text-red-600'
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
        <div className="text-xs text-gray-500 mt-4 pt-3 border-t border-gray-100">
          {watchedStocks.length} stock{watchedStocks.length !== 1 ? 's' : ''} watched • Click to view details
        </div>
      )}
    </div>
  )
}