'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

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
      <div className="relative flex items-center shadow-2xl">
        <Search className="absolute left-4 h-5 w-5 text-slate-400 z-10" />
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Search stocks (e.g. AAPL, TSLA, NVDA)"
          className="w-full pl-12 pr-32 py-4 text-lg border border-slate-600 bg-slate-800/80 text-slate-100 placeholder-slate-400 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-md transition-all duration-200 hover:bg-slate-800/90"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !symbol.trim()}
          className="absolute right-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
    </form>
  )
}