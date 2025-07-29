const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface StockData {
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
  historical_data?: any[]
  // Additional overview data
  peg_ratio?: number
  book_value?: number
  dividend_per_share?: number
  dividend_yield?: number
  eps?: number
  beta?: number
  sector?: string
  industry?: string
  description?: string
}

export interface MarketOverview {
  [key: string]: {
    name: string
    value: number
    change: number
    change_percent: number
  }
}

export interface NewsArticle {
  title: string
  description: string
  url: string
  published_at: string
  source: string
  content: string
}

export interface NewsAnalysis {
  summary: string
  sentiment: 'bullish' | 'bearish' | 'neutral'
  sentiment_score: number
  key_points: string[]
  reasoning: string
  article_count: number
}

export interface NewsInsights {
  symbol: string
  analysis: NewsAnalysis
  raw_articles: NewsArticle[]
  last_updated: string
}

export interface ChartDataPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface HistoricalData {
  symbol: string
  period: string
  data: ChartDataPoint[]
  data_points: number
  period_high: number
  period_low: number
}

export interface TrendingStock {
  symbol: string
  reason: string
  sentiment: 'bullish' | 'bearish' | 'neutral'
}

export interface HighImpactEvent {
  event: string
  impact: 'high' | 'medium' | 'low'
  timeframe: string
}

export interface MarketAnalysis {
  market_sentiment: 'bullish' | 'bearish' | 'neutral'
  trending_stocks: TrendingStock[]
  key_themes: string[]
  daily_summary: string
  high_impact_events: HighImpactEvent[]
  article_count: number
  last_updated: string
}

export interface MarketInsights {
  analysis: MarketAnalysis
  raw_articles: NewsArticle[]
  last_updated: string
  days_back: number
}

class ApiClient {
  private async request<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }
    
    return response.json()
  }

  async getStock(symbol: string, period: string = '1y'): Promise<StockData> {
    return this.request<StockData>(`/api/stock/${symbol}?period=${period}`)
  }

  async getMarketOverview(): Promise<MarketOverview> {
    return this.request<MarketOverview>('/api/market/overview')
  }

  async getNewsInsights(symbol: string): Promise<NewsInsights> {
    return this.request<NewsInsights>(`/api/news/${symbol}`)
  }

  async getStockHistory(symbol: string, period: string = '1y'): Promise<HistoricalData> {
    return this.request<HistoricalData>(`/api/stock/${symbol}/history?period=${period}`)
  }

  async getMarketInsights(daysBack: number = 1): Promise<MarketInsights> {
    return this.request<MarketInsights>(`/api/market/insights?days_back=${daysBack}`)
  }
}

export const apiClient = new ApiClient()