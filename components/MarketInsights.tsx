'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, ExternalLink, RefreshCw, AlertCircle, Calendar, Zap, Eye } from 'lucide-react'
import { apiClient, type MarketInsights } from '@/lib/api'

interface MarketInsightsProps {
  onSymbolSelect?: (symbol: string) => void
  onSentimentChange?: (sentiment: string) => void
  onFiltersChange?: (daysBack: number) => void
}

export default function MarketInsightsComponent({ onSymbolSelect, onSentimentChange, onFiltersChange }: MarketInsightsProps) {
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
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 p-6 animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-48 mb-4"></div>
          <div className="h-16 bg-gray-700 rounded mb-4"></div>
          <div className="h-4 bg-gray-700 rounded w-32"></div>
        </div>
        
        {/* Trending Stocks Skeleton */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 p-6 animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-40 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 backdrop-blur-sm">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
            <span className="text-red-300">{error}</span>
          </div>
        </div>
      )}

      {insights && (
        <>
          {/* Key Themes */}
          {insights.analysis.key_themes.length > 0 && (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-3">Key Market Themes</h3>
              <div className="flex flex-wrap gap-2">
                {insights.analysis.key_themes.map((theme, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-600/20 text-blue-300 text-sm rounded-full border border-blue-500/30"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Trending Stocks */}
          {insights.analysis.trending_stocks.length > 0 && (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center text-white">
                <Zap className="w-5 h-5 mr-2 text-yellow-400" />
                Trending Stocks
              </h2>
              
              <div className="space-y-3">
                {insights.analysis.trending_stocks.map((stock, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border border-gray-600 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-colors"
                    onClick={() => handleStockClick(stock.symbol)}
                  >
                    <div className="flex items-center flex-1">
                      <div className="flex items-center">
                        {getSentimentIcon(stock.sentiment)}
                        <div className="ml-3">
                          <div className="flex items-center">
                            <span className="font-medium text-white">{stock.symbol}</span>
                            <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getSentimentColor(stock.sentiment)}`}>
                              {stock.sentiment}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300 mt-1">{stock.reason}</p>
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
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center text-white">
                <Calendar className="w-5 h-5 mr-2 text-blue-400" />
                Upcoming Events to Watch
              </h2>
              
              <div className="space-y-3">
                {insights.analysis.high_impact_events.map((event, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border border-gray-600 rounded-lg"
                  >
                    <div>
                      <h3 className="font-medium text-white">{event.event}</h3>
                      <p className="text-sm text-gray-400">{event.timeframe}</p>
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
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4 text-white">Latest Market News</h2>
              
              <div className="space-y-3">
                {insights.raw_articles.slice(0, 6).map((article, index) => {
                  // Create concise summary from title and description
                  const createConciseSummary = (title: string, description: string) => {
                    // Extract key info from title, clean up common patterns
                    let summary = title
                      .replace(/\s*-\s*.*$/, '') // Remove source suffixes like "- Reuters"
                      .replace(/^\w+:\s*/, '') // Remove prefixes like "UPDATE:"
                      .trim()
                    
                    // If description adds meaningful context, incorporate key parts
                    if (description && description.length > 20) {
                      const descWords = description.toLowerCase()
                      if (descWords.includes('earnings') || descWords.includes('revenue') || 
                          descWords.includes('stock') || descWords.includes('shares') ||
                          descWords.includes('deal') || descWords.includes('merger')) {
                        // Extract key numbers or percentages if they exist
                        const percentMatch = description.match(/(\d+(?:\.\d+)?%)/g)?.[0]
                        const dollarMatch = description.match(/\$(\d+(?:\.\d+)?(?:\s*billion|\s*million)?)/gi)?.[0]
                        
                        if (percentMatch) {
                          summary += `, ${percentMatch} ${descWords.includes('gain') || descWords.includes('rise') || descWords.includes('up') ? 'gain' : 
                                      descWords.includes('fall') || descWords.includes('drop') || descWords.includes('down') ? 'decline' : 'change'}`
                        } else if (dollarMatch) {
                          summary += `, involving ${dollarMatch}`
                        }
                      }
                    }
                    
                    return summary
                  }
                  
                  const conciseSummary = createConciseSummary(article.title, article.description || '')
                  
                  return (
                    <div key={index} className="flex items-start gap-3 group">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-300 leading-relaxed line-clamp-2">
                          {conciseSummary}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center text-xs text-gray-500">
                            <span>{article.source}</span>
                            <span className="mx-1">•</span>
                            <span>{formatDate(article.published_at)}</span>
                          </div>
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700/50 rounded transition-all duration-200"
                            title="Read full article"
                          >
                            <ExternalLink className="w-3 h-3 text-gray-400 hover:text-white" />
                          </a>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Footer Info */}
          <div className="text-xs text-gray-400 text-center">
            Based on {insights.analysis.article_count} articles • Updated {formatDate(insights.last_updated)}
          </div>
        </>
      )}
    </div>
  )
}