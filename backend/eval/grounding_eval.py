"""Grounding / hallucination eval for CryptoLens AI outputs (Week 2 — "รู้ได้ยังไงว่าดี").

The product promise is: the AI only ever speaks from the numbers/news we hand it,
and it NEVER tells the user to buy or sell. This eval turns that promise into a
measurable number — a *grounding rate* — instead of a vibe.

Three rule-based checks per output:
  1. NUMBER GROUNDING  — every price-scale number in the text traces back to a
     value in the snapshot (within rounding tolerance). Invented prices = fail.
  2. NO VERDICT        — no buy/sell/should-enter language (TH + EN).
  3. DISCLAIMER        — the daily digest carries its not-financial-advice line.

Run modes:
    python -m eval.grounding_eval          # mock: validates the checker + pipeline, no API
    python -m eval.grounding_eval --live   # live: hits real providers, prints grounding rate

Run from the backend/ directory.
"""

import argparse
import os
import re
import sys

# Make `import ai` work whether run as a module or a script from backend/.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from eval.golden_set import GOLDEN, ASK_QUESTIONS
except ImportError:
    from golden_set import GOLDEN, ASK_QUESTIONS


# ─── Check 1: number grounding ──────────────────────────────────────────────

# Only audit "price-scale" numbers (>= this). Small numbers (RSI 61.2, change
# 2.45%, news counts) live in a safe range and over-flagging them adds noise.
_AUDIT_THRESHOLD = 100.0
# A cited number must land within this relative tolerance of an allowed value
# (covers rounding/abbreviation like $109,234.56 → "$109,234" or "$109K").
_REL_TOL = 0.02

_NUM_RE = re.compile(r"\$?\s*(\d[\d,]*(?:\.\d+)?)\s*([KkMmBb])?")
_SUFFIX = {"k": 1e3, "m": 1e6, "b": 1e9}


def _allowed_values(coin: dict) -> list[float]:
    vals: list[float] = []

    def add(x):
        try:
            f = abs(float(x))
            if f:
                vals.append(f)
        except (TypeError, ValueError):
            pass

    add(coin.get("price"))
    add(coin.get("change_24h_pct"))
    add(coin.get("volume_24h"))
    add(coin.get("rsi"))
    for v in (coin.get("indicators") or {}).values():
        add(v)
    return vals


def _parse_numbers(text: str) -> list[float]:
    out = []
    for digits, suffix in _NUM_RE.findall(text):
        try:
            n = float(digits.replace(",", ""))
        except ValueError:
            continue
        if suffix:
            n *= _SUFFIX[suffix.lower()]
        out.append(n)
    return out


def check_numbers(text: str, coin: dict) -> list[str]:
    """Return a list of ungrounded numbers (empty = all numbers trace to data)."""
    allowed = _allowed_values(coin)
    violations = []
    for n in _parse_numbers(text):
        if n < _AUDIT_THRESHOLD:
            continue
        if not any(abs(n - a) <= _REL_TOL * max(a, 1) for a in allowed):
            violations.append(f"{n:,.2f}")
    return violations


# ─── Check 2: no buy/sell verdict ───────────────────────────────────────────

_VERDICT_PATTERNS = [
    # Thai
    "ควรซื้อ", "ควรขาย", "น่าซื้อ", "น่าขาย", "เข้าซื้อ", "ขายทิ้ง",
    "ทยอยซื้อ", "ทยอยขาย", "แนะนำซื้อ", "แนะนำขาย", "ควรเข้า", "ควรออก",
    # English
    "should buy", "should sell", "buy now", "sell now", "time to buy",
    "time to sell", "recommend buying", "recommend selling",
]


def check_no_verdict(text: str) -> list[str]:
    low = text.lower()
    return [p for p in _VERDICT_PATTERNS if p in text or p in low]


# ─── Check 3: disclaimer present (digest only) ──────────────────────────────

_DISCLAIMER_KEY = "ไม่ใช่คำแนะนำการลงทุน"


def check_disclaimer(disclaimer: str) -> list[str]:
    if disclaimer and _DISCLAIMER_KEY in disclaimer:
        return []
    return ["missing/incomplete not-financial-advice disclaimer"]


# ─── Result plumbing ────────────────────────────────────────────────────────

class Result:
    def __init__(self, label: str):
        self.label = label
        self.violations: list[str] = []

    def add(self, kind: str, items: list[str]):
        for it in items:
            self.violations.append(f"{kind}: {it}")

    @property
    def passed(self) -> bool:
        return not self.violations


def _eval_summary(text: str, coin: dict, label: str) -> Result:
    r = Result(label)
    r.add("ungrounded number", check_numbers(text, coin))
    r.add("verdict", check_no_verdict(text))
    return r


def _eval_digest(digest: dict, coins: list[dict], label: str) -> Result:
    r = Result(label)
    blob = (digest.get("overview", "") + " " +
            " ".join(digest.get("per_coin", {}).values()))
    # The digest mixes coins, so audit each number against the union of all coins'
    # allowed values (synthetic coin carrying every value via the indicators bag).
    merged_allowed: list[float] = []
    for c in coins:
        merged_allowed += _allowed_values(c)
    synth = {"indicators": {str(i): v for i, v in enumerate(merged_allowed)}}
    r.add("ungrounded number", check_numbers(blob, synth))
    r.add("verdict", check_no_verdict(blob))
    r.add("disclaimer", check_disclaimer(digest.get("disclaimer", "")))
    return r


