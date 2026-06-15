import asyncio
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any

import cache
import binance as bnb
import indicators as ind
import news as news_api
import ai
import binance_trade
import vault
import db

app = FastAPI(title="CryptoLens")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_SYMBOLS = ["BTC", "ETH", "BNB", "SOL"]
VALID_CHART_INTERVALS = {"1m", "5m", "15m", "30m", "1h", "4h", "1d"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


async def fetch_coin(symbol: str) -> dict:
    closes, ticker, news = await asyncio.gather(
        bnb.get_klines(symbol, limit=100),
        bnb.get_24h(symbol),
        news_api.get_news(symbol),
    )
    indicators = ind.compute_all(closes)
    coin = {
        "symbol": symbol,
        "price": ticker["price"],
        "change_24h_pct": ticker["change_24h_pct"],
        "volume_24h": ticker["volume_24h"],
        "rsi": indicators["rsi"],
        "sparkline": ind.sparkline(closes),
        "indicators": indicators,
        "news": news,
        "summary": "",
    }
    coin["summary"] = ai.summarize_coin(coin)
    return coin


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/insights")
async def insights(symbols: str = Query(default=",".join(DEFAULT_SYMBOLS))):
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    cache_key = f"insights:{','.join(sym_list)}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    stale = cache.get_stale(cache_key)
    try:
        coins = await asyncio.gather(*[fetch_coin(s) for s in sym_list])
        result = {"as_of": now_iso(), "stale": False, "coins": list(coins)}
        cache.set(cache_key, result)
        for c in coins:
            cache.set(f"snapshot:{c['symbol']}", {**c, "as_of": result["as_of"]})
        return result
    except Exception as e:
        if stale:
            stale["stale"] = True
            return stale
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/candles")
async def candles(
    symbol: str = Query(default="BTC"),
    interval: str = Query(default="1h"),
    limit: int = Query(default=100, ge=10, le=500),
):
    sym = symbol.upper()
    if not sym.isalnum():
        raise HTTPException(status_code=400, detail=f"Unknown symbol: {sym}")
    if interval not in VALID_CHART_INTERVALS:
        raise HTTPException(status_code=400, detail=f"Invalid interval. Use: {', '.join(VALID_CHART_INTERVALS)}")

    cache_key = f"candles:{sym}:{interval}:{limit}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    stale = cache.get_stale(cache_key)
    try:
        ohlc = await bnb.get_ohlc_klines(sym, interval, limit)
        closes = [c["close"] for c in ohlc]
        result = {
            "symbol": sym,
            "interval": interval,
            "as_of": now_iso(),
            "stale": False,
            "candles": ohlc,
            "indicators": ind.compute_all(closes),
        }
        cache.set(cache_key, result)
        return result
    except Exception as e:
        if stale:
            stale["stale"] = True
            return stale
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/news")
async def news(symbol: str = Query(default="BTC")):
    sym = symbol.upper()
    if not sym.isalnum():
        raise HTTPException(status_code=400, detail=f"Unknown symbol: {sym}")

    cache_key = f"news:{sym}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    stale = cache.get_stale(cache_key)
    try:
        posts = await news_api.get_news(sym)
        result = {"symbol": sym, "as_of": now_iso(), "stale": False, "news": posts}
        cache.set(cache_key, result)
        return result
    except Exception as e:
        if stale:
            stale["stale"] = True
            return stale
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/mood")
async def mood():
    cache_key = "mood"
    cached = cache.get(cache_key)
    if cached:
        return cached

    stale = cache.get_stale(cache_key)
    try:
        insights_key = f"insights:{','.join(DEFAULT_SYMBOLS)}"
        ins = cache.get(insights_key) or cache.get_stale(insights_key)
        if ins:
            coins = ins["coins"]
        else:
            coins_raw = await asyncio.gather(*[fetch_coin(s) for s in DEFAULT_SYMBOLS])
            coins = list(coins_raw)

        mood_text = ai.market_mood(coins)
        result = {"mood": mood_text, "as_of": now_iso(), "stale": False}
        cache.set(cache_key, result)
        return result
    except Exception as e:
        if stale:
            stale["stale"] = True
            return stale
        raise HTTPException(status_code=502, detail=str(e))


class AskBody(BaseModel):
    symbol: str
    question: str


@app.post("/api/ask")
async def ask(body: AskBody):
    symbol = body.symbol.upper()
    snapshot = cache.get(f"snapshot:{symbol}") or cache.get_stale(f"snapshot:{symbol}")
    if not snapshot:
        raise HTTPException(status_code=404, detail=f"No snapshot for {symbol}. Load insights first.")
    try:
        answer = ai.ask_coin(snapshot, body.question)
        return {"answer": answer, "as_of": snapshot.get("as_of", now_iso())}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ─── Insight-first Phase 1: watchlist · digest · chart drawings ──────────

def _require_user(x_user_id: Optional[str]) -> str:
    if not x_user_id:
        raise HTTPException(status_code=400, detail="Missing user session ID (X-User-ID header).")
    return x_user_id


class WatchlistBody(BaseModel):
    symbol: str


@app.get("/api/watchlist")
def get_watchlist(x_user_id: Optional[str] = Header(None)):
    user = _require_user(x_user_id)
    return {"symbols": db.get_watchlist(user)}


@app.post("/api/watchlist")
async def add_watchlist(body: WatchlistBody, x_user_id: Optional[str] = Header(None)):
    user = _require_user(x_user_id)
    symbol = body.symbol.strip().upper()
    if not symbol.isalnum():
        raise HTTPException(status_code=400, detail=f"Invalid symbol: {symbol}")
    # Enforce the cap (spec §8 Q2) — but only block genuinely new symbols, so
    # re-adding an existing one is always idempotent.
    if symbol not in db.get_watchlist(user) and db.count_watchlist(user) >= db.WATCHLIST_MAX:
        raise HTTPException(
            status_code=400,
            detail=f"Watchlist เต็ม (สูงสุด {db.WATCHLIST_MAX} เหรียญ)",
        )
    if not await bnb.validate_symbol(symbol):
        raise HTTPException(status_code=400, detail=f"ไม่พบเหรียญ {symbol} บน Binance (ต้องมีคู่ {symbol}USDT)")
    db.add_to_watchlist(user, symbol)
    return {"symbols": db.get_watchlist(user)}


@app.delete("/api/watchlist/{symbol}")
def delete_watchlist(symbol: str, x_user_id: Optional[str] = Header(None)):
    user = _require_user(x_user_id)
    db.remove_from_watchlist(user, symbol)
    return {"symbols": db.get_watchlist(user)}


@app.get("/api/digest")
async def digest(x_user_id: Optional[str] = Header(None)):
    user = _require_user(x_user_id)
    symbols = db.get_watchlist(user)[: db.WATCHLIST_MAX]
    day = today_utc()

    cached = db.get_digest_cache(user, day)
    if cached:
        return {**cached, "cached": True}

    try:
        coins = []
        for s in symbols:
            snap = cache.get(f"snapshot:{s}") or cache.get_stale(f"snapshot:{s}")
            if not snap:
                snap = await fetch_coin(s)
                cache.set(f"snapshot:{s}", {**snap, "as_of": now_iso()})
            coins.append(snap)

        result = ai.daily_digest(coins)
        payload = {
            "as_of": now_iso(),
            "day": day,
            "symbols": symbols,
            "digest": result,
            "coins": [
                {
                    "symbol": c["symbol"],
                    "price": c["price"],
                    "change_24h_pct": c["change_24h_pct"],
                }
                for c in coins
            ],
        }
        db.set_digest_cache(user, day, payload)
        return {**payload, "cached": False}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


class ChartDrawingsBody(BaseModel):
    symbol: str
    drawings: list[Any] = []


@app.get("/api/chart/drawings")
def get_chart_drawings(symbol: str = Query(...), x_user_id: Optional[str] = Header(None)):
    user = _require_user(x_user_id)
    return {"symbol": symbol.upper(), "drawings": db.get_chart_drawings(user, symbol)}


@app.put("/api/chart/drawings")
def put_chart_drawings(body: ChartDrawingsBody, x_user_id: Optional[str] = Header(None)):
    user = _require_user(x_user_id)
    db.save_chart_drawings(user, body.symbol, body.drawings)
    return {"status": "success", "symbol": body.symbol.upper(), "count": len(body.drawings)}


class OrderBody(BaseModel):
    symbol: str
    side: str  # BUY or SELL
    type: str  # LIMIT or MARKET
    quantity: float
    price: float = None


class LinkKeysBody(BaseModel):
    api_key: str
    secret_key: str


@app.get("/api/config")
def get_config():
    """Retrieve backend configurations (e.g. trading environment)."""
    return {
        "is_mainnet": binance_trade.IS_MAINNET,
        "base_url": binance_trade.BASE_URL
    }


@app.post("/api/account/keys")
async def link_keys(body: LinkKeysBody, x_user_id: Optional[str] = Header(None)):
    if not x_user_id:
        raise HTTPException(status_code=400, detail="Missing user session ID (X-User-ID header).")
    
    is_valid, msg = await binance_trade.verify_api_key(body.api_key, body.secret_key)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)
    
    try:
        vault.store_keys(x_user_id, body.api_key, body.secret_key)
        return {"status": "success", "message": msg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store keys: {e}")


@app.delete("/api/account/keys")
def unlink_keys(x_user_id: Optional[str] = Header(None)):
    if not x_user_id:
        raise HTTPException(status_code=400, detail="Missing user session ID (X-User-ID header).")
    
    try:
        vault.delete_keys(x_user_id)
        return {"status": "success", "message": "Keys unlinked successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete keys: {e}")


@app.get("/api/account/keys/status")
def get_keys_status(x_user_id: Optional[str] = Header(None)):
    # 1. Per-user key linked in the vault takes precedence
    api_key = None
    source = None
    if x_user_id:
        keys = vault.get_keys(x_user_id)
        if keys:
            api_key, source = keys[0], "user"

    # 2. Fall back to a shared demo key from the backend environment
    if not api_key and binance_trade.env_keys_configured():
        api_key, source = binance_trade.env_api_key(), "env"

    if not api_key:
        return {"linked": False}

    masked_key = f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else "****"
    return {
        "linked": True,
        "api_key_masked": masked_key,
        "is_mainnet": binance_trade.IS_MAINNET,
        "source": source,  # "user" (linked in Settings) or "env" (shared demo)
    }


@app.post("/api/order")
async def place_order(body: OrderBody, x_user_id: Optional[str] = Header(None)):
    try:
        res = await binance_trade.place_spot_order(
            symbol=body.symbol,
            side=body.side,
            order_type=body.type,
            quantity=body.quantity,
            price=body.price,
            user_id=x_user_id
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/account/balances")
async def get_balances(x_user_id: Optional[str] = Header(None)):
    try:
        res = await binance_trade.get_account_balances(user_id=x_user_id)
        return {"balances": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/account/orders/open")
async def get_open_orders(symbol: Optional[str] = Query(None), x_user_id: Optional[str] = Header(None)):
    try:
        res = await binance_trade.get_open_orders(symbol=symbol, user_id=x_user_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/account/orders/history")
async def get_order_history(symbol: str = Query(...), x_user_id: Optional[str] = Header(None)):
    try:
        res = await binance_trade.get_all_orders(symbol=symbol, user_id=x_user_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/account/trades")
async def get_my_trades(symbol: str = Query(...), x_user_id: Optional[str] = Header(None)):
    try:
        res = await binance_trade.get_my_trades(symbol=symbol, user_id=x_user_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



@app.delete("/api/order")
async def cancel_order(symbol: str = Query(...), order_id: int = Query(...), x_user_id: Optional[str] = Header(None)):
    try:
        res = await binance_trade.cancel_spot_order(symbol=symbol, order_id=order_id, user_id=x_user_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

