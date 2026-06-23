import os
import time
import hmac
import hashlib
import urllib.parse
import logging
from typing import Any, Dict, Optional
import httpx
from decimal import Decimal, ROUND_DOWN

log = logging.getLogger("binance_trade")

MAINNET_URL = "https://api.binance.com"
TESTNET_URL = "https://testnet.binance.vision"

# Env default when user has no saved preference (see db.get_binance_use_testnet).
ENV_DEFAULT_MAINNET = os.environ.get("ENABLE_BINANCE_MAINNET", "").lower() == "true"
IS_MAINNET = ENV_DEFAULT_MAINNET
BASE_URL = MAINNET_URL if ENV_DEFAULT_MAINNET else TESTNET_URL


def base_url_for(mainnet: bool) -> str:
    return MAINNET_URL if mainnet else TESTNET_URL


def resolve_mainnet(user_id: Optional[str] = None) -> bool:
    if user_id:
        import db

        return db.get_binance_mainnet(user_id)
    return ENV_DEFAULT_MAINNET


def get_keys(user_id: Optional[str] = None, *, mainnet: Optional[bool] = None) -> tuple[str, str]:
    """Retrieve API keys based on session user or environment selection."""
    if mainnet is None:
        mainnet = resolve_mainnet(user_id)

    if user_id:
        try:
            import vault

            keys = vault.get_keys(user_id)
            if keys:
                return keys[0].strip(), keys[1].strip()
        except Exception as e:
            log.error(f"Failed to fetch keys from vault for user {user_id}: {e}")

    return _env_keys(mainnet)


def _env_keys(mainnet: Optional[bool] = None) -> tuple[str, str]:
    """Shared demo keys from environment (selected by network)."""
    if mainnet is None:
        mainnet = ENV_DEFAULT_MAINNET
    if mainnet:
        api_key = os.environ.get("BINANCE_API_KEY", "")
        secret_key = os.environ.get("BINANCE_SECRET_KEY", "")
    else:
        api_key = os.environ.get("BINANCE_TESTNET_API_KEY", "")
        secret_key = os.environ.get("BINANCE_TESTNET_SECRET_KEY", "")
    return api_key.strip(), secret_key.strip()


def env_api_key(user_id: Optional[str] = None) -> str:
    """The configured shared/demo API key (for masking in status), or empty string."""
    return _env_keys(resolve_mainnet(user_id))[0]


def env_keys_configured(user_id: Optional[str] = None) -> bool:
    """True when a shared demo key pair is set for the user's network."""
    api_key, secret_key = _env_keys(resolve_mainnet(user_id))
    return bool(api_key and secret_key)


_server_time_offsets: Dict[str, int] = {}


async def get_server_time(base: Optional[str] = None) -> int:
    """Fetch current server time from Binance or calculate it using the cached offset."""
    base = base or BASE_URL
    local_ms = int(time.time() * 1000)

    offset = _server_time_offsets.get(base)
    if offset is not None:
        return local_ms + offset

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(f"{base}/api/v3/time")
            r.raise_for_status()
            server_time = int(r.json()["serverTime"])
            _server_time_offsets[base] = server_time - local_ms
            return server_time
        except Exception as e:
            log.error(f"Failed to fetch Binance server time from {base}: {e}")
            return local_ms


