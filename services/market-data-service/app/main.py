import asyncio, random, os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="TradeX Market Data Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STOCKS: dict = {
    "AAPL":     {"name": "Apple Inc.",            "price": 178.50,  "sector": "Technology",    "currency": "USD"},
    "GOOGL":    {"name": "Alphabet Inc.",          "price": 141.20,  "sector": "Technology",    "currency": "USD"},
    "TSLA":     {"name": "Tesla Inc.",             "price": 245.80,  "sector": "EV",            "currency": "USD"},
    "MSFT":     {"name": "Microsoft Corp.",        "price": 378.90,  "sector": "Technology",    "currency": "USD"},
    "AMZN":     {"name": "Amazon.com Inc.",        "price": 186.50,  "sector": "E-Commerce",    "currency": "USD"},
    "NVDA":     {"name": "NVIDIA Corp.",           "price": 875.30,  "sector": "Semiconductors","currency": "USD"},
    "RELIANCE": {"name": "Reliance Industries",    "price": 2940.50, "sector": "Conglomerate",  "currency": "INR"},
    "TCS":      {"name": "Tata Consultancy Svcs.", "price": 3875.20, "sector": "IT Services",   "currency": "INR"},
    "INFY":     {"name": "Infosys Ltd.",           "price": 1820.40, "sector": "IT Services",   "currency": "INR"},
    "HDFC":     {"name": "HDFC Bank Ltd.",         "price": 1624.30, "sector": "Banking",       "currency": "INR"},
}

def simulate_price(base: float) -> float:
    change = random.gauss(0, 0.008)
    change = max(-0.04, min(0.04, change))
    return round(base * (1 + change), 2)

def generate_history(symbol: str, days: int):
    price = STOCKS[symbol]["price"]
    history = []
    for i in range(days):
        dt = datetime.now() - timedelta(days=days - i)
        price = simulate_price(price)
        history.append({
            "date":   dt.strftime("%Y-%m-%d"),
            "open":   round(price * random.uniform(0.99, 1.003), 2),
            "high":   round(price * random.uniform(1.004, 1.022), 2),
            "low":    round(price * random.uniform(0.978, 0.996), 2),
            "close":  price,
            "volume": random.randint(400_000, 9_000_000),
        })
    return history

@app.get("/market/stocks")
def list_stocks():
    result = []
    for symbol, data in STOCKS.items():
        new_price  = simulate_price(data["price"])
        STOCKS[symbol]["price"] = new_price
        prev_close = new_price / (1 + random.uniform(-0.025, 0.025))
        change_pct = round((new_price - prev_close) / prev_close * 100, 2)
        result.append({
            "symbol":     symbol,
            "name":       data["name"],
            "sector":     data["sector"],
            "currency":   data["currency"],
            "price":      new_price,
            "change":     change_pct,
            "changeAmt":  round(new_price - prev_close, 2),
            "volume":     random.randint(400_000, 9_000_000),
            "marketCap":  round(new_price * random.randint(5_000_000, 50_000_000), 0),
            "high52w":    round(new_price * 1.38, 2),
            "low52w":     round(new_price * 0.68, 2),
            "pe":         round(random.uniform(15, 45), 1),
        })
    return sorted(result, key=lambda x: abs(x["change"]), reverse=True)

@app.get("/market/stocks/{symbol}")
def get_stock(symbol: str):
    symbol = symbol.upper()
    if symbol not in STOCKS:
        raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' not found")
    data = STOCKS[symbol]
    price = simulate_price(data["price"])
    STOCKS[symbol]["price"] = price
    return {"symbol": symbol, **data, "price": price}

@app.get("/market/stocks/{symbol}/chart")
def get_chart(symbol: str, period: str = Query("1M", regex="^(1W|1M|3M|6M|1Y)$")):
    symbol = symbol.upper()
    if symbol not in STOCKS:
        raise HTTPException(status_code=404, detail="Symbol not found")
    days = {"1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365}[period]
    return generate_history(symbol, days)

@app.websocket("/market/ws")
async def ws_market_feed(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            updates = {}
            for symbol in STOCKS:
                new_price = simulate_price(STOCKS[symbol]["price"])
                STOCKS[symbol]["price"] = new_price
                updates[symbol] = {
                    "price":  new_price,
                    "change": round(random.uniform(-2.5, 2.5), 2),
                }
            await websocket.send_json(updates)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass

@app.get("/health")
def health():
    return {"status": "ok", "service": "market-data-service", "version": os.getenv("VERSION", "1.0.0")}

@app.get("/")
def root():
    return {"message": "TradeX Market Data API", "docs": "/docs"}
