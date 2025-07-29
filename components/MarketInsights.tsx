'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, ExternalLink, RefreshCw, AlertCircle, Calendar, Zap, Eye } from 'lucide-react'
import { apiClient, type MarketInsights } from '@/lib/api'

interface MarketInsightsProps {
  onSymbolSelect?: (symbol: string) => void
}

export default function MarketInsightsComponent({ onSymbolSelect }: MarketInsightsProps) {
  const [insights, setInsights] = useState<MarketInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [daysBack, setDaysBack] = useState(1)

  const fetchInsights = async (days: number = daysBack) => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await apiClient.getMarketInsights(days)
      setInsights(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch market insights')
      setInsights(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInsights()
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      fetchInsights()
    }, 300000) // 5 minutes

    return () => clearInterval(interval)
  }, [daysBack])

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return <TrendingUp className="w-5 h-5 text-green-600" />
      case 'bearish':
        return <TrendingDown className="w-5 h-5 text-red-600" />
      default:
        return <Minus className="w-5 h-5 text-gray-600" />
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'bearish':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleStockClick = (symbol: string) => {
    if (onSymbolSelect) {
      onSymbolSelect(symbol)
    }
  }

  if (loading && !insights) {
    return (
      <div className="space-y-6">
        {/* Market Sentiment Skeleton */}
        <div className="bg-white rounded-lg shadow p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="h-16 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
        </div>
        
        {/* Trending Stocks Skeleton */}
        <div className="bg-white rounded-lg shadow p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-40 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">AI Market Insights</h1>
          <div className="flex items-center gap-2">
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>Today</option>
              <option value={3}>3 Days</option>
              <option value={7}>This Week</option>
            </select>
            <button
              onClick={() => fetchInsights()}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-50"
              title="Refresh insights"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        <p className="text-gray-600">
          AI-powered analysis of market-moving news and trending stocks
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {insights && (
        <>
          {/* Market Sentiment Overview */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Market Sentiment</h2>
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getSentimentColor(insights.analysis.market_sentiment)}`}>
                {getSentimentIcon(insights.analysis.market_sentiment)}
                <span className="ml-2 capitalize">{insights.analysis.market_sentiment}</span>
              </div>
            </div>
            
            <p className="text-gray-700 mb-4 leading-relaxed">
              {insights.analysis.daily_summary}
            </p>
            
            {/* Key Themes */}
            {insights.analysis.key_themes.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Key Market Themes</h3>
                <div className="flex flex-wrap gap-2">
                  {insights.analysis.key_themes.map((theme, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full border border-blue-200"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Trending Stocks */}
          {insights.analysis.trending_stocks.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-yellow-500" />
                Trending Stocks
              </h2>
              
              <div className="space-y-3">
                {insights.analysis.trending_stocks.map((stock, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleStockClick(stock.symbol)}
                  >
                    <div className="flex items-center flex-1">
                      <div className="flex items-center">
                        {getSentimentIcon(stock.sentiment)}
                        <div className="ml-3">
                          <div className="flex items-center">
                            <span className="font-medium text-gray-900">{stock.symbol}</span>
                            <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getSentimentColor(stock.sentiment)}`}>
                              {stock.sentiment}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{stock.reason}</p>
                        </div>
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-gray-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* High Impact Events */}
          {insights.analysis.high_impact_events.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-blue-500" />
                Upcoming Events to Watch
              </h2>
              
              <div className="space-y-3">
                {insights.analysis.high_impact_events.map((event, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <h3 className="font-medium text-gray-900">{event.event}</h3>
                      <p className="text-sm text-gray-600">{event.timeframe}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs rounded-full font-medium border ${getImpactColor(event.impact)}`}>
                      {event.impact.toUpperCase()} IMPACT
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Market News */}
          {insights.raw_articles.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Latest Market News</h2>
              
              <div className="space-y-4">
                {insights.raw_articles.slice(0, 5).map((article, index) => (
                  <div key={index} className="border-b border-gray-100 pb-4 last:border-b-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">
                          {article.title}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {article.description}
                        </p>
                        <div className="flex items-center text-xs text-gray-500">
                          <span>{article.source}</span>
                          <span className="mx-2">•</span>
                          <span>{formatDate(article.published_at)}</span>
                        </div>
                      </div>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-3 p-2 hover:bg-gray-100 rounded-full"
                        title="Read full article"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Info */}
          <div className="text-xs text-gray-500 text-center">
            Based on {insights.analysis.article_count} articles • Updated {formatDate(insights.last_updated)}
          </div>
        </>
      )}
    </div>
  )
}