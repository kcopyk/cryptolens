import httpx

BASE = "https://api.binance.com"
PAIRS = {"BTC": "BTCUSDT", "ETH": "ETHUSDT", "BNB": "BNBUSDT", "SOL": "SOLUSDT"}


async def get_24h(symbol: str) -> dict:
    pair = PAIRS[symbol]
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{BASE}/api/v3/ticker/24hr", params={"symbol": pair})
        r.raise_for_status()
        data = r.json()
    return {
        "price": float(data["lastPrice"]),
        "change_24h_pct": float(data["priceChangePercent"]),
        "volume_24h": float(data["quoteVolume"]),
    }


VALID_INTERVALS = {"1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"}


async def get_klines(symbol: str, interval: str = "1h", limit: int = 50) -> list[float]:
    candles = await get_ohlc_klines(symbol, interval, limit)
    return [c["close"] for c in candles]


async def get_ohlc_klines(symbol: str, interval: str = "1h", limit: int = 100) -> list[dict]:
    if interval not in VALID_INTERVALS:
        interval = "1h"
    pair = PAIRS[symbol]
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{BASE}/api/v3/klines",
            params={"symbol": pair, "interval": interval, "limit": limit},
        )
        r.raise_for_status()
        data = r.json()
    return [
        {
            "time": int(candle[0]) // 1000,
            "open": float(candle[1]),
            "high": float(candle[2]),
            "low": float(candle[3]),
            "close": float(candle[4]),
            "volume": float(candle[5]),
        }
        for candle in data
    ]
