"""Deterministic 'Heat' score (0-100) — intensity, NOT a buy/sell signal.

Iron rules (PLAN.md §กติกาเหล็ก):
  2. Heat is DETERMINISTIC — a pure function of real numbers (RSI + volatility
     percentile + news sentiment). No LLM ever touches the number. Same input
     → same score, always, and "why 82?" is always answerable.
  3. Heat measures how HOT/COLD (extreme) a coin is right now, in EITHER
     direction. RSI 78 (overbought) and RSI 22 (oversold) are both hot — we say
     "how extreme", never "which way to trade".

Every score returns its component breakdown so the UI can show the user exactly
how it was built (transparency = the shield against "you're steering me").
"""

from typing import Optional

# Component weights — must sum to 1.0. Tuned so no single signal dominates.
RSI_WEIGHT = 0.40
VOL_WEIGHT = 0.40
NEWS_WEIGHT = 0.20

# Zone thresholds on the final 0-100 score.
HOT_THRESHOLD = 70
MID_THRESHOLD = 40

# How many directional (bullish/bearish) headlines = "max news heat".
NEWS_SATURATION = 5


def _rsi_heat(rsi: float) -> float:
    """Distance from the neutral 50 → 0..100. Overbought AND oversold are hot."""
    return round(min(abs(rsi - 50) / 50 * 100, 100), 1)


def _daily_range_pct(candle: dict) -> Optional[float]:
    """Today's swing as a % of the open (a simple, robust volatility proxy)."""
    base = candle.get("open") or candle.get("close")
    if not base:
        return None
    hi = candle.get("high")
    lo = candle.get("low")
    if hi is None or lo is None:
        return None
    return abs(hi - lo) / base * 100


def _volatility_heat(daily_candles: list[dict]) -> tuple[float, float]:
    """Percentile-rank today's volatility against its own recent history.

    Returns (heat 0..100, today_range_pct). A coin swinging wider than usual is
    hot regardless of direction; one quietly ranging is cold.
    """
    ranges = [r for c in daily_candles if (r := _daily_range_pct(c)) is not None]
    if len(ranges) < 2:
        today = ranges[-1] if ranges else 0.0
        return 50.0, round(today, 2)
    today = ranges[-1]
    history = ranges[:-1]
    at_or_below = sum(1 for r in history if r <= today)
    pct = at_or_below / len(history) * 100
    return round(pct, 1), round(today, 2)


def _news_heat(news: list[dict]) -> tuple[float, int, int]:
    """How much directional news pressure exists today.

    Returns (heat 0..100, bullish_count, bearish_count). Lots of strongly-toned
    headlines = hot; a quiet/neutral news day = cold. We count both directions
    because volume of conviction is what makes a coin 'hot', not its sign.
    """
    bullish = sum(1 for n in news if n.get("sentiment") == "bullish")
    bearish = sum(1 for n in news if n.get("sentiment") == "bearish")
    directional = bullish + bearish
    heat = round(min(directional / NEWS_SATURATION, 1.0) * 100, 1)
    return heat, bullish, bearish


def zone_of(score: float) -> str:
    """Map a 0-100 score to a zone label. Intensity only — never direction."""
    if score >= HOT_THRESHOLD:
        return "hot"
    if score >= MID_THRESHOLD:
        return "mid"
    return "cold"


def compute_heat(rsi: float, daily_candles: list[dict], news: list[dict]) -> dict:
    """Combine the three deterministic components into a single 0-100 Heat score.

    `daily_candles` should be oldest→newest 1d OHLC dicts (the last one = today).
    Returns {score, zone, components{...}} — fully reproducible and explainable.
    """
    rsi_h = _rsi_heat(rsi)
    vol_h, today_range = _volatility_heat(daily_candles)
    news_h, bullish, bearish = _news_heat(news)

    score = round(rsi_h * RSI_WEIGHT + vol_h * VOL_WEIGHT + news_h * NEWS_WEIGHT)
    score = max(0, min(100, score))

    return {
        "score": score,
        "zone": zone_of(score),
        "components": {
            "rsi": {
                "value": rsi,
                "heat": rsi_h,
                "weight": RSI_WEIGHT,
            },
            "volatility": {
                "percentile": vol_h,
                "today_range_pct": today_range,
                "heat": vol_h,
                "weight": VOL_WEIGHT,
            },
            "news": {
                "bullish": bullish,
                "bearish": bearish,
                "heat": news_h,
                "weight": NEWS_WEIGHT,
            },
        },
    }


