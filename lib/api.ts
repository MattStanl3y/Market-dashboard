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
}

export interface MarketOverview {
  [key: string]: {
    name: string
    value: number
    change: number
    change_percent: number
  }
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
}

export const apiClient = new ApiClient()