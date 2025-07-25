from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv
from newsapi import NewsApiClient
from datetime import datetime, timedelta
import openai

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)