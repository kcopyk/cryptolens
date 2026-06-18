"""In-memory token + latency metrics for AI calls (Week 2 — cost & latency awareness).

Every LLM completion records: which provider served it, how long it took, and
how many tokens it burned. We keep a rolling window in memory (no DB needed) and
expose an aggregate via `snapshot()` so `/api/metrics` can answer the homework
question "1 call กิน token / เงิน / เวลาเท่าไหร่" with REAL measured numbers.

Cost note: the app runs on free-tier keys, so actual spend is $0. The PRICING
table below is the *paid-tier reference rate* — we multiply measured tokens by it
to show "what this WOULD cost at scale", which is the number worth managing.
"""

import threading
import time
from collections import deque
from typing import Optional

# Paid-tier reference pricing (USD per 1M tokens) — for "cost at scale" math only.
# Free tier = $0 today; these let us project spend if/when we outgrow it.
PRICING = {
    # Gemini 2.5 Flash (primary)
    "gemini": {"in": 0.15, "out": 0.60},
    # Gemini 2.5 Flash-Lite (cheap backup)
    "gemini2": {"in": 0.10, "out": 0.40},
    # Gemini 3.1 Flash-Lite (quality backup)
    "gemini3": {"in": 0.25, "out": 1.50},
    # Groq Llama-3.3-70b-versatile
    "groq": {"in": 0.59, "out": 0.79},
    "groq2": {"in": 0.59, "out": 0.79},
}

_MAX_SAMPLES = 500
_lock = threading.Lock()
_samples: deque[dict] = deque(maxlen=_MAX_SAMPLES)


def estimate_cost_usd(provider: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Project paid-tier cost for one call. Returns USD (tiny, but real at scale)."""
    rate = PRICING.get(provider)
    if not rate and provider.startswith("gemini_acc"):
        rate = PRICING.get("gemini")
    if not rate:
        return 0.0
    return round(
        prompt_tokens / 1_000_000 * rate["in"]
        + completion_tokens / 1_000_000 * rate["out"],
        8,
    )


def record(
    *,
    provider: str,
    op: str,
    latency_ms: float,
    prompt_tokens: int,
    completion_tokens: int,
    ok: bool = True,
) -> dict:
    """Store one call's metrics and return the per-call record (also handy for logs)."""
    total = prompt_tokens + completion_tokens
    sample = {
        "ts": time.time(),
        "provider": provider,
        "op": op,
        "latency_ms": round(latency_ms, 1),
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total,
        "est_cost_usd": estimate_cost_usd(provider, prompt_tokens, completion_tokens),
        "ok": ok,
    }
    with _lock:
        _samples.append(sample)
    return sample


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = max(0, min(len(s) - 1, round((p / 100) * (len(s) - 1))))
    return round(s[k], 1)


def snapshot() -> dict:
    """Aggregate view across the rolling window — what /api/metrics returns."""
    with _lock:
        samples = list(_samples)

    if not samples:
        return {"calls": 0, "note": "no AI calls recorded yet"}

    latencies = [s["latency_ms"] for s in samples]
    total_tokens = sum(s["total_tokens"] for s in samples)
    total_cost = sum(s["est_cost_usd"] for s in samples)

    by_provider: dict[str, int] = {}
    by_op: dict[str, int] = {}
    for s in samples:
        by_provider[s["provider"]] = by_provider.get(s["provider"], 0) + 1
        by_op[s["op"]] = by_op.get(s["op"], 0) + 1

    return {
        "calls": len(samples),
        "window_max": _MAX_SAMPLES,
        "latency_ms": {
            "avg": round(sum(latencies) / len(latencies), 1),
            "p50": _percentile(latencies, 50),
            "p95": _percentile(latencies, 95),
            "max": round(max(latencies), 1),
        },
        "tokens": {
            "total": total_tokens,
            "avg_per_call": round(total_tokens / len(samples), 1),
        },
        "est_cost_usd": {
            "total_window": round(total_cost, 8),
            "avg_per_call": round(total_cost / len(samples), 8),
            "note": "paid-tier projection; actual free-tier spend = $0",
        },
        "calls_by_provider": by_provider,
        "calls_by_op": by_op,
        "recent": samples[-10:][::-1],
    }
