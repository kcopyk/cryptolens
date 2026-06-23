import os
import re
import time
import logging
from typing import Callable
from dotenv import load_dotenv

import metrics
import rate_limit
import triage

load_dotenv()

# Adapters return (text, prompt_tokens, completion_tokens) so complete() can
# record real token usage for cost/latency awareness (Week 2).
Adapter = Callable[[str, int], tuple[str, int, int]]
# Chain entry: (provider label, adapter, model id for logs)
ChainEntry = tuple[str, Adapter, str]

log = logging.getLogger("ai")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")

GROQ_MODEL = "llama-3.3-70b-versatile"

# Model fallback on each distinct Gemini key (best → cheap → 3.x lite).
# Override defaults via GEMINI_MODEL / GEMINI2_MODEL / GEMINI3_MODEL.
_GEMINI_MODEL_CHAIN: list[tuple[str, str, str]] = [
    ("gemini", "gemini-2.5-flash", "GEMINI_MODEL"),
    ("gemini2", "gemini-2.5-flash-lite", "GEMINI2_MODEL"),
    ("gemini3", "gemini-3.1-flash-lite", "GEMINI3_MODEL"),
]
_GEMINI_KEY_ENVS = ("GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3")


class QuotaError(Exception):
    """Provider unusable right now (quota / auth / transient outage) — try next provider."""


def _is_quota_error(e: Exception) -> bool:
    msg = str(e).lower()
    return any(s in msg for s in ("429", "quota", "rate limit", "rate_limit", "resource_exhausted",
                                  "unauthenticated", "invalid api key", "permission_denied"))


def _is_transient_error(e: Exception) -> bool:
    """Temporary provider outage (5xx / overload / timeout) — the next provider may well work.

    These are exactly what a multi-provider chain exists for, so they must fall
    through just like quota errors. A false positive only costs one extra attempt
    on the next provider; a false negative (the old behaviour) surfaces a 503 to
    the user instead of trying healthy Groq.
    """
    msg = str(e).lower()
    return any(s in msg for s in ("503", "504", "unavailable", "overloaded", "try again later",
                                  "temporarily", "deadline", "timeout", "timed out"))


def _quota_reason(e: Exception) -> str:
    """Human-readable reason for logs when falling back to the next provider."""
    msg = str(e).lower()
    if "empty response" in msg:
        return "empty response"
    if "unauthenticated" in msg or "invalid api key" in msg:
        return "invalid API key / auth"
    if "permission_denied" in msg or "permission denied" in msg:
        return "permission denied"
    if "429" in msg or "resource_exhausted" in msg or "rate limit" in msg or "rate_limit" in msg:
        if any(s in msg for s in ("per day", "daily", "rpd", "requests per day")):
            return "daily quota (RPD)"
        if any(s in msg for s in ("per minute", "rpm", "requests per minute")):
            return "rate limit (RPM)"
        if "token" in msg and "minute" in msg:
            return "token rate limit (TPM)"
        return "quota / rate limit (429)"
    if "quota" in msg:
        return "quota exceeded"
    if any(s in msg for s in ("503", "unavailable", "overloaded", "try again later", "temporarily")):
        return "provider overloaded (503)"
    if any(s in msg for s in ("504", "deadline", "timeout", "timed out")):
        return "timeout"
    # Strip provider prefix like "gemini: ..." for readability.
    text = str(e).split(": ", 1)[-1]
    return text[:160] if len(text) > 160 else text


def _provider_display(label: str, model: str) -> str:
    return f"{label} ({model})"


def _collect_gemini_keys() -> list[str]:
    """Distinct keys in env order. Same key in multiple vars is deduped once."""
    seen: set[str] = set()
    keys: list[str] = []
    for env_key in _GEMINI_KEY_ENVS:
        if k := os.environ.get(env_key):
            if k not in seen:
                seen.add(k)
                keys.append(k)
    return keys


def _resolve_gemini_model(default: str, model_env: str) -> str:
    return os.environ.get(model_env, default)


def _gemini_generation_config(model: str, max_tokens: int) -> dict:
    config: dict = {
        "max_output_tokens": max_tokens,
        "temperature": 0.4,
    }
    if model.startswith("gemini-3"):
        # Gemini 3 uses thinking_level; minimal = fastest/cheapest for short summaries.
        config["thinking_config"] = {"thinking_level": "minimal"}
    else:
        # gemini-2.5-* enables thinking by default, which eats the output budget
        # and truncates the visible answer. Disable for these grounded summaries.
        config["thinking_config"] = {"thinking_budget": 0}
    return config


