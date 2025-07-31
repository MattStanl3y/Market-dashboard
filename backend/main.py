from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv
from newsapi import NewsApiClient
from datetime import datetime, timedelta
import openai
from typing import Optional

load_dotenv()

# Simple in-memory cache for chart data
chart_cache = {}

app = FastAPI(title="Market Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://market-dashboard-fawn.vercel.app",
        "https://market.mattstanley.dev"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Market Dashboard API is running"}


async def fetch_alpha_vantage_overview(symbol: str, api_key: str = None):
    """Fetch company overview data from Alpha Vantage API"""
    import httpx
    
    if api_key is None:
        api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
        if not api_key:
            raise Exception("Alpha Vantage API key not found in environment variables")
    
    try:
        overview_url = f"https://www.alphavantage.co/query?function=OVERVIEW&symbol={symbol}&apikey={api_key}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(overview_url, timeout=15)
            data = response.json()
            
            # Check for API errors
            if "Error Message" in data:
                raise Exception(data["Error Message"])
            elif "Note" in data:
                raise Exception("API call frequency limit reached. Please try again later.")
            elif "Information" in data:
                raise Exception(f"Alpha Vantage API limit: {data['Information']}")
            elif not data or data == {}:
                raise Exception("No overview data available for this symbol")
            
            # Extract key financial metrics
            def safe_float(value, default=None):
                try:
                    if value and value != "None" and value != "-":
                        return float(value)
                    return default
                except (ValueError, TypeError):
                    return default
            
            def safe_int(value, default=None):
                try:
                    if value and value != "None" and value != "-":
                        return int(float(value))
                    return default
                except (ValueError, TypeError):
                    return default
            
            return {
                "company_name": data.get("Name", f"{symbol} Inc."),
                "description": data.get("Description", ""),
                "sector": data.get("Sector", ""),
                "industry": data.get("Industry", ""),
                "market_cap": safe_int(data.get("MarketCapitalization")),
                "pe_ratio": safe_float(data.get("PERatio")),
                "peg_ratio": safe_float(data.get("PEGRatio")),
                "book_value": safe_float(data.get("BookValue")),
                "dividend_per_share": safe_float(data.get("DividendPerShare")),
                "dividend_yield": safe_float(data.get("DividendYield")),
                "eps": safe_float(data.get("EPS")),
                "revenue_per_share": safe_float(data.get("RevenuePerShareTTM")),
                "profit_margin": safe_float(data.get("ProfitMargin")),
                "operating_margin": safe_float(data.get("OperatingMarginTTM")),
                "return_on_assets": safe_float(data.get("ReturnOnAssetsTTM")),
                "return_on_equity": safe_float(data.get("ReturnOnEquityTTM")),
                "revenue_ttm": safe_int(data.get("RevenueTTM")),
                "gross_profit_ttm": safe_int(data.get("GrossProfitTTM")),
                "ebitda": safe_int(data.get("EBITDA")),
                "52_week_high": safe_float(data.get("52WeekHigh")),
                "52_week_low": safe_float(data.get("52WeekLow")),
                "beta": safe_float(data.get("Beta")),
                "shares_outstanding": safe_int(data.get("SharesOutstanding"))
            }
            
    except Exception as e:
        raise Exception(f"Alpha Vantage overview API error: {str(e)}")


async def fetch_alpha_vantage_stock(symbol: str, api_key: str = None):
    """Fetch stock data from Alpha Vantage API"""
    import httpx
    
    if api_key is None:
        api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
        if not api_key:
            raise Exception("Alpha Vantage API key not found in environment variables")
    
    try:
        # Get quote data and overview data in parallel
        quote_url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={symbol}&apikey={api_key}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(quote_url, timeout=10)
            data = response.json()
            
            if "Global Quote" not in data:
                if "Error Message" in data:
                    raise Exception(data["Error Message"])
                elif "Note" in data:
                    raise Exception("API call frequency limit reached. Please try again later.")
                elif "Information" in data:
                    raise Exception(f"Alpha Vantage API limit: {data['Information']}")
                else:
                    raise Exception("Invalid response from Alpha Vantage")
                
            quote = data["Global Quote"]
            
            # Try to get overview data for fundamental metrics
            overview_data = None
            try:
                overview_data = await fetch_alpha_vantage_overview(symbol, api_key)
            except Exception as overview_error:
                print(f"Overview data failed for {symbol}: {overview_error}")
                # Continue without overview data
            
            # Combine quote and overview data
            result = {
                "symbol": quote.get("01. symbol", symbol),
                "company_name": overview_data.get("company_name", f"{symbol} Inc.") if overview_data else f"{symbol} Inc.",
                "current_price": float(quote.get("05. price", 0)),
                "change": float(quote.get("09. change", 0)),
                "change_percent": float(quote.get("10. change percent", "0%").replace("%", "")),
                "volume": int(quote.get("06. volume", 0)),
                "52_week_high": float(quote.get("03. high", 0)),
                "52_week_low": float(quote.get("04. low", 0)),
                "historical_data": []
            }
            
            # Add overview data if available
            if overview_data:
                result.update({
                    "market_cap": overview_data.get("market_cap"),
                    "pe_ratio": overview_data.get("pe_ratio"),
                    "peg_ratio": overview_data.get("peg_ratio"),
                    "book_value": overview_data.get("book_value"),
                    "dividend_per_share": overview_data.get("dividend_per_share"),
                    "dividend_yield": overview_data.get("dividend_yield"),
                    "eps": overview_data.get("eps"),
                    "beta": overview_data.get("beta"),
                    "sector": overview_data.get("sector"),
                    "industry": overview_data.get("industry"),
                    "description": overview_data.get("description")
                })
                
                # Use overview 52-week high/low if available (more accurate)
                if overview_data.get("52_week_high"):
                    result["52_week_high"] = overview_data["52_week_high"]
                if overview_data.get("52_week_low"):
                    result["52_week_low"] = overview_data["52_week_low"]
            else:
                # Fallback values when overview is not available
                result.update({
                    "market_cap": None,
                    "pe_ratio": None,
                    "peg_ratio": None,
                    "book_value": None,
                    "dividend_per_share": None,
                    "dividend_yield": None,
                    "eps": None,
                    "beta": None,
                    "sector": None,
                    "industry": None,
                    "description": None
                })
            
            return result
            
    except Exception as e:
        raise Exception(f"Alpha Vantage API error: {str(e)}")


async def fetch_alpha_vantage_history(symbol: str, period: str = "1y", api_key: str = None):
    """Fetch historical stock data from Alpha Vantage API"""
    import httpx
    
    if api_key is None:
        api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
        if not api_key:
            raise Exception("Alpha Vantage API key not found in environment variables")
    
    # Check cache first (cache for 1 hour)
    cache_key = f"{symbol}_{period}"
    if cache_key in chart_cache:
        cached_data, cached_time = chart_cache[cache_key]
        if datetime.now() - cached_time < timedelta(hours=1):
            return cached_data
    
    try:
        # For 1D period, use intraday data (30min intervals)
        if period == "1d":
            url = f"https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol={symbol}&interval=30min&outputsize=full&apikey={api_key}"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=30)
                data = response.json()
                
                print(f"Alpha Vantage 1D response keys: {list(data.keys())}")  # Debug
                print(f"Alpha Vantage 1D response: {data}")  # Debug
                
                if "Time Series (30min)" not in data:
                    if "Error Message" in data:
                        raise Exception(data["Error Message"])
                    elif "Note" in data:
                        raise Exception("API call frequency limit reached. Please try again later.")
                    elif "Information" in data:
                        raise Exception(f"Alpha Vantage API limit: {data['Information']}")
                    else:
                        raise Exception(f"Invalid 1D response from Alpha Vantage. Got keys: {list(data.keys())}")
                
                time_series = data["Time Series (30min)"]
                
                # Convert to list format
                chart_data = []
                for datetime_str, values in time_series.items():
                    chart_data.append({
                        "date": datetime_str,
                        "open": float(values["1. open"]),
                        "high": float(values["2. high"]),
                        "low": float(values["3. low"]),
                        "close": float(values["4. close"]),
                        "volume": int(values["5. volume"])
                    })
                
                # Sort by datetime (oldest first)
                chart_data.sort(key=lambda x: x["date"])
                
                # Filter to current trading day (9:30 AM - 4:00 PM EST)
                import pytz
                
                est = pytz.timezone('US/Eastern')
                now_est = datetime.now(est)
                
                # Get current date in EST
                current_date = now_est.date()
                
                # Define trading hours (9:30 AM - 4:00 PM EST)
                market_open = est.localize(datetime.combine(current_date, datetime.min.time().replace(hour=9, minute=30)))
                market_close = est.localize(datetime.combine(current_date, datetime.min.time().replace(hour=16, minute=0)))
                
                # If market is closed or it's weekend, use previous trading day
                if now_est.weekday() >= 5:  # Weekend
                    # Go back to Friday
                    days_back = now_est.weekday() - 4
                    current_date = current_date - timedelta(days=days_back)
                    market_open = est.localize(datetime.combine(current_date, datetime.min.time().replace(hour=9, minute=30)))
                    market_close = est.localize(datetime.combine(current_date, datetime.min.time().replace(hour=16, minute=0)))
                elif now_est < market_open:  # Before market opens today
                    # Use previous trading day
                    if now_est.weekday() == 0:  # Monday, go back to Friday
                        current_date = current_date - timedelta(days=3)
                    else:
                        current_date = current_date - timedelta(days=1)
                    market_open = est.localize(datetime.combine(current_date, datetime.min.time().replace(hour=9, minute=30)))
                    market_close = est.localize(datetime.combine(current_date, datetime.min.time().replace(hour=16, minute=0)))
                
                # Filter data to trading hours of the target date
                filtered_data = []
                for item in chart_data:
                    item_dt = datetime.strptime(item["date"], "%Y-%m-%d %H:%M:%S")
                    item_dt_est = pytz.UTC.localize(item_dt).astimezone(est)
                    
                    if market_open <= item_dt_est <= market_close:
                        filtered_data.append(item)
                
        else:
            # Use TIME_SERIES_DAILY for other periods
            url = f"https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol={symbol}&outputsize=full&apikey={api_key}"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=30)
                data = response.json()
                
                print(f"Alpha Vantage Daily response keys: {list(data.keys())}")  # Debug
                print(f"Alpha Vantage Daily response: {data}")  # Debug
                
                if "Time Series (Daily)" not in data:
                    if "Error Message" in data:
                        raise Exception(data["Error Message"])
                    elif "Note" in data:
                        raise Exception("API call frequency limit reached. Please try again later.")
                    elif "Information" in data:
                        raise Exception(f"Alpha Vantage API limit: {data['Information']}")
                    else:
                        raise Exception(f"Invalid Daily response from Alpha Vantage. Got keys: {list(data.keys())}")
                
                time_series = data["Time Series (Daily)"]
                
                # Convert to list format and sort by date
                chart_data = []
                for date_str, values in time_series.items():
                    chart_data.append({
                        "date": date_str,
                        "open": float(values["1. open"]),
                        "high": float(values["2. high"]),
                        "low": float(values["3. low"]),
                        "close": float(values["4. close"]),
                        "volume": int(values["5. volume"])
                    })
                
                # Sort by date (oldest first)
                chart_data.sort(key=lambda x: x["date"])
                
                # Filter by period
                end_date = datetime.now()
                if period == "1w":
                    start_date = end_date - timedelta(days=7)
                elif period == "3m":
                    start_date = end_date - timedelta(days=90)
                elif period == "1y":
                    start_date = end_date - timedelta(days=365)
                else:  # Default to 1 year
                    start_date = end_date - timedelta(days=365)
                
                filtered_data = [
                    item for item in chart_data 
                    if datetime.strptime(item["date"], "%Y-%m-%d") >= start_date
                ]
        
        # Calculate period high/low from the filtered data
        if filtered_data:
            period_high = max(item['high'] for item in filtered_data)
            period_low = min(item['low'] for item in filtered_data)
        else:
            period_high = 0
            period_low = 0
        
        # Add period high/low to the response data
        result_data = {
            "data": filtered_data,
            "period_high": period_high,
            "period_low": period_low
        }
        
        # Cache the result
        chart_cache[cache_key] = (result_data, datetime.now())
        
        return result_data
            
    except Exception as e:
        raise Exception(f"Alpha Vantage history API error: {str(e)}")


