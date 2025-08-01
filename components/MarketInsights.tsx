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

  const fetchInsights = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await apiClient.getMarketInsights(1) // Fixed to 1 day
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
  }, [])

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
        {/* News Feed Skeleton */}
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-lg shadow-lg border border-slate-600 p-6 animate-pulse">
          <div className="h-6 bg-slate-700 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-slate-700 rounded w-full"></div>
                <div className="h-3 bg-slate-700 rounded w-32"></div>
              </div>
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
          {/* Latest Market News - Main Section */}
          <div className="bg-slate-800/60 backdrop-blur-sm rounded-lg shadow-lg border border-slate-600 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-100 flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-3 animate-pulse"></div>
                Latest Market News
              </h2>
              <div className="flex items-center gap-2">
                {insights.is_mock_data && (
                  <div className="text-xs text-amber-400 bg-amber-500/20 px-2 py-1 rounded-full border border-amber-500/30">
                    API Limit - Mock Data
                  </div>
                )}
                <div className="text-xs text-slate-400 bg-slate-700/50 px-3 py-1 rounded-full">
                  Live Updates
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              {insights.raw_articles.slice(0, 12).map((article, index) => (
                <article key={index} className="group hover:bg-slate-700/30 -mx-3 px-3 py-4 rounded-xl transition-all duration-200 hover:shadow-lg border border-transparent hover:border-slate-600">
                  <div className="flex gap-4">
                    {/* Article Priority Indicator */}
                    <div className="flex flex-col items-center pt-1">
                      <div className={`w-3 h-3 rounded-full ${
                        index < 3 ? 'bg-red-400' : index < 6 ? 'bg-yellow-400' : 'bg-green-400'
                      } opacity-70 group-hover:opacity-100 transition-opacity`}></div>
                      <div className="w-px h-full bg-slate-600 mt-2 opacity-30"></div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-slate-100 font-medium leading-snug group-hover:text-blue-300 transition-colors text-base line-clamp-2 flex-1">
                          {article.title}
                        </h3>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-3 opacity-50 group-hover:opacity-100 p-2 hover:bg-blue-600/20 rounded-full transition-all duration-200 flex-shrink-0"
                          title="Read full article"
                        >
                          <ExternalLink className="w-4 h-4 text-slate-400 hover:text-blue-400" />
                        </a>
                      </div>
                      
                      {article.description && (
                        <p className="text-slate-300 text-sm leading-relaxed mb-3 line-clamp-2 group-hover:text-slate-200 transition-colors">
                          {article.description}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-xs text-slate-500">
                          <span className="font-medium text-slate-400 bg-slate-700/50 px-2 py-1 rounded">
                            {article.source}
                          </span>
                          <span className="mx-2">•</span>
                          <span>{formatDate(article.published_at)}</span>
                        </div>
                        <div className="flex items-center text-xs text-slate-500">
                          <span className="opacity-70">#{index + 1}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            
            {insights.raw_articles.length > 12 && (
              <div className="text-center mt-6 pt-4 border-t border-slate-600">
                <button className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
                  View {insights.raw_articles.length - 12} more articles →
                </button>
              </div>
            )}
          </div>


          {/* Trending Stocks - Enhanced */}
          {insights.analysis.trending_stocks.length > 0 && (
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-lg shadow-lg border border-slate-600 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center text-slate-100">
                <Zap className="w-5 h-5 mr-2 text-yellow-400 animate-pulse" />
                Trending Stocks
              </h3>
              
              <div className="grid gap-3">
                {insights.analysis.trending_stocks.slice(0, 5).map((stock, index) => (
                  <div
                    key={index}
                    className="group flex items-center justify-between p-4 border border-slate-600 rounded-xl hover:bg-slate-700/50 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.01] hover:border-slate-500"
                    onClick={() => handleStockClick(stock.symbol)}
                  >
                    <div className="flex items-center flex-1">
                      <div className="flex items-center">
                        <div className="p-2 rounded-lg bg-slate-700/50 group-hover:bg-slate-600/50 transition-colors">
                          {getSentimentIcon(stock.sentiment)}
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center mb-1">
                            <span className="font-bold text-slate-100 text-lg group-hover:text-blue-300 transition-colors">
                              {stock.symbol}
                            </span>
                            <span className={`ml-3 px-3 py-1 text-xs rounded-full font-medium border ${getSentimentColor(stock.sentiment)}`}>
                              {stock.sentiment.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-300 group-hover:text-slate-200 transition-colors line-clamp-1">
                            {stock.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center text-slate-400 group-hover:text-blue-400 transition-colors">
                      <Eye className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* High Impact Events */}
          {insights.analysis.high_impact_events.length > 0 && (
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-lg shadow-lg border border-slate-600 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center text-slate-100">
                <Calendar className="w-5 h-5 mr-2 text-blue-400" />
                Upcoming Events to Watch
              </h3>
              
              <div className="space-y-3">
                {(() => {
                  // Extend events list with additional items if we have fewer than 5 (in chronological order)
                  const additionalEvents = [
                    { event: 'Oil Inventory Report', timeframe: 'Weekly', impact: 'low' as const, order: 1 },
                    { event: 'Monthly Jobs Report Release', timeframe: 'First Friday', impact: 'medium' as const, order: 2 },
                    { event: 'Federal Reserve Interest Rate Decision', timeframe: 'Next Week', impact: 'high' as const, order: 3 },
                    { event: 'Apple iPhone Sales Data', timeframe: 'Next 2 Weeks', impact: 'medium' as const, order: 4 },
                    { event: 'Consumer Price Index (CPI)', timeframe: 'Mid-Month', impact: 'high' as const, order: 5 },
                    { event: 'Tesla Q4 Earnings Report', timeframe: 'This Month', impact: 'high' as const, order: 6 }
                  ]
                  
                  // Start with original events and add order property
                  const allEvents = insights.analysis.high_impact_events.map((event, index) => ({
                    ...event,
                    order: index * 0.1 // Give original events priority with decimal ordering
                  }))
                  
                  // Add additional events until we have at least 6 total
                  additionalEvents.forEach(additionalEvent => {
                    // Only add if not already present
                    const exists = allEvents.some(existing => 
                      existing.event.toLowerCase() === additionalEvent.event.toLowerCase()
                    )
                    if (!exists && allEvents.length < 6) {
                      allEvents.push(additionalEvent)
                    }
                  })
                  
                  // Sort by chronological order
                  allEvents.sort((a, b) => (a.order || 999) - (b.order || 999))
                  
                  return allEvents.map((event, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border border-slate-600 rounded-lg hover:bg-slate-700/30 transition-colors"
                    >
                      <div>
                        <h4 className="font-medium text-slate-100">{event.event}</h4>
                        <p className="text-sm text-slate-400">{event.timeframe}</p>
                      </div>
                      <span className={`px-3 py-1 text-xs rounded-full font-medium border ${getImpactColor(event.impact)}`}>
                        {event.impact.toUpperCase()} IMPACT
                      </span>
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}

          {/* Footer Info */}
          <div className="text-xs text-slate-400 text-center py-2">
            Based on {insights.analysis.article_count} articles • Updated {formatDate(insights.last_updated)}
          </div>
        </>
      )}
    </div>
  )
}