def _make_gemini_adapter(api_key: str, label: str, model: str) -> Adapter:
    from google import genai
    client = genai.Client(api_key=api_key)

    def call(prompt: str, max_tokens: int) -> tuple[str, int, int]:
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=_gemini_generation_config(model, max_tokens),
            )
            text = (resp.text or "").strip()
            if not text:
                raise QuotaError(f"{label}: empty response")
            usage = getattr(resp, "usage_metadata", None)
            prompt_tok = getattr(usage, "prompt_token_count", 0) or 0
            completion_tok = getattr(usage, "candidates_token_count", 0) or 0
            log.info(f"served by {label} ({model})")
            return text, prompt_tok, completion_tok
        except Exception as e:
            if _is_quota_error(e) or _is_transient_error(e):
                raise QuotaError(f"{label}: {e}") from e
            raise

    return call


def _make_groq_adapter(api_key: str, label: str = "groq") -> Adapter:
    from groq import Groq
    client = Groq(api_key=api_key)

    def call(prompt: str, max_tokens: int) -> tuple[str, int, int]:
        try:
            resp = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=0.4,
            )
            text = (resp.choices[0].message.content or "").strip()
            if not text:
                raise QuotaError(f"{label}: empty response")
            usage = getattr(resp, "usage", None)
            prompt_tok = getattr(usage, "prompt_tokens", 0) or 0
            completion_tok = getattr(usage, "completion_tokens", 0) or 0
            log.info(f"served by {label} ({GROQ_MODEL})")
            return text, prompt_tok, completion_tok
        except Exception as e:
            if _is_quota_error(e) or _is_transient_error(e):
                raise QuotaError(f"{label}: {e}") from e
            raise

    return call


def _build_chain() -> list[ChainEntry]:
    chain: list[ChainEntry] = []
    gemini_keys = _collect_gemini_keys()
    if gemini_keys:
        # Primary key: try all models in order (same API key is fine).
        for label, default_model, model_env in _GEMINI_MODEL_CHAIN:
            model = _resolve_gemini_model(default_model, model_env)
            chain.append((label, _make_gemini_adapter(gemini_keys[0], label, model), model))
        # Extra keys from other Google accounts = more quota on the primary model.
        primary_model = _resolve_gemini_model("gemini-2.5-flash", "GEMINI_MODEL")
        for i, api_key in enumerate(gemini_keys[1:], start=2):
            label = f"gemini_acc{i}"
            chain.append((label, _make_gemini_adapter(api_key, label, primary_model), primary_model))
    if k := os.environ.get("GROQ_API_KEY"):
        chain.append(("groq", _make_groq_adapter(k, "groq"), GROQ_MODEL))
    if k := os.environ.get("GROQ_API_KEY_2"):
        chain.append(("groq2", _make_groq_adapter(k, "groq2"), GROQ_MODEL))
    if not chain:
        raise RuntimeError(
            "No AI providers configured. Set at least one of "
            "GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3, "
            "GROQ_API_KEY, GROQ_API_KEY_2 in .env"
        )
    return chain


_chain: list[ChainEntry] | None = None


def _get_chain() -> list[ChainEntry]:
    """Build the provider chain lazily on first use.

    Keeping import side-effect-free means tooling (e.g. the grounding eval in
    mock mode) can `import ai` and monkeypatch `complete` without needing any
    provider SDK installed or any API key configured.
    """
    global _chain
    if _chain is None:
        _chain = _build_chain()
        chain_desc = " → ".join(_provider_display(label, model) for label, _, model in _chain)
        log.info(f"AI provider chain ({len(_chain)} steps): {chain_desc}")
    return _chain


