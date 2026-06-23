"""Portfolio triage verdict — shared by digest, backtest, and interview pack.

False-alarm reductions (2026-06):
  - Hero abnormal only when |z| × weight ≥ HERO_ATTENTION_MIN
  - Mild never elevates to hero (stays in body chips)
  - Macro mode when ≥75% coins abnormal same direction
  - Calmer copy on market-wide down days still inside bands
"""

from __future__ import annotations

# |z| × weight_pct — e.g. 20% × z=2.0 = 40. Filters low-impact abnormal from hero.
HERO_ATTENTION_MIN = 40.0
MACRO_ABNORMAL_RATIO = 0.75
MARKET_DOWN_AVG_PCT = -2.0


def attention_score(coin: dict, *, weighted: bool, n_coins: int) -> float:
    dev = coin.get("deviation") or {}
    z = abs(dev.get("z") or 0.0)
    w = coin.get("weight_pct")
    if weighted and w is not None:
        return z * float(w)
    return z * (100.0 / max(n_coins, 1))


def is_hero_abnormal(coin: dict, *, weighted: bool, n_coins: int) -> bool:
    if (coin.get("deviation") or {}).get("status") != "abnormal":
        return False
    return attention_score(coin, weighted=weighted, n_coins=n_coins) >= HERO_ATTENTION_MIN


def hero_abnormal_coins(coins: list[dict], weighted: bool) -> list[dict]:
    n = len(coins)
    return [c for c in coins if is_hero_abnormal(c, weighted=weighted, n_coins=n)]


def is_macro_abnormal(coins: list[dict]) -> bool:
    """True when most coins are abnormal in the same direction (market-wide move)."""
    if not coins:
        return False
    abnormal = [c for c in coins if (c.get("deviation") or {}).get("status") == "abnormal"]
    if len(abnormal) < len(coins) * MACRO_ABNORMAL_RATIO:
        return False
    dirs = {(c.get("deviation") or {}).get("direction") for c in abnormal}
    dirs.discard("flat")
    return len(dirs) <= 1


def _market_direction(coins: list[dict]) -> str:
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


def _avg_change(coins: list[dict]) -> float:
    return sum(c.get("change_24h_pct", 0) for c in coins) / len(coins) if coins else 0.0


def _abnormal_narrative(hero: list[dict], macro: bool, direction: str) -> str:
    if macro:
        move = "ลง" if direction == "down" else "ขึ้น" if direction == "up" else "แกว่ง"
        return (
            f"ทุกเหรียญขยับผิดกรอบปกติพร้อมกัน ({move}ทั้งก้อน) — "
            "เป็นเหตุตลาดร่วม ไม่ใช่แค่เหรียญเดียว · ไม่ใช่คำแนะนำให้ขาย"
        )
    downs = [c for c in hero if (c.get("deviation") or {}).get("direction") == "down"]
    if downs:
        return (
            "เหรียญที่ highlight ลงแรงสำหรับตัวมันเอง — "
            "ไม่ใช่คำแนะนำให้ขาย · ดูรายละเอียดด้านล่าง"
        )
    return "เหรียญที่ highlight ขยับผิดกรอบปกติของตัวเอง — ดูรายละเอียดด้านล่าง"


def portfolio_verdict(coins: list[dict], weighted: bool) -> tuple[str, str, str, str]:
    """Returns (verdict, narrative, level, direction). Level is hero level only."""
    scope = "พอร์ตคุณ" if weighted else "ตลาดวันนี้"
    direction = _market_direction(coins)
    avg = _avg_change(coins)
    hero = hero_abnormal_coins(coins, weighted)
    macro = bool(hero) and is_macro_abnormal(coins)

    if hero:
        if macro:
            move = "ลง" if direction == "down" else "ขึ้น" if direction == "up" else "แกว่ง"
            verdict = f"{scope}ผิดปกติร่วม — {move}ทั้งก้อน"
        else:
            syms = ", ".join(c["symbol"] for c in hero[:3])
            prefix = "พอร์ตคุณมี" if weighted else "มี"
            verdict = f"{prefix} {len(hero)} เหรียญควรดู — {syms}"
        narrative = _abnormal_narrative(hero, macro, direction)
        return verdict, narrative, "abnormal", direction

    # Mild stays in body only — hero uses calm-style message.
    if direction == "down":
        if avg <= MARKET_DOWN_AVG_PCT:
            verdict = f"{scope}ลงร่วมตลาด · ยังไม่ผิดปกติเทียบกรอบแต่ละเหรียญ"
            narrative = (
                f"เฉลี่ยลง {avg:.1f}% (24h) — ยังอยู่ในกรอบปกติ 30 วัน · ไม่ต้องรีบทำอะไร"
            )
        else:
            verdict = f"{scope}ลงแต่ยังอยู่ในกรอบปกติ — ไม่ต้องห่วง"
            narrative = (
                f"ทุกเหรียญลงเฉลี่ย {avg:.1f}% (24h) "
                f"แต่ยังอยู่ในกรอบปกติ 30 วัน — ไม่ใช่การขยับผิดปกติ"
            )
        return verdict, narrative, "normal", direction

    if direction == "up":
        verdict = f"{scope}ขึ้นและยังอยู่ในกรอบปกติ — ไม่ต้องห่วง"
        narrative = f"เหรียญหลักขึ้นเฉลี่ย {avg:+.1f}% (24h) และยังอยู่ในกรอบปกติ 30 วัน"
        return verdict, narrative, "normal", direction

    if direction == "mixed":
        verdict = f"{scope}ผสม — ยังอยู่ในกรอบปกติ"
        narrative = f"{', '.join(c['symbol'] for c in coins)} ยังเคลื่อนไหวอยู่ในกรอบปกติ 30 วัน"
        return verdict, narrative, "normal", direction

    verdict = f"{scope}ปกติ — ไม่ต้องห่วง"
    narrative = f"{', '.join(c['symbol'] for c in coins)} ยังเคลื่อนไหวอยู่ในกรอบปกติ 30 วัน"
    return verdict, narrative, "normal", direction


def coin_sort_key(coin: dict, *, weighted: bool, n_coins: int) -> tuple:
    status_rank = {"abnormal": 2, "mild": 1, "normal": 0}
    dev = coin.get("deviation") or {}
    status = dev.get("status", "normal")
    rank = status_rank.get(status, 0)
    if status == "abnormal" and not is_hero_abnormal(coin, weighted=weighted, n_coins=n_coins):
        rank = 1  # demoted abnormal → sort with mild, not hero
    return (rank, attention_score(coin, weighted=weighted, n_coins=n_coins), coin.get("weight_pct") or 0)