async def fetch_news_for_symbol(symbol: str, api_key: str = None):
    """Fetch recent news for a stock symbol using NewsAPI"""
    if api_key is None:
        api_key = os.getenv("NEWS_API_KEY")
        if not api_key:
            # Fallback to mock data for development
            return [
                {
                    "title": f"{symbol} Reports Strong Quarterly Earnings",
                    "description": f"{symbol} exceeded analyst expectations with robust revenue growth and positive outlook for next quarter.",
                    "url": "https://example.com/mock-news-1",
                    "published_at": "2024-01-20T10:30:00Z",
                    "source": "Financial Times",
                    "content": f"Company {symbol} demonstrated strong performance in recent quarterly results..."
                },
                {
                    "title": f"Analysts Upgrade {symbol} Price Target",
                    "description": f"Major investment banks raise price targets for {symbol} citing strong fundamentals and market position.",
                    "url": "https://example.com/mock-news-2", 
                    "published_at": "2024-01-19T14:15:00Z",
                    "source": "Reuters",
                    "content": f"Several analysts have revised their outlook on {symbol} following recent developments..."
                },
                {
                    "title": f"{symbol} Announces Strategic Partnership",
                    "description": f"{symbol} enters new strategic alliance expected to drive future growth and market expansion.",
                    "url": "https://example.com/mock-news-3",
                    "published_at": "2024-01-18T09:45:00Z", 
                    "source": "Bloomberg",
                    "content": f"The partnership between {symbol} and industry leaders signals strong growth potential..."
                }
            ]
    
    try:
        newsapi = NewsApiClient(api_key=api_key)
        
        # Get news from last 7 days
        to_date = datetime.now()
        from_date = to_date - timedelta(days=7)
        
        # Financial news domains to prioritize
        financial_domains = [
            'reuters.com', 'bloomberg.com', 'wsj.com', 'marketwatch.com',
            'cnbc.com', 'yahoo.com', 'fool.com', 'seekingalpha.com',
            'finance.yahoo.com', 'financialnews.com', 'investorplace.com',
            'benzinga.com', 'forbes.com', 'barrons.com'
        ]
        
        # Terms to exclude (product announcements, etc.)
        exclude_terms = ['game', 'app store', 'mac', 'iphone', 'ipad', 'beta', 'software', 'release']
        
        # Search for news related to the company with financial focus
        company_searches = [
            f"{symbol} earnings OR revenue OR profit OR loss",
            f"{symbol} stock OR shares OR trading OR price",
            f"{symbol} analyst OR upgrade OR downgrade OR target",
            f"{symbol} financial OR quarterly OR annual OR results"
        ]
        
        all_articles = []
        
        for search_term in company_searches:
            try:
                articles = newsapi.get_everything(
                    q=search_term,
                    language='en',
                    sort_by='publishedAt',
                    from_param=from_date.strftime('%Y-%m-%d'),
                    to=to_date.strftime('%Y-%m-%d'),
                    page_size=10,
                    domains=','.join(financial_domains)
                )
                
                if articles.get('articles'):
                    for article in articles['articles']:
                        title = article.get('title', '').lower()
                        description = article.get('description', '').lower()
                        
                        # Check if article is actually about the stock/company
                        if symbol.lower() in title or symbol.lower() in description:
                            # Exclude non-financial content
                            if not any(exclude_term in title for exclude_term in exclude_terms):
                                # Check for financial keywords
                                financial_keywords = ['stock', 'share', 'earnings', 'revenue', 'profit', 
                                                    'analyst', 'price', 'target', 'upgrade', 'downgrade',
                                                    'financial', 'quarterly', 'trading', 'market']
                                
                                if any(keyword in title or keyword in description for keyword in financial_keywords):
                                    all_articles.append({
                                        'title': article.get('title', ''),
                                        'description': article.get('description', ''),
                                        'url': article.get('url', ''),
                                        'published_at': article.get('publishedAt', ''),
                                        'source': article.get('source', {}).get('name', ''),
                                        'content': article.get('content', '')[:500] if article.get('content') else ''
                                    })
                            
            except Exception as search_error:
                print(f"Error searching for {search_term}: {search_error}")
                continue
        
        # Remove duplicates based on URL and limit to 10 most recent
        seen_urls = set()
        unique_articles = []
        for article in sorted(all_articles, key=lambda x: x['published_at'], reverse=True):
            if article['url'] not in seen_urls and len(unique_articles) < 10:
                seen_urls.add(article['url'])
                unique_articles.append(article)
        
        # If no articles found with strict filtering, try broader search
        if not unique_articles:
            print(f"No articles found with strict filtering for {symbol}, trying broader search...")
            try:
                articles = newsapi.get_everything(
                    q=symbol,
                    language='en',
                    sort_by='publishedAt',
                    from_param=from_date.strftime('%Y-%m-%d'),
                    to=to_date.strftime('%Y-%m-%d'),
                    page_size=5
                )
                
                if articles.get('articles'):
                    for article in articles['articles']:
                        title = article.get('title', '').lower()
                        description = article.get('description', '').lower()
                        
                        if (symbol.lower() in title or symbol.lower() in description) and len(unique_articles) < 5:
                            unique_articles.append({
                                'title': article.get('title', ''),
                                'description': article.get('description', ''),
                                'url': article.get('url', ''),
                                'published_at': article.get('publishedAt', ''),
                                'source': article.get('source', {}).get('name', ''),
                                'content': article.get('content', '')[:500] if article.get('content') else ''
                            })
                            
            except Exception as broad_search_error:
                print(f"Broad search also failed for {symbol}: {broad_search_error}")
        
        return unique_articles
        
    except Exception as e:
        raise Exception(f"News API error: {str(e)}")


