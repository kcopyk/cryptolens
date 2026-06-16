"""Golden snapshots for the grounding eval.

Each entry is a realistic `coin` dict in the exact shape ai.summarize_coin /
ai.ask_coin / ai.daily_digest expect. The numbers here are the ONLY values an
AI output is allowed to cite — anything else is a hallucination.
"""

GOLDEN = [
    {
        "symbol": "BTC",
        "price": 109_234.56,
        "change_24h_pct": 2.45,
        "volume_24h": 38_500_000_000,
        "rsi": 61.2,
        "indicators": {
            "rsi": 61.2,
            "ema_9": 108_900.00,
            "ema_21": 107_400.00,
            "macd": 320.50,
            "macd_signal": 280.10,
            "macd_histogram": 40.40,
            "bb_upper": 111_000.00,
            "bb_middle": 108_500.00,
            "bb_lower": 106_000.00,
        },
        "news": [
            {"sentiment": "bullish", "title": "Spot BTC ETFs see record weekly inflows", "source": "CoinDesk"},
            {"sentiment": "neutral", "title": "Fed holds rates steady", "source": "Reuters"},
        ],
        "summary": "BTC at $109,234.56 (+2.45%), RSI 61.2 — momentum positive on ETF inflows.",
    },
    {
        "symbol": "ETH",
        "price": 4_120.30,
        "change_24h_pct": -1.85,
        "volume_24h": 19_200_000_000,
        "rsi": 43.7,
        "indicators": {
            "rsi": 43.7,
            "ema_9": 4_180.00,
            "ema_21": 4_250.00,
            "macd": -22.30,
            "macd_signal": -10.50,
            "macd_histogram": -11.80,
            "bb_upper": 4_400.00,
            "bb_middle": 4_220.00,
            "bb_lower": 4_040.00,
        },
        "news": [
            {"sentiment": "bearish", "title": "Layer-2 token unlock pressures ETH", "source": "The Block"},
        ],
        "summary": "ETH at $4,120.30 (-1.85%), RSI 43.7 — cooling off, MACD turned negative.",
    },
    {
        "symbol": "SOL",
        "price": 198.74,
        "change_24h_pct": 5.10,
        "volume_24h": 5_800_000_000,
        "rsi": 72.9,
        "indicators": {
            "rsi": 72.9,
            "ema_9": 192.00,
            "ema_21": 184.50,
            "macd": 4.20,
            "macd_signal": 2.80,
            "macd_histogram": 1.40,
            "bb_upper": 205.00,
            "bb_middle": 190.00,
            "bb_lower": 175.00,
        },
        "news": [
            {"sentiment": "bullish", "title": "Solana DEX volume hits all-time high", "source": "Decrypt"},
            {"sentiment": "bullish", "title": "Major payments firm adds SOL settlement", "source": "CoinTelegraph"},
        ],
        "summary": "SOL at $198.74 (+5.10%), RSI 72.9 (overbought) — strong volume-led rally.",
    },
]

# Questions for the ask_coin path.
ASK_QUESTIONS = [
    "Why is the price moving today?",
    "Is this coin overbought right now?",
]
