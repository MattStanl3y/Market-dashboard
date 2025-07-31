'use client'

import { useState } from 'react'
import { Search, ArrowRight } from 'lucide-react'

interface SearchBarProps {
  onSearch: (symbol: string) => void
  loading?: boolean
}

export default function SearchBar({ onSearch, loading = false }: SearchBarProps) {
  const [symbol, setSymbol] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (symbol.trim()) {
      onSearch(symbol.trim().toUpperCase())
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-slate-600/20 rounded-2xl blur-xl opacity-50"></div>
        <div className="relative flex items-center shadow-2xl">
          <Search className="absolute left-5 h-5 w-5 text-slate-400 z-10" />
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="Search stocks (e.g. AAPL, TSLA, NVDA)"
            className="w-full pl-14 pr-36 py-5 text-lg border border-slate-600/50 bg-slate-800/90 text-slate-100 placeholder-slate-400 rounded-2xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 backdrop-blur-md transition-all duration-300 hover:bg-slate-800/95 focus:bg-slate-800/95"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !symbol.trim()}
            className="absolute right-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-slate-600 text-white rounded-xl hover:from-blue-700 hover:to-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            {loading ? (
              <span>Searching...</span>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                <span>Search</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}