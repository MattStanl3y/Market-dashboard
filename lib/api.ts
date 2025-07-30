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
  private getCacheKey(endpoint: string): string {
    return `market-dashboard-cache-${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`
  }

  private getTSLABackupData(): StockData {
    return {
      symbol: 'TSLA',
      company_name: 'Tesla, Inc.',
      current_price: 248.50,
      change: 12.34,
      change_percent: 0.0523,
      market_cap: 792000000000,
      pe_ratio: 62.8,
      volume: 89567432,
      '52_week_high': 299.29,
      '52_week_low': 138.80,
      peg_ratio: 2.14,
      book_value: 28.64,
      dividend_per_share: 0,
      dividend_yield: 0,
      eps: 3.95,
      beta: 2.11,
      sector: 'Consumer Cyclical',
      industry: 'Auto Manufacturers',
      description: 'Tesla, Inc. designs, develops, manufactures, leases, and sells electric vehicles, and energy generation and storage systems.'
    }
  }

  private getCachedData<T>(cacheKey: string, maxAgeMinutes: number = 5): T | null {
    if (typeof window === 'undefined') return null
    
    try {
      const cached = localStorage.getItem(cacheKey)
      if (!cached) return null
      
      const { data, timestamp } = JSON.parse(cached)
      const age = Date.now() - timestamp
      const maxAge = maxAgeMinutes * 60 * 1000
      
      if (age < maxAge) {
        console.log(`Cache hit for ${cacheKey} (age: ${Math.round(age / 1000)}s)`)
        return data
      } else {
        localStorage.removeItem(cacheKey)
        return null
      }
    } catch (error) {
      console.error('Cache read error:', error)
      return null
    }
  }

  private setCachedData<T>(cacheKey: string, data: T): void {
    if (typeof window === 'undefined') return
    
    try {
      const cached = {
        data,
        timestamp: Date.now()
      }
      localStorage.setItem(cacheKey, JSON.stringify(cached))
      console.log(`Data cached for ${cacheKey}`)
    } catch (error) {
      console.error('Cache write error:', error)
    }
  }

  private async request<T>(endpoint: string, cacheMinutes: number = 5): Promise<T> {
    const cacheKey = this.getCacheKey(endpoint)
    
    // Try to get from cache first
    const cached = this.getCachedData<T>(cacheKey, cacheMinutes)
    if (cached) {
      return cached
    }

    console.log(`Making API request to ${endpoint}`)
    const response = await fetch(`${API_BASE_URL}${endpoint}`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }
    
    const data = await response.json()
    
    // Cache the response
    this.setCachedData(cacheKey, data)
    
    return data
  }

  async getStock(symbol: string, period: string = '1y'): Promise<StockData> {
    // Use backup data for TSLA to reduce API calls
    if (symbol.toUpperCase() === 'TSLA') {
      console.log('Using TSLA backup data')
      return this.getTSLABackupData()
    }
    
    // Cache stock data for 2 minutes (stock prices change frequently)
    return this.request<StockData>(`/api/stock/${symbol}?period=${period}`, 2)
  }

  async getMarketOverview(): Promise<MarketOverview> {
    // Cache market overview for 5 minutes
    return this.request<MarketOverview>('/api/market/overview', 5)
  }

  async getNewsInsights(symbol: string): Promise<NewsInsights> {
    // Cache news insights for 15 minutes (news doesn't change as frequently)
    return this.request<NewsInsights>(`/api/news/${symbol}`, 15)
  }

  async getStockHistory(symbol: string, period: string = '1y'): Promise<HistoricalData> {
    // Cache historical data for 30 minutes (historical data is more stable)
    return this.request<HistoricalData>(`/api/stock/${symbol}/history?period=${period}`, 30)
  }

  async getMarketInsights(daysBack: number = 1): Promise<MarketInsights> {
    // Cache market insights for 10 minutes
    return this.request<MarketInsights>(`/api/market/insights?days_back=${daysBack}`, 10)
  }
}

export const apiClient = new ApiClient()