def compute_facts(
    rsi: float,
    daily_candles: list[dict],
    news: list[dict],
    change_24h_pct: float,
) -> dict:
    """Plain-fact summary for a coin's card — numbers only, no verdict.

    e.g. RSI 78 (overbought) · down 12% from the 7-day high · 2 bearish headlines.
    The user draws their own conclusion; we never say buy/sell.
    """
    last7 = daily_candles[-7:] if daily_candles else []
    highs = [c["high"] for c in last7 if c.get("high") is not None]
    lows = [c["low"] for c in last7 if c.get("low") is not None]
    closes = [c["close"] for c in last7 if c.get("close") is not None]
    price = closes[-1] if closes else None

    drop_from_high = None
    gain_from_low = None
    if price and highs:
        hi = max(highs)
        if hi:
            drop_from_high = round((price - hi) / hi * 100, 2)
    if price and lows:
        lo = min(lows)
        if lo:
            gain_from_low = round((price - lo) / lo * 100, 2)

    bullish = sum(1 for n in news if n.get("sentiment") == "bullish")
    bearish = sum(1 for n in news if n.get("sentiment") == "bearish")

    return {
        "rsi": rsi,
        "rsi_label": _rsi_label(rsi),
        "change_24h_pct": round(change_24h_pct, 2),
        "drop_from_high_7d_pct": drop_from_high,
        "gain_from_low_7d_pct": gain_from_low,
        "news_bullish": bullish,
        "news_bearish": bearish,
        "news_total": len(news),
    }


# ─── Deviation band — the WEDGE: "normal vs abnormal vs its OWN baseline" ────
#
# PLAN.md §"Decisions รอบ 2": the hero signal per coin is no longer absolute
# Heat ("how hot") but "is today inside or outside THIS coin's own normal swing".
# It answers the one panic-killing question — "ควรห่วงไหม / นี่ปกติของมันรึเปล่า".
#
# Deterministic, like Heat: z-score of today's daily return against the trailing
# ~30-day distribution of daily returns. Same candles in → same status out, and
# every number is returned so the user can check "why abnormal?".

# |z| thresholds → status. Tuned so most days read "normal" (the honest default).
DEV_MILD_Z = 1.0      # 1–2 SD = เริ่มผิดปกติ
DEV_ABNORMAL_Z = 2.0  # ≥2 SD  = ผิดปกติชัด


def _daily_returns_pct(daily_candles: list[dict]) -> list[float]:
    """Close-to-close % returns, oldest→newest. Needs ≥2 closes."""
    closes = [c["close"] for c in daily_candles if c.get("close")]
    out = []
    for prev, cur in zip(closes, closes[1:]):
        if prev:
            out.append((cur - prev) / prev * 100)
    return out


def compute_deviation(daily_candles: list[dict]) -> dict:
    """How abnormal is today's move vs this coin's OWN 30-day baseline.

    Returns a status (normal/mild/abnormal) + direction + the raw numbers behind
    it. NOT a verdict: "abnormal down" never means "sell" — it means "today's
    drop is large *for this coin*", which is exactly the context that calms (or
    rightly alerts) a worried holder.
    """
    returns = _daily_returns_pct(daily_candles)
    base = {
        "status": "normal",
        "direction": "flat",
        "today_return_pct": None,
        "z": None,
        "baseline_mean_pct": None,
        "baseline_std_pct": None,
        "normal_low_pct": None,
        "normal_high_pct": None,
        "window_days": len(returns),
        "enough_data": False,
    }
    if len(returns) < 5:
        # Not enough history to judge "normal for this coin" honestly.
        if returns:
            base["today_return_pct"] = round(returns[-1], 2)
        return base

    today = returns[-1]
    history = returns[:-1]  # exclude today so it can't inflate its own baseline
    n = len(history)
    mean = sum(history) / n
    var = sum((r - mean) ** 2 for r in history) / n
    std = var ** 0.5

    if std == 0:
        z = 0.0
    else:
        z = (today - mean) / std

    az = abs(z)
    if az >= DEV_ABNORMAL_Z:
        status = "abnormal"
    elif az >= DEV_MILD_Z:
        status = "mild"
    else:
        status = "normal"

    if today > 0.1:
        direction = "up"
    elif today < -0.1:
        direction = "down"
    else:
        direction = "flat"

    return {
        "status": status,
        "direction": direction,
        "today_return_pct": round(today, 2),
        "z": round(z, 2),
        "baseline_mean_pct": round(mean, 2),
        "baseline_std_pct": round(std, 2),
        "normal_low_pct": round(mean - std, 2),
        "normal_high_pct": round(mean + std, 2),
        "window_days": n + 1,
        "enough_data": True,
    }


def _rsi_label(rsi: float) -> str:
    """Neutral, factual RSI band label (no buy/sell connotation)."""
    if rsi >= 70:
        return "overbought"
    if rsi >= 55:
        return "strong"
    if rsi >= 45:
        return "neutral"
    if rsi >= 30:
        return "weak"
    return "oversold"