def complete(prompt: str, max_tokens: int = 200, op: str = "ad-hoc") -> str:
    """Provider-neutral completion. Tries providers in order, falls through on quota errors.

    Records token usage + latency for each successful call (see metrics.py) so the
    app can report real cost/latency per feature. `op` labels the caller
    (summarize_coin / market_mood / daily_digest / ask_coin) for per-feature stats.
    """
    last_err: Exception | None = None
    rate_limit.acquire()
    chain = _get_chain()
    for i, (label, adapter, model) in enumerate(chain):
        current = _provider_display(label, model)
        if i == 0:
            log.info(f"[{op}] trying {current}")
        t0 = time.perf_counter()
        try:
            text, prompt_tok, completion_tok = adapter(prompt, max_tokens)
        except QuotaError as e:
            reason = _quota_reason(e)
            last_err = e
            if i + 1 < len(chain):
                nlabel, _, nmodel = chain[i + 1]
                nxt = _provider_display(nlabel, nmodel)
                log.warning(f"[{op}] fallback: {current} failed ({reason}) → trying {nxt}")
            else:
                log.error(f"[{op}] all providers exhausted; last failure: {current} ({reason})")
            continue
        latency_ms = (time.perf_counter() - t0) * 1000
        rec = metrics.record(
            provider=label,
            op=op,
            latency_ms=latency_ms,
            prompt_tokens=prompt_tok,
            completion_tokens=completion_tok,
        )
        if i > 0:
            log.info(f"[{op}] fallback succeeded on {current}")
        log.info(
            f"[{op}] {current} {rec['total_tokens']}tok "
            f"{rec['latency_ms']}ms ~${rec['est_cost_usd']:.6f}"
        )
        return text
    raise RuntimeError(f"All AI providers exhausted. Last error: {last_err}")


def _format_indicators(coin: dict) -> str:
    ind = coin.get("indicators") or {}
    if not ind:
        return f"- RSI (14): {coin.get('rsi', 'N/A')}"
    return (
        f"- RSI (14): {ind.get('rsi', coin.get('rsi', 'N/A'))}\n"
        f"- EMA 9: ${ind.get('ema_9', 0):,.2f} · EMA 21: ${ind.get('ema_21', 0):,.2f}\n"
        f"- MACD: {ind.get('macd', 0):.4f} · Signal: {ind.get('macd_signal', 0):.4f} · "
        f"Histogram: {ind.get('macd_histogram', 0):+.4f}\n"
        f"- Bollinger Bands: upper ${ind.get('bb_upper', 0):,.2f} · "
        f"middle ${ind.get('bb_middle', 0):,.2f} · lower ${ind.get('bb_lower', 0):,.2f}"
    )


def _format_news(coin: dict, *, limit: int = 5) -> str:
    news = coin.get("news") or []
    if not news:
        return "- ไม่มีข่าวล่าสุดในระบบ"
    lines = []
    for n in news[:limit]:
        sentiment = n.get("sentiment", "neutral")
        title = n.get("title", "")
        source = n.get("source", "")
        pub = (n.get("published_at") or "")[:10]
        meta = " · ".join(p for p in (source, pub) if p)
        lines.append(f"- [{sentiment}] {title}" + (f" ({meta})" if meta else ""))
    return "\n".join(lines)


def _format_heat_deviation(coin: dict) -> str:
    lines: list[str] = []
    heat = coin.get("heat")
    if isinstance(heat, dict):
        score = heat.get("score")
        zone = heat.get("zone", "")
        if score is not None:
            lines.append(f"- Heat: {score}/100 ({zone}) — ระดับความร้อน/สุดโต่ง ไม่ใช่สัญญาณซื้อขาย")
    elif heat is not None:
        lines.append(f"- Heat: {heat}/100")

    dev = coin.get("deviation") or {}
    if dev.get("enough_data"):
        _th = {"abnormal": "ผิดปกติชัด", "mild": "เริ่มผิดปกติ", "normal": "ปกติ"}
        status = _th.get(dev.get("status"), dev.get("status", "normal"))
        z = dev.get("z")
        z_str = f"{z:+.2f}" if z is not None else "N/A"
        today = dev.get("today_return_pct")
        today_str = f"{today:+.2f}%" if today is not None else "N/A"
        lines.append(
            f"- Deviation: วันนี้ {today_str} = {status} "
            f"(z={z_str}, กรอบปกติ {dev.get('normal_low_pct'):+.1f}..{dev.get('normal_high_pct'):+.1f}%/วัน)"
        )

    facts = coin.get("facts") or {}
    if facts.get("drop_from_high_7d_pct") is not None:
        lines.append(f"- จากจุดสูง 7 วัน: {facts['drop_from_high_7d_pct']:+.2f}%")
    if facts.get("gain_from_low_7d_pct") is not None:
        lines.append(f"- จากจุดต่ำ 7 วัน: {facts['gain_from_low_7d_pct']:+.2f}%")
    nb, nr = facts.get("news_bullish"), facts.get("news_bearish")
    if nb is not None or nr is not None:
        lines.append(f"- ข่าวทิศทาง: bullish {nb or 0} · bearish {nr or 0}")

    return "\n".join(lines) if lines else "- ไม่มี Heat/Deviation ใน snapshot นี้"