def generate_signature(secret_key: str, query_string: str) -> str:
    """Generate HMAC-SHA256 signature."""
    return hmac.new(
        secret_key.encode("utf-8"),
        query_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


async def signed_request(
    method: str,
    endpoint: str,
    params: Dict[str, Any] = None,
    user_id: Optional[str] = None,
    api_key: Optional[str] = None,
    secret_key: Optional[str] = None,
    mainnet: Optional[bool] = None,
) -> Any:
    """Send signed request to Binance API."""
    if mainnet is None:
        mainnet = resolve_mainnet(user_id)

    if not api_key or not secret_key:
        api_key, secret_key = get_keys(user_id, mainnet=mainnet)

    if not api_key or not secret_key:
        raise RuntimeError("Binance API keys not configured. Please link your API Keys first.")

    if params is None:
        params = {}

    base = base_url_for(mainnet)
    server_time = await get_server_time(base)
    params["timestamp"] = server_time
    params["recvWindow"] = 60000

    query_string = urllib.parse.urlencode(params)
    signature = generate_signature(secret_key, query_string)
    query_string += f"&signature={signature}"

    headers = {
        "X-MBX-APIKEY": api_key,
        "Content-Type": "application/x-www-form-urlencoded",
    }

    url = f"{base}{endpoint}?{query_string}"

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            if method.upper() == "POST":
                r = await client.post(url, headers=headers)
            elif method.upper() == "DELETE":
                r = await client.delete(url, headers=headers)
            else:
                r = await client.get(url, headers=headers)

            if r.status_code >= 400:
                try:
                    error_data = r.json()
                    raise RuntimeError(
                        f"Binance API Error: {error_data.get('msg', r.text)} "
                        f"(code: {error_data.get('code')})"
                    )
                except ValueError:
                    raise RuntimeError(f"Binance HTTP Error: {r.status_code} {r.text}")

            return r.json()
        except httpx.HTTPError as e:
            raise RuntimeError(f"Network error calling Binance API: {e}")


_exchange_info_cache: Dict[str, Any] = {}


async def fetch_exchange_info(symbol: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Fetch and cache exchange filter specifications for a symbol."""
    pair = symbol if symbol.endswith("USDT") else f"{symbol}USDT"
    mainnet = resolve_mainnet(user_id)
    cache_key = f"{mainnet}:{pair}"

    if cache_key in _exchange_info_cache:
        return _exchange_info_cache[cache_key]

    base = base_url_for(mainnet)
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(f"{base}/api/v3/exchangeInfo", params={"symbol": pair})
            r.raise_for_status()
            data = r.json()
            if data and "symbols" in data and len(data["symbols"]) > 0:
                sym_info = data["symbols"][0]
                _exchange_info_cache[cache_key] = sym_info
                return sym_info
            raise ValueError(f"Symbol {pair} not found in exchangeInfo")
        except Exception as e:
            log.error(f"Failed to fetch exchangeInfo for {pair}: {e}")
            raise


def extract_filter(sym_info: Dict[str, Any], filter_type: str) -> Dict[str, Any]:
    """Extract filter constraints by type name."""
    for f in sym_info.get("filters", []):
        if f.get("filterType") == filter_type:
            return f
    return {}


def round_value(value: float, step: float, rounding_mode=ROUND_DOWN) -> float:
    """Precision-safe rounding matching Binance requirements."""
    if step <= 0:
        return value

    step_str = f"{step:.8f}".rstrip("0")
    if "." in step_str:
        decimals = len(step_str.split(".")[1])
    else:
        decimals = 0

    dec_val = Decimal(str(value))
    dec_step = Decimal(str(step))

    remainder = dec_val % dec_step
    rounded = dec_val - remainder

    quantized = rounded.quantize(Decimal("10") ** -decimals, rounding=rounding_mode)
    return float(quantized)


async def format_order_params(
    symbol: str, price: float, quantity: float, side: str, order_type: str, user_id: Optional[str] = None
) -> tuple[float, float]:
    """Verify and format price and quantity according to Binance's filter guidelines."""
    sym_info = await fetch_exchange_info(symbol, user_id=user_id)

    price_filter = extract_filter(sym_info, "PRICE_FILTER")
    lot_size = extract_filter(sym_info, "LOT_SIZE")
    min_notional = extract_filter(sym_info, "MIN_NOTIONAL") or extract_filter(sym_info, "NOTIONAL")

    tick_size = float(price_filter.get("tickSize", 0))
    step_size = float(lot_size.get("stepSize", 0))
    min_val = float(min_notional.get("minNotional", 0)) if min_notional else 0.0

    final_price = round_value(price, tick_size, ROUND_DOWN) if tick_size > 0 else price
    final_qty = round_value(quantity, step_size, ROUND_DOWN) if step_size > 0 else quantity

    notional = final_price * final_qty
    if min_val > 0 and notional < min_val:
        raise ValueError(
            f"ยอดสั่งซื้อน้อยเกินไป ยอดรวม (${notional:.2f}) ต้องมีขนาดอย่างน้อย ${min_val:.2f}"
        )

    min_qty = float(lot_size.get("minQty", 0))
    max_qty = float(lot_size.get("maxQty", 0))
    if min_qty > 0 and final_qty < min_qty:
        raise ValueError(f"จำนวนเหรียญต่ำกว่าจำนวนขั้นต่ำที่กำหนด ({min_qty})")
    if max_qty > 0 and final_qty > max_qty:
        raise ValueError(f"จำนวนเหรียญเกินขีดจำกัดสูงสุดที่กำหนด ({max_qty})")

    return final_price, final_qty


async def place_spot_order(
    symbol: str,
    side: str,
    order_type: str,
    quantity: float,
    price: float = None,
    user_id: Optional[str] = None,
) -> Any:
    """Place a Spot Limit or Market order on Binance."""
    pair = symbol if symbol.endswith("USDT") else f"{symbol}USDT"

    side_upper = side.upper()
    type_upper = order_type.upper()

    if side_upper not in ("BUY", "SELL"):
        raise ValueError("Invalid side. Must be BUY or SELL.")
    if type_upper not in ("LIMIT", "MARKET"):
        raise ValueError("Invalid type. Must be LIMIT or MARKET.")

    params: Dict[str, Any] = {
        "symbol": pair,
        "side": side_upper,
        "type": type_upper,
    }

    if type_upper == "LIMIT":
        if price is None or price <= 0:
            raise ValueError("Price is required for Limit orders.")

        final_price, final_qty = await format_order_params(
            pair, price, quantity, side_upper, type_upper, user_id=user_id
        )
        params["price"] = f"{final_price:.8f}".rstrip("0").rstrip(".")
        params["quantity"] = f"{final_qty:.8f}".rstrip("0").rstrip(".")
        params["timeInForce"] = "GTC"
    else:
        ticker_price = price
        if not ticker_price:
            import binance as bnb

            ticker = await bnb.get_24h(symbol)
            ticker_price = ticker["price"]

        _, final_qty = await format_order_params(
            pair, ticker_price, quantity, side_upper, type_upper, user_id=user_id
        )
        params["quantity"] = f"{final_qty:.8f}".rstrip("0").rstrip(".")

    return await signed_request("POST", "/api/v3/order", params, user_id=user_id)


async def get_account_balances(user_id: Optional[str] = None) -> list[Dict[str, Any]]:
    """Fetch user balance statistics from Spot account."""
    result = await signed_request("GET", "/api/v3/account", user_id=user_id)
    balances = result.get("balances", [])

    active_balances = []
    for asset in balances:
        free = float(asset.get("free", 0))
        locked = float(asset.get("locked", 0))
        if free > 0 or locked > 0 or asset.get("asset") in ("BTC", "ETH", "BNB", "SOL", "USDT"):
            active_balances.append(
                {
                    "asset": asset.get("asset"),
                    "free": free,
                    "locked": locked,
                    "total": free + locked,
                }
            )
    return active_balances


async def get_open_orders(symbol: Optional[str] = None, user_id: Optional[str] = None) -> list[Dict[str, Any]]:
    """Fetch user's open orders from Binance. If symbol is None, returns all open orders."""
    params = {}
    if symbol:
        pair = symbol if symbol.endswith("USDT") else f"{symbol}USDT"
        params["symbol"] = pair

    return await signed_request("GET", "/api/v3/openOrders", params, user_id=user_id)


async def get_all_orders(symbol: str, user_id: Optional[str] = None, limit: int = 20) -> list[Dict[str, Any]]:
    """Fetch user's historical orders (active, canceled, or filled) for a specific symbol."""
    pair = symbol if symbol.endswith("USDT") else f"{symbol}USDT"
    params = {"symbol": pair, "limit": limit}
    return await signed_request("GET", "/api/v3/allOrders", params, user_id=user_id)


async def get_my_trades(symbol: str, user_id: Optional[str] = None, limit: int = 50) -> list[Dict[str, Any]]:
    """Fetch user's historical trades (fills) for a specific symbol from Binance."""
    pair = symbol if symbol.endswith("USDT") else f"{symbol}USDT"
    params = {"symbol": pair, "limit": limit}
    return await signed_request("GET", "/api/v3/myTrades", params, user_id=user_id)


async def cancel_spot_order(symbol: str, order_id: int, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Cancel an active open order on Binance."""
    pair = symbol if symbol.endswith("USDT") else f"{symbol}USDT"
    params = {"symbol": pair, "orderId": order_id}
    return await signed_request("DELETE", "/api/v3/order", params, user_id=user_id)


async def verify_api_key(
    api_key: str,
    secret_key: str,
    *,
    require_trading: bool = False,
    mainnet: Optional[bool] = None,
) -> tuple[bool, str]:
    """Verify API key: withdrawals must stay off; reading or trading as required."""
    if mainnet is None:
        mainnet = ENV_DEFAULT_MAINNET

    try:
        try:
            res = await signed_request(
                "GET",
                "/sapi/v1/account/apiRestrictions",
                api_key=api_key,
                secret_key=secret_key,
                mainnet=mainnet,
            )
            enable_withdrawals = res.get("enableWithdrawals", False)
            enable_trading = res.get("enableSpotAndMarginTrading", False)
            enable_reading = res.get("enableReading", True)

            if enable_withdrawals:
                return False, "สิทธิ์การถอนเงิน (Withdrawal) ถูกเปิดใช้งานอยู่ เพื่อความปลอดภัย กรุณาปิดสิทธิ์นี้ก่อนเชื่อมต่อ"
            if require_trading and not enable_trading:
                return False, "สิทธิ์การเทรด (Spot Trading) ยังไม่ได้เปิดใช้งาน กรุณาเปิดสิทธิ์นี้ก่อนเชื่อมต่อ"
            if not enable_trading and not enable_reading:
                return False, "เปิดสิทธิ์ Enable Reading หรือ Spot Trading บน Binance ก่อนเชื่อมต่อ"

            await signed_request(
                "GET", "/api/v3/account", api_key=api_key, secret_key=secret_key, mainnet=mainnet
            )
            network = "Mainnet" if mainnet else "Testnet"
            if enable_trading:
                return True, f"เชื่อมต่อ {network} สำเร็จ — อ่านยอดและเทรดได้ (Withdrawal ปิดอยู่)"
            return True, f"เชื่อมต่อ {network} สำเร็จ — อ่านยอด Spot อย่างเดียว"
        except Exception as e:
            if not mainnet:
                await signed_request(
                    "GET", "/api/v3/account", api_key=api_key, secret_key=secret_key, mainnet=False
                )
                return True, "เชื่อมต่อ Testnet สำเร็จ"
            raise e
    except Exception as e:
        return False, f"เชื่อมต่อล้มเหลว: {e}"


STABLE_ASSETS = frozenset({"USDT", "USDC", "BUSD", "FDUSD", "TUSD", "DAI"})


def compute_avg_cost_from_trades(trades: list[Dict[str, Any]]) -> float:
    """Average buy price from fill history (FIFO-style, matches frontend helper)."""
    sorted_trades = sorted(trades, key=lambda t: t.get("time", 0))
    total_qty = 0.0
    total_cost = 0.0
    avg_buy_price = 0.0

    for t in sorted_trades:
        price = float(t.get("price", 0))
        qty = float(t.get("qty", 0))
        if t.get("isBuyer"):
            total_cost += price * qty
            total_qty += qty
            if total_qty > 0:
                avg_buy_price = total_cost / total_qty
        else:
            total_qty = max(0.0, total_qty - qty)
            total_cost = total_qty * avg_buy_price

    return avg_buy_price if total_qty > 0 else 0.0


async def build_holdings_from_account(
    user_id: Optional[str] = None,
    *,
    max_coins: int = 10,
) -> list[Dict[str, Any]]:
    """Map Spot balances → holdings sorted by USD value (read-only sync)."""
    import binance as bnb

    balances = await get_account_balances(user_id=user_id)
    candidates: list[Dict[str, Any]] = []

    for asset in balances:
        sym = asset.get("asset", "")
        if sym in STABLE_ASSETS:
            continue
        total = float(asset.get("total", 0))
        if total <= 0:
            continue
        if not await bnb.validate_symbol(sym):
            continue
        try:
            ticker = await bnb.get_24h(sym)
            usd_value = total * ticker["price"]
        except Exception:
            usd_value = 0.0
        if usd_value < 1.0:
            continue
        candidates.append({"symbol": sym, "amount": total, "usd_value": usd_value})

    candidates.sort(key=lambda c: c["usd_value"], reverse=True)
    top = candidates[:max_coins]

    holdings: list[Dict[str, Any]] = []
    for c in top:
        avg_price = None
        try:
            trades = await get_my_trades(c["symbol"], user_id=user_id, limit=500)
            cost = compute_avg_cost_from_trades(trades)
            if cost > 0:
                avg_price = round(cost, 8)
        except Exception:
            pass
        item: Dict[str, Any] = {"symbol": c["symbol"], "amount": c["amount"]}
        if avg_price is not None:
            item["avg_price"] = avg_price
        holdings.append(item)

    return holdings
