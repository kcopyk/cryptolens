import os
import logging
from typing import Callable
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("ai")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")

GEMINI_MODEL = "gemini-2.0-flash"
GROQ_MODEL = "llama-3.3-70b-versatile"


class QuotaError(Exception):
    """Provider hit rate-limit / quota / auth issue — try next provider."""


def _is_quota_error(e: Exception) -> bool:
    msg = str(e).lower()
    return any(s in msg for s in ("429", "quota", "rate limit", "rate_limit", "resource_exhausted",
                                  "unauthenticated", "invalid api key", "permission_denied"))


def _make_gemini_adapter(api_key: str, label: str) -> Callable[[str, int], str]:
    from google import genai
    client = genai.Client(api_key=api_key)

    def call(prompt: str, max_tokens: int) -> str:
        try:
            resp = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config={"max_output_tokens": max_tokens, "temperature": 0.4},
            )
            text = (resp.text or "").strip()
            if not text:
                raise QuotaError(f"{label}: empty response")
            log.info(f"served by {label}")
            return text
        except Exception as e:
            if _is_quota_error(e):
                raise QuotaError(f"{label}: {e}") from e
            raise

    return call


def _make_groq_adapter(api_key: str, label: str = "groq") -> Callable[[str, int], str]:
    from groq import Groq
    client = Groq(api_key=api_key)

    def call(prompt: str, max_tokens: int) -> str:
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
            log.info(f"served by {label}")
            return text
        except Exception as e:
            if _is_quota_error(e):
                raise QuotaError(f"{label}: {e}") from e
            raise

    return call


def _build_chain() -> list[Callable[[str, int], str]]:
    chain: list[Callable[[str, int], str]] = []
    if k := os.environ.get("GEMINI_API_KEY"):
        chain.append(_make_gemini_adapter(k, "gemini"))
    if k := os.environ.get("GEMINI_API_KEY_2"):
        chain.append(_make_gemini_adapter(k, "gemini2"))
    if k := os.environ.get("GROQ_API_KEY"):
        chain.append(_make_groq_adapter(k, "groq"))
    if k := os.environ.get("GROQ_API_KEY_2"):
        chain.append(_make_groq_adapter(k, "groq2"))
    if not chain:
        raise RuntimeError(
            "No AI providers configured. Set at least one of "
            "GEMINI_API_KEY, GEMINI_API_KEY_2, GROQ_API_KEY, GROQ_API_KEY_2 in .env"
        )
    return chain


_chain = _build_chain()


def complete(prompt: str, max_tokens: int = 200) -> str:
    """Provider-neutral completion. Tries providers in order, falls through on quota errors."""
    last_err: Exception | None = None
    for adapter in _chain:
        try:
            return adapter(prompt, max_tokens)
        except QuotaError as e:
            log.warning(f"provider exhausted, trying next: {e}")
            last_err = e
            continue
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


def _format_news(coin: dict) -> str:
    news = coin.get("news") or []
    if not news:
        return "- No recent news available"
    lines = []
    for n in news[:5]:
        sentiment = n.get("sentiment", "neutral")
        title = n.get("title", "")
        source = n.get("source", "")
        lines.append(f"- [{sentiment}] {title}" + (f" ({source})" if source else ""))
    return "\n".join(lines)


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
    return complete(prompt, max_tokens=180)


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
    return complete(prompt, max_tokens=80)


DIGEST_DISCLAIMER = (
    "ข้อมูลนี้สรุปจากราคา/ตัวชี้วัด/หัวข้อข่าวจริงเท่านั้น ไม่ใช่คำแนะนำการลงทุน "
    "โปรดตัดสินใจด้วยตนเอง"
)


