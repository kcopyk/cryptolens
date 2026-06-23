"""Historical backtest for CryptoLens deviation triage (PLAN v2 grill 2026-06-18).

Measures whether the deterministic engine helps portfolio holders:
  A) Signal quality — calm-day accuracy, spike recall, ranking
  B) Panic counterfactual — hold vs panic-sell on abnormal+down (research sim, NOT advice)
  C) Alert value (forward 7d) — calm/attention alerts vs what happened next
  D) Interview-day picker — dates with ≥1 abnormal coin for qualitative study
  E) Abnormal-up buy counterfactual — did abnormal-up fire before/during up moves;
     if you bought at close on signal day, forward 7d win rate (research sim, NOT advice)

Ground truth (independent of z-score): |daily return| in top 5% of the coin's
own history over the evaluation window.

Run from backend/:
    python -m eval.backtest_deviation
    python -m eval.backtest_deviation --list-interview-days
    python -m eval.backtest_deviation --start 2023-01-01   # extend to ~3yr window
    python -m eval.backtest_deviation --sweep              # grid search + append log

Tuning history: eval/tuning_log.json (auto-appended unless --no-log).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import heat as heat_mod  # noqa: E402
import triage  # noqa: E402

BINANCE = "https://api.binance.com"

PORTFOLIO: dict[str, float] = {
    "BTC": 40.0,
    "ETH": 20.0,
    "BNB": 20.0,
    "XRP": 20.0,
}

DEFAULT_START = date(2024, 1, 1)
WARMUP_DAYS = 30
SPIKE_PERCENTILE = 95.0
PANIC_COOLDOWN_DAYS = 30
INITIAL_CAPITAL = 10_000.0
FORWARD_DAYS = 7
LEAD_LOOKBACK_DAYS = 3
CALM_DOWN_AVG_PCT = -2.0          # avg coin return on alert day → "market down"
CALM_DISASTER_FWD_PCT = -10.0     # portfolio 7d worse → false reassurance
FALSE_PANIC_PREVENT_TARGET = 0.80 # calm-on-down days with fwd 7d > disaster threshold
TUNING_LOG_PATH = Path(__file__).with_name("tuning_log.json")

# Curated sanity dates — checked when they fall inside the run window.
SANITY_DATES: dict[str, str] = {
    "2022-05-09": "Luna/UST collapse",
    "2022-11-09": "FTX collapse",
    "2024-08-05": "Yen carry / global risk-off",
    "2024-11-06": "US election",
    "2025-01-20": "Trump inauguration",
    "2025-04-07": "Tariff shock",
}


@dataclass
class CoinDay:
    symbol: str
    dev: dict
    daily_return_pct: float | None
    true_spike: bool
    attention_score: float  # |z| × weight


@dataclass
class DaySnapshot:
    day: date
    coins: list[CoinDay]
    verdict_level: str  # normal | mild | abnormal
    portfolio_spike: bool  # any coin true_spike
    portfolio_calm: bool  # no coin true_spike
    all_engine_normal: bool
    any_engine_alert: bool  # mild or abnormal on any coin


def _pair(symbol: str) -> str:
    return f"{symbol.upper()}USDT"


def fetch_daily_klines(symbol: str, start: date, end: date) -> list[dict]:
    """Fetch 1d OHLC candles from Binance (paginated, oldest→newest)."""
    start_ms = int(datetime(start.year, start.month, start.day, tzinfo=timezone.utc).timestamp() * 1000)
    end_ms = int(datetime(end.year, end.month, end.day, 23, 59, tzinfo=timezone.utc).timestamp() * 1000)
    out: list[dict] = []
    cursor = start_ms
    pair = _pair(symbol)
    with httpx.Client(timeout=30) as client:
        while cursor <= end_ms:
            r = client.get(
                f"{BINANCE}/api/v3/klines",
                params={
                    "symbol": pair,
                    "interval": "1d",
                    "startTime": cursor,
                    "endTime": end_ms,
                    "limit": 1000,
                },
            )
            r.raise_for_status()
            batch = r.json()
            if not batch:
                break
            for candle in batch:
                out.append(
                    {
                        "time": int(candle[0]) // 1000,
                        "open": float(candle[1]),
                        "high": float(candle[2]),
                        "low": float(candle[3]),
                        "close": float(candle[4]),
                        "volume": float(candle[5]),
                    }
                )
            last_open_ms = int(batch[-1][0])
            cursor = last_open_ms + 86_400_000
            if len(batch) < 1000:
                break
    return out


def _candle_date(c: dict) -> date:
    return datetime.fromtimestamp(c["time"], tz=timezone.utc).date()


def _daily_return_pct(prev_close: float, close: float) -> float | None:
    if not prev_close:
        return None
    return (close - prev_close) / prev_close * 100


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    xs = sorted(values)
    idx = min(len(xs) - 1, int(round((pct / 100) * (len(xs) - 1))))
    return xs[idx]


def _coin_day_dict(c: CoinDay) -> dict:
    return {
        "symbol": c.symbol,
        "change_24h_pct": c.daily_return_pct or 0.0,
        "weight_pct": PORTFOLIO[c.symbol],
        "deviation": c.dev,
    }


def _verdict_level(coins: list[CoinDay]) -> str:
    _, _, level, _ = triage.portfolio_verdict([_coin_day_dict(c) for c in coins], weighted=True)
    return level


def _rank_coins(coins: list[CoinDay]) -> list[CoinDay]:
    n = len(coins)
    return sorted(
        coins,
        key=lambda c: triage.coin_sort_key(_coin_day_dict(c), weighted=True, n_coins=n),
        reverse=True,
    )


def build_series(
    start: date,
    end: date,
) -> tuple[list[date], dict[str, dict[date, dict]], dict[str, float]]:
    """Load candles, align dates, compute spike thresholds per coin."""
    fetch_start = start - timedelta(days=WARMUP_DAYS + 5)
    raw: dict[str, list[dict]] = {}
    for sym in PORTFOLIO:
        raw[sym] = fetch_daily_klines(sym, fetch_start, end)

    by_sym_date: dict[str, dict[date, dict]] = {}
    all_dates: set[date] = set()
    for sym, candles in raw.items():
        by_sym_date[sym] = {}
        for c in candles:
            d = _candle_date(c)
            by_sym_date[sym][d] = c
            all_dates.add(d)

    eval_dates = sorted(d for d in all_dates if start <= d <= end)
    if len(eval_dates) < WARMUP_DAYS + 5:
        raise SystemExit(f"Not enough data between {start} and {end}")

    # Independent spike thresholds from |returns| over eval window.
    spike_threshold: dict[str, float] = {}
    for sym in PORTFOLIO:
        abs_returns: list[float] = []
        dates = sorted(by_sym_date[sym].keys())
        for i in range(1, len(dates)):
            d = dates[i]
            if d < start or d > end:
                continue
            prev = by_sym_date[sym][dates[i - 1]]["close"]
            cur = by_sym_date[sym][d]["close"]
            r = _daily_return_pct(prev, cur)
            if r is not None:
                abs_returns.append(abs(r))
        spike_threshold[sym] = _percentile(abs_returns, SPIKE_PERCENTILE)

    return eval_dates, by_sym_date, spike_threshold


def simulate_days(
    eval_dates: list[date],
    by_sym_date: dict[str, dict[date, dict]],
    spike_threshold: dict[str, float],
    *,
    mild_z: float | None = None,
    abnormal_z: float | None = None,
) -> list[DaySnapshot]:
    """Walk-forward: each day uses trailing daily candles ending that day."""
    snapshots: list[DaySnapshot] = []
    metric_start = eval_dates[WARMUP_DAYS] if len(eval_dates) > WARMUP_DAYS else eval_dates[-1]

    for d in eval_dates:
        if d < metric_start:
            continue
        coin_days: list[CoinDay] = []
        for sym, weight in PORTFOLIO.items():
            dates = sorted(by_sym_date[sym].keys())
            if d not in dates:
                continue
            idx = dates.index(d)
            if idx < 4:
                continue
            window_dates = dates[max(0, idx - 40) : idx + 1]
            candles = [by_sym_date[sym][dd] for dd in window_dates]
            dev = heat_mod.compute_deviation(candles, mild_z=mild_z, abnormal_z=abnormal_z)
            prev_close = by_sym_date[sym][dates[idx - 1]]["close"]
            close = by_sym_date[sym][d]["close"]
            ret = _daily_return_pct(prev_close, close)
            true_spike = ret is not None and abs(ret) >= spike_threshold[sym]
            z = dev.get("z") or 0.0
            coin_days.append(
                CoinDay(
                    symbol=sym,
                    dev=dev,
                    daily_return_pct=ret,
                    true_spike=true_spike,
                    attention_score=abs(z) * weight,
                )
            )
        if len(coin_days) != len(PORTFOLIO):
            continue
        ranked = _rank_coins(coin_days)
        level = _verdict_level(coin_days)
        portfolio_spike = any(c.true_spike for c in coin_days)
        portfolio_calm = not portfolio_spike
        all_normal = all(c.dev.get("status") == "normal" for c in coin_days)
        any_alert = any(c.dev.get("status") in ("mild", "abnormal") for c in coin_days)
        snapshots.append(
            DaySnapshot(
                day=d,
                coins=ranked,
                verdict_level=level,
                portfolio_spike=portfolio_spike,
                portfolio_calm=portfolio_calm,
                all_engine_normal=all_normal,
                any_engine_alert=any_alert,
            )
        )
    return snapshots


@dataclass
class Metrics:
    eval_days: int = 0
    calm_days: int = 0
    calm_correct: int = 0
    spike_coin_days: int = 0
    spike_detected: int = 0
    ranking_top1_hits: int = 0
    ranking_days: int = 0
    abnormal_days: int = 0

    @property
    def calm_accuracy(self) -> float:
        return self.calm_correct / self.calm_days if self.calm_days else 0.0

    @property
    def spike_recall(self) -> float:
        return self.spike_detected / self.spike_coin_days if self.spike_coin_days else 0.0

    @property
    def ranking_accuracy(self) -> float:
        return self.ranking_top1_hits / self.ranking_days if self.ranking_days else 0.0

    def to_dict(self) -> dict:
        return {
            "eval_days": self.eval_days,
            "calm_accuracy": round(self.calm_accuracy, 4),
            "calm_correct": self.calm_correct,
            "calm_days": self.calm_days,
            "spike_recall": round(self.spike_recall, 4),
            "spike_detected": self.spike_detected,
            "spike_coin_days": self.spike_coin_days,
            "ranking_accuracy": round(self.ranking_accuracy, 4),
            "ranking_top1_hits": self.ranking_top1_hits,
            "ranking_days": self.ranking_days,
            "abnormal_days": self.abnormal_days,
        }


def _metrics_passed(m: Metrics, target: float = 0.85) -> bool:
    return (
        m.calm_accuracy >= target
        and m.spike_recall >= target
        and m.ranking_accuracy >= target
    )


def compute_metrics(snapshots: list[DaySnapshot]) -> Metrics:
    m = Metrics(eval_days=len(snapshots))
    for snap in snapshots:
        if snap.portfolio_calm:
            m.calm_days += 1
            if snap.all_engine_normal:
                m.calm_correct += 1
        if snap.verdict_level == "abnormal":
            m.abnormal_days += 1

        # Coin-level spike recall.
        for c in snap.coins:
            if c.true_spike:
                m.spike_coin_days += 1
                if c.dev.get("status") in ("mild", "abnormal"):
                    m.spike_detected += 1

        # Ranking: on portfolio spike days, does top attention match max |ret|×weight?
        if snap.portfolio_spike:
            m.ranking_days += 1
            by_ret = max(
                snap.coins,
                key=lambda c: abs(c.daily_return_pct or 0) * PORTFOLIO[c.symbol],
            )
            top = snap.coins[0]
            if top.symbol == by_ret.symbol:
                m.ranking_top1_hits += 1
    return m


def _avg_daily_return(snap: DaySnapshot) -> float:
    rets = [c.daily_return_pct for c in snap.coins if c.daily_return_pct is not None]
    return sum(rets) / len(rets) if rets else 0.0


def _coin_forward_return_pct(
    sym: str,
    day: date,
    horizon: int,
    by_sym_date: dict[str, dict[date, dict]],
) -> float | None:
    dates = sorted(by_sym_date[sym].keys())
    if day not in dates:
        return None
    idx = dates.index(day)
    if idx + horizon >= len(dates):
        return None
    c0 = by_sym_date[sym][dates[idx]]["close"]
    c1 = by_sym_date[sym][dates[idx + horizon]]["close"]
    if not c0:
        return None
    return (c1 - c0) / c0 * 100


def _portfolio_forward_return_pct(
    day: date,
    horizon: int,
    by_sym_date: dict[str, dict[date, dict]],
) -> float | None:
    """Weighted portfolio return from `day` close → `horizon` trading days later."""
    total_w = sum(PORTFOLIO.values())
    weighted = 0.0
    for sym, w in PORTFOLIO.items():
        r = _coin_forward_return_pct(sym, day, horizon, by_sym_date)
        if r is None:
            return None
        weighted += w * r
    return weighted / total_w


def _is_calm_on_down_alert(snap: DaySnapshot) -> bool:
    """Product-like calm alert: normal verdict while portfolio avg is down ≥2%."""
    return (
        snap.verdict_level == "normal"
        and snap.all_engine_normal
        and _avg_daily_return(snap) <= CALM_DOWN_AVG_PCT
    )


@dataclass
class AlertValueMetrics:
    forward_days: int = FORWARD_DAYS
    calm_on_down_days: int = 0
    calm_honest_7d: int = 0          # fwd portfolio > CALM_DISASTER_FWD_PCT
    calm_false_reassurance: int = 0  # fwd portfolio ≤ CALM_DISASTER_FWD_PCT
    false_panic_prevented: int = 0   # calm-on-down & fwd > 0 (panic sell would miss recovery)
    calm_recover_7d: int = 0         # calm-on-down & fwd > 0

    attention_abnormal_days: int = 0
    attention_abnormal_down_coins: int = 0
    attention_recover_7d: int = 0    # abnormal+down coin higher at +7d

    @property
    def calm_honest_rate(self) -> float:
        return self.calm_honest_7d / self.calm_on_down_days if self.calm_on_down_days else 0.0

    @property
    def false_panic_prevention_rate(self) -> float:
        """Share of calm-on-down days where holding beat panic-selling within 7d."""
        return self.false_panic_prevented / self.calm_on_down_days if self.calm_on_down_days else 0.0

    @property
    def attention_recover_rate(self) -> float:
        return (
            self.attention_recover_7d / self.attention_abnormal_down_coins
            if self.attention_abnormal_down_coins
            else 0.0
        )

    def to_dict(self) -> dict:
        return {
            "forward_days": self.forward_days,
            "calm_on_down_days": self.calm_on_down_days,
            "calm_honest_7d": self.calm_honest_7d,
            "calm_false_reassurance": self.calm_false_reassurance,
            "false_panic_prevented": self.false_panic_prevented,
            "calm_honest_rate": round(self.calm_honest_rate, 4),
            "false_panic_prevention_rate": round(self.false_panic_prevention_rate, 4),
            "attention_abnormal_days": self.attention_abnormal_days,
            "attention_abnormal_down_coins": self.attention_abnormal_down_coins,
            "attention_recover_7d": self.attention_recover_7d,
            "attention_recover_rate": round(self.attention_recover_rate, 4),
        }


def compute_alert_value(
    snapshots: list[DaySnapshot],
    by_sym_date: dict[str, dict[date, dict]],
    *,
    forward_days: int = FORWARD_DAYS,
) -> AlertValueMetrics:
    """Forward-looking value of calm vs attention alerts (layer 2 eval)."""
    av = AlertValueMetrics(forward_days=forward_days)
    for snap in snapshots:
        fwd = _portfolio_forward_return_pct(snap.day, forward_days, by_sym_date)
        if fwd is None:
            continue

        if _is_calm_on_down_alert(snap):
            av.calm_on_down_days += 1
            if fwd > CALM_DISASTER_FWD_PCT:
                av.calm_honest_7d += 1
            else:
                av.calm_false_reassurance += 1
            if fwd > 0:
                av.false_panic_prevented += 1
                av.calm_recover_7d += 1

        if snap.verdict_level == "abnormal":
            av.attention_abnormal_days += 1

        for c in snap.coins:
            if c.dev.get("status") != "abnormal" or c.dev.get("direction") != "down":
                continue
            if not triage.is_hero_abnormal(
                _coin_day_dict(c), weighted=True, n_coins=len(snap.coins)
            ):
                continue
            coin_fwd = _coin_forward_return_pct(c.symbol, snap.day, forward_days, by_sym_date)
            if coin_fwd is None:
                continue
            av.attention_abnormal_down_coins += 1
            if coin_fwd > 0:
                av.attention_recover_7d += 1

    return av


def _is_abnormal_up_signal(c: CoinDay, *, hero_only: bool = False, n_coins: int = 4) -> bool:
    if c.dev.get("direction") != "up":
        return False
    st = c.dev.get("status")
    if st not in ("mild", "abnormal"):
        return False
    if hero_only:
        return st == "abnormal" and triage.is_hero_abnormal(
            _coin_day_dict(c), weighted=True, n_coins=n_coins
        )
    return True


def _is_up_spike(c: CoinDay) -> bool:
    return c.true_spike and (c.daily_return_pct or 0) > 0


@dataclass
class AbnormalUpBuyMetrics:
    forward_days: int = FORWARD_DAYS
    # Buy at close on abnormal/mild + up signal day → forward return
    signal_coin_days: int = 0
    signal_wins: int = 0
    signal_avg_fwd_pct: float = 0.0
    signal_median_fwd_pct: float = 0.0
    abnormal_only_days: int = 0
    abnormal_only_wins: int = 0
    hero_abnormal_up_days: int = 0
    hero_abnormal_up_wins: int = 0
    # Baseline: buy every coin-day in eval window
    baseline_coin_days: int = 0
    baseline_wins: int = 0
    baseline_avg_fwd_pct: float = 0.0
    # Did abnormal-up appear on/before big up days?
    up_spike_days: int = 0
    up_spike_same_day_signal: int = 0
    up_spike_with_lead_signal: int = 0  # same day or within LEAD_LOOKBACK_DAYS prior

    @property
    def signal_win_rate(self) -> float:
        return self.signal_wins / self.signal_coin_days if self.signal_coin_days else 0.0

    @property
    def abnormal_only_win_rate(self) -> float:
        return self.abnormal_only_wins / self.abnormal_only_days if self.abnormal_only_days else 0.0

    @property
    def hero_abnormal_up_win_rate(self) -> float:
        return (
            self.hero_abnormal_up_wins / self.hero_abnormal_up_days
            if self.hero_abnormal_up_days
            else 0.0
        )

    @property
    def baseline_win_rate(self) -> float:
        return self.baseline_wins / self.baseline_coin_days if self.baseline_coin_days else 0.0

    @property
    def up_spike_same_day_rate(self) -> float:
        return self.up_spike_same_day_signal / self.up_spike_days if self.up_spike_days else 0.0

    @property
    def up_spike_lead_rate(self) -> float:
        return self.up_spike_with_lead_signal / self.up_spike_days if self.up_spike_days else 0.0

    def to_dict(self) -> dict:
        return {
            "forward_days": self.forward_days,
            "signal_coin_days": self.signal_coin_days,
            "signal_win_rate": round(self.signal_win_rate, 4),
            "signal_wins": self.signal_wins,
            "signal_avg_fwd_pct": round(self.signal_avg_fwd_pct, 3),
            "signal_median_fwd_pct": round(self.signal_median_fwd_pct, 3),
            "abnormal_only_days": self.abnormal_only_days,
            "abnormal_only_win_rate": round(self.abnormal_only_win_rate, 4),
            "hero_abnormal_up_days": self.hero_abnormal_up_days,
            "hero_abnormal_up_win_rate": round(self.hero_abnormal_up_win_rate, 4),
            "baseline_coin_days": self.baseline_coin_days,
            "baseline_win_rate": round(self.baseline_win_rate, 4),
            "baseline_avg_fwd_pct": round(self.baseline_avg_fwd_pct, 3),
            "up_spike_days": self.up_spike_days,
            "up_spike_same_day_rate": round(self.up_spike_same_day_rate, 4),
            "up_spike_lead_rate": round(self.up_spike_lead_rate, 4),
        }


def compute_abnormal_up_buy(
    snapshots: list[DaySnapshot],
    by_sym_date: dict[str, dict[date, dict]],
    *,
    forward_days: int = FORWARD_DAYS,
) -> AbnormalUpBuyMetrics:
    """Research counterfactual: buy at close on abnormal-up signal; measure forward return."""
    m = AbnormalUpBuyMetrics(forward_days=forward_days)
    by_day = {s.day: s for s in snapshots}

    signal_fwds: list[float] = []
    baseline_fwds: list[float] = []

    for snap in snapshots:
        n_coins = len(snap.coins)
        for c in snap.coins:
            fwd = _coin_forward_return_pct(c.symbol, snap.day, forward_days, by_sym_date)
            if fwd is None:
                continue

            baseline_fwds.append(fwd)
            m.baseline_coin_days += 1
            if fwd > 0:
                m.baseline_wins += 1

            if _is_abnormal_up_signal(c):
                signal_fwds.append(fwd)
                m.signal_coin_days += 1
                if fwd > 0:
                    m.signal_wins += 1

            if c.dev.get("status") == "abnormal" and c.dev.get("direction") == "up":
                m.abnormal_only_days += 1
                if fwd > 0:
                    m.abnormal_only_wins += 1

            if _is_abnormal_up_signal(c, hero_only=True, n_coins=n_coins):
                m.hero_abnormal_up_days += 1
                if fwd > 0:
                    m.hero_abnormal_up_wins += 1

            if not _is_up_spike(c):
                continue
            m.up_spike_days += 1
            same = _is_abnormal_up_signal(c, n_coins=n_coins)
            if same:
                m.up_spike_same_day_signal += 1
            lead = same
            if not lead:
                for lag in range(1, LEAD_LOOKBACK_DAYS + 1):
                    prev = by_day.get(snap.day - timedelta(days=lag))
                    if not prev:
                        continue
                    pc = next((x for x in prev.coins if x.symbol == c.symbol), None)
                    if pc and _is_abnormal_up_signal(pc, n_coins=len(prev.coins)):
                        lead = True
                        break
            if lead:
                m.up_spike_with_lead_signal += 1

    if signal_fwds:
        m.signal_avg_fwd_pct = sum(signal_fwds) / len(signal_fwds)
        m.signal_median_fwd_pct = sorted(signal_fwds)[len(signal_fwds) // 2]
    if baseline_fwds:
        m.baseline_avg_fwd_pct = sum(baseline_fwds) / len(baseline_fwds)

    return m


@dataclass
class PanicResult:
    hold_final: float
    panic_final: float
    hold_return_pct: float
    panic_return_pct: float
    panic_sells: int
    false_alarms: int  # sold then price higher within 30d

    def to_dict(self) -> dict:
        return {
            "hold_final_usd": self.hold_final,
            "hold_return_pct": self.hold_return_pct,
            "panic_final_usd": self.panic_final,
            "panic_return_pct": self.panic_return_pct,
            "panic_sells": self.panic_sells,
            "false_alarms_30d": self.false_alarms,
        }


def _load_tuning_log() -> dict:
    if TUNING_LOG_PATH.is_file():
        with TUNING_LOG_PATH.open(encoding="utf-8") as f:
            return json.load(f)
    return {
        "schema_version": 1,
        "description": "Deviation z-threshold tuning history — each round = one backtest run or sweep.",
        "targets": {"calm_accuracy": 0.85, "spike_recall": 0.85, "ranking_accuracy": 0.85},
        "production": {},
        "rounds": [],
    }


def _next_round_id(log: dict) -> str:
    n = len(log.get("rounds", [])) + 1
    return f"round-{n:03d}"


def append_tuning_round(
    *,
    kind: str,
    label: str,
    mild_z: float | None,
    abnormal_z: float | None,
    start: date,
    end: date,
    metrics: Metrics,
    panic: PanicResult | None = None,
    alert_value: AlertValueMetrics | None = None,
    abnormal_up_buy: AbnormalUpBuyMetrics | None = None,
    passed: bool,
    notes: str = "",
    candidates: list[dict] | None = None,
) -> str:
    """Append one entry to eval/tuning_log.json; returns new round id."""
    log = _load_tuning_log()
    round_id = _next_round_id(log)
    entry: dict = {
        "id": round_id,
        "run_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "kind": kind,
        "label": label,
        "mild_z": mild_z if mild_z is not None else heat_mod.DEV_MILD_Z,
        "abnormal_z": abnormal_z if abnormal_z is not None else heat_mod.DEV_ABNORMAL_Z,
        "window": {"start": start.isoformat(), "end": end.isoformat()},
        "portfolio": dict(PORTFOLIO),
        "metrics": metrics.to_dict(),
        "passed": passed,
    }
    if panic is not None:
        entry["panic"] = panic.to_dict()
    if alert_value is not None:
        entry["alert_value"] = alert_value.to_dict()
    if abnormal_up_buy is not None:
        entry["abnormal_up_buy"] = abnormal_up_buy.to_dict()
    if notes:
        entry["notes"] = notes
    if candidates:
        entry["candidates"] = candidates
    log.setdefault("rounds", []).append(entry)
    with TUNING_LOG_PATH.open("w", encoding="utf-8") as f:
        json.dump(log, f, indent=2, ensure_ascii=False)
        f.write("\n")
    return round_id


def simulate_panic(
    snapshots: list[DaySnapshot],
    by_sym_date: dict[str, dict[date, dict]],
) -> PanicResult:
    """Hold vs panic-sell 100% on abnormal+down, no rebuy (capitulation model)."""
    if not snapshots:
        return PanicResult(0, 0, 0, 0, 0, 0)

    first = snapshots[0].day
    prices: dict[str, float] = {}
    for sym in PORTFOLIO:
        prices[sym] = by_sym_date[sym][first]["close"]

    hold_units = {sym: INITIAL_CAPITAL * (w / 100) / prices[sym] for sym, w in PORTFOLIO.items()}
    panic_units = dict(hold_units)
    panic_cash = 0.0
    sold: dict[str, date] = {}  # sym → sell date
    panic_sells = 0
    false_alarms = 0

    snap_by_day = {s.day: s for s in snapshots}
    all_days = sorted(d for sym in PORTFOLIO for d in by_sym_date[sym].keys() if d >= first)

    for d in all_days:
        for sym in PORTFOLIO:
            if d not in by_sym_date[sym]:
                continue
            close = by_sym_date[sym][d]["close"]
            snap = snap_by_day.get(d)
            if snap:
                coin = next(c for c in snap.coins if c.symbol == sym)
                payload = _coin_day_dict(coin)
                if (
                    sym in panic_units
                    and coin.dev.get("status") == "abnormal"
                    and coin.dev.get("direction") == "down"
                    and triage.is_hero_abnormal(
                        payload, weighted=True, n_coins=len(snap.coins)
                    )
                ):
                    panic_cash += panic_units[sym] * close
                    del panic_units[sym]
                    sold[sym] = d
                    panic_sells += 1

        # False alarm check at 30d mark for recent sells.
        for sym, sell_day in list(sold.items()):
            if (d - sell_day).days != PANIC_COOLDOWN_DAYS:
                continue
            if sym not in by_sym_date or sell_day not in by_sym_date[sym]:
                continue
            sell_px = by_sym_date[sym][sell_day]["close"]
            now_px = by_sym_date[sym][d]["close"]
            if now_px > sell_px:
                false_alarms += 1
            del sold[sym]

    last = all_days[-1]
    hold_final = sum(hold_units[sym] * by_sym_date[sym][last]["close"] for sym in hold_units)
    panic_final = panic_cash + sum(
        panic_units[sym] * by_sym_date[sym][last]["close"] for sym in panic_units
    )
    return PanicResult(
        hold_final=round(hold_final, 2),
        panic_final=round(panic_final, 2),
        hold_return_pct=round((hold_final / INITIAL_CAPITAL - 1) * 100, 2),
        panic_return_pct=round((panic_final / INITIAL_CAPITAL - 1) * 100, 2),
        panic_sells=panic_sells,
        false_alarms=false_alarms,
    )


def _down_attention(snap: DaySnapshot) -> float:
    """Attention concentrated in abnormal-DOWN coins (the panic scenario)."""
    return sum(
        c.attention_score
        for c in snap.coins
        if c.dev.get("status") == "abnormal" and c.dev.get("direction") == "down"
    )


def pick_interview_days(snapshots: list[DaySnapshot], n: int = 5) -> list[DaySnapshot]:
    """Spread abnormal days across time, guaranteeing ≥1 abnormal-DOWN scenario.

    The product's core job is calming a worried holder when prices DROP, so the
    study must include the panic case. Pure attention×spread can land entirely on
    up-swings (e.g. 2022-02 BTC↑, 2023-07 XRP↑); we seed the strongest down-crash
    day explicitly so Luna/FTX-style drops are always exercised.
    """
    abnormal = [s for s in snapshots if s.verdict_level == "abnormal"]
    if not abnormal:
        return []
    if len(abnormal) <= n:
        return abnormal

    # Seed with strongest overall day, then the strongest abnormal-DOWN day.
    picked: list[DaySnapshot] = [max(abnormal, key=lambda s: sum(c.attention_score for c in s.coins))]
    down_days = [s for s in abnormal if _down_attention(s) > 0 and s not in picked]
    if down_days and _down_attention(picked[0]) == 0:
        picked.append(max(down_days, key=_down_attention))
    pool = [s for s in abnormal if s not in picked]
    while len(picked) < n and pool:
        def score(s: DaySnapshot) -> float:
            days_dist = min(abs((s.day - p.day).days) for p in picked)
            n_abn = sum(1 for c in s.coins if c.dev.get("status") == "abnormal")
            return days_dist * 10 + n_abn

        best = max(pool, key=score)
        picked.append(best)
        pool.remove(best)
    return sorted(picked, key=lambda s: s.day)


def pick_calm_controls(snapshots: list[DaySnapshot], n: int = 2) -> list[DaySnapshot]:
    """Calm days where market down avg >2% but engine says normal."""
    candidates = []
    for s in snapshots:
        if not s.portfolio_calm or not s.all_engine_normal:
            continue
        rets = [c.daily_return_pct for c in s.coins if c.daily_return_pct is not None]
        if not rets:
            continue
        avg = sum(rets) / len(rets)
        if avg < -2.0:
            candidates.append(s)
    return sorted(candidates, key=lambda s: s.day)[:: max(1, len(candidates) // n)][:n]


def print_sanity_checks(snapshots: list[DaySnapshot], start: date, end: date) -> None:
    by_day = {s.day: s for s in snapshots}
    print("\n── Sanity dates (curated) ──")
    for ds, label in sorted(SANITY_DATES.items()):
        d = date.fromisoformat(ds)
        if d < start or d > end:
            print(f"  {ds}  ({label})  — outside window")
            continue
        snap = by_day.get(d)
        if not snap:
            print(f"  {ds}  ({label})  — no data")
            continue
        flags = [
            f"{c.symbol}:{c.dev.get('status')}{c.dev.get('direction', '')[:1].upper()}"
            for c in snap.coins
            if c.dev.get("status") != "normal"
        ]
        flag_txt = ", ".join(flags) if flags else "all normal"
        print(f"  {ds}  ({label})  verdict={snap.verdict_level}  [{flag_txt}]")


def print_interview_days(snapshots: list[DaySnapshot]) -> None:
    picks = pick_interview_days(snapshots)
    controls = pick_calm_controls(snapshots)
    print("\n── Interview days (≥1 abnormal) ──")
    for s in picks:
        abn = [c for c in s.coins if c.dev.get("status") == "abnormal"]
        syms = ", ".join(
            f"{c.symbol}{'↓' if c.dev.get('direction') == 'down' else '↑' if c.dev.get('direction') == 'up' else ''}"
            f" z={c.dev.get('z')}"
            for c in abn
        )
        print(f"  {s.day}  verdict={s.verdict_level}  abnormal: [{syms}]")
    print("\n── Calm control days (down >2% avg, engine normal) ──")
    for s in controls:
        avg = sum(c.daily_return_pct or 0 for c in s.coins) / len(s.coins)
        print(f"  {s.day}  avg_return={avg:.1f}%  verdict={s.verdict_level}")


def _pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def sweep_thresholds(
    eval_dates: list[date],
    by_sym_date: dict[str, dict[date, dict]],
    spike_threshold: dict[str, float],
    target: float = 0.85,
) -> list[tuple[float, float, Metrics]]:
    """Grid search mild_z × abnormal_z; return combos meeting all targets."""
    results: list[tuple[float, float, Metrics]] = []
    mild_grid = [round(x * 0.25, 2) for x in range(2, 25)]  # 0.5 .. 6.0
    for abnormal_z in [round(x * 0.25, 2) for x in range(4, 33)]:  # 1.0 .. 8.0
        for mild_z in mild_grid:
            if mild_z >= abnormal_z:
                continue
            snaps = simulate_days(
                eval_dates, by_sym_date, spike_threshold,
                mild_z=mild_z, abnormal_z=abnormal_z,
            )
            m = compute_metrics(snaps)
            if (
                m.calm_accuracy >= target
                and m.spike_recall >= target
                and m.ranking_accuracy >= target
            ):
                results.append((mild_z, abnormal_z, m))
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="CryptoLens deviation backtest")
    parser.add_argument("--start", default=DEFAULT_START.isoformat(), help="eval start (YYYY-MM-DD)")
    parser.add_argument("--end", default=date.today().isoformat(), help="eval end (YYYY-MM-DD)")
    parser.add_argument("--list-interview-days", action="store_true", help="print interview calendar only")
    parser.add_argument("--sweep", action="store_true", help="grid-search z thresholds for >=85%% on all metrics")
    parser.add_argument("--mild-z", type=float, default=None, help="override DEV_MILD_Z")
    parser.add_argument("--abnormal-z", type=float, default=None, help="override DEV_ABNORMAL_Z")
    parser.add_argument("--label", default="", help="note for tuning_log.json entry")
    parser.add_argument("--no-log", action="store_true", help="skip append to eval/tuning_log.json")
    args = parser.parse_args()

    start = date.fromisoformat(args.start)
    end = date.fromisoformat(args.end)
    print(f"CryptoLens deviation backtest  {start} → {end}")
    print(f"Portfolio: {', '.join(f'{s} {w:.0f}%' for s, w in PORTFOLIO.items())}")
    print(f"Warmup: {WARMUP_DAYS}d · spike ground truth: top {SPIKE_PERCENTILE:.0f}% |return|\n")

    print("Fetching Binance daily candles…")
    eval_dates, by_sym_date, spike_threshold = build_series(start, end)
    for sym, th in spike_threshold.items():
        print(f"  {sym} spike threshold (p{SPIKE_PERCENTILE:.0f}): {th:.2f}%/day")

    snapshots = simulate_days(
        eval_dates, by_sym_date, spike_threshold,
        mild_z=args.mild_z, abnormal_z=args.abnormal_z,
    )
    if not snapshots:
        raise SystemExit("No evaluation snapshots — check date range / network.")

    if args.sweep:
        print("\n── Threshold sweep (target ≥85% all metrics) ──")
        hits = sweep_thresholds(eval_dates, by_sym_date, spike_threshold)
        best: tuple[float, float, Metrics] | None = None
        if not hits:
            print("  No combo hit all three ≥85%. Showing best by min metric:\n")
            best_min = 0.0
            for abnormal_z in [round(x * 0.25, 2) for x in range(4, 33)]:
                for mild_z in [round(x * 0.25, 2) for x in range(2, 25)]:
                    if mild_z >= abnormal_z:
                        continue
                    snaps = simulate_days(
                        eval_dates, by_sym_date, spike_threshold,
                        mild_z=mild_z, abnormal_z=abnormal_z,
                    )
                    m = compute_metrics(snaps)
                    mn = min(m.calm_accuracy, m.spike_recall, m.ranking_accuracy)
                    if mn > best_min:
                        best_min = mn
                        best = (mild_z, abnormal_z, m)
            if best:
                mz, az, m = best
                print(f"  best min-metric: mild_z={mz} abnormal_z={az}")
                print(f"    calm={_pct(m.calm_accuracy)} spike={_pct(m.spike_recall)} rank={_pct(m.ranking_accuracy)}")
        else:
            hits.sort(key=lambda t: (t[0], t[1]))
            print(f"  {len(hits)} combos pass. Top 5 (lowest mild_z first):\n")
            for mz, az, m in hits[:5]:
                print(
                    f"  mild_z={mz:.2f} abnormal_z={az:.2f}  "
                    f"calm={_pct(m.calm_accuracy)} spike={_pct(m.spike_recall)} rank={_pct(m.ranking_accuracy)}"
                )
        if not args.no_log:
            rid: str | None = None
            if hits:
                best_mz, best_az, best_m = hits[0]
                candidates = [
                    {"mild_z": mz, "abnormal_z": az, "metrics": m.to_dict(), "passed": True}
                    for mz, az, m in hits[:10]
                ]
                rid = append_tuning_round(
                    kind="sweep",
                    label=args.label or f"sweep — {len(hits)} combos pass",
                    mild_z=best_mz,
                    abnormal_z=best_az,
                    start=start,
                    end=end,
                    metrics=best_m,
                    passed=True,
                    notes=f"Top passing combo (lowest mild_z). {len(hits)} total pass.",
                    candidates=candidates,
                )
            elif best:
                mz, az, m = best
                rid = append_tuning_round(
                    kind="sweep",
                    label=args.label or "sweep — no full pass",
                    mild_z=mz,
                    abnormal_z=az,
                    start=start,
                    end=end,
                    metrics=m,
                    passed=_metrics_passed(m),
                    notes="No combo hit all three >=85%; logged best min-metric combo.",
                )
            if rid:
                print(f"\nLogged → eval/tuning_log.json ({rid})")
        sys.exit(0)

    if args.mild_z is not None or args.abnormal_z is not None:
        print(f"Thresholds: mild_z={args.mild_z} abnormal_z={args.abnormal_z}\n")

    metrics = compute_metrics(snapshots)
    alert_value = compute_alert_value(snapshots, by_sym_date)
    abnormal_up = compute_abnormal_up_buy(snapshots, by_sym_date)
    panic = simulate_panic(snapshots, by_sym_date)

    print(f"\n── A) Signal quality ({metrics.eval_days} eval days) ──")
    print(f"  Calm-day accuracy (all normal on quiet days):  {_pct(metrics.calm_accuracy)}  "
          f"({metrics.calm_correct}/{metrics.calm_days})  target ≥85%")
    print(f"  Spike recall (coin-days top-{SPIKE_PERCENTILE:.0f}% → mild/abnormal):  "
          f"{_pct(metrics.spike_recall)}  ({metrics.spike_detected}/{metrics.spike_coin_days})  target ≥85%")
    print(f"  Ranking top-1 (spike days, |ret|×weight):     {_pct(metrics.ranking_accuracy)}  "
          f"({metrics.ranking_top1_hits}/{metrics.ranking_days})  target ≥85%")
    print(f"  Days with portfolio verdict abnormal:         {metrics.abnormal_days}")
    raw_abn = sum(
        1 for s in snapshots
        if any(c.dev.get("status") == "abnormal" for c in s.coins)
    )
    print(f"  Days with any raw abnormal (pre-gate):      {raw_abn}")

    print("\n── B) Panic counterfactual (abnormal+down → sell 100%, no rebuy) ──")
    print(f"  Hold final:   ${panic.hold_final:,.2f}  ({panic.hold_return_pct:+.1f}%)")
    print(f"  Panic final:  ${panic.panic_final:,.2f}  ({panic.panic_return_pct:+.1f}%)")
    print(f"  Panic sells:  {panic.panic_sells}  ·  false alarms (recover within 30d): {panic.false_alarms}")
    print("  (Research sim — NOT product advice; measures cost of panic without context.)")

    print(f"\n── C) Alert value (forward {FORWARD_DAYS}d) ──")
    print(f"  Calm alert (normal verdict · avg day ≤{CALM_DOWN_AVG_PCT:.0f}%):  "
          f"{alert_value.calm_on_down_days} days")
    print(f"  Calm honest (portfolio 7d > {CALM_DISASTER_FWD_PCT:.0f}%):       "
          f"{_pct(alert_value.calm_honest_rate)}  "
          f"({alert_value.calm_honest_7d}/{alert_value.calm_on_down_days})  target ≥80%")
    print(f"  False panic prevented (7d fwd > 0%):          "
          f"{_pct(alert_value.false_panic_prevention_rate)}  "
          f"({alert_value.false_panic_prevented}/{alert_value.calm_on_down_days})")
    print(f"  False reassurance (7d fwd ≤ {CALM_DISASTER_FWD_PCT:.0f}%):       "
          f"{alert_value.calm_false_reassurance} days")
    print(f"  Attention hero abnormal+down → recovers 7d:  "
          f"{_pct(alert_value.attention_recover_rate)}  "
          f"({alert_value.attention_recover_7d}/{alert_value.attention_abnormal_down_coins})  "
          f"(hero-gated |z|×weight≥{triage.HERO_ATTENTION_MIN:.0f})")
    print("  (Calm = 'ไม่ต้องห่วง' on down days · Attention = abnormal+down coin context.)")

    print(f"\n── E) Abnormal-up buy counterfactual (forward {FORWARD_DAYS}d) ──")
    print(f"  Signal mild/abnormal+↑ → buy at close:     "
          f"win {_pct(abnormal_up.signal_win_rate)}  "
          f"({abnormal_up.signal_wins}/{abnormal_up.signal_coin_days})  "
          f"avg {abnormal_up.signal_avg_fwd_pct:+.2f}%  "
          f"med {abnormal_up.signal_median_fwd_pct:+.2f}%")
    print(f"  Abnormal-only+↑:                           "
          f"win {_pct(abnormal_up.abnormal_only_win_rate)}  "
          f"({abnormal_up.abnormal_only_wins}/{abnormal_up.abnormal_only_days})")
    print(f"  Hero abnormal+↑ (|z|×weight≥{triage.HERO_ATTENTION_MIN:.0f}):  "
          f"win {_pct(abnormal_up.hero_abnormal_up_win_rate)}  "
          f"({abnormal_up.hero_abnormal_up_wins}/{abnormal_up.hero_abnormal_up_days})")
    print(f"  Baseline (buy every coin-day):               "
          f"win {_pct(abnormal_up.baseline_win_rate)}  "
          f"({abnormal_up.baseline_wins}/{abnormal_up.baseline_coin_days})  "
          f"avg {abnormal_up.baseline_avg_fwd_pct:+.2f}%")
    print(f"  Big up days (top-{SPIKE_PERCENTILE:.0f}% daily ↑):  {abnormal_up.up_spike_days}")
    print(f"    had abnormal/mild+↑ same day:              "
          f"{_pct(abnormal_up.up_spike_same_day_rate)}  "
          f"({abnormal_up.up_spike_same_day_signal}/{abnormal_up.up_spike_days})")
    print(f"    had signal same day or ≤{LEAD_LOOKBACK_DAYS}d before:  "
          f"{_pct(abnormal_up.up_spike_lead_rate)}  "
          f"({abnormal_up.up_spike_with_lead_signal}/{abnormal_up.up_spike_days})")
    print("  (Research sim — NOT buy advice; tests if abnormal-up precedes/profits from up moves.)")

    print_sanity_checks(snapshots, start, end)

    if args.list_interview_days:
        print_interview_days(snapshots)
        print("\nNext: python -m eval.interview_pack  → interview_pack.html")
    else:
        print("\nTip: --list-interview-days then python -m eval.interview_pack for study B.")

    # Exit non-zero if below targets (soft gate for CI).
    ok = (
        metrics.calm_accuracy >= 0.85
        and metrics.spike_recall >= 0.85
        and metrics.ranking_accuracy >= 0.85
        and alert_value.calm_honest_rate >= FALSE_PANIC_PREVENT_TARGET
    )
    if not args.no_log:
        mild = args.mild_z if args.mild_z is not None else heat_mod.DEV_MILD_Z
        abn = args.abnormal_z if args.abnormal_z is not None else heat_mod.DEV_ABNORMAL_Z
        rid = append_tuning_round(
            kind="run",
            label=args.label or "backtest run",
            mild_z=mild,
            abnormal_z=abn,
            start=start,
            end=end,
            metrics=metrics,
            panic=panic,
            alert_value=alert_value,
            abnormal_up_buy=abnormal_up,
            passed=ok,
        )
        print(f"\nLogged → eval/tuning_log.json ({rid})")
    if not ok:
        print("\n⚠ Below target thresholds — review before qualitative study (B).")
        if alert_value.calm_honest_rate < FALSE_PANIC_PREVENT_TARGET:
            print(f"   Alert value: calm honest {_pct(alert_value.calm_honest_rate)} < {_pct(FALSE_PANIC_PREVENT_TARGET)}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
