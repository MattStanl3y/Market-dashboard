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
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900">{formatTooltipDate(label)}</p>
          <p className="text-sm text-blue-600">
            Price: {formatCurrency(data.close)}
          </p>
          <p className="text-sm text-gray-600">
            Volume: {(data.volume / 1000000).toFixed(1)}M
          </p>
        </div>
      )
    }
    return null
  }

  if (!symbol) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Stock Chart</h2>
        <p className="text-gray-500 text-center py-8">
          Search for a stock to see price chart
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Stock Chart</h2>
        <button
          onClick={() => fetchChartData()}
          disabled={loading}
          className="p-1 hover:bg-gray-100 rounded-full disabled:opacity-50"
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
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          <span className="text-gray-600">Loading chart...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          {/* Price Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  stroke="#666"
                  fontSize={12}
                />
                <YAxis 
                  domain={['dataMin - 5', 'dataMax + 5']}
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                  stroke="#666"
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
            <h3 className="text-sm font-medium text-gray-700 mb-2">Trading Volume</h3>
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
                    fill="#94a3b8"
                    opacity={0.6}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart Info */}
          <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
            {data.data_points} data points • Period: {selectedPeriod.toUpperCase()} • High: {formatCurrency(data.period_high)} • Low: {formatCurrency(data.period_low)}
          </div>
        </div>
      )}
    </div>
  )
}