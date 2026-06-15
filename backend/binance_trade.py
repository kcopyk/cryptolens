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

# Determine base URL (default: Testnet)
IS_MAINNET = os.environ.get("ENABLE_BINANCE_MAINNET", "").lower() == "true"
BASE_URL = "https://api.binance.com" if IS_MAINNET else "https://testnet.binance.vision"

def get_keys(user_id: Optional[str] = None) -> tuple[str, str]:
    """Retrieve API keys based on session user or environment selection."""
    if user_id:
        try:
            import vault
            keys = vault.get_keys(user_id)
            if keys:
                return keys[0].strip(), keys[1].strip()
        except Exception as e:
            log.error(f"Failed to fetch keys from vault for user {user_id}: {e}")
            
    api_key, secret_key = _env_keys()
    return api_key, secret_key


def _env_keys() -> tuple[str, str]:
    """Shared demo keys from environment (selected by network)."""
    if IS_MAINNET:
        api_key = os.environ.get("BINANCE_API_KEY", "")
        secret_key = os.environ.get("BINANCE_SECRET_KEY", "")
    else:
        api_key = os.environ.get("BINANCE_TESTNET_API_KEY", "")
        secret_key = os.environ.get("BINANCE_TESTNET_SECRET_KEY", "")
    return api_key.strip(), secret_key.strip()


def env_api_key() -> str:
    """The configured shared/demo API key (for masking in status), or empty string."""
    return _env_keys()[0]


def env_keys_configured() -> bool:
    """True when a shared demo key pair is set in the environment."""
    api_key, secret_key = _env_keys()
    return bool(api_key and secret_key)

_server_time_offset: Optional[int] = None

async def get_server_time() -> int:
    """Fetch current server time from Binance or calculate it using the cached offset."""
    global _server_time_offset
    local_ms = int(time.time() * 1000)
    
    if _server_time_offset is not None:
        return local_ms + _server_time_offset
        
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(f"{BASE_URL}/api/v3/time")
            r.raise_for_status()
            server_time = int(r.json()["serverTime"])
            _server_time_offset = server_time - local_ms
            return server_time
        except Exception as e:
            log.error(f"Failed to fetch Binance server time: {e}")
            # Fallback to local time in milliseconds
            return local_ms

