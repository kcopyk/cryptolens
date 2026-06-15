# CryptoLens Lite — v1

AI-native crypto insight dashboard. Binance data → free-tier LLM summaries → single dark screen.

## AI Providers (free-tier first)

Provider chain — tried in order, falls through on quota/rate-limit errors:

1. **Gemini** (`GEMINI_API_KEY`) — primary. Get free: https://aistudio.google.com/apikey
2. **Gemini #2** (`GEMINI_API_KEY_2`) — optional. Must be from a **different Google account** to count as extra quota (AI Studio + Gemini API share the same per-account quota).
3. **Groq** (`GROQ_API_KEY`) — final fallback. Get free: https://console.groq.com/keys

Set **at least one** in `backend/.env`. Logs show which provider served each call.

## Setup

### Backend (Python 3.11+)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # paste at least one key
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

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Backend alive check |
| GET | `/api/mood` | One-line AI market mood |
| GET | `/api/insights?symbols=BTC,ETH,BNB,SOL` | Per-coin data + AI summary |
| POST | `/api/ask` | `{symbol, question}` → grounded AI answer |
