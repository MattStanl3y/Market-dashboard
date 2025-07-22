from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv

load_dotenv()

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


async def fetch_alpha_vantage_stock(symbol: str, api_key: str = None):
    """Fetch stock data from Alpha Vantage API"""
    import httpx
    
    if api_key is None:
        api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
        if not api_key:
            raise Exception("Alpha Vantage API key not found in environment variables")
    
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)