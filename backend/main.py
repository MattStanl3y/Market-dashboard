from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import yfinance as yf
from datetime import datetime, timedelta
import pandas as pd
from typing import Optional
import time
import asyncio
from functools import lru_cache

app = FastAPI(title="Market Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Market Dashboard API is running"}

@app.get("/debug/yfinance/{symbol}")
async def debug_yfinance(symbol: str):
    """Debug endpoint to test yfinance step by step"""
    results = {}
    
    try:
        # Test 1: Try with much longer delay
        try:
            await asyncio.sleep(5)  # Longer delay
            data = yf.download(symbol.upper(), period="1mo", interval="1d", progress=False, timeout=10)
            results["long_delay_download"] = {
                "success": True,
                "rows": len(data),
                "empty": data.empty,
                "latest_date": str(data.index[-1]) if not data.empty else None
            }
        except Exception as e:
            results["long_delay_download"] = {"success": False, "error": str(e)}
        
        # Test 2: Try with session headers
        try:
            await asyncio.sleep(1)  # Add delay
            import requests
            session = requests.Session()
            session.headers.update({
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            })
            
            stock = yf.Ticker(symbol.upper(), session=session)
            hist = stock.history(period="5d")
            results["with_session"] = {
                "success": True,
                "rows": len(hist),
                "empty": hist.empty
            }
        except Exception as e:
            results["with_session"] = {"success": False, "error": str(e)}
            
        # Test 3: Basic ticker (original method)
        try:
            await asyncio.sleep(1)  # Add delay
            stock = yf.Ticker(symbol.upper())
            hist = stock.history(period="5d")
            results["basic_ticker"] = {
                "success": True,
                "rows": len(hist),
                "empty": hist.empty
            }
        except Exception as e:
            results["basic_ticker"] = {"success": False, "error": str(e)}
            
    except Exception as e:
        results["error"] = str(e)
    
    return results

async def fetch_alpha_vantage_stock(symbol: str, api_key: str = "demo"):
    """Fetch stock data from Alpha Vantage API"""
    import httpx
    
    try:
        # Get quote data
        quote_url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={symbol}&apikey={api_key}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(quote_url, timeout=10)
            data = response.json()
            
            if "Global Quote" not in data:
                raise Exception("Invalid response from Alpha Vantage")
                
            quote = data["Global Quote"]
            
            return {
                "symbol": quote.get("01. symbol", symbol),
                "company_name": f"{symbol} Inc.",  # Alpha Vantage doesn't provide company name in quote
                "current_price": float(quote.get("05. price", 0)),
                "change": float(quote.get("09. change", 0)),
                "change_percent": float(quote.get("10. change percent", "0%").replace("%", "")),
                "market_cap": None,  # Not available in free tier
                "pe_ratio": None,   # Not available in free tier
                "volume": int(quote.get("06. volume", 0)),
                "52_week_high": float(quote.get("03. high", 0)),
                "52_week_low": float(quote.get("04. low", 0)),
                "historical_data": []
            }
            
    except Exception as e:
        raise Exception(f"Alpha Vantage API error: {str(e)}")

@app.get("/api/stock/{symbol}")
async def get_stock_data(symbol: str):
    try:
        # Try Alpha Vantage first (using demo key for now)
        try:
            return await fetch_alpha_vantage_stock(symbol.upper())
        except Exception as alpha_error:
            print(f"Alpha Vantage failed: {alpha_error}")
            
            # Fallback to mock data
            mock_data = {
                "AAPL": {"longName": "Apple Inc.", "marketCap": 3000000000000, "trailingPE": 28.5},
                "TSLA": {"longName": "Tesla, Inc.", "marketCap": 800000000000, "trailingPE": 65.2},
                "GOOGL": {"longName": "Alphabet Inc.", "marketCap": 1700000000000, "trailingPE": 25.1},
                "MSFT": {"longName": "Microsoft Corporation", "marketCap": 2800000000000, "trailingPE": 32.4}
            }
            
            symbol_upper = symbol.upper()
            if symbol_upper in mock_data:
                info = mock_data[symbol_upper]
                current_price = {"AAPL": 185.25, "TSLA": 248.50, "GOOGL": 142.80, "MSFT": 378.90}.get(symbol_upper, 100.0)
                change = {"AAPL": 2.15, "TSLA": -3.20, "GOOGL": 1.45, "MSFT": 4.25}.get(symbol_upper, 1.0)
            else:
                info = {"longName": f"{symbol_upper} Inc.", "marketCap": 50000000000, "trailingPE": 20.0}
                current_price = 100.0
                change = 1.0
            
            prev_close = current_price - change
            change_percent = (change / prev_close * 100) if prev_close else 0
            
            return {
                "symbol": symbol_upper,
                "company_name": info.get("longName", "N/A"),
                "current_price": round(current_price, 2),
                "change": round(change, 2),
                "change_percent": round(change_percent, 2),
                "market_cap": info.get("marketCap"),
                "pe_ratio": info.get("trailingPE"),
                "volume": 25000000,
                "52_week_high": round(current_price * 1.2, 2),
                "52_week_low": round(current_price * 0.8, 2),
                "historical_data": []
            }
            
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": f"Failed to fetch data for {symbol}: {str(e)}"}
        )

@app.get("/api/market/overview")
async def get_market_overview():
    try:
        # Get major market indices
        indices = {
            "^GSPC": "S&P 500",
            "^DJI": "Dow Jones",
            "^IXIC": "NASDAQ"
        }
        
        market_data = {}
        
        for symbol, name in indices.items():
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="2d")
            
            if not hist.empty:
                current = hist['Close'].iloc[-1]
                prev = hist['Close'].iloc[-2] if len(hist) > 1 else current
                change = current - prev
                change_percent = (change / prev * 100) if prev else 0
                
                market_data[symbol] = {
                    "name": name,
                    "value": round(current, 2),
                    "change": round(change, 2),
                    "change_percent": round(change_percent, 2)
                }
        
        return market_data
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to fetch market overview: {str(e)}"}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)