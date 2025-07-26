'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency, formatPercent, formatLargeNumber } from '@/lib/utils'

interface StockData {
  symbol: string
  company_name: string
  current_price: number
  change: number
  change_percent: number
  market_cap?: number
  pe_ratio?: number
  volume?: number
  '52_week_high'?: number
  '52_week_low'?: number
}

interface StockCardProps {
  data: StockData
  period?: string
  chartData?: any
}

export default function StockCard({ data, period = '1y', chartData }: StockCardProps) {
  const isPositive = data.change >= 0
  
  // Get dynamic high/low labels and values
  const getHighLowLabel = () => {
    switch (period) {
      case '1d': return 'Today\'s'
      case '1w': return 'Week'
      case '3m': return '3M'
      case '1y': return '1Y'
      default: return '1Y'
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
    <div className="bg-white rounded-lg shadow-lg p-6 border">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{data.symbol}</h2>
          <p className="text-gray-600 text-sm">{data.company_name}</p>
        </div>
        <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
          {formatPercent(data.change_percent)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(data.current_price)}
          </p>
          <p className={`text-sm font-medium ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {isPositive ? '+' : ''}{formatCurrency(data.change)} today
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Volume</p>
          <p className="text-lg font-semibold">
            {data.volume ? formatLargeNumber(data.volume) : 'N/A'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
        <div>
          <p className="text-sm text-gray-500">Market Cap</p>
          <p className="font-semibold">
            {data.market_cap ? formatLargeNumber(data.market_cap) : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">P/E Ratio</p>
          <p className="font-semibold">
            {data.pe_ratio ? data.pe_ratio.toFixed(2) : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">{getHighLowLabel()} High</p>
          <p className="font-semibold">
            {getPeriodHigh() ? formatCurrency(getPeriodHigh()) : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">{getHighLowLabel()} Low</p>
          <p className="font-semibold">
            {getPeriodLow() ? formatCurrency(getPeriodLow()) : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  )
}