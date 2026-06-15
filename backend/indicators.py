def rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [max(d, 0) for d in deltas[-period:]]
    losses = [abs(min(d, 0)) for d in deltas[-period:]]
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)


def sparkline(closes: list[float]) -> list[float]:
    return [round(c, 2) for c in closes[-24:]]


def _ema_series(values: list[float], period: int) -> list[float]:
    if not values:
        return []
    if len(values) < period:
        return [values[-1]] * len(values)
    multiplier = 2 / (period + 1)
    series: list[float] = []
    seed = sum(values[:period]) / period
    series.extend([seed] * period)
    ema_val = seed
    for price in values[period:]:
        ema_val = (price - ema_val) * multiplier + ema_val
        series.append(ema_val)
    return series


def ema(closes: list[float], period: int) -> float:
    series = _ema_series(closes, period)
    return round(series[-1], 2) if series else 0.0


def macd(closes: list[float], fast: int = 12, slow: int = 26, signal: int = 9) -> dict:
    if len(closes) < slow + signal:
        return {"macd": 0.0, "signal": 0.0, "histogram": 0.0}
    fast_series = _ema_series(closes, fast)
    slow_series = _ema_series(closes, slow)
    macd_line = [f - s for f, s in zip(fast_series, slow_series)]
    signal_series = _ema_series(macd_line, signal)
    macd_val = macd_line[-1]
    signal_val = signal_series[-1]
    return {
        "macd": round(macd_val, 4),
        "signal": round(signal_val, 4),
        "histogram": round(macd_val - signal_val, 4),
    }


def bollinger_bands(closes: list[float], period: int = 20, std_dev: float = 2.0) -> dict:
    if len(closes) < period:
        mid = closes[-1] if closes else 0.0
        return {"upper": round(mid, 2), "middle": round(mid, 2), "lower": round(mid, 2)}
    window = closes[-period:]
    middle = sum(window) / period
    variance = sum((x - middle) ** 2 for x in window) / period
    std = variance ** 0.5
    return {
        "upper": round(middle + std_dev * std, 2),
        "middle": round(middle, 2),
        "lower": round(middle - std_dev * std, 2),
    }


def compute_all(closes: list[float]) -> dict:
    macd_vals = macd(closes)
    bb = bollinger_bands(closes)
    return {
        "rsi": rsi(closes),
        "ema_9": ema(closes, 9),
        "ema_21": ema(closes, 21),
        "macd": macd_vals["macd"],
        "macd_signal": macd_vals["signal"],
        "macd_histogram": macd_vals["histogram"],
        "bb_upper": bb["upper"],
        "bb_middle": bb["middle"],
        "bb_lower": bb["lower"],
    }