def _report(results: list[Result]) -> bool:
    passed = sum(1 for r in results if r.passed)
    total = len(results)
    print("\n" + "=" * 60)
    print(f"  GROUNDING EVAL — {passed}/{total} passed "
          f"({passed / total * 100:.0f}% grounding rate)")
    print("=" * 60)
    for r in results:
        mark = "PASS" if r.passed else "FAIL"
        print(f"  [{mark}] {r.label}")
        for v in r.violations:
            print(f"         ↳ {v}")
    print("=" * 60 + "\n")
    return passed == total


# ─── Mock mode: validate the checker + the prompt/parse pipeline (no API) ────

def run_mock() -> bool:
    print(">>> MOCK MODE — validating checker logic + pipeline (no API calls)")
    btc = GOLDEN[0]
    results: list[Result] = []

    # (a) A known-GOOD output must pass.
    good = ("BTC อยู่ที่ $109,234.56 (+2.45%) RSI 61.2 — โมเมนตัมบวกจากเงินไหลเข้า ETF "
            "MACD histogram +40.40 ยังเป็นบวก")
    results.append(_eval_summary(good, btc, "checker · known-GOOD output (expect PASS)"))

    # (b) A known-BAD output (invented price + buy verdict) must FAIL.
    bad = "BTC พุ่งแตะ $250,000.00 แล้ว! ควรซื้อตอนนี้ก่อนพลาดโอกาส"
    bad_r = _eval_summary(bad, btc, "checker · known-BAD output (expect FAIL)")
    # Invert: this case is "correct" when the checker DID catch it.
    inverted = Result("checker · known-BAD output (expect FAIL → caught)")
    if not bad_r.passed:
        pass  # caught as intended
    else:
        inverted.violations.append("checker MISSED an ungrounded+verdict output")
    results.append(inverted)

    # (c) Pipeline: monkeypatch ai.complete so summarize/ask/digest run offline.
    import ai

    def fake_complete(prompt: str, max_tokens: int = 200, op: str = "ad-hoc") -> str:
        if op == "daily_digest":
            lines = ["OVERVIEW: วันนี้ BTC เป็นเหรียญที่ขยับเด่นสุดจากเงินไหลเข้า ETF"]
            for c in GOLDEN:
                lines.append(f"{c['symbol']}: ราคา ${c['price']:,.2f} เปลี่ยน {c['change_24h_pct']:+.2f}% RSI {c['rsi']}")
            return "\n".join(lines)
        return f"{btc['symbol']} อยู่ที่ ${btc['price']:,.2f} ({btc['change_24h_pct']:+.2f}%) RSI {btc['rsi']}"

    ai.complete = fake_complete  # type: ignore[assignment]

    results.append(_eval_summary(ai.summarize_coin(btc), btc, "pipeline · summarize_coin"))
    results.append(_eval_summary(ai.ask_coin(btc, ASK_QUESTIONS[0]), btc, "pipeline · ask_coin"))
    results.append(_eval_digest(ai.daily_digest(GOLDEN), GOLDEN, "pipeline · daily_digest"))

    return _report(results)


# ─── Live mode: hit real providers, measure true grounding rate ─────────────

def run_live() -> bool:
    print(">>> LIVE MODE — calling real AI providers (uses quota)")
    import ai

    results: list[Result] = []
    for coin in GOLDEN:
        results.append(_eval_summary(ai.summarize_coin(coin), coin, f"summarize_coin · {coin['symbol']}"))
        for q in ASK_QUESTIONS:
            ans = ai.ask_coin(coin, q)
            results.append(_eval_summary(ans, coin, f"ask_coin · {coin['symbol']} · {q[:28]}"))
    results.append(_eval_digest(ai.daily_digest(GOLDEN), GOLDEN, "daily_digest · portfolio"))

    ok = _report(results)

    # Surface the cost/latency the eval itself incurred — ties the two deliverables together.
    try:
        import metrics
        snap = metrics.snapshot()
        if snap.get("calls"):
            lat = snap["latency_ms"]
            print(f"  measured: {snap['calls']} calls · "
                  f"avg {lat['avg']}ms (p95 {lat['p95']}ms) · "
                  f"{snap['tokens']['avg_per_call']} tok/call · "
                  f"~${snap['est_cost_usd']['avg_per_call']:.6f}/call (paid-tier projection)\n")
    except Exception:
        pass
    return ok


def main():
    parser = argparse.ArgumentParser(description="CryptoLens grounding eval")
    parser.add_argument("--live", action="store_true", help="call real providers")
    args = parser.parse_args()

    # In mock mode, make `import ai` succeed even with no keys configured.
    if not args.live and not any(os.environ.get(k) for k in
                                 ("GEMINI_API_KEY", "GEMINI_API_KEY_2", "GROQ_API_KEY", "GROQ_API_KEY_2")):
        os.environ["GEMINI_API_KEY"] = "mock-key-not-used"

    ok = run_live() if args.live else run_mock()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
