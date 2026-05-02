import asyncio, random, os
from datetime import datetime, timedelta
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="TradeX Market Data Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

STOCKS = {
    "AAPL":     {"name": "Apple Inc.",           "price": 178.50,  "sector": "Technology",     "currency": "USD"},
    "GOOGL":    {"name": "Alphabet Inc.",         "price": 141.20,  "sector": "Technology",     "currency": "USD"},
    "TSLA":     {"name": "Tesla Inc.",            "price": 245.80,  "sector": "EV",             "currency": "USD"},
    "MSFT":     {"name": "Microsoft Corp.",       "price": 378.90,  "sector": "Technology",     "currency": "USD"},
    "AMZN":     {"name": "Amazon.com Inc.",       "price": 186.50,  "sector": "E-Commerce",     "currency": "USD"},
    "NVDA":     {"name": "NVIDIA Corp.",          "price": 875.30,  "sector": "Semiconductors", "currency": "USD"},
    "RELIANCE": {"name": "Reliance Industries",   "price": 2940.50, "sector": "Conglomerate",   "currency": "INR"},
    "TCS":      {"name": "Tata Consultancy",      "price": 3875.20, "sector": "IT Services",    "currency": "INR"},
    "INFY":     {"name": "Infosys Ltd.",          "price": 1820.40, "sector": "IT Services",    "currency": "INR"},
    "HDFC":     {"name": "HDFC Bank Ltd.",        "price": 1624.30, "sector": "Banking",        "currency": "INR"},
}

def sim(base: float) -> float:
    c = max(-0.04, min(0.04, random.gauss(0, 0.008)))
    return round(base * (1 + c), 2)

def history(symbol: str, days: int):
    p = STOCKS[symbol]["price"]
    out = []
    for i in range(days):
        dt = datetime.now() - timedelta(days=days - i)
        p = sim(p)
        out.append({"date": dt.strftime("%Y-%m-%d"), "open": round(p * random.uniform(0.99, 1.003), 2),
                    "high": round(p * random.uniform(1.004, 1.022), 2), "low": round(p * random.uniform(0.978, 0.996), 2),
                    "close": p, "volume": random.randint(400_000, 9_000_000)})
    return out

@app.get("/market/stocks")
def list_stocks():
    result = []
    for symbol, d in STOCKS.items():
        np = sim(d["price"]); STOCKS[symbol]["price"] = np
        prev = np / (1 + random.uniform(-0.025, 0.025))
        chg = round((np - prev) / prev * 100, 2)
        result.append({"symbol": symbol, "name": d["name"], "sector": d["sector"], "currency": d["currency"],
                        "price": np, "change": chg, "changeAmt": round(np - prev, 2),
                        "volume": random.randint(400_000, 9_000_000), "high52w": round(np * 1.38, 2),
                        "low52w": round(np * 0.68, 2), "pe": round(random.uniform(15, 45), 1)})
    return sorted(result, key=lambda x: abs(x["change"]), reverse=True)

@app.get("/market/stocks/{symbol}")
def get_stock(symbol: str):
    s = symbol.upper()
    if s not in STOCKS: raise HTTPException(404, f"Symbol '{s}' not found")
    d = STOCKS[s]; p = sim(d["price"]); STOCKS[s]["price"] = p
    return {"symbol": s, **d, "price": p}

@app.get("/market/stocks/{symbol}/chart")
def get_chart(symbol: str, period: str = Query("1M", regex="^(1W|1M|3M|6M|1Y)$")):
    s = symbol.upper()
    if s not in STOCKS: raise HTTPException(404, "Symbol not found")
    return history(s, {"1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365}[period])

@app.websocket("/market/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            updates = {}
            for sym in STOCKS:
                np = sim(STOCKS[sym]["price"]); STOCKS[sym]["price"] = np
                updates[sym] = {"price": np, "change": round(random.uniform(-2.5, 2.5), 2)}
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