def _is_thai(text: str) -> bool:
    return any("\u0e00" <= ch <= "\u0e7f" for ch in text)


def _ask_max_tokens(question: str) -> int:
    q = question.lower()
    kind = _classify_ask_question(question)
    if kind == "news":
        return 480
    if kind == "overview":
        return 400
    if kind in ("indicators", "status"):
        return 360
    return 320


def _classify_ask_question(question: str) -> str:
    q = question.lower()
    if any(k in q for k in ("ข่าว", "news", "headline", "headlines")):
        return "news"
    if any(k in q for k in ("rsi", "macd", "ema", "bollinger", "ตัวชี้วัด", "indicator")):
        return "indicators"
    if any(k in q for k in ("ผิดปกติ", "deviation", "heat", "ร้อน", "เย็น")):
        return "status"
    if any(k in q for k in ("ภาพรวม", "overview", "สรุป", "วันนี้", "เป็นไง", "เป็นยังไง", "how is")):
        return "overview"
    return "general"


_SENTIMENT_TH = {"bullish": "เชิงบวก", "bearish": "เชิงลบ", "neutral": "กลาง"}


def _ask_style_rules(kind: str) -> str:
    base = (
        "รูปแบบ (บังคับ):\n"
        "- ข้อความ plain text เท่านั้น — ห้าม markdown ทุกชนิด (ไม่มี **, *, #, ```)\n"
        "- ห้ามทักทาย/ลากท้าย (ไม่มี 'สวัสดี', 'หวังว่า', 'บอกได้ถ้า')\n"
        "- ตอบตรงคำถามก่อน — อย่า copy รายการ snapshot ทั้งก้อน\n"
        "- ใช้ภาษาคนธรรมดา อ่านง่าย เหมือนคุยกับเพื่อน\n"
        "- แปล sentiment เป็นภาษาไทย: bullish=เชิงบวก, bearish=เชิงลบ, neutral=กลาง\n"
        "- ห้ามโชว์ z-score / percentile ยกเว้นผู้ใช้ถามเชิงเทคนิคโดยตรง\n"
    )
    templates = {
        "news": (
            "โครงสร้างสำหรับคำถามข่าว:\n"
            "บรรทัดแรก: สรุปอารมณ์ข่าวรวม 1 ประโยค\n"
            "จากนั้นแต่ละข่าว 1 บรรทัด ขึ้นต้นด้วย ·\n"
            "  · [เชิงลบ/เชิงบวก/กลาง] หัวข้อ — สรุปสั้น ๆ (แหล่ง)\n"
            "ไม่ต้องใส่ราคา/RSI ถ้าไม่เกี่ยวกับข่าว"
        ),
        "overview": (
            "โครงสร้างสำหรับภาพรวม:\n"
            "บรรทัดแรก: สรุปภาพรวมวันนี้ 1 ประโยค (ปกติ/ผิดปกติ + ทิศทาง)\n"
            "บรรทัดถัดไป 2–4 bullet · เท่านั้น เลือกเฉพาะที่สำคัญ:\n"
            "  · ราคา + 24h%\n"
            "  · สถานะ deviation ภาษาคน (ไม่ใช้ z-score)\n"
            "  · ข่าวเด่น 1–2 เรื่องถ้ามี\n"
            "ห้ามใส่ volume/Heat ถ้าไม่ช่วยตอบคำถาม"
        ),
        "indicators": (
            "โครงสร้างสำหรับตัวชี้วัด:\n"
            "อธิบายเฉพาะตัวที่ถาม — 1–2 ประโยคต่อตัว\n"
            "ใส่ตัวเลขจริงจาก snapshot · แปลเป็นภาษาคน (เช่น RSI 52 = เป็นกลาง)"
        ),
        "status": (
            "โครงสร้างสำหรับสถานะ/Heat/Deviation:\n"
            "ตอบว่า 'ปกติ/เริ่มผิดปกติ/ผิดปกติชัด' ภาษาคน + เหตุผลจากตัวเลข\n"
            "Heat = บอกว่าร้อน/เย็นแค่ไหน ไม่ใช่สัญญาณซื้อขาย"
        ),
        "general": (
            "ตอบสั้น กระชับ 2–4 ประโยค ใช้เฉพาะข้อมูลที่เกี่ยวกับคำถาม"
        ),
    }
    return base + templates.get(kind, templates["general"])


