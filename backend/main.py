from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv
from newsapi import NewsApiClient
from datetime import datetime, timedelta
import openai
from typing import Optional
import time

load_dotenv()

# Simple in-memory cache for chart data
chart_cache = {}

# Simple rate limiting cache
rate_limit_cache = {}

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
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

def check_rate_limit(client_ip: str, max_requests: int = 60, window_minutes: int = 1) -> bool:
    """Simple rate limiting - max_requests per window_minutes"""
    current_time = time.time()
    window_size = window_minutes * 60
    
    if client_ip not in rate_limit_cache:
        rate_limit_cache[client_ip] = []
    
    # Remove old requests outside the window
    rate_limit_cache[client_ip] = [
        req_time for req_time in rate_limit_cache[client_ip] 
        if current_time - req_time < window_size
    ]
    
    # Check if limit exceeded
    if len(rate_limit_cache[client_ip]) >= max_requests:
        return False
    
    # Add current request
    rate_limit_cache[client_ip].append(current_time)
    return True

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
                raise Exception(f"Alpha Vantage API limit reached for {symbol}")
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
        raise Exception(f"Alpha Vantage overview API error for {symbol}: Failed to fetch company data")


def generate_mock_historical_data(symbol: str, period: str = "1y"):
    """Generate realistic mock historical chart data when Alpha Vantage is unavailable"""
    import random
    from datetime import datetime, timedelta
    
    # Get base price from our mock stock data
    base_data = get_mock_stock_data(symbol)
    base_price = base_data['current_price']
    
    # Determine date range and interval based on period
    end_date = datetime.now()
    if period == "1d":
        start_date = end_date - timedelta(days=1)
        # For 1D, use 30-minute intervals during trading hours
        intervals = []
        current = start_date.replace(hour=9, minute=30, second=0, microsecond=0)
        while current <= end_date.replace(hour=16, minute=0):
            intervals.append(current)
            current += timedelta(minutes=30)
    elif period == "1w":
        start_date = end_date - timedelta(days=7)
        intervals = [(start_date + timedelta(days=i)) for i in range(8)]
    elif period == "3m":
        start_date = end_date - timedelta(days=90)
        intervals = [(start_date + timedelta(days=i*3)) for i in range(31)]
    else:  # 1y
        start_date = end_date - timedelta(days=365)
        intervals = [(start_date + timedelta(days=i*7)) for i in range(53)]
    
    # Generate realistic price movement
    data = []
    current_price = base_price * 0.95  # Start slightly lower than current
    
    # Calculate volatility based on period (shorter periods = less volatility)
    volatility = {
        "1d": 0.01,    # 1% daily volatility
        "1w": 0.02,    # 2% weekly volatility  
        "3m": 0.03,    # 3% quarterly volatility
        "1y": 0.04     # 4% yearly volatility
    }.get(period, 0.03)
    
    for i, date in enumerate(intervals):
        # Random walk with slight upward trend
        change = random.gauss(0.001, volatility)  # Slight positive drift
        current_price *= (1 + change)
        
        # Add some realistic daily variation
        daily_high = current_price * (1 + random.uniform(0, volatility/2))
        daily_low = current_price * (1 - random.uniform(0, volatility/2))
        open_price = current_price * (1 + random.uniform(-volatility/4, volatility/4))
        
        # Generate volume (higher volume on bigger price moves)
        volume_base = random.randint(20000000, 60000000)
        volume_multiplier = 1 + abs(change) * 10
        volume = int(volume_base * volume_multiplier)
        
        data.append({
            "date": date.strftime("%Y-%m-%d %H:%M:%S") if period == "1d" else date.strftime("%Y-%m-%d"),
            "open": round(open_price, 2),
            "high": round(daily_high, 2),
            "low": round(daily_low, 2),
            "close": round(current_price, 2),
            "volume": volume
        })
    
    # Calculate period high/low
    period_high = max(item['high'] for item in data)
    period_low = min(item['low'] for item in data)
    
    return {
        "data": data,
        "period_high": period_high,
        "period_low": period_low,
        "is_mock_data": True  # Flag to indicate this is mock data
    }


