import os
import asyncio
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

import httpx

NS3_BASE = "https://api.ns3.ai/feed/news-data"
CRYPTOPANIC_BASE = "https://cryptopanic.com/api/v1/posts/"

SYMBOL_NAMES = {
    "BTC": "Bitcoin",
    "ETH": "Ethereum",
    "BNB": "Binance Coin",
    "SOL": "Solana",
}


def _parse_sentiment(text: str) -> str:
    lower = text.lower()
    if "bullish" in lower:
        return "bullish"
    if "bearish" in lower or "risk-off" in lower:
        return "bearish"
    return "neutral"


def _parse_rss_items(xml_text: str, limit: int) -> list[dict]:
    root = ET.fromstring(xml_text)
    channel = root.find("channel")
    if channel is None:
        return []

    posts = []
    for item in channel.findall("item")[:limit]:
        title = (item.findtext("title") or "").strip()
        url = (item.findtext("link") or "").strip()
        pub = (item.findtext("pubDate") or "").strip()
        published_at = ""
        if pub:
            try:
                published_at = parsedate_to_datetime(pub).isoformat()
            except Exception:
                published_at = pub

        insight = (item.findtext("insight") or item.findtext("description") or "")
        source = ""
        if " - " in title:
            parts = title.rsplit(" - ", 1)
            if len(parts) == 2:
                source = parts[1].strip()
                title = parts[0].strip()

        posts.append({
            "title": title,
            "url": url,
            "published_at": published_at,
            "source": source or "NS3 News",
            "sentiment": _parse_sentiment(insight),
        })
    return posts


async def _ns3_news(symbol: str, limit: int) -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(
                NS3_BASE,
                params={"lang": "en", "crypto": symbol, "limit": limit},
                headers={"Accept": "application/rss+xml, application/xml, text/xml"},
            )
            r.raise_for_status()
            return _parse_rss_items(r.text, limit)
        except Exception:
            return []


async def _google_news(symbol: str, limit: int) -> list[dict]:
    query = SYMBOL_NAMES.get(symbol, symbol)
    url = "https://news.google.com/rss/search"
    params = {
        "q": f"{query} cryptocurrency",
        "hl": "en-US",
        "gl": "US",
        "ceid": "US:en",
    }
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        try:
            r = await client.get(url, params=params)
            r.raise_for_status()
            items = _parse_rss_items(r.text, limit)
            for item in items:
                item["source"] = item["source"] or "Google News"
                item["sentiment"] = "neutral"
            return items
        except Exception:
            return []


async def _cryptopanic_news(symbol: str, limit: int) -> list[dict]:
    token = os.environ.get("CRYPTOPANIC_API_KEY", "").strip()
    if not token:
        return []

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(
                CRYPTOPANIC_BASE,
                params={
                    "auth_token": token,
                    "currencies": symbol,
                    "filter": "hot",
                    "public": "true",
                },
            )
            r.raise_for_status()
            data = r.json()
        except Exception:
            return []

    posts = []
    for item in data.get("results", [])[:limit]:
        votes = item.get("votes") or {}
        positive = votes.get("positive", 0)
        negative = votes.get("negative", 0)
        if positive > negative:
            sentiment = "bullish"
        elif negative > positive:
            sentiment = "bearish"
        else:
            sentiment = "neutral"

        posts.append({
            "title": item.get("title", ""),
            "url": item.get("url", ""),
            "published_at": item.get("published_at", ""),
            "source": (item.get("source") or {}).get("title", "CryptoPanic"),
            "sentiment": sentiment,
        })
    return posts


async def get_news(symbol: str, limit: int = 5) -> list[dict]:
    """Fetch crypto news concurrently from all sources, combine, deduplicate, and sort by date."""
    results = await asyncio.gather(
        _ns3_news(symbol, limit),
        _google_news(symbol, limit),
        _cryptopanic_news(symbol, limit),
        return_exceptions=True
    )

    all_posts = []
    for res in results:
        if isinstance(res, list):
            all_posts.extend(res)

    # Deduplicate by URL and title
    seen_urls = set()
    seen_titles = set()
    unique_posts = []
    for post in all_posts:
        url = post.get("url", "").strip()
        title_lower = post.get("title", "").strip().lower()
        if not title_lower:
            continue
        # Deduplicate
        if (url and url in seen_urls) or (title_lower in seen_titles):
            continue
        if url:
            seen_urls.add(url)
        seen_titles.add(title_lower)
        unique_posts.append(post)

    # Sort by published_at (newest first)
    unique_posts.sort(key=lambda x: x.get("published_at") or "", reverse=True)

    return unique_posts[:limit]
