# CryptoLens

An AI-native crypto **insight assistant** for **retail traders** who manage their own positions and open the app when they're worried — not when they're glued to a chart all day. Binance data + deterministic signals + free-tier LLM summaries, condensed into a single dark screen that answers one question: **"Is my position at risk today — do I need to pay attention?"**

It is **not** a trading terminal. We don't place orders or hold trade keys — when you want to act, we deep-link you out to Binance.

## What it does

- **Daily digest (the hero)** — a portfolio-weighted, plain-language summary that leads with what's *notable* today. On a quiet day it says so honestly ("everything's within its normal range").
- **Manual holdings** — enter the coins and amounts you hold; the digest and ranking get weighted by your real portfolio.
- **Deviation band** — the wedge signal: is today's move *normal or abnormal vs this coin's own 30-day baseline* (deterministic z-score). This is what kills panic/FOMO.
- **Heat score (0–100)** — a deterministic intensity score (RSI + volatility percentile + news sentiment). Measures how *hot/extreme* a coin is, in either direction — **never** "should I buy". Every score shows its breakdown.
- **Per-coin fact cards** — status + the *why* as plain facts (e.g. "RSI 78 overbought · down 12% from the 7-day high · 2 bearish headlines"). You draw your own conclusion.
- **Watchlist + AI chat** — ask grounded questions about any coin; answers use only the cached snapshot data.
- **Trade on Binance** — a deep-link button. We never touch your money.

### Iron rules (by design)

1. Never print "buy / sell / good to buy" — we describe, we don't prescribe.
2. Heat & deviation are **deterministic** — pure functions of real numbers, never invented by an LLM, always reproducible and explainable.
3. The LLM is grounded strictly in the price / indicator / news data passed to it — no hallucinated numbers.
4. We don't hold trade keys or place orders. Acting happens on the user's own Binance.

> The real trading surface (signed `/api/order`, key vault, OrderPanel) is **frozen** behind a Spot Testnet demo and is not part of the main flow. See `docs/superpowers/specs/2026-06-15-cryptolens-insight-pivot-design.md` and `PLAN.md`.

## AI Providers (free-tier first)

Provider chain — tried in order, falls through on quota/rate-limit errors. Set **at least one** in `backend/.env`. Logs show which provider served each call, plus token usage, latency, and a projected paid-tier cost (`/api/metrics`).

1. **Gemini** (`GEMINI_API_KEY`) — primary. Free key: https://aistudio.google.com/apikey
2. **Gemini #2** (`GEMINI_API_KEY_2`) — optional. Use a key from a **different Google account** for real extra quota (AI Studio shares the primary account's quota).
3. **Groq** (`GROQ_API_KEY`, `GROQ_API_KEY_2`) — fallbacks. Free key: https://console.groq.com/keys

News works with **no key** via NS3 News + Google News RSS. `CRYPTOPANIC_API_KEY` is an optional legacy source (free tier ends April 2026).

## Setup

### Backend (Python 3.11+)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # paste at least one AI key
uvicorn main:app --reload --port 8000
```

Health check: `curl http://localhost:8000/api/health`

### Frontend

```bash
cd frontend
npm install
npm run dev                  # http://localhost:3000
```

## Endpoints

User-scoped endpoints (watchlist, holdings, digest, chart drawings, account) require an `X-User-ID` header.

### Insight (read-only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Backend alive check |
| GET | `/api/metrics` | Measured AI token usage, latency & projected cost |
| GET | `/api/insights?symbols=BTC,ETH,BNB,SOL` | Per-coin data + indicators + AI summary |
| GET | `/api/candles?symbol=BTC&interval=1h&limit=100` | OHLC candles + indicators |
| GET | `/api/news?symbol=BTC` | Aggregated, deduplicated crypto news |
| GET | `/api/mood` | One-line AI market mood |
| GET | `/api/heat?symbols=BTC,ETH` | Deterministic Heat score + deviation + facts |
| POST | `/api/ask` | `{symbol, question}` → grounded AI answer |

### Personalized (require `X-User-ID`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/digest` | Portfolio-weighted daily digest (cached per day) |
| GET/POST/DELETE | `/api/holdings` | Manual holdings (coin + amount) |
| GET/POST/DELETE | `/api/watchlist` | Watchlist (with reorder via `PUT /api/watchlist/reorder`) |
| GET/PUT | `/api/chart/drawings` | Saved chart drawings per symbol |

### Trading (frozen — Spot Testnet demo, off the main path)

`GET /api/config`, `POST/DELETE /api/account/keys`, `POST/DELETE /api/order`, and the `/api/account/*` balance/order/trade endpoints. Defaults to Binance Spot **testnet** (fake funds); mainnet is gated behind `ENABLE_BINANCE_MAINNET=true` and requires sign-off + security review.
