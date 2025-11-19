# MarketPulse

**Live at:** [market.mattstanley.dev](https://market.mattstanley.dev)

Real-time financial market analysis platform providing stock data, market insights, and AI-powered trend analysis.

## How It Works

The application combines three external APIs to deliver market intelligence:

**Alpha Vantage API:** Provides real-time stock quotes, company fundamentals, and historical price data for core stock information.

**News API:** Fetches financial news and market headlines. Articles are filtered for market relevance, though some irrelevant content may appear.

**OpenAI API:** Analyzes news articles to generate market sentiment analysis, identify trending stocks, and provide market summaries with actionable insights.

## Features

- Live stock quotes and company data
- Interactive price charts with historical analysis
- AI-generated market insights and sentiment analysis
- Personal watchlist management
- Real-time market news feed

## Tech Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** FastAPI (Python)
- **Charts:** Recharts

**Note:** Due to API rate limits, mock data is used as fallback to ensure continuous availability. News filtering may occasionally include non-financial articles.