def _clean_ask_response(text: str) -> str:
    """Strip markdown the chat UI can't render — keeps plain readable text."""
    text = text.strip()
    text = re.sub(r"```[^\n]*\n?", "", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"\1", text)
    text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-•]\s*\*\s*", "· ", text, flags=re.MULTILINE)
    text = re.sub(r"^(สวัสดี[^\n]*[!?\n]\s*)", "", text)
    text = re.sub(r"^(Hello[^\n]*[!?\n]\s*)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def summarize_coin(coin: dict) -> str:
    prompt = (
        f"You are a crypto analyst writing for a busy beginner investor who has no time to watch charts.\n"
        f"Summarize {coin['symbol']} in 1–2 sentences using ONLY these numbers:\n"
        f"- Price: ${coin['price']:,.2f}\n"
        f"- 24h change: {coin['change_24h_pct']:+.2f}%\n"
        f"- 24h volume: ${coin['volume_24h']:,.0f}\n"
        f"{_format_indicators(coin)}\n\n"
        f"Recent news headlines:\n{_format_news(coin)}\n\n"
        f"Rules: cite actual values, keep language simple, mention news context if relevant to price move. "
        f"End with one practical signal. Do NOT hallucinate prices or events not in the data."
    )
    return complete(prompt, max_tokens=180, op="summarize_coin")


def market_mood(coins: list[dict]) -> str:
    lines = []
    for c in coins:
        ind = c.get("indicators") or {}
        macd_hist = ind.get("macd_histogram", 0)
        news_count = len(c.get("news") or [])
        lines.append(
            f"- {c['symbol']}: {c['change_24h_pct']:+.2f}%, RSI {c['rsi']}, "
            f"MACD hist {macd_hist:+.4f}, {news_count} news items"
        )
    prompt = (
        f"Write ONE line (≤120 chars) describing the overall crypto market mood based on:\n"
        f"{chr(10).join(lines)}\n"
        f"Be specific: mention direction, leading coin, and one signal. No fluff. One sentence only."
    )
    return complete(prompt, max_tokens=80, op="market_mood")


DIGEST_DISCLAIMER = (
    "ข้อมูลนี้สรุปจากราคา/ตัวชี้วัด/หัวข้อข่าวจริงเท่านั้น ไม่ใช่คำแนะนำการลงทุน "
    "โปรดตัดสินใจด้วยตนเอง"
)


def _market_direction(coins: list[dict]) -> str:
    """Aggregate 24h price direction across coins: down/up/mixed/flat."""
    if not coins:
        return "flat"
    threshold = 0.05
    down = sum(1 for c in coins if c.get("change_24h_pct", 0) < -threshold)
    up = sum(1 for c in coins if c.get("change_24h_pct", 0) > threshold)
    n = len(coins)
    if down == n:
        return "down"
    if up == n:
        return "up"
    if down >= n * 0.75:
        return "down"
    if up >= n * 0.75:
        return "up"
    if down == 0 and up == 0:
        return "flat"
    return "mixed"


def _verdict_fallback(coins: list[dict], weighted: bool) -> tuple[str, str, str, str]:
    """Deterministic attention verdict from deviation + market direction."""
    return triage.portfolio_verdict(coins, weighted)


def daily_digest(coins: list[dict]) -> dict:
    """Build a beginner-friendly 'what happened to your coins today' digest.

    Strictly grounded in the numbers/headlines passed in — the model is told to
    invent nothing and to give NO buy/sell advice (spec §3.2, liability §6.2).
    Returns attention verdict + narrative + mood + per-coin facts.
    """
    if not coins:
        return {
            "verdict": "ยังไม่มีเหรียญในพอร์ต",
            "narrative": "",
            "mood": "",
            "verdict_level": "normal",
            "market_direction": "flat",
            "overview": "ยังไม่มีเหรียญในพอร์ต",
            "per_coin": {},
            "disclaimer": DIGEST_DISCLAIMER,
        }

    weighted = any(c.get("weight_pct") is not None for c in coins)
    fb_verdict, fb_narrative, fb_level, fb_direction = _verdict_fallback(coins, weighted)
    market_dir = fb_direction

    blocks = []
    for c in coins:
        ind = c.get("indicators") or {}
        macd_hist = ind.get("macd_histogram", 0)
        headlines = "; ".join(
            f"[{n.get('sentiment', 'neutral')}] {n.get('title', '')}"
            for n in (c.get("news") or [])[:3]
        ) or "ไม่มีข่าวเด่น"
        weight = c.get("weight_pct")
        weight_str = f", {weight}% ของพอร์ต" if weight is not None else ""
        heat = c.get("heat")
        heat_str = f", Heat {heat}/100 ({c.get('heat_zone', '')})" if heat is not None else ""
        dev = c.get("deviation") or {}
        dev_str = ""
        if dev.get("enough_data"):
            _th = {"abnormal": "ผิดปกติชัด", "mild": "เริ่มผิดปกติ", "normal": "ปกติ"}
            dev_str = (
                f", วันนี้ {dev.get('today_return_pct'):+.2f}% = "
                f"{_th.get(dev.get('status'), dev.get('status'))} "
                f"(กรอบปกติ {dev.get('normal_low_pct'):+.1f}..{dev.get('normal_high_pct'):+.1f}%/วัน)"
            )
        blocks.append(
            f"{c['symbol']}: price ${c['price']:,.2f}, 24h {c['change_24h_pct']:+.2f}%, "
            f"RSI {c.get('rsi', 'N/A')}, MACD hist {macd_hist:+.4f}{weight_str}{heat_str}{dev_str}\n"
            f"  news: {headlines}"
        )

    symbols = ", ".join(c["symbol"] for c in coins)
    any_abnormal = any((c.get("deviation") or {}).get("status") in ("abnormal", "mild") for c in coins)

    if weighted:
        verdict_hint = (
            "<1 บรรทัด — ต้องเล่า 'ทิศทาง' (ลง/ขึ้น/ผสม) คู่กับ 'ต้องจับตาไหม' "
            "เช่น 'พอร์ตลงแต่ยังอยู่ในกรอบปกติ — ไม่ต้องห่วง' หรือ 'พอร์ตมี 1 เหรียญควรดู — ETH'>"
        )
    else:
        verdict_hint = (
            "<1 บรรทัด — ต้องเล่า 'ทิศทาง' (ลง/ขึ้น/ผสม) คู่กับ 'ต้องจับตาไหม' "
            "เช่น 'ตลาดลงทั่วแต่ยังอยู่ในกรอบปกติ — ไม่ต้องห่วง' ห้ามบอกแค่ 'ปกติ' เมื่อทุกเหรียญลง>"
        )

    if any_abnormal:
        narrative_hint = (
            "<1-2 ประโยค อธิบายเหตุผลสั้น ๆ — เหรียญไหนขยับเท่าไร ทำไม notable อิงข่าว/ตัวเลข>"
        )
    else:
        narrative_hint = (
            "<1 ประโยค สรุปว่าเหรียญหลักยังอยู่ในกรอบปกติ — อย่าปั้นให้ดูตื่นเต้น>"
        )

    weight_rule = (
        "ใส่บริบทน้ำหนักพอร์ตได้ (เช่น 'เป็น 60% ของพอร์ตคุณ') เพื่อช่วยจัดลำดับความสนใจ, "
        if weighted
        else ""
    )
    prompt = (
        "คุณเป็นผู้ช่วยสรุปคริปโตให้มนุษย์เงินเดือนที่ถือเหรียญอยู่ แต่ไม่มีเวลานั่งเฝ้าจอ\n"
        "ตอบคำถามเดียว: 'วันนี้ต้องสนใจอะไรไหม' จากข้อมูลจริงด้านล่างเท่านั้น "
        "ห้ามแต่งราคา/ตัวเลข/ข่าวที่ไม่ได้ใหมา\n"
        "สำคัญ: VERDICT = attention verdict (ต้องจับตาไหม) ไม่ใช่คำสั่งซื้อ/ขาย\n"
        "  - ต้องเล่าทิศทางตลาด (ลง/ขึ้น/ผสม) คู่กับความผิดปกติเสมอ\n"
        "  - อนุญาต: 'ลงแต่ยังอยู่ในกรอบปกติ — ไม่ต้องห่วง', 'มี X เหรียญควรดู — จับตา'\n"
        "  - ห้าม: 'ควรซื้อ', 'ควรขาย', 'น่าสะสม', 'เข้าซื้อ', 'ออกขาย'\n"
        "Heat = ระดับความ 'ร้อน/สุดโต่ง' (0-100) ไม่ใช่ความน่าซื้อ\n"
        "ใช้สถานะ 'ปกติ/เริ่มผิดปกติ/ผิดปกติชัด' (เทียบกรอบ 30 วัน) เป็นตัวจัดลำดับ\n\n"
        f"ข้อมูล ({symbols}):\n" + "\n".join(blocks) + "\n\n"
        "ตอบเป็นภาษาไทย ใช้รูปแบบนี้เป๊ะ ๆ (หนึ่งบรรทัดต่อหัวข้อ):\n"
        f"VERDICT: {verdict_hint}\n"
        f"NARRATIVE: {narrative_hint}\n"
        "MOOD: <1 บรรทัดสั้น ๆ อารมณ์ตลาดโดยรวม เช่น 'mixed — BTC นิ่ง ETH แรง'>\n"
        + "\n".join(f"{c['symbol']}: <1-2 ประโยค อะไรขยับและทำไม อิงข่าว/ตัวเลขจริง>" for c in coins)
        + "\n\nกฎ PER_COIN: ถ้าอ้าง % การขยับ ต้องใช้ '24h X%' จากบรรทัด 24h หรือ 'วันนี้ Y%' จาก deviation "
        "และระบุคำว่า '24h' หรือ 'วันนี้' นำหน้าตัวเลขเสมอ — ห้ามสลับสองค่านี้\n"
        "กฎ: อ้างตัวเลขจริง, ภาษาง่ายเหมาะมือใหม่, "
        + weight_rule
        + "ห้ามให้คำแนะนำซื้อ/ขาย — แค่เล่าว่าเกิดอะไรขึ้นและรุนแรงแค่ไหน"
    )
    # If every provider is down, don't 502 the user — fall through to the
    # deterministic verdict (same engine the backtest validates). raw="" makes
    # the parser below find nothing, so the fb_* values take over wholesale.
    degraded = False
    try:
        raw = complete(prompt, max_tokens=140 + 70 * len(coins), op="daily_digest")
    except Exception as e:
        log.warning(f"daily_digest: all AI providers unavailable ({e}) — serving deterministic fallback")
        raw = ""
        degraded = True

    verdict = ""
    narrative = ""
    mood = ""
    per_coin: dict[str, str] = {}
    valid = {c["symbol"].upper() for c in coins}
    for line in raw.splitlines():
        line = line.strip().lstrip("-•").strip()
        if not line or ":" not in line:
            continue
        label, _, text = line.partition(":")
        label = label.strip().upper()
        text = text.strip()
        if label == "VERDICT":
            verdict = text
        elif label == "NARRATIVE":
            narrative = text
        elif label == "MOOD":
            mood = text
        elif label == "OVERVIEW":
            if not narrative:
                narrative = text
        elif label in valid:
            per_coin[label] = text

    if not verdict:
        verdict = fb_verdict
    elif fb_level == "normal" and market_dir == "down" and "ลง" not in verdict:
        verdict = fb_verdict
    if not narrative:
        narrative = fb_narrative or raw.strip()
    elif fb_level == "normal" and market_dir == "down" and "24h" not in narrative and fb_narrative:
        narrative = fb_narrative
    if not mood:
        try:
            mood = market_mood(coins)
        except Exception:
            mood = ""

    level = fb_level
    if any(
        phrase in verdict
        for phrase in ("ควรดู", "ผิดปกติร่วม", "ผิดปกติชัด")
    ):
        if triage.hero_abnormal_coins(coins, weighted) or "ผิดปกติร่วม" in verdict:
            level = "abnormal"
    if "ปกติ" in verdict or "ไม่ต้องห่วง" in verdict or "ไม่ต้องรีบ" in verdict:
        if not triage.hero_abnormal_coins(coins, weighted):
            level = "normal"

    overview = narrative if narrative else verdict

    return {
        "verdict": verdict,
        "narrative": narrative,
        "mood": mood,
        "verdict_level": level,
        "market_direction": market_dir,
        "overview": overview,
        "per_coin": per_coin,
        "disclaimer": DIGEST_DISCLAIMER,
        "degraded": degraded,
    }


def ask_coin(coin_snapshot: dict, question: str) -> str:
    lang = "ภาษาไทย" if _is_thai(question) else "the same language as the question"
    kind = _classify_ask_question(question)
    sym = coin_snapshot["symbol"]
    summary = (coin_snapshot.get("summary") or "").strip()
    summary_block = f"\nสรุปก่อนหน้า: {summary}\n" if summary else ""

    prompt = (
        f"คุณเป็นผู้ช่วยอธิบายคริปโตให้คนถือเหรียญ — ตอบคำถามเกี่ยวกับ {sym}\n"
        f"ใช้เฉพาะข้อมูล snapshot ด้านล่าง (ห้ามแต่งราคา/ข่าว/ตัวเลขที่ไม่ได้ใหมา)\n\n"
        f"[SNAPSHOT]\n"
        f"ราคา ${coin_snapshot['price']:,.2f} · 24h {coin_snapshot['change_24h_pct']:+.2f}% · "
        f"volume ${coin_snapshot['volume_24h']:,.0f}\n"
        f"{_format_indicators(coin_snapshot)}\n"
        f"{_format_heat_deviation(coin_snapshot)}\n"
        f"ข่าว ({len(coin_snapshot.get('news') or [])} หัว):\n"
        f"{_format_news(coin_snapshot, limit=10)}"
        f"{summary_block}\n"
        f"คำถาม: {question}\n"
        f"ประเภทคำถาม: {kind}\n\n"
        f"กฎ:\n"
        f"- ตอบเป็น{lang}\n"
        f"- ห้าม: 'ควรซื้อ', 'ควรขาย', 'น่าสะสม', buy/sell\n"
        f"- ข้อมูลไม่พอ → บอกตรง ๆ\n"
        f"{_ask_style_rules(kind)}"
    )
    raw = complete(prompt, max_tokens=_ask_max_tokens(question), op="ask_coin")
    return _clean_ask_response(raw)


_DEV_TH = {"abnormal": "ผิดปกติชัด", "mild": "เริ่มผิดปกติ", "normal": "ปกติ"}


def ask_coin_fallback(coin_snapshot: dict, question: str) -> str:
    """Deterministic plain-text answer from the snapshot — no LLM.

    Served when every provider is exhausted so /api/ask degrades to real facts
    instead of a 502 / blank chat (same principle as the digest's triage
    fallback). It only restates numbers already in the snapshot, so it can never
    hallucinate or give a buy/sell verdict.
    """
    sym = coin_snapshot["symbol"]
    kind = _classify_ask_question(question)
    lines = [f"ตอนนี้ผู้ช่วย AI ไม่พร้อมตอบ — สรุปจากข้อมูลล่าสุดของ {sym} ให้แทน:"]

    if kind == "news":
        lines.append(_format_news(coin_snapshot, limit=5))
    elif kind == "indicators":
        lines.append(_format_indicators(coin_snapshot))
    else:
        lines.append(
            f"· ราคา ${coin_snapshot['price']:,.2f} · 24h "
            f"{coin_snapshot['change_24h_pct']:+.2f}%"
        )
        dev = coin_snapshot.get("deviation") or {}
        if dev.get("enough_data"):
            lines.append(
                f"· วันนี้ {dev.get('today_return_pct'):+.2f}% = "
                f"{_DEV_TH.get(dev.get('status'), dev.get('status'))} "
                f"(เทียบกรอบปกติ 30 วัน)"
            )
        heat = coin_snapshot.get("heat")
        score = heat.get("score") if isinstance(heat, dict) else heat
        if score is not None:
            lines.append(f"· Heat {score}/100 — ระดับความร้อน ไม่ใช่สัญญาณซื้อขาย")

    return "\n".join(l for l in lines if l).strip()
