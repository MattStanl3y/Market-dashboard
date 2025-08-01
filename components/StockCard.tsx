'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency, formatPercent, formatLargeNumber } from '@/lib/utils'
import { type StockData } from '@/lib/api'

interface StockCardProps {
  data: StockData
  period?: string
  chartData?: any
  loading?: boolean
}

// Loading skeleton component
function StockCardSkeleton() {
  return (
    <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl p-6 border border-slate-700/50 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="h-6 bg-gray-700 rounded w-20 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-32"></div>
        </div>
        <div className="h-6 bg-gray-700 rounded w-16"></div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <div className="h-8 bg-gray-700 rounded w-24 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-20"></div>
        </div>
        <div className="text-right">
          <div className="h-4 bg-gray-700 rounded w-12 mb-1 ml-auto"></div>
          <div className="h-5 bg-gray-700 rounded w-16 ml-auto"></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-600">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="h-3 bg-gray-700 rounded w-16 mb-1"></div>
            <div className="h-4 bg-gray-700 rounded w-12"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StockCard({ data, period = '1y', chartData, loading = false }: StockCardProps) {
  if (loading) {
    return <StockCardSkeleton />
  }

  const isPositive = data.change >= 0
  
  // Get dynamic high/low labels and values
  const getHighLowLabel = () => {
    switch (period) {
      case '1d': return 'Today\'s'
      case '1w': return 'Week'
      case '3m': return '3M'
      case '1y': return '52W'
      default: return '52W'
    }
  }
  
  const getPeriodHigh = () => {
    if (chartData?.period_high) return chartData.period_high
    return data['52_week_high'] || 0
  }
  
  const getPeriodLow = () => {
    if (chartData?.period_low) return chartData.period_low
    return data['52_week_low'] || 0
  }

  return (
    <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-md rounded-2xl shadow-2xl p-6 border border-slate-700/50">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-slate-100">{data.symbol}</h2>
            {data.is_mock_data && (
              <div className="text-xs text-amber-400 bg-amber-500/20 px-2 py-1 rounded-full border border-amber-500/30">
                Mock
              </div>
            )}
          </div>
          <p className="text-slate-300 text-sm">{data.company_name}</p>
        </div>
        <div className={`flex items-center px-4 py-2 rounded-xl text-sm font-medium backdrop-blur-sm ${
          isPositive ? 'bg-gradient-to-r from-green-600/20 to-emerald-600/20 text-green-400 border border-green-500/40' : 'bg-gradient-to-r from-red-600/20 to-red-800/20 text-red-400 border border-red-500/40'
        }`}>
          {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
          {formatPercent(data.change_percent)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-3xl font-bold text-slate-100">
            {formatCurrency(data.current_price)}
          </p>
          <p className={`text-sm font-medium ${
            isPositive ? 'text-green-400' : 'text-red-400'
          }`}>
            {isPositive ? '+' : ''}{formatCurrency(data.change)} today
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">Volume</p>
          <p className="text-lg font-semibold text-slate-100">
            {data.volume ? formatLargeNumber(data.volume) : 'N/A'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-600/50">
        <div>
          <p className="text-sm text-slate-400">Market Cap</p>
          <p className="font-semibold text-slate-100">
            {data.market_cap ? formatLargeNumber(data.market_cap) : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-400">P/E Ratio</p>
          <p className="font-semibold text-slate-100">
            {data.pe_ratio ? data.pe_ratio.toFixed(2) : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-400">{getHighLowLabel()} High</p>
          <p className="font-semibold text-slate-100">
            {getPeriodHigh() ? formatCurrency(getPeriodHigh()) : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-400">{getHighLowLabel()} Low</p>
          <p className="font-semibold text-slate-100">
            {getPeriodLow() ? formatCurrency(getPeriodLow()) : 'N/A'}
          </p>
        </div>
        {data.eps && (
          <div>
            <p className="text-sm text-slate-400">EPS</p>
            <p className="font-semibold text-slate-100">{data.eps.toFixed(2)}</p>
          </div>
        )}
        {data.beta && (
          <div>
            <p className="text-sm text-slate-400">Beta</p>
            <p className="font-semibold text-slate-100">{data.beta.toFixed(2)}</p>
          </div>
        )}
        {data.dividend_yield && data.dividend_yield > 0 && (
          <div>
            <p className="text-sm text-slate-400">Dividend Yield</p>
            <p className="font-semibold text-slate-100">{data.dividend_yield.toFixed(2)}%</p>
          </div>
        )}
        {data.peg_ratio && (
          <div>
            <p className="text-sm text-slate-400">PEG Ratio</p>
            <p className="font-semibold text-slate-100">{data.peg_ratio.toFixed(2)}</p>
          </div>
        )}
      </div>
      
      {/* Company Info Section */}
      {(data.sector || data.industry) && (
        <div className="pt-6 border-t border-slate-600/50 mt-4">
          <div className="grid grid-cols-1 gap-2">
            {data.sector && (
              <div>
                <p className="text-sm text-slate-400">Sector</p>
                <p className="text-sm font-medium text-slate-300">{data.sector}</p>
              </div>
            )}
            {data.industry && (
              <div>
                <p className="text-sm text-slate-400">Industry</p>
                <p className="text-sm font-medium text-slate-300">{data.industry}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}