async def fetch_market_news(api_key: str = None, days_back: int = 1):
    """Fetch general market news for AI analysis of trending stocks and events"""
    if api_key is None:
        api_key = os.getenv("NEWS_API_KEY")
        if not api_key:
            # Return mock market news for development
            return [
                {
                    "title": "Tesla Reports Record Q4 Earnings, Stock Jumps 8% in After-Hours Trading",
                    "description": "Electric vehicle maker Tesla exceeded analyst expectations with strong quarterly results, boosting investor confidence.",
                    "url": "https://example.com/tesla-earnings",
                    "published_at": "2024-01-25T16:30:00Z",
                    "source": "Reuters",
                    "content": "Tesla Inc. reported record quarterly earnings...",
                    "mentions": ["TSLA"]
                },
                {
                    "title": "Fed Signals Potential Rate Cuts as Inflation Cools",
                    "description": "Federal Reserve officials hint at possible interest rate reductions following lower-than-expected inflation data.",
                    "url": "https://example.com/fed-rates",
                    "published_at": "2024-01-25T14:20:00Z",
                    "source": "Wall Street Journal",
                    "content": "The Federal Reserve is considering rate cuts...",
                    "mentions": ["SPY", "QQQ", "DJI"]
                },
                {
                    "title": "Microsoft and OpenAI Partnership Deepens with $10B Investment",
                    "description": "Microsoft announces expanded partnership with OpenAI, investing billions more in AI development and integration.",
                    "url": "https://example.com/msft-openai",
                    "published_at": "2024-01-25T11:45:00Z",
                    "source": "Bloomberg",
                    "content": "Microsoft Corp. is expanding its relationship with OpenAI...",
                    "mentions": ["MSFT", "GOOGL", "NVDA"]
                },
                {
                    "title": "Amazon Web Services Launches New AI Cloud Services",
                    "description": "Amazon's cloud division unveils suite of AI tools to compete with Microsoft and Google in enterprise AI market.",
                    "url": "https://example.com/aws-ai",
                    "published_at": "2024-01-25T09:15:00Z",
                    "source": "CNBC",
                    "content": "Amazon Web Services announced new AI capabilities...",
                    "mentions": ["AMZN", "MSFT", "GOOGL"]
                },
                {
                    "title": "Apple Earnings Preview: iPhone Sales in Focus Amid China Concerns",
                    "description": "Analysts expect Apple's upcoming earnings to reveal impact of China market challenges on iPhone revenue.",
                    "url": "https://example.com/aapl-earnings-preview",
                    "published_at": "2024-01-25T08:00:00Z",
                    "source": "MarketWatch",
                    "content": "Apple Inc. is set to report quarterly earnings next week...",
                    "mentions": ["AAPL"]
                }
            ]
    
    try:
        newsapi = NewsApiClient(api_key=api_key)
        
        # Get news from specified days back
        to_date = datetime.now()
        from_date = to_date - timedelta(days=days_back)
        
        # Market-focused search terms
        market_searches = [
            "earnings OR revenue OR profit OR quarterly results",
            "stock market OR trading OR NYSE OR NASDAQ",
            "Federal Reserve OR interest rates OR inflation",
            "merger OR acquisition OR deal OR partnership",
            "IPO OR stock debut OR public offering",
            "analyst upgrade OR downgrade OR price target",
            "CEO OR executive OR leadership change",
            "regulation OR SEC OR antitrust"
        ]
        
        all_articles = []
        
        for search_term in market_searches:
            try:
                articles = newsapi.get_everything(
                    q=search_term,
                    language='en',
                    sort_by='publishedAt',
                    from_param=from_date.strftime('%Y-%m-%d'),
                    to=to_date.strftime('%Y-%m-%d'),
                    page_size=15,
                    domains='reuters.com,bloomberg.com,wsj.com,marketwatch.com,cnbc.com,yahoo.com,benzinga.com,forbes.com,barrons.com'
                )
                
                if articles.get('articles'):
                    for article in articles['articles']:
                        title = article.get('title', '').lower()
                        description = article.get('description', '').lower()
                        content = article.get('content', '') or article.get('description', '')
                        
                        # Extract mentioned stock symbols (basic regex)
                        import re
                        symbol_pattern = r'\b([A-Z]{1,5})\b'
                        mentioned_symbols = []
                        
                        # Look for stock symbols in title and description
                        text_to_search = f"{title} {description}".upper()
                        potential_symbols = re.findall(symbol_pattern, text_to_search)
                        
                        # Filter to likely stock symbols (3-5 chars, exclude common words)
                        exclude_words = {'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'HAD', 'BUT', 'CEO', 'CFO', 'IPO', 'SEC', 'FDA', 'API', 'USA', 'NYSE', 'ETF'}
                        for symbol in potential_symbols:
                            if len(symbol) >= 3 and len(symbol) <= 5 and symbol not in exclude_words:
                                mentioned_symbols.append(symbol)
                        
                        # Check for financial keywords to ensure relevance
                        financial_keywords = ['stock', 'share', 'earnings', 'revenue', 'profit', 'quarter', 
                                            'analyst', 'price', 'target', 'upgrade', 'downgrade', 'trading',
                                            'market', 'investor', 'billion', 'million', 'ceo', 'merger',
                                            'acquisition', 'ipo', 'sec', 'fed', 'rates']
                        
                        if any(keyword in title or keyword in description for keyword in financial_keywords):
                            all_articles.append({
                                'title': article.get('title', ''),
                                'description': article.get('description', ''),
                                'url': article.get('url', ''),
                                'published_at': article.get('publishedAt', ''),
                                'source': article.get('source', {}).get('name', ''),
                                'content': content[:500] if content else '',
                                'mentions': list(set(mentioned_symbols))  # Remove duplicates
                            })
                            
            except Exception as search_error:
                print(f"Error searching market news for {search_term}: {search_error}")
                continue
        
        # Remove duplicates and sort by publish date
        seen_urls = set()
        unique_articles = []
        for article in sorted(all_articles, key=lambda x: x['published_at'], reverse=True):
            if article['url'] not in seen_urls and len(unique_articles) < 25:
                seen_urls.add(article['url'])
                unique_articles.append(article)
        
        return unique_articles
        
    except Exception as e:
        raise Exception(f"Market news API error: {str(e)}")


async def analyze_market_trends_with_openai(articles: list, api_key: str = None):
    """Use OpenAI to analyze market news and extract trending stocks and themes"""
    if api_key is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise Exception("OpenAI API key not found in environment variables")
    
    if not articles:
        return {
            "market_sentiment": "neutral",
            "trending_stocks": [],
            "key_themes": [],
            "daily_summary": "No recent market news found.",
            "high_impact_events": []
        }
    
    try:
        # Prepare news content for analysis (limit for token efficiency)
        news_content = ""
        stock_mentions = {}
        
        for i, article in enumerate(articles[:15], 1):  # Limit to 15 articles
            news_content += f"\nArticle {i}:\n"
            news_content += f"Title: {article['title']}\n"
            news_content += f"Description: {article['description']}\n"
            news_content += f"Source: {article['source']}\n"
            
            # Count stock mentions
            for symbol in article.get('mentions', []):
                stock_mentions[symbol] = stock_mentions.get(symbol, 0) + 1
        
        # Create OpenAI client
        client = openai.OpenAI(api_key=api_key)
        
        prompt = f"""
You are a financial market analyst. Analyze these recent financial news articles and respond with ONLY valid JSON in this exact format:

{{
    "market_sentiment": "bullish" or "bearish" or "neutral",
    "trending_stocks": [
        {{"symbol": "AAPL", "reason": "Strong earnings report", "sentiment": "bullish"}},
        {{"symbol": "TSLA", "reason": "Production concerns", "sentiment": "bearish"}}
    ],
    "key_themes": ["AI partnerships", "Interest rate changes", "Earnings season"],
    "daily_summary": "2-3 sentence summary of key market developments",
    "high_impact_events": [
        {{"event": "Fed meeting", "impact": "high", "timeframe": "this week"}},
        {{"event": "Apple earnings", "impact": "medium", "timeframe": "next week"}}
    ]
}}

IMPORTANT: 
- Respond ONLY with valid JSON
- No additional text before or after
- Focus on actionable insights for traders
- Identify 3-5 most mentioned/relevant stocks
- Highlight upcoming events that could move markets

Recent Financial News:
{news_content}

Stock mentions in articles: {dict(list(stock_mentions.items())[:10])}
"""

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a financial analyst. Respond ONLY with valid JSON. No extra text."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=800,
            temperature=0.2
        )
        
        response_text = response.choices[0].message.content.strip()
        print(f"OpenAI Market Analysis Response: {response_text}")  # Debug logging
        
        # Extract JSON if response has extra text
        if not response_text.startswith('{'):
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                response_text = response_text[json_start:json_end]
        
        import json
        analysis = json.loads(response_text)
        
        # Validate and set defaults
        analysis.setdefault("market_sentiment", "neutral")
        analysis.setdefault("trending_stocks", [])
        analysis.setdefault("key_themes", [])
        analysis.setdefault("daily_summary", "Market analysis unavailable")
        analysis.setdefault("high_impact_events", [])
        
        # Add metadata
        analysis["article_count"] = len(articles)
        analysis["last_updated"] = datetime.now().isoformat()
        
        return analysis
        
    except json.JSONDecodeError as json_error:
        print(f"JSON parsing error in market analysis: {json_error}")
        print(f"Response was: {response_text}")
        
        # Fallback analysis based on article data
        top_stocks = sorted(stock_mentions.items(), key=lambda x: x[1], reverse=True)[:5]
        
        return {
            "market_sentiment": "neutral",
            "trending_stocks": [
                {"symbol": symbol, "reason": f"Mentioned in {count} articles", "sentiment": "neutral"}
                for symbol, count in top_stocks
            ],
            "key_themes": ["Market News", "Corporate Updates", "Economic Reports"],
            "daily_summary": f"Found {len(articles)} recent financial news articles covering various market developments.",
            "high_impact_events": [],
            "article_count": len(articles),
            "last_updated": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise Exception(f"OpenAI market analysis error: {str(e)}")


async def analyze_news_with_openai(articles: list, symbol: str, api_key: str = None):
    """Use OpenAI to analyze and summarize news articles for sentiment and key insights"""
    if api_key is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise Exception("OpenAI API key not found in environment variables")
    
    if not articles:
        return {
            "summary": "No recent news found for this symbol.",
            "sentiment": "neutral",
            "sentiment_score": 0.0,
            "key_points": [],
            "article_count": 0
        }
    
    try:
        # Prepare news content for analysis
        news_content = ""
        for i, article in enumerate(articles[:5], 1):  # Limit to 5 articles for token efficiency
            news_content += f"\nArticle {i}:\n"
            news_content += f"Title: {article['title']}\n"
            news_content += f"Description: {article['description']}\n"
            news_content += f"Source: {article['source']}\n"
            if article['content']:
                news_content += f"Content: {article['content']}\n"
        
        # Create OpenAI client
        client = openai.OpenAI(api_key=api_key)
        
        prompt = f"""
You are a financial analyst. Analyze these news articles about {symbol} stock and respond with ONLY valid JSON in this exact format:

{{
    "summary": "2-3 sentence summary of key developments",
    "sentiment": "bullish" or "bearish" or "neutral",
    "sentiment_score": number between -1.0 and 1.0,
    "key_points": ["key point 1", "key point 2", "key point 3"],
    "reasoning": "Brief explanation of why this sentiment"
}}

IMPORTANT: 
- Respond ONLY with valid JSON
- No additional text before or after
- Use double quotes for all strings
- sentiment_score: -1.0 = very bearish, 0.0 = neutral, +1.0 = very bullish

News Articles:
{news_content}
"""

        try:
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a financial analyst. Respond ONLY with valid JSON. No extra text."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=600,
                temperature=0.2
            )
            
            response_text = response.choices[0].message.content.strip()
            print(f"OpenAI Response for {symbol}: {response_text}")  # Debug logging
            
            # Try to extract JSON if response has extra text
            if not response_text.startswith('{'):
                json_start = response_text.find('{')
                json_end = response_text.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    response_text = response_text[json_start:json_end]
            
            import json
            analysis = json.loads(response_text)
            
            # Validate required fields
            required_fields = ['summary', 'sentiment', 'sentiment_score', 'key_points', 'reasoning']
            for field in required_fields:
                if field not in analysis:
                    raise ValueError(f"Missing required field: {field}")
            
            # Validate sentiment_score is a number
            if not isinstance(analysis['sentiment_score'], (int, float)):
                analysis['sentiment_score'] = 0.0
            
            # Ensure sentiment_score is in valid range
            analysis['sentiment_score'] = max(-1.0, min(1.0, float(analysis['sentiment_score'])))
            
            # Validate sentiment value
            if analysis['sentiment'] not in ['bullish', 'bearish', 'neutral']:
                analysis['sentiment'] = 'neutral'
                analysis['sentiment_score'] = 0.0
            
            analysis["article_count"] = len(articles)
            return analysis
            
        except json.JSONDecodeError as json_error:
            print(f"JSON parsing error for {symbol}: {json_error}")
            print(f"Response was: {response_text}")
            
            # Create basic analysis from article titles
            titles = [article['title'] for article in articles[:3]]
            
            return {
                "summary": f"Found {len(articles)} recent financial news articles about {symbol}. Key headlines: {'; '.join(titles[:2])}",
                "sentiment": "neutral",
                "sentiment_score": 0.0,
                "key_points": titles,
                "article_count": len(articles),
                "reasoning": "AI analysis failed - fallback to article titles"
            }
    except Exception as e:
        raise Exception(f"OpenAI analysis error: {str(e)}")

