import httpx

BASE = "https://api.binance.com"
PAIRS = {"BTC": "BTCUSDT", "ETH": "ETHUSDT", "BNB": "BNBUSDT", "SOL": "SOLUSDT"}

# Symbols confirmed to exist on Binance (against USDT). Seeded with the known
# pairs and grown lazily by validate_symbol() so the watchlist can hold any
# coin Binance lists, not just the four hardcoded above.
_VALID_SYMBOLS: set[str] = set(PAIRS.keys())


def to_pair(symbol: str) -> str:
    """Resolve a bare symbol (e.g. 'XRP') to its Binance USDT pair.

    Falls back to `{SYMBOL}USDT` for coins outside the hardcoded PAIRS map so
    watchlist additions work beyond the original four."""
    s = symbol.upper()
    return PAIRS.get(s, f"{s}USDT")


async def validate_symbol(symbol: str) -> bool:
    """True iff `{SYMBOL}USDT` is a real, currently-trading Binance spot pair.

    Used to gate watchlist additions so we never persist a symbol the rest of
    the app (candles/news/insights) can't actually fetch."""
    s = symbol.upper()
    if s in _VALID_SYMBOLS:
        return True
    pair = to_pair(s)
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(f"{BASE}/api/v3/exchangeInfo", params={"symbol": pair})
            if r.status_code != 200:
                return False
            symbols = r.json().get("symbols", [])
            ok = any(
                item.get("symbol") == pair and item.get("status") == "TRADING"
                for item in symbols
            )
        except Exception:
            return False
    if ok:
        _VALID_SYMBOLS.add(s)
    return ok


async def get_24h(symbol: str) -> dict:
    pair = to_pair(symbol)
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
    pair = to_pair(symbol)
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
