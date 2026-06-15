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


def _make_groq_adapter(api_key: str) -> Callable[[str, int], str]:
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
                raise QuotaError("groq: empty response")
            log.info("served by groq")
            return text
        except Exception as e:
            if _is_quota_error(e):
                raise QuotaError(f"groq: {e}") from e
            raise

    return call


def _build_chain() -> list[Callable[[str, int], str]]:
    chain: list[Callable[[str, int], str]] = []
    if k := os.environ.get("GEMINI_API_KEY"):
        chain.append(_make_gemini_adapter(k, "gemini"))
    if k := os.environ.get("GEMINI_API_KEY_2"):
        chain.append(_make_gemini_adapter(k, "gemini2"))
    if k := os.environ.get("GROQ_API_KEY"):
        chain.append(_make_groq_adapter(k))
    if not chain:
        raise RuntimeError(
            "No AI providers configured. Set at least one of "
            "GEMINI_API_KEY, GEMINI_API_KEY_2, GROQ_API_KEY in .env"
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