@app.get("/api/stock/{symbol}")
async def get_stock_data(symbol: str):
    try:
        # Try Alpha Vantage first
        try:
            return await fetch_alpha_vantage_stock(symbol.upper())
        except Exception as alpha_error:
            print(f"Alpha Vantage failed: {alpha_error}")
            raise Exception(f"Failed to fetch data for {symbol}: {str(alpha_error)}")
            
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": f"Failed to fetch data for {symbol}: {str(e)}"}
        )

@app.get("/api/market/overview")
async def get_market_overview():
    """Get market overview using Alpha Vantage - TODO: Implement with Alpha Vantage API"""
    # Temporary mock data until Alpha Vantage market overview is implemented
    return {
        "^GSPC": {
            "name": "S&P 500",
            "value": 5500.25,
            "change": 12.50,
            "change_percent": 0.23
        },
        "^DJI": {
            "name": "Dow Jones",
            "value": 38750.80,
            "change": -45.20,
            "change_percent": -0.12
        },
        "^IXIC": {
            "name": "NASDAQ",
            "value": 17250.45,
            "change": 85.30,
            "change_percent": 0.50
        }
    }

@app.get("/api/news/{symbol}")
async def get_news_insights(symbol: str):
    """Get AI-analyzed news insights for a stock symbol"""
    try:
        # Fetch recent news articles
        articles = await fetch_news_for_symbol(symbol.upper())
        
        # Analyze with OpenAI
        analysis = await analyze_news_with_openai(articles, symbol.upper())
        
        # Include raw articles for frontend display if needed
        response = {
            "symbol": symbol.upper(),
            "analysis": analysis,
            "raw_articles": articles[:5],  # First 5 articles for display
            "last_updated": datetime.now().isoformat()
        }
        
        return response
        
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": f"Failed to fetch news insights for {symbol}: {str(e)}"}
        )

