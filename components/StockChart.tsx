'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { apiClient, type HistoricalData, type ChartDataPoint } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'

interface StockChartProps {
  symbol?: string
  onPeriodChange?: (period: string, data: any) => void
}

const TIME_PERIODS = [
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
  { value: '3m', label: '3M' },
  { value: '1y', label: '1Y' }
]

export default function StockChart({ symbol, onPeriodChange }: StockChartProps) {
  const [data, setData] = useState<HistoricalData | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('1y')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchChartData = async (period: string = selectedPeriod) => {
    if (!symbol) return
    
    setLoading(true)
    setError(null)
    
    try {
      const chartData = await apiClient.getStockHistory(symbol, period)
      setData(chartData)
      
      // Notify parent component about period change and chart data
      if (onPeriodChange) {
        onPeriodChange(period, chartData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chart data')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChartData()
  }, [symbol])

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    fetchChartData(period)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    if (selectedPeriod === '1d') {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else if (selectedPeriod === '1w') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }

  const formatTooltipDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-gray-800 p-3 border border-gray-600 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-white">{formatTooltipDate(label)}</p>
          <p className="text-sm text-blue-400">
            Price: {formatCurrency(data.close)}
          </p>
          <p className="text-sm text-gray-300">
            Volume: {(data.volume / 1000000).toFixed(1)}M
          </p>
        </div>
      )
    }
    return null
  }

  if (!symbol) {
    return (
      <div className="bg-slate-800/60 backdrop-blur-sm rounded-lg shadow-lg border border-slate-600 p-6">
        <h2 className="text-lg font-semibold mb-4 text-slate-100">Stock Chart</h2>
        <p className="text-slate-400 text-center py-8">
          Search for a stock to see price chart
        </p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/60 backdrop-blur-sm rounded-lg shadow-lg border border-slate-600 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-100">Stock Chart</h2>
        <button
          onClick={() => fetchChartData()}
          disabled={loading}
          className="p-1 hover:bg-slate-700/50 rounded-full disabled:opacity-50 text-slate-400 hover:text-slate-200 transition-colors"
          title="Refresh chart"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Time Period Selector */}
      <div className="flex space-x-1 mb-4">
        {TIME_PERIODS.map((period) => (
          <button
            key={period.value}
            onClick={() => handlePeriodChange(period.value)}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              selectedPeriod === period.value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-slate-100'
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 animate-spin mr-2 text-slate-400" />
          <span className="text-slate-400">Loading chart...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center p-3 bg-red-900/50 border border-red-500 rounded-lg mb-4 backdrop-blur-sm">
          <AlertCircle className="w-4 h-4 text-red-400 mr-2" />
          <span className="text-red-300 text-sm">{error}</span>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          {/* Price Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  stroke="#94a3b8"
                  fontSize={12}
                />
                <YAxis 
                  domain={['dataMin - 5', 'dataMax + 5']}
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                  stroke="#94a3b8"
                  fontSize={12}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="close" 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#2563eb' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Trading Volume Chart */}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-300 mb-2">Trading Volume</h3>
            <div className="h-20">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.data} margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <XAxis 
                    dataKey="date" 
                    tick={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={false}
                    axisLine={false}
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                  />
                  <Bar 
                    dataKey="volume" 
                    fill="#64748b"
                    opacity={0.7}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart Info */}
          <div className="text-xs text-slate-400 pt-2 border-t border-slate-600">
            {data.data_points} data points • Period: {selectedPeriod.toUpperCase()} • High: {formatCurrency(data.period_high)} • Low: {formatCurrency(data.period_low)}
          </div>
        </div>
      )}
    </div>
  )
}