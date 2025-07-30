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
      <div className="bg-slate-800/60 backdrop-blur-sm rounded-lg shadow-lg border border-slate-600 p-6">
        <h2 className="text-lg font-semibold mb-4 text-slate-100">AI Insights</h2>
        <p className="text-slate-400 text-center py-8">
          Search for a stock to see AI-powered news analysis
        </p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/60 backdrop-blur-sm rounded-lg shadow-lg border border-slate-600 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center mr-3">
              <span className="text-white text-sm font-bold">AI</span>
            </div>
            AI Insights
          </h2>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="p-2 hover:bg-slate-700/50 rounded-full disabled:opacity-50 text-slate-400 hover:text-slate-200 transition-colors"
          title="Refresh insights"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 animate-spin mr-2 text-slate-400" />
          <span className="text-slate-400">Analyzing news...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center p-3 bg-red-900/50 border border-red-500 rounded-lg mb-4 backdrop-blur-sm">
          <AlertCircle className="w-4 h-4 text-red-400 mr-2" />
          <span className="text-red-300 text-sm">{error}</span>
        </div>
      )}

      {insights && !loading && (
        <div className="space-y-5">
          {/* Sentiment Badge - Enhanced */}
          <div className="flex items-center justify-center">
            <div className={`flex items-center px-4 py-2 rounded-xl text-base font-semibold border-2 shadow-lg ${getSentimentColor(insights.analysis.sentiment)}`}>
              {getSentimentIcon(insights.analysis.sentiment)}
              <span className="ml-2 capitalize">{insights.analysis.sentiment}</span>
              <span className="ml-3 text-sm opacity-80">
                ({insights.analysis.sentiment_score > 0 ? '+' : ''}{insights.analysis.sentiment_score.toFixed(1)})
              </span>
            </div>
          </div>

          {/* Summary - Enhanced */}
          <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
            <h3 className="font-semibold text-slate-100 mb-3 flex items-center">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
              AI Summary
            </h3>
            <p className="text-slate-200 text-sm leading-relaxed">
              {insights.analysis.summary}
            </p>
          </div>

          {/* Key Points - Enhanced */}
          {insights.analysis.key_points.length > 0 && (
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <h3 className="font-semibold text-slate-100 mb-3 flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                Key Insights
              </h3>
              <ul className="space-y-2">
                {insights.analysis.key_points.map((point, index) => (
                  <li key={index} className="text-sm text-slate-200 flex items-start group">
                    <div className="w-2 h-2 bg-slate-400 rounded-full mr-3 mt-2 group-hover:bg-blue-400 transition-colors flex-shrink-0"></div>
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent Articles - Enhanced */}
          {insights.raw_articles.length > 0 && (
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
              <h3 className="font-semibold text-slate-100 mb-3 flex items-center">
                <div className="w-2 h-2 bg-orange-400 rounded-full mr-2"></div>
                Related News ({insights.raw_articles.length})
              </h3>
              <div className="space-y-3">
                {insights.raw_articles.slice(0, 3).map((article, index) => (
                  <div key={index} className="border border-slate-600 rounded-lg p-3 hover:bg-slate-600/30 transition-colors group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-slate-100 line-clamp-2 mb-2 group-hover:text-blue-300 transition-colors">
                          {article.title}
                        </h4>
                        <div className="flex items-center text-xs text-slate-400 mb-1">
                          <span className="bg-slate-600/50 px-2 py-1 rounded text-slate-300 font-medium">
                            {article.source}
                          </span>
                          <span className="mx-2">•</span>
                          <span>{formatDate(article.published_at)}</span>
                        </div>
                        {article.description && (
                          <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                            {article.description}
                          </p>
                        )}
                      </div>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-3 p-2 hover:bg-blue-600/20 rounded-full transition-colors flex-shrink-0"
                        title="Read full article"
                      >
                        <ExternalLink className="w-3 h-3 text-slate-400 hover:text-blue-400" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              {insights.raw_articles.length > 3 && (
                <div className="text-center mt-3 pt-2 border-t border-slate-600">
                  <span className="text-xs text-slate-400">
                    +{insights.raw_articles.length - 3} more articles analyzed
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Meta Info */}
          <div className="text-xs text-slate-400 pt-2 border-t border-slate-600">
            Based on {insights.analysis.article_count} articles • Updated {formatDate(insights.last_updated)}
          </div>
        </div>
      )}
    </div>
  )
}