@app.get("/api/stock/{symbol}/history")
async def get_stock_history(symbol: str, period: str = "1y"):
    """Get historical stock data for charting"""
    try:
        # Validate period parameter
        valid_periods = ["1d", "1w", "3m", "1y"]
        if period not in valid_periods:
            return JSONResponse(
                status_code=400,
                content={"error": f"Invalid period. Must be one of: {', '.join(valid_periods)}"}
            )
        
        # Fetch historical data
        history_data = await fetch_alpha_vantage_history(symbol.upper(), period)
        
        response = {
            "symbol": symbol.upper(),
            "period": period,
            "data": history_data["data"],
            "data_points": len(history_data["data"]),
            "period_high": history_data["period_high"],
            "period_low": history_data["period_low"]
        }
        
        return response
        
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": f"Failed to fetch historical data for {symbol}: {str(e)}"}
        )

@app.get("/api/market/insights")
async def get_market_insights(days_back: int = 1):
    """Get AI-analyzed market insights and trending stocks from recent news"""
    try:
        # Fetch recent market news
        articles = await fetch_market_news(days_back=days_back)
        
        # Analyze with OpenAI to extract trends and insights
        analysis = await analyze_market_trends_with_openai(articles)
        
        # Include raw articles for frontend display
        response = {
            "analysis": analysis,
            "raw_articles": articles[:10],  # First 10 articles for display
            "last_updated": datetime.now().isoformat(),
            "days_back": days_back
        }
        
        return response
        
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": f"Failed to fetch market insights: {str(e)}"}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)