def generate_signature(secret_key: str, query_string: str) -> str:
    """Generate HMAC-SHA256 signature."""
    return hmac.new(
        secret_key.encode("utf-8"),
        query_string.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

async def signed_request(
    method: str, 
    endpoint: str, 
    params: Dict[str, Any] = None, 
    user_id: Optional[str] = None,
    api_key: Optional[str] = None, 
    secret_key: Optional[str] = None
) -> Any:
    """Send signed request to Binance API."""
    if not api_key or not secret_key:
        api_key, secret_key = get_keys(user_id)
        
    if not api_key or not secret_key:
        raise RuntimeError("Binance API keys not configured. Please link your API Keys first.")

    if params is None:
        params = {}

    # Sync server time
    server_time = await get_server_time()
    params["timestamp"] = server_time
    params["recvWindow"] = 60000  # Allow up to 60 seconds network delay

    # Construct signed query string
    query_string = urllib.parse.urlencode(params)
    signature = generate_signature(secret_key, query_string)
    query_string += f"&signature={signature}"

    headers = {
        "X-MBX-APIKEY": api_key,
        "Content-Type": "application/x-www-form-urlencoded"
    }

    url = f"{BASE_URL}{endpoint}?{query_string}"

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            if method.upper() == "POST":
                r = await client.post(url, headers=headers)
            elif method.upper() == "DELETE":
                r = await client.delete(url, headers=headers)
            else:
                r = await client.get(url, headers=headers)
            
            # Custom error parsing
            if r.status_code >= 400:
                try:
                    error_data = r.json()
                    raise RuntimeError(f"Binance API Error: {error_data.get('msg', r.text)} (code: {error_data.get('code')})")
                except ValueError:
                    raise RuntimeError(f"Binance HTTP Error: {r.status_code} {r.text}")
            
            return r.json()
        except httpx.HTTPError as e:
            raise RuntimeError(f"Network error calling Binance API: {e}")

# In-memory exchangeInfo filters cache
_exchange_info_cache: Dict[str, Any] = {}

async def fetch_exchange_info(symbol: str) -> Dict[str, Any]:
    """Fetch and cache exchange filter specifications for a symbol."""
    pair = symbol if symbol.endswith("USDT") else f"{symbol}USDT"
    
    if pair in _exchange_info_cache:
        return _exchange_info_cache[pair]
        
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(f"{BASE_URL}/api/v3/exchangeInfo", params={"symbol": pair})
            r.raise_for_status()
            data = r.json()
            if data and "symbols" in data and len(data["symbols"]) > 0:
                sym_info = data["symbols"][0]
                _exchange_info_cache[pair] = sym_info
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
    
    # Extract decimals count from stepSize/tickSize float representation
    step_str = f"{step:.8f}".rstrip('0')
    if '.' in step_str:
        decimals = len(step_str.split('.')[1])
    else:
        decimals = 0

    dec_val = Decimal(str(value))
    dec_step = Decimal(str(step))

    remainder = dec_val % dec_step
    rounded = dec_val - remainder
    
    quantized = rounded.quantize(Decimal('10') ** -decimals, rounding=rounding_mode)
    return float(quantized)

async def format_order_params(symbol: str, price: float, quantity: float, side: str, order_type: str) -> tuple[float, float]:
    """Verify and format price and quantity according to Binance's filter guidelines."""
    sym_info = await fetch_exchange_info(symbol)
    
    price_filter = extract_filter(sym_info, "PRICE_FILTER")
    lot_size = extract_filter(sym_info, "LOT_SIZE")
    min_notional = extract_filter(sym_info, "MIN_NOTIONAL") or extract_filter(sym_info, "NOTIONAL")
    
    tick_size = float(price_filter.get("tickSize", 0))
    step_size = float(lot_size.get("stepSize", 0))
    min_val = float(min_notional.get("minNotional", 0)) if min_notional else 0.0

    # Precision rounding
    final_price = round_value(price, tick_size, ROUND_DOWN) if tick_size > 0 else price
    final_qty = round_value(quantity, step_size, ROUND_DOWN) if step_size > 0 else quantity
    
    # Min Notional Validation (price * quantity)
    notional = final_price * final_qty
    if min_val > 0 and notional < min_val:
        raise ValueError(
            f"ยอดสั่งซื้อน้อยเกินไป ยอดรวม (${notional:.2f}) ต้องมีขนาดอย่างน้อย ${min_val:.2f}"
        )
        
    # Min/Max Limit check
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
    user_id: Optional[str] = None
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
        
        # Verify and format parameters
        final_price, final_qty = await format_order_params(pair, price, quantity, side_upper, type_upper)
        params["price"] = f"{final_price:.8f}".rstrip('0').rstrip('.')
        params["quantity"] = f"{final_qty:.8f}".rstrip('0').rstrip('.')
        params["timeInForce"] = "GTC"
    else:
        # Market orders
        ticker_price = price
        if not ticker_price:
            import binance as bnb
            ticker = await bnb.get_24h(symbol)
            ticker_price = ticker["price"]
            
        _, final_qty = await format_order_params(pair, ticker_price, quantity, side_upper, type_upper)
        params["quantity"] = f"{final_qty:.8f}".rstrip('0').rstrip('.')

    # Send signed HTTP POST order
    result = await signed_request("POST", "/api/v3/order", params, user_id=user_id)
    return result

async def get_account_balances(user_id: Optional[str] = None) -> list[Dict[str, Any]]:
    """Fetch user balance statistics from Spot account."""
    result = await signed_request("GET", "/api/v3/account", user_id=user_id)
    balances = result.get("balances", [])
    
    active_balances = []
    for asset in balances:
        free = float(asset.get("free", 0))
        locked = float(asset.get("locked", 0))
        # Keep non-empty holdings or core tracking assets
        if free > 0 or locked > 0 or asset.get("asset") in ("BTC", "ETH", "BNB", "SOL", "USDT"):
            active_balances.append({
                "asset": asset.get("asset"),
                "free": free,
                "locked": locked,
                "total": free + locked
            })
    return active_balances


async def get_open_orders(symbol: Optional[str] = None, user_id: Optional[str] = None) -> list[Dict[str, Any]]:
    """Fetch user's open orders from Binance. If symbol is None, returns all open orders."""
    params = {}
    if symbol:
        pair = symbol if symbol.endswith("USDT") else f"{symbol}USDT"
        params["symbol"] = pair
        
    result = await signed_request("GET", "/api/v3/openOrders", params, user_id=user_id)
    return result


async def get_all_orders(symbol: str, user_id: Optional[str] = None, limit: int = 20) -> list[Dict[str, Any]]:
    """Fetch user's historical orders (active, canceled, or filled) for a specific symbol."""
    pair = symbol if symbol.endswith("USDT") else f"{symbol}USDT"
    params = {
        "symbol": pair,
        "limit": limit
    }
    result = await signed_request("GET", "/api/v3/allOrders", params, user_id=user_id)
    return result


async def get_my_trades(symbol: str, user_id: Optional[str] = None, limit: int = 50) -> list[Dict[str, Any]]:
    """Fetch user's historical trades (fills) for a specific symbol from Binance."""
    pair = symbol if symbol.endswith("USDT") else f"{symbol}USDT"
    params = {
        "symbol": pair,
        "limit": limit
    }
    result = await signed_request("GET", "/api/v3/myTrades", params, user_id=user_id)
    return result



async def cancel_spot_order(symbol: str, order_id: int, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Cancel an active open order on Binance."""
    pair = symbol if symbol.endswith("USDT") else f"{symbol}USDT"
    params = {
        "symbol": pair,
        "orderId": order_id
    }
    result = await signed_request("DELETE", "/api/v3/order", params, user_id=user_id)
    return result


async def verify_api_key(api_key: str, secret_key: str) -> tuple[bool, str]:
    """Verify that the provided API key is valid and has safe permissions (withdrawals disabled, trading enabled)."""
    try:
        # 1. First, check permissions (restrictions)
        try:
            res = await signed_request("GET", "/sapi/v1/account/apiRestrictions", api_key=api_key, secret_key=secret_key)
            enable_withdrawals = res.get("enableWithdrawals", False)
            enable_trading = res.get("enableSpotAndMarginTrading", False)
            
            if enable_withdrawals:
                return False, "สิทธิ์การถอนเงิน (Withdrawal) ถูกเปิดใช้งานอยู่ เพื่อความปลอดภัย กรุณาปิดสิทธิ์นี้ก่อนเชื่อมต่อ"
            if not enable_trading:
                return False, "สิทธิ์การเทรด (Spot Trading) ยังไม่ได้เปิดใช้งาน กรุณาเปิดสิทธิ์นี้ก่อนเชื่อมต่อ"
            return True, "เชื่อมต่อสำเร็จและกุญแจปลอดภัย"
        except Exception as e:
            # Fallback for Binance Spot Testnet (which does not support /sapi/v1/account/apiRestrictions)
            # We try querying standard account info /api/v3/account to verify the keys are valid
            if not IS_MAINNET:
                await signed_request("GET", "/api/v3/account", api_key=api_key, secret_key=secret_key)
                return True, "เชื่อมต่อ Testnet สำเร็จ"
            raise e
    except Exception as e:
        return False, f"เชื่อมต่อล้มเหลว: {e}"
