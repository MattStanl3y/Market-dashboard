'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react'
import { apiClient, type NewsInsights } from '@/lib/api'

interface AIInsightsProps {
  symbol?: string
}

export default function AIInsights({ symbol }: AIInsightsProps) {
  const [insights, setInsights] = useState<NewsInsights | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInsights = async () => {
    if (!symbol) return
    
    setLoading(true)
    setError(null)
    
    try {
      const data = await apiClient.getNewsInsights(symbol)
      setInsights(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch news insights')
      setInsights(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [symbol])

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return <TrendingUp className="w-4 h-4 text-green-600" />
      case 'bearish':
        return <TrendingDown className="w-4 h-4 text-red-600" />
      default:
        return <Minus className="w-4 h-4 text-gray-600" />
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!symbol) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-4 text-white">AI Insights</h2>
        <p className="text-gray-400 text-center py-8">
          Search for a stock to see AI-powered news analysis
        </p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">AI Insights</h2>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="p-1 hover:bg-gray-700/50 rounded-full disabled:opacity-50 text-gray-300 hover:text-white transition-colors"
          title="Refresh insights"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 animate-spin mr-2 text-gray-400" />
          <span className="text-gray-400">Analyzing news...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center p-3 bg-red-900/50 border border-red-500 rounded-lg mb-4 backdrop-blur-sm">
          <AlertCircle className="w-4 h-4 text-red-400 mr-2" />
          <span className="text-red-300 text-sm">{error}</span>
        </div>
      )}

      {insights && !loading && (
        <div className="space-y-4">
          {/* Sentiment Badge */}
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getSentimentColor(insights.analysis.sentiment)}`}>
            {getSentimentIcon(insights.analysis.sentiment)}
            <span className="ml-1 capitalize">{insights.analysis.sentiment}</span>
            <span className="ml-2 text-xs">
              ({insights.analysis.sentiment_score > 0 ? '+' : ''}{insights.analysis.sentiment_score.toFixed(1)})
            </span>
          </div>

          {/* Summary */}
          <div>
            <h3 className="font-medium text-white mb-2">Summary</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              {insights.analysis.summary}
            </p>
          </div>

          {/* Key Points */}
          {insights.analysis.key_points.length > 0 && (
            <div>
              <h3 className="font-medium text-white mb-2">Key Points</h3>
              <ul className="space-y-1">
                {insights.analysis.key_points.map((point, index) => (
                  <li key={index} className="text-sm text-gray-300 flex items-start">
                    <span className="w-1 h-1 bg-gray-500 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent Articles */}
          {insights.raw_articles.length > 0 && (
            <div>
              <h3 className="font-medium text-white mb-2">Recent News</h3>
              <div className="space-y-2">
                {insights.raw_articles.slice(0, 3).map((article, index) => (
                  <div key={index} className="border border-gray-600 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-white line-clamp-2 mb-1">
                          {article.title}
                        </h4>
                        <p className="text-xs text-gray-400 mb-1">
                          {article.source} • {formatDate(article.published_at)}
                        </p>
                        {article.description && (
                          <p className="text-xs text-gray-300 line-clamp-2">
                            {article.description}
                          </p>
                        )}
                      </div>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 p-1 hover:bg-gray-700/50 rounded transition-colors"
                        title="Read full article"
                      >
                        <ExternalLink className="w-3 h-3 text-gray-400 hover:text-white" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta Info */}
          <div className="text-xs text-gray-400 pt-2 border-t border-gray-600">
            Based on {insights.analysis.article_count} articles • Updated {formatDate(insights.last_updated)}
          </div>
        </div>
      )}
    </div>
  )
}