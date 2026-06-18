import asyncio
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any

import cache
import metrics
import rate_limit
import binance as bnb
import indicators as ind
import news as news_api
import ai
import binance_trade
import vault
import db
import heat as heat_mod

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


def digest_bucket() -> str:
    """UTC hour bucket for digest cache — one fresh LLM digest per user per hour."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")


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
        # The per-coin LLM summary is NOT shown in the fact-card UI (which uses
        # deterministic Heat/deviation/facts) — it's only used as extra context
        # in /api/ask. Generating it eagerly here fired one AI call PER coin on
        # every load, instantly blowing the free-tier 5 RPM limit. Leave it empty
        # and let /api/ask fill it on demand.
        "summary": "",
    }
    return coin


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/metrics")
def ai_metrics():
    """Measured token usage, latency, and projected cost across recent AI calls.

    Answers the Week 2 'cost & latency awareness' question with real numbers
    rather than estimates. Free-tier spend is $0; est_cost_usd is a paid-tier
    projection so the team can see what the feature would cost at scale.
    """
    return metrics.snapshot()


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
        # Summaries are generated lazily (not on every insights load) to stay
        # under the free-tier RPM limit. Build it on the first question, then
        # cache it back onto the snapshot so later questions reuse it.
        if not snapshot.get("summary"):
            snapshot["summary"] = ai.summarize_coin(snapshot)
            cache.set(f"snapshot:{symbol}", snapshot)
        answer = ai.ask_coin(snapshot, body.question)
        return {"answer": answer, "as_of": snapshot.get("as_of", now_iso())}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


# ─── Heat score (deterministic — PLAN milestone 2) ──────────────────────


async def _get_snapshot(symbol: str) -> dict:
    """Reuse the cached insights snapshot (rsi/news/price); fetch if missing."""
    snap = cache.get(f"snapshot:{symbol}") or cache.get_stale(f"snapshot:{symbol}")
    if not snap:
        snap = await fetch_coin(symbol)
        cache.set(f"snapshot:{symbol}", {**snap, "as_of": now_iso()})
    return snap


async def _get_daily_candles(symbol: str, days: int = 30) -> list[dict]:
    cache_key = f"daily:{symbol}:{days}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    try:
        candles = await bnb.get_ohlc_klines(symbol, "1d", days)
    except Exception:
        candles = cache.get_stale(cache_key) or []
    cache.set(cache_key, candles)
    return candles


async def _heat_for(symbol: str) -> dict:
    snap, daily = await asyncio.gather(
        _get_snapshot(symbol),
        _get_daily_candles(symbol),
    )
    rsi = snap.get("rsi", 50)
    news = snap.get("news") or []
    change = snap.get("change_24h_pct", 0.0)
    result = heat_mod.compute_heat(rsi, daily, news)
    result["facts"] = heat_mod.compute_facts(rsi, daily, news, change)
    result["deviation"] = heat_mod.compute_deviation(daily)
    result["price"] = snap.get("price")
    return result


@app.get("/api/heat")
async def get_heat(symbols: str = Query(default=",".join(DEFAULT_SYMBOLS))):
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not sym_list:
        return {"as_of": now_iso(), "heat": {}}
    try:
        results = await asyncio.gather(*[_heat_for(s) for s in sym_list])
        return {"as_of": now_iso(), "heat": dict(zip(sym_list, results))}
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


class ReorderBody(BaseModel):
    symbols: list[str]


@app.put("/api/watchlist/reorder")
def reorder_watchlist(body: ReorderBody, x_user_id: Optional[str] = Header(None)):
    user = _require_user(x_user_id)
    db.reorder_watchlist(user, body.symbols)
    return {"symbols": db.get_watchlist(user)}


@app.delete("/api/watchlist/{symbol}")
def delete_watchlist(symbol: str, x_user_id: Optional[str] = Header(None)):
    user = _require_user(x_user_id)
    db.remove_from_watchlist(user, symbol)
    return {"symbols": db.get_watchlist(user)}


# ─── Manual holdings (PLAN milestone 1) ─────────────────────────────────


class HoldingBody(BaseModel):
    symbol: str
    amount: float


@app.get("/api/holdings")
def get_holdings(x_user_id: Optional[str] = Header(None)):
    user = _require_user(x_user_id)
    return {"holdings": db.get_holdings(user)}


@app.post("/api/holdings")
async def upsert_holding(body: HoldingBody, x_user_id: Optional[str] = Header(None)):
    user = _require_user(x_user_id)
    symbol = body.symbol.strip().upper()
    if not symbol.isalnum():
        raise HTTPException(status_code=400, detail=f"Invalid symbol: {symbol}")
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="จำนวนต้องมากกว่า 0")
    existing = {h["symbol"] for h in db.get_holdings(user)}
    if symbol not in existing and db.count_holdings(user) >= db.WATCHLIST_MAX:
        raise HTTPException(
            status_code=400,
            detail=f"พอร์ตเต็ม (สูงสุด {db.WATCHLIST_MAX} เหรียญ)",
        )
    if not await bnb.validate_symbol(symbol):
        raise HTTPException(status_code=400, detail=f"ไม่พบเหรียญ {symbol} บน Binance (ต้องมีคู่ {symbol}USDT)")
    db.upsert_holding(user, symbol, body.amount)
    return {"holdings": db.get_holdings(user)}


@app.delete("/api/holdings/{symbol}")
def delete_holding(symbol: str, x_user_id: Optional[str] = Header(None)):
    user = _require_user(x_user_id)
    db.remove_holding(user, symbol)
    return {"holdings": db.get_holdings(user)}


@app.get("/api/digest")
async def digest(
    force: bool = Query(default=False),
    x_user_id: Optional[str] = Header(None),
):
    user = _require_user(x_user_id)
    holdings = db.get_holdings(user)
    holding_amounts = {h["symbol"]: h["amount"] for h in holdings}
    if holdings:
        symbols = [h["symbol"] for h in holdings][: db.WATCHLIST_MAX]
    else:
        symbols = db.get_watchlist(user)[: db.WATCHLIST_MAX]
    bucket = digest_bucket()
    weighted = bool(holdings)
    shared_key = db.digest_shared_key(bucket, symbols)

    if force:
        if not db.can_force_refresh(user, bucket):
            raise HTTPException(
                status_code=429,
                detail=f"รีเฟรชบังคับได้สูงสุด {db.DIGEST_FORCE_MAX} ครั้งต่อชั่วโมง",
            )

    cached = None
    if not force:
        if weighted:
            cached = db.get_digest_cache(user, bucket)
        else:
            cached = db.get_shared_digest_cache(shared_key)
    if cached:
        return {
            **cached,
            "cached": True,
            "shared": not weighted,
            "force_remaining": db.force_refresh_remaining(user, bucket),
        }

    try:
        coins = []
        for s in symbols:
            snap = cache.get(f"snapshot:{s}") or cache.get_stale(f"snapshot:{s}")
            if not snap:
                snap = await fetch_coin(s)
                cache.set(f"snapshot:{s}", {**snap, "as_of": now_iso()})
            coins.append(snap)

        # Attach Heat + portfolio weight so the digest can say "X is Y% of your
        # portfolio and running unusually hot" — grounded, never a buy/sell call.
        daily_lists = await asyncio.gather(*[_get_daily_candles(s) for s in symbols])
        total_value = sum(
            holding_amounts.get(c["symbol"], 0) * (c.get("price") or 0) for c in coins
        )
        for c, daily in zip(coins, daily_lists):
            h = heat_mod.compute_heat(c.get("rsi", 50), daily, c.get("news") or [])
            c["heat"] = h["score"]
            c["heat_zone"] = h["zone"]
            # Deviation = the wedge: is today abnormal vs THIS coin's own baseline.
            c["deviation"] = heat_mod.compute_deviation(daily)
            if total_value > 0 and c["symbol"] in holding_amounts:
                c["weight_pct"] = round(
                    holding_amounts[c["symbol"]] * (c.get("price") or 0) / total_value * 100, 1
                )
            else:
                c["weight_pct"] = None

        # Lead with what's NOTABLE today: abnormal-vs-own-baseline coins first
        # (the panic-killer wedge), heaviest holding breaking ties. A big holding
        # behaving normally isn't "something to attend to" — an abnormal move is.
        _dev_rank = {"abnormal": 2, "mild": 1, "normal": 0}
        coins.sort(
            key=lambda c: (
                _dev_rank.get((c.get("deviation") or {}).get("status"), 0),
                c.get("weight_pct") or 0,
            ),
            reverse=True,
        )

        result = ai.daily_digest(coins)
        payload = {
            "as_of": now_iso(),
            "day": today_utc(),
            "bucket": bucket,
            "symbols": [c["symbol"] for c in coins],
            "weighted": total_value > 0,
            "digest": result,
            "coins": [
                {
                    "symbol": c["symbol"],
                    "price": c["price"],
                    "change_24h_pct": c["change_24h_pct"],
                    "heat": c.get("heat"),
                    "heat_zone": c.get("heat_zone"),
                    "weight_pct": c.get("weight_pct"),
                    "deviation": c.get("deviation"),
                }
                for c in coins
            ],
        }
        # Don't pin a degraded (all-providers-down) digest for the whole hour —
        # the next request retries the LLM instead of serving a deterministic-only
        # digest until the bucket rolls over.
        if not result.get("degraded"):
            if total_value > 0:
                db.set_digest_cache(user, bucket, payload)
            else:
                db.set_shared_digest_cache(shared_key, payload)
        if force:
            db.record_force_refresh(user, bucket)
        return {
            **payload,
            "cached": False,
            "shared": total_value == 0,
            "force_remaining": db.force_refresh_remaining(user, bucket),
        }
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