def daily_digest(coins: list[dict]) -> dict:
    """Build a beginner-friendly 'what happened to your coins today' digest.

    Strictly grounded in the numbers/headlines passed in — the model is told to
    invent nothing and to give NO buy/sell advice (spec §3.2, liability §6.2).
    Returns {"overview": str, "per_coin": {SYMBOL: str}, "disclaimer": str}.
    """
    if not coins:
        return {"overview": "ยังไม่มีเหรียญใน watchlist", "per_coin": {}, "disclaimer": DIGEST_DISCLAIMER}

    blocks = []
    for c in coins:
        ind = c.get("indicators") or {}
        macd_hist = ind.get("macd_histogram", 0)
        headlines = "; ".join(
            f"[{n.get('sentiment', 'neutral')}] {n.get('title', '')}"
            for n in (c.get("news") or [])[:3]
        ) or "ไม่มีข่าวเด่น"
        blocks.append(
            f"{c['symbol']}: price ${c['price']:,.2f}, 24h {c['change_24h_pct']:+.2f}%, "
            f"RSI {c.get('rsi', 'N/A')}, MACD hist {macd_hist:+.4f}\n"
            f"  news: {headlines}"
        )

    symbols = ", ".join(c["symbol"] for c in coins)
    prompt = (
        "คุณเป็นผู้ช่วยสรุปข่าวคริปโตให้นักลงทุนมือใหม่ที่ไม่มีเวลานั่งเฝ้าจอ\n"
        "สรุป 'วันนี้เหรียญในลิสต์มีอะไรเกิดขึ้น' จากข้อมูลจริงด้านล่างเท่านั้น "
        "ห้ามแต่งราคา/ตัวเลข/ข่าวที่ไม่ได้ให้มา\n\n"
        f"ข้อมูล ({symbols}):\n" + "\n".join(blocks) + "\n\n"
        "ตอบเป็นภาษาไทย ใช้รูปแบบนี้เป๊ะ ๆ (หนึ่งบรรทัดต่อหัวข้อ):\n"
        "OVERVIEW: <ภาพรวมตลาดวันนี้ 1 บรรทัด อิงทิศทางรวม + เหรียญนำ>\n"
        + "\n".join(f"{c['symbol']}: <1-2 ประโยค อะไรขยับและทำไม อิงข่าว/ตัวเลขจริง>" for c in coins)
        + "\n\nกฎ: อ้างตัวเลขจริง, ภาษาง่ายเหมาะมือใหม่, อธิบายศัพท์เทคนิคสั้น ๆ ถ้าใช้, "
        "ห้ามให้คำแนะนำซื้อ/ขายหรือบอกว่าควรเข้า/ออก แค่เล่าว่าเกิดอะไรขึ้น"
    )
    raw = complete(prompt, max_tokens=90 + 60 * len(coins))

    overview = ""
    per_coin: dict[str, str] = {}
    valid = {c["symbol"].upper() for c in coins}
    for line in raw.splitlines():
        line = line.strip().lstrip("-•").strip()
        if not line or ":" not in line:
            continue
        label, _, text = line.partition(":")
        label = label.strip().upper()
        text = text.strip()
        if label == "OVERVIEW":
            overview = text
        elif label in valid:
            per_coin[label] = text

    # Fallback: if the model ignored the format, surface the raw text rather
    # than show nothing.
    if not overview and not per_coin:
        overview = raw.strip()

    return {"overview": overview, "per_coin": per_coin, "disclaimer": DIGEST_DISCLAIMER}


def ask_coin(coin_snapshot: dict, question: str) -> str:
    prompt = (
        f"You are answering a question about {coin_snapshot['symbol']} for a crypto beginner.\n"
        f"Use ONLY this snapshot data (do not fetch or infer anything else):\n"
        f"- Price: ${coin_snapshot['price']:,.2f}\n"
        f"- 24h change: {coin_snapshot['change_24h_pct']:+.2f}%\n"
        f"- 24h volume: ${coin_snapshot['volume_24h']:,.0f}\n"
        f"{_format_indicators(coin_snapshot)}\n\n"
        f"Recent news:\n{_format_news(coin_snapshot)}\n\n"
        f"- AI summary: {coin_snapshot['summary']}\n\n"
        f"Question: {question}\n\n"
        f"Answer in 2–4 sentences. Keep language beginner-friendly. "
        f"Use indicators (RSI, MACD, EMA, Bollinger) and news to explain WHY price may be moving. "
        f"If the answer requires data not in the snapshot, say so clearly."
    )
    return complete(prompt, max_tokens=300)