def get_mock_stock_data(symbol: str):
    """Get realistic mock stock data for featured picks when API is unavailable"""
    import random
    
    # Base data for different symbols with realistic market caps and sectors
    mock_data = {
        'AAPL': {
            'company_name': 'Apple Inc.',
            'base_price': 185.0,
            'sector': 'Technology',
            'industry': 'Consumer Electronics',
            'market_cap': 2800000000000,
            'pe_ratio': 28.5,
            'description': 'Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.'
        },
        'TSLA': {
            'company_name': 'Tesla, Inc.',
            'base_price': 248.0,
            'sector': 'Consumer Cyclical',
            'industry': 'Auto Manufacturers',
            'market_cap': 780000000000,
            'pe_ratio': 65.2,
            'description': 'Tesla, Inc. designs, develops, manufactures, leases, and sells electric vehicles, and energy generation and storage systems.'
        },
        'NVDA': {
            'company_name': 'NVIDIA Corporation',
            'base_price': 875.0,
            'sector': 'Technology',
            'industry': 'Semiconductors',
            'market_cap': 2150000000000,
            'pe_ratio': 45.8,
            'description': 'NVIDIA Corporation operates as a computing company in the United States and internationally.'
        },
        'MSFT': {
            'company_name': 'Microsoft Corporation',
            'base_price': 420.0,
            'sector': 'Technology',
            'industry': 'Software—Infrastructure',
            'market_cap': 3100000000000,
            'pe_ratio': 32.1,
            'description': 'Microsoft Corporation develops, licenses, and supports software, services, devices, and solutions worldwide.'
        },
        'GOOGL': {
            'company_name': 'Alphabet Inc.',
            'base_price': 165.0,
            'sector': 'Communication Services',
            'industry': 'Internet Content & Information',
            'market_cap': 2050000000000,
            'pe_ratio': 25.4,
            'description': 'Alphabet Inc. provides various products and services in the United States, international markets, and China.'
        },
        'AMZN': {
            'company_name': 'Amazon.com, Inc.',
            'base_price': 145.0,
            'sector': 'Consumer Cyclical',
            'industry': 'Internet Retail',
            'market_cap': 1500000000000,
            'pe_ratio': 48.7,
            'description': 'Amazon.com, Inc. engages in the retail sale of consumer products and subscriptions in North America and internationally.'
        },
        'META': {
            'company_name': 'Meta Platforms, Inc.',
            'base_price': 485.0,
            'sector': 'Communication Services',
            'industry': 'Internet Content & Information',
            'market_cap': 1200000000000,
            'pe_ratio': 26.8,
            'description': 'Meta Platforms, Inc. develops products that enable people to connect and share with friends and family through mobile devices, personal computers, virtual reality headsets, and wearables worldwide.'
        },
        'NFLX': {
            'company_name': 'Netflix, Inc.',
            'base_price': 485.0,
            'sector': 'Communication Services',
            'industry': 'Entertainment',
            'market_cap': 210000000000,
            'pe_ratio': 42.3,
            'description': 'Netflix, Inc. provides entertainment services. It offers TV series, documentaries, feature films, and mobile games across a wide variety of genres and languages.'
        }
    }
    
    # Get base data or create generic data for unknown symbols
    base = mock_data.get(symbol, {
        'company_name': f'{symbol} Inc.',
        'base_price': 120.0,
        'sector': 'Technology',
        'industry': 'Software',
        'market_cap': 50000000000,
        'pe_ratio': 25.0,
        'description': f'{symbol} is a publicly traded company.'
    })
    
    # Add some realistic random variation to price (±5%)
    price_variation = random.uniform(-0.05, 0.05)
    current_price = base['base_price'] * (1 + price_variation)
    
    # Calculate change based on price variation
    change = current_price - base['base_price']
    change_percent = (change / base['base_price']) * 100
    
    # Generate realistic volume
    volume = random.randint(15000000, 85000000)
    
    # Generate realistic dividend info (add fake dividends for demo purposes)
    dividend_yield = 0
    dividend_per_share = 0
    # Include more stocks with fake dividends for better demo experience
    if symbol in ['AAPL', 'MSFT', 'JNJ', 'KO', 'PG', 'NVDA', 'GOOGL', 'META', 'AMZN']:
        dividend_yield = round(random.uniform(1.2, 3.8), 2)
        dividend_per_share = round((current_price * dividend_yield / 100) / 4, 2)  # Quarterly dividend

    return {
        'symbol': symbol,
        'company_name': base['company_name'],
        'current_price': round(current_price, 2),
        'change': round(change, 2),
        'change_percent': round(change_percent, 2),
        'volume': volume,
        'market_cap': base['market_cap'],
        'pe_ratio': base['pe_ratio'],
        'sector': base['sector'],
        'industry': base['industry'],
        'description': base['description'],
        '52_week_high': round(current_price * 1.25, 2),
        '52_week_low': round(current_price * 0.75, 2),
        'eps': round(current_price / base['pe_ratio'], 2),
        'beta': round(random.uniform(0.8, 2.2), 2),
        'dividend_yield': dividend_yield,
        'dividend_per_share': dividend_per_share,
        'peg_ratio': round(random.uniform(1.0, 3.0), 2),
        'book_value': round(current_price * random.uniform(0.15, 0.35), 2),
        'is_mock_data': True  # Flag to indicate this is mock data
    }


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
                    raise Exception(f"Alpha Vantage API limit reached for {symbol}")
                else:
                    raise Exception("Invalid response from Alpha Vantage")
                
            quote = data["Global Quote"]
            
            # Try to get overview data for fundamental metrics
            overview_data = None
            try:
                overview_data = await fetch_alpha_vantage_overview(symbol, api_key)
            except Exception:
                # Continue without overview data - don't log errors that may contain sensitive info
                overview_data = None
            
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
        # If Alpha Vantage fails (rate limited, etc.), return mock data for featured picks
        error_msg = str(e).lower()
        if any(term in error_msg for term in ['rate limit', 'api limit', 'frequency', 'api call']):
            # Return mock data when rate limited
            return get_mock_stock_data(symbol)
        else:
            raise Exception(f"Alpha Vantage API error for {symbol}: Failed to fetch stock data")


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
                
                # Debug logs removed for security
                
                if "Time Series (30min)" not in data:
                    if "Error Message" in data:
                        raise Exception(data["Error Message"])
                    elif "Note" in data:
                        raise Exception("API call frequency limit reached. Please try again later.")
                    elif "Information" in data:
                        raise Exception(f"Alpha Vantage API limit reached for {symbol}")
                    else:
                        raise Exception(f"Invalid 1D response from Alpha Vantage for {symbol}")
                
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
                
                # Debug logs removed for security
                
                if "Time Series (Daily)" not in data:
                    if "Error Message" in data:
                        raise Exception(data["Error Message"])
                    elif "Note" in data:
                        raise Exception("API call frequency limit reached. Please try again later.")
                    elif "Information" in data:
                        raise Exception(f"Alpha Vantage API limit reached for {symbol}")
                    else:
                        raise Exception(f"Invalid Daily response from Alpha Vantage for {symbol}")
                
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
        # If Alpha Vantage historical API fails, return mock chart data
        error_msg = str(e).lower()
        if any(term in error_msg for term in ['rate limit', 'api limit', 'frequency', 'api call']):
            # Return mock historical data when rate limited
            return generate_mock_historical_data(symbol, period)
        else:
            raise Exception(f"Alpha Vantage history API error for {symbol}: Failed to fetch historical data")


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
        # Try to initialize NewsAPI client - this might fail if key is invalid
        try:
            newsapi = NewsApiClient(api_key=api_key)
        except Exception as init_error:
            # If NewsAPI client initialization fails, fall back to mock data
            raise Exception("NewsAPI initialization failed")
        
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
                
                # Check for rate limiting or API errors
                if isinstance(articles, dict) and articles.get('status') == 'error':
                    if articles.get('code') == 'rateLimited':
                        raise Exception("NewsAPI rate limit exceeded")
                    else:
                        continue
                
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
                            
            except Exception as e:
                # Check if it's a rate limit error - if so, break and use fallback
                if "rate limit" in str(e).lower() or "rateLimited" in str(e):
                    raise Exception("NewsAPI rate limit exceeded")
                # Otherwise skip failed searches
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
            try:
                articles = newsapi.get_everything(
                    q=symbol,
                    language='en',
                    sort_by='publishedAt',
                    from_param=from_date.strftime('%Y-%m-%d'),
                    to=to_date.strftime('%Y-%m-%d'),
                    page_size=5
                )
                
                # Check for rate limiting or API errors
                if isinstance(articles, dict) and articles.get('status') == 'error':
                    if articles.get('code') == 'rateLimited':
                        raise Exception("NewsAPI rate limit exceeded")
                    else:
                        pass  # Continue with empty results
                
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
                            
            except Exception as e:
                # Check if it's a rate limit error - if so, propagate
                if "rate limit" in str(e).lower() or "rateLimited" in str(e):
                    raise Exception("NewsAPI rate limit exceeded")
                # Otherwise continue with empty results
                pass
        
        return unique_articles
        
    except Exception as e:
        # If rate limited, return mock data for the symbol
        if "rate limit" in str(e).lower() or "rateLimited" in str(e):
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
        else:
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
        # Try to initialize NewsAPI client - this might fail if key is invalid
        try:
            newsapi = NewsApiClient(api_key=api_key)
        except Exception as init_error:
            # If NewsAPI client initialization fails, fall back to mock data
            raise Exception("NewsAPI initialization failed")
        
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
                
                # Check for rate limiting or API errors
                if isinstance(articles, dict) and articles.get('status') == 'error':
                    if articles.get('code') == 'rateLimited':
                        # Hit rate limit - fall back to mock data
                        raise Exception("NewsAPI rate limit exceeded")
                    else:
                        # Other API error - continue with other searches
                        continue
                
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
                            
            except Exception as e:
                # Check if it's a rate limit error - if so, break and use fallback
                if "rate limit" in str(e).lower() or "rateLimited" in str(e):
                    raise Exception("NewsAPI rate limit exceeded")
                # Otherwise skip failed searches
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
        # If rate limited or other API error, return mock data
        if "rate limit" in str(e).lower() or "rateLimited" in str(e) or "initialization failed" in str(e).lower():
            # Return realistic mock market news when API is unavailable
            now = datetime.now()
            
            return [
                {
                    "title": "Tech Stocks Rally as AI Spending Drives Growth",
                    "description": "Major technology companies see stock prices surge amid increased investment in artificial intelligence infrastructure and services.",
                    "url": "https://example.com/tech-rally",
                    "published_at": (now - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": "Reuters",
                    "content": "Technology stocks continued their upward momentum as companies report strong AI-related revenue growth...",
                    "mentions": ["NVDA", "MSFT", "GOOGL", "META"]
                },
                {
                    "title": "Federal Reserve Maintains Interest Rates Amid Economic Uncertainty",
                    "description": "The Federal Reserve keeps interest rates steady while monitoring inflation trends and employment data.",
                    "url": "https://example.com/fed-rates",
                    "published_at": (now - timedelta(hours=4)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": "Wall Street Journal",
                    "content": "The Federal Reserve announced its decision to maintain current interest rates...",
                    "mentions": ["SPY", "QQQ", "DJI"]
                },
                {
                    "title": "Electric Vehicle Sales Surge Despite Market Headwinds",
                    "description": "EV manufacturers report strong quarterly deliveries as consumer adoption accelerates globally.",
                    "url": "https://example.com/ev-sales",
                    "published_at": (now - timedelta(hours=6)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": "Bloomberg",
                    "content": "Electric vehicle sales continue to outpace traditional auto sales...",
                    "mentions": ["TSLA", "RIVN", "LCID", "NIO"]
                },
                {
                    "title": "Energy Sector Gains on Rising Oil Prices",
                    "description": "Oil and gas companies see stock gains as crude prices climb amid supply concerns and geopolitical tensions.",
                    "url": "https://example.com/energy-gains",
                    "published_at": (now - timedelta(hours=8)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": "CNBC",
                    "content": "Energy stocks surged as oil prices reached new monthly highs...",
                    "mentions": ["XOM", "CVX", "COP", "EOG"]
                },
                {
                    "title": "Healthcare Stocks Mixed on Drug Approval News",
                    "description": "Pharmaceutical companies show varied performance following FDA approvals and clinical trial results.",
                    "url": "https://example.com/healthcare-mixed",
                    "published_at": (now - timedelta(hours=10)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": "MarketWatch",
                    "content": "Healthcare sector shows mixed results with some major drug approvals...",
                    "mentions": ["JNJ", "PFE", "MRNA", "ABBV"]
                },
                {
                    "title": "Streaming Wars Heat Up as Disney+ Subscriber Growth Slows",
                    "description": "Media companies face increased competition in streaming market as growth rates moderate across platforms.",
                    "url": "https://example.com/streaming-wars",
                    "published_at": (now - timedelta(hours=12)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": "Forbes",
                    "content": "The streaming market becomes increasingly competitive as subscriber growth slows...",
                    "mentions": ["DIS", "NFLX", "WBD", "PARA"]
                },
                {
                    "title": "Banking Sector Faces Regulatory Scrutiny on Climate Risk",
                    "description": "Major banks prepare for new climate-related stress tests as regulators increase focus on environmental risks.",
                    "url": "https://example.com/banking-climate",
                    "published_at": (now - timedelta(hours=14)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": "Financial Times",
                    "content": "Banking regulators are implementing new climate risk assessment requirements...",
                    "mentions": ["JPM", "BAC", "WFC", "C"]
                },
                {
                    "title": "Semiconductor Stocks Volatile on China Trade Concerns",
                    "description": "Chip manufacturers face uncertainty as trade tensions and export restrictions impact global supply chains.",
                    "url": "https://example.com/semiconductor-trade",
                    "published_at": (now - timedelta(hours=16)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": "Benzinga",
                    "content": "Semiconductor companies navigate complex trade environment...",
                    "mentions": ["NVDA", "AMD", "INTC", "TSM"]
                },
                {
                    "title": "Retail Earnings Season Shows Consumer Resilience",
                    "description": "Major retailers report better-than-expected results as consumers continue spending despite economic pressures.",
                    "url": "https://example.com/retail-earnings",
                    "published_at": (now - timedelta(hours=18)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": "Yahoo Finance",
                    "content": "Retail earnings demonstrate ongoing consumer strength...",
                    "mentions": ["WMT", "AMZN", "TGT", "COST"]
                },
                {
                    "title": "Gold Prices Reach New Highs Amid Market Uncertainty",
                    "description": "Precious metals surge as investors seek safe-haven assets during volatile market conditions.",
                    "url": "https://example.com/gold-highs",  
                    "published_at": (now - timedelta(hours=20)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": "MarketWatch",
                    "content": "Gold prices continue climbing as uncertainty drives safe-haven demand...",
                    "mentions": ["GLD", "GOLD", "AEM", "NEM"]
                }
            ]
        else:
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
        # OpenAI response logging removed for security
        
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
        
    except json.JSONDecodeError:
        # JSON parsing failed - use fallback analysis
        
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
            # OpenAI response logging removed for security
            
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
            
        except json.JSONDecodeError:
            # JSON parsing error - use fallback analysis
            
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

def validate_symbol(symbol: str) -> str:
    """Validate and sanitize stock symbol"""
    if not symbol or len(symbol) > 10:
        raise ValueError("Invalid symbol length")
    
    # Remove any non-alphanumeric characters
    clean_symbol = ''.join(c for c in symbol.upper() if c.isalnum())
    
    if not clean_symbol or len(clean_symbol) < 1:
        raise ValueError("Invalid symbol format")
    
    return clean_symbol

@app.get("/api/stock/{symbol}")
async def get_stock_data(symbol: str, request: Request):
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip, max_requests=30, window_minutes=1):
        return JSONResponse(
            status_code=429,
            content={"error": "Rate limit exceeded. Please try again later."}
        )
    
    try:
        # Validate and sanitize symbol
        clean_symbol = validate_symbol(symbol)
        
        # Try Alpha Vantage first
        try:
            return await fetch_alpha_vantage_stock(clean_symbol)
        except Exception:
            # Don't log the full error to avoid exposing sensitive details
            raise Exception(f"Failed to fetch data for {clean_symbol}")
            
    except ValueError as ve:
        return JSONResponse(
            status_code=400,
            content={"error": str(ve)}
        )
    except Exception:
        return JSONResponse(
            status_code=400,
            content={"error": "Unable to fetch stock data"}
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
        # Validate and sanitize symbol
        clean_symbol = validate_symbol(symbol)
        
        # Fetch recent news articles
        articles = await fetch_news_for_symbol(clean_symbol)
        
        # Analyze with OpenAI
        analysis = await analyze_news_with_openai(articles, clean_symbol)
        
        # Check if we're using mock data (first article has example.com URL)
        is_mock_data = len(articles) > 0 and "example.com" in articles[0].get("url", "")
        
        # Include raw articles for frontend display if needed
        response = {
            "symbol": clean_symbol,
            "analysis": analysis,
            "raw_articles": articles[:5],  # First 5 articles for display
            "last_updated": datetime.now().isoformat(),
            "is_mock_data": is_mock_data
        }
        
        return response
        
    except ValueError as ve:
        return JSONResponse(
            status_code=400,
            content={"error": str(ve)}
        )
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": "Unable to fetch news insights"}
        )

@app.get("/api/stock/{symbol}/history")
async def get_stock_history(symbol: str, period: str = "1y"):
    """Get historical stock data for charting"""
    try:
        # Validate and sanitize symbol
        clean_symbol = validate_symbol(symbol)
        
        # Validate period parameter
        valid_periods = ["1d", "1w", "3m", "1y"]
        if period not in valid_periods:
            return JSONResponse(
                status_code=400,
                content={"error": f"Invalid period. Must be one of: {', '.join(valid_periods)}"}
            )
        
        # Fetch historical data
        history_data = await fetch_alpha_vantage_history(clean_symbol, period)
        
        response = {
            "symbol": clean_symbol,
            "period": period,
            "data": history_data["data"],
            "data_points": len(history_data["data"]),
            "period_high": history_data["period_high"],
            "period_low": history_data["period_low"],
            "is_mock_data": history_data.get("is_mock_data", False)
        }
        
        return response
        
    except ValueError as ve:
        return JSONResponse(
            status_code=400,
            content={"error": str(ve)}
        )
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": "Unable to fetch historical data"}
        )

@app.get("/api/market/insights")
async def get_market_insights(days_back: int = 1):
    """Get AI-analyzed market insights and trending stocks from recent news"""
    try:
        # Validate days_back parameter
        if days_back < 1 or days_back > 7:
            return JSONResponse(
                status_code=400,
                content={"error": "days_back must be between 1 and 7"}
            )
        
        # Fetch recent market news
        articles = await fetch_market_news(days_back=days_back)
        
        # Try to analyze with OpenAI, but fall back to basic analysis if it fails
        try:
            analysis = await analyze_market_trends_with_openai(articles)
        except Exception:
            # Fallback analysis when OpenAI fails (e.g., missing API key)
            analysis = {
                "market_sentiment": "neutral",
                "trending_stocks": [
                    {"symbol": "AAPL", "reason": "Technology sector leader", "sentiment": "bullish"},
                    {"symbol": "TSLA", "reason": "Electric vehicle innovation", "sentiment": "bullish"},
                    {"symbol": "NVDA", "reason": "AI chip demand", "sentiment": "bullish"},
                    {"symbol": "MSFT", "reason": "Cloud computing growth", "sentiment": "bullish"},
                    {"symbol": "AMZN", "reason": "E-commerce dominance", "sentiment": "neutral"}
                ],
                "key_themes": ["Technology Innovation", "Market Stability", "Economic Growth"],
                "daily_summary": "Markets showing mixed signals with technology stocks leading gains while traditional sectors remain stable.",
                "high_impact_events": [
                    {"event": "Federal Reserve Meeting", "impact": "high", "timeframe": "This Week"},
                    {"event": "Tech Earnings Reports", "impact": "medium", "timeframe": "Next Week"}
                ],
                "article_count": len(articles),
                "last_updated": datetime.now().isoformat()
            }
        
        # Check if we're using mock data (first article has example.com URL)
        is_mock_data = len(articles) > 0 and "example.com" in articles[0].get("url", "")
        
        # Include raw articles for frontend display
        response = {
            "analysis": analysis,
            "raw_articles": articles[:10],  # First 10 articles for display
            "last_updated": datetime.now().isoformat(),
            "days_back": days_back,
            "is_mock_data": is_mock_data
        }
        
        return response
        
    except Exception:
        # Final fallback - return complete mock data if everything fails
        now = datetime.now()
        return {
            "analysis": {
                "market_sentiment": "neutral",
                "trending_stocks": [
                    {"symbol": "AAPL", "reason": "Technology sector leader", "sentiment": "bullish"},
                    {"symbol": "TSLA", "reason": "Electric vehicle innovation", "sentiment": "bullish"},
                    {"symbol": "NVDA", "reason": "AI chip demand", "sentiment": "bullish"},
                    {"symbol": "MSFT", "reason": "Cloud computing growth", "sentiment": "bullish"},
                    {"symbol": "AMZN", "reason": "E-commerce dominance", "sentiment": "neutral"}
                ],
                "key_themes": ["Technology Innovation", "Market Stability", "Economic Growth"],
                "daily_summary": "Markets showing mixed signals with technology stocks leading gains while traditional sectors remain stable.",
                "high_impact_events": [
                    {"event": "Federal Reserve Meeting", "impact": "high", "timeframe": "This Week"},
                    {"event": "Tech Earnings Reports", "impact": "medium", "timeframe": "Next Week"}
                ],
                "article_count": 10,
                "last_updated": now.isoformat()
            },
            "raw_articles": [
                {
                    "title": "Tech Stocks Rally as AI Spending Drives Growth",
                    "description": "Major technology companies see stock prices surge amid increased investment in artificial intelligence infrastructure and services.",
                    "url": "https://example.com/tech-rally",
                    "published_at": (now - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": "Reuters",
                    "content": "Technology stocks continued their upward momentum as companies report strong AI-related revenue growth...",
                    "mentions": ["NVDA", "MSFT", "GOOGL", "META"]
                },
                {
                    "title": "Federal Reserve Maintains Interest Rates Amid Economic Uncertainty",
                    "description": "The Federal Reserve keeps interest rates steady while monitoring inflation trends and employment data.",
                    "url": "https://example.com/fed-rates",
                    "published_at": (now - timedelta(hours=4)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": "Wall Street Journal",
                    "content": "The Federal Reserve announced its decision to maintain current interest rates...",
                    "mentions": ["SPY", "QQQ", "DJI"]
                },
                {
                    "title": "Electric Vehicle Sales Surge Despite Market Headwinds",
                    "description": "EV manufacturers report strong quarterly deliveries as consumer adoption accelerates globally.",
                    "url": "https://example.com/ev-sales",
                    "published_at": (now - timedelta(hours=6)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": "Bloomberg",
                    "content": "Electric vehicle sales continue to outpace traditional auto sales...",
                    "mentions": ["TSLA", "RIVN", "LCID", "NIO"]
                },
                {
                    "title": "Energy Sector Gains on Rising Oil Prices",
                    "description": "Oil and gas companies see stock gains as crude prices climb amid supply concerns and geopolitical tensions.",
                    "url": "https://example.com/energy-gains",
                    "published_at": (now - timedelta(hours=8)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": "CNBC",
                    "content": "Energy stocks surged as oil prices reached new monthly highs...",
                    "mentions": ["XOM", "CVX", "COP", "EOG"]
                },
                {
                    "title": "Healthcare Stocks Mixed on Drug Approval News",
                    "description": "Pharmaceutical companies show varied performance following FDA approvals and clinical trial results.",
                    "url": "https://example.com/healthcare-mixed",
                    "published_at": (now - timedelta(hours=10)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "source": "MarketWatch",
                    "content": "Healthcare sector shows mixed results with some major drug approvals...",
                    "mentions": ["JNJ", "PFE", "MRNA", "ABBV"]
                }
            ],
            "last_updated": now.isoformat(),
            "days_back": days_back,
            "is_mock_data": True
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)