"""Generate qualitative study (B) materials from backtest interview days.

Replays deterministic digest (hero + body) as the product would show on each
historical date — no LLM, uses same _verdict_fallback as production fallback.

Outputs:
  eval/interview_pack.json   — scenarios + questions + empty response slots
  eval/interview_pack.html   — printable cards for participants

Run from backend/:
    python -m eval.interview_pack
    python -m eval.interview_pack --record responses.json   # merge filled responses
"""

from __future__ import annotations

import argparse
import html
import json
import os
import sys
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import ai  # noqa: E402

from eval.backtest_deviation import (  # noqa: E402
    DEFAULT_START,
    PORTFOLIO,
    DaySnapshot,
    build_series,
    pick_calm_controls,
    pick_interview_days,
    simulate_days,
)

PACK_JSON = Path(__file__).with_name("interview_pack.json")
PACK_HTML = Path(__file__).with_name("interview_pack.html")

QUESTIONS = [
    {
        "id": "q1_match",
        "text": "one-liner ตรงกับที่คุณรู้สึกว่าวันนั้นพอร์ตเป็นไง?",
        "type": "yes_no",
        "pass": "yes",
    },
    {
        "id": "q2_understand",
        "text": "เข้าใจว่าทำไมเหรียญที่ highlight ถูกเน้น?",
        "type": "yes_no",
        "pass": "yes",
    },
    {
        "id": "q3_anxiety",
        "text": "หลังอ่านแล้วระดับกังวล (1=เพิ่มมาก · 3=เท่าเดิม · 5=ลดมาก)",
        "type": "scale_1_5",
        "pass_at_least": 3,
    },
]

PASS_CRITERIA = {
    "min_participants": 5,
    "q2_yes_ratio": 0.8,
    "q3_at_least_3_ratio": 0.6,
    "notes": "≥4/5 เข้าใจ (q2) และ ≥3/5 กังวลลดหรือเท่าเดิม (q3 ≥3)",
}


def _body_line(symbol: str, dev: dict, weight: float) -> str | None:
    status = dev.get("status")
    if status not in ("mild", "abnormal"):
        return None
    label = "ผิดปกติชัด" if status == "abnormal" else "เริ่มผิดปกติ"
    z = dev.get("z")
    mult = f"{abs(z):.1f}" if z is not None else "?"
    ret = dev.get("today_return_pct")
    ret_s = f"{ret:+.1f}%" if ret is not None else "—"
    extra = ""
    if status == "abnormal" and dev.get("direction") == "down":
        extra = " · ไม่ใช่คำแนะนำให้ขาย"
    return f"{symbol} — {label} ~{mult}× สวิงปกติ ({ret_s}) · {weight:.0f}% ของพอร์ต{extra}"


def snapshot_to_scenario(snap: DaySnapshot, kind: str) -> dict:
    """Build one interview scenario from a walk-forward day snapshot."""
    coins_payload: list[dict] = []
    for c in snap.coins:
        sym = c.symbol
        weight = PORTFOLIO[sym]
        coins_payload.append(
            {
                "symbol": sym,
                "price": None,
                "change_24h_pct": c.daily_return_pct or 0.0,
                "weight_pct": weight,
                "deviation": c.dev,
            }
        )

    verdict, narrative, level, direction = ai._verdict_fallback(coins_payload, weighted=True)
    body = []
    for c in snap.coins:
        line = _body_line(c.symbol, c.dev, PORTFOLIO[c.symbol])
        if line:
            body.append(
                {
                    "symbol": c.symbol,
                    "line": line,
                    "weight_pct": PORTFOLIO[c.symbol],
                    "deviation": c.dev,
                }
            )

    return {
        "id": f"{kind}-{snap.day.isoformat()}",
        "kind": kind,
        "date": snap.day.isoformat(),
        "hero": verdict,
        "narrative": narrative,
        "verdict_level": level,
        "market_direction": direction,
        "body": body,
        "responses": [],
    }


def build_pack(start: date, end: date) -> dict:
    eval_dates, by_sym_date, spike_threshold = build_series(start, end)
    snapshots = simulate_days(eval_dates, by_sym_date, spike_threshold)
    abnormal_days = pick_interview_days(snapshots, n=5)
    calm_days = pick_calm_controls(snapshots, n=2)

    scenarios = [snapshot_to_scenario(s, "abnormal") for s in abnormal_days]
    scenarios += [snapshot_to_scenario(s, "calm_control") for s in calm_days]

    return {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "study": "B qualitative — portfolio triage comprehension",
        "window": {"start": start.isoformat(), "end": end.isoformat()},
        "portfolio": dict(PORTFOLIO),
        "questions": QUESTIONS,
        "pass_criteria": PASS_CRITERIA,
        "scenarios": scenarios,
    }


def _render_html(pack: dict) -> str:
    cards = []
    for i, sc in enumerate(pack["scenarios"], 1):
        body_rows = "".join(
            f'<li class="body-row"><strong>{html.escape(r["symbol"])}</strong> '
            f'<span class="muted">{html.escape(r["line"])}</span></li>'
            for r in sc["body"]
        ) or '<li class="muted">— ไม่มีเหรียญที่ต้อง highlight —</li>'
        narrative = sc.get("narrative") or ""
        nav = f'<p class="narrative">{html.escape(narrative)}</p>' if narrative else ""
        kind_label = "วันผิดปกติ" if sc["kind"] == "abnormal" else "วันเงียบ (control)"
        badge_cls = "badge" if sc["kind"] == "abnormal" else "badge calm"
        cards.append(
            f"""
            <article class="card" id="{html.escape(sc["id"])}">
              <header>
                <span class="{badge_cls}">{kind_label}</span>
                <span class="date">{html.escape(sc["date"])}</span>
                <span class="num">Scenario {i}/{len(pack["scenarios"])}</span>
              </header>
              <p class="hero">{html.escape(sc["hero"])}</p>
              {nav}
              <ul class="body">{body_rows}</ul>
              <section class="questions">
                <h3>คำถามหลังแสดงการ์ดนี้</h3>
                <ol>
                  <li>{html.escape(QUESTIONS[0]["text"])} <em>(ใช่/ไม่)</em></li>
                  <li>{html.escape(QUESTIONS[1]["text"])} <em>(ใช่/ไม่)</em></li>
                  <li>{html.escape(QUESTIONS[2]["text"])} <em>(1–5)</em></li>
                </ol>
              </section>
            </article>
            """
        )

    portfolio = ", ".join(f"{s} {w:.0f}%" for s, w in pack["portfolio"].items())
    return f"""<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>CryptoLens Interview Pack</title>
  <style>
    :root {{ font-family: system-ui, sans-serif; color: #111; background: #f6f6f4; }}
    body {{ max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }}
    h1 {{ font-size: 1.25rem; margin-bottom: 4px; }}
    .meta {{ color: #666; font-size: 0.85rem; margin-bottom: 24px; }}
    .card {{
      background: #fff; border: 1px solid #ddd; border-radius: 16px;
      padding: 20px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.06);
    }}
    header {{ display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }}
    .badge {{ background: #fef3c7; color: #92400e; font-size: 0.7rem; font-weight: 700;
              padding: 2px 8px; border-radius: 999px; }}
    .badge.calm {{ background: #e0f2fe; color: #0369a1; }}
    .date {{ font-weight: 600; }}
    .num {{ margin-left: auto; color: #888; font-size: 0.75rem; }}
    .hero {{ font-size: 1.35rem; font-weight: 800; line-height: 1.35; margin: 0 0 8px; }}
    .narrative {{ color: #555; font-size: 0.95rem; margin: 0 0 12px; }}
    .body {{ list-style: none; padding: 0; margin: 0; border-top: 1px solid #eee; }}
    .body-row {{ padding: 10px 0; border-bottom: 1px solid #eee; font-size: 0.9rem; }}
    .muted {{ color: #777; }}
    .questions {{ margin-top: 16px; padding-top: 12px; border-top: 1px dashed #ddd; }}
    .questions h3 {{ font-size: 0.8rem; text-transform: uppercase; letter-spacing: .04em; color: #888; }}
    .questions ol {{ margin: 8px 0 0; padding-left: 1.2rem; font-size: 0.9rem; }}
    @media print {{ body {{ background: #fff; }} .card {{ break-inside: avoid; box-shadow: none; }} }}
  </style>
</head>
<body>
  <h1>CryptoLens — Interview Pack (Study B)</h1>
  <p class="meta">พอร์ตจำลอง: {html.escape(portfolio)} · แสดงการ์ดทีละใบ · ถาม 3 คำถามต่อการ์ด</p>
  {"".join(cards)}
</body>
</html>"""


def score_responses(pack: dict, responses: list[dict]) -> dict:
    """Summarize filled participant responses against pass criteria."""
    if not responses:
        return {"participants": 0, "passed": False, "reason": "no responses"}

    q2_yes = sum(1 for r in responses if r.get("q2_understand") is True)
    q3_ok = sum(1 for r in responses if (r.get("q3_anxiety") or 0) >= 3)
    n = len(responses)
    ratio2 = q2_yes / n
    ratio3 = q3_ok / n
    passed = n >= PASS_CRITERIA["min_participants"] and ratio2 >= PASS_CRITERIA["q2_yes_ratio"] and ratio3 >= PASS_CRITERIA["q3_at_least_3_ratio"]
    return {
        "participants": n,
        "q2_yes": q2_yes,
        "q2_yes_ratio": round(ratio2, 3),
        "q3_at_least_3": q3_ok,
        "q3_at_least_3_ratio": round(ratio3, 3),
        "passed": passed,
    }


def merge_recorded_responses(pack: dict, record_path: Path) -> dict:
    data = json.loads(record_path.read_text(encoding="utf-8"))
    by_scenario = {sc["id"]: sc for sc in pack["scenarios"]}
    for entry in data.get("entries", []):
        sid = entry.get("scenario_id")
        if sid in by_scenario:
            by_scenario[sid]["responses"].append(entry)
    pack["summary"] = score_responses(pack, data.get("entries", []))
    return pack


def main() -> None:
    parser = argparse.ArgumentParser(description="CryptoLens qualitative interview pack")
    parser.add_argument("--start", default=DEFAULT_START.isoformat())
    parser.add_argument("--end", default=date.today().isoformat())
    parser.add_argument("--record", type=Path, help="merge responses JSON into pack summary")
    args = parser.parse_args()

    start = date.fromisoformat(args.start)
    end = date.fromisoformat(args.end)
    print(f"Building interview pack  {start} → {end} …")

    pack = build_pack(start, end)
    if args.record:
        pack = merge_recorded_responses(pack, args.record)
        print(f"Merged responses from {args.record}")

    PACK_JSON.write_text(json.dumps(pack, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    PACK_HTML.write_text(_render_html(pack), encoding="utf-8")

    n_abn = sum(1 for s in pack["scenarios"] if s["kind"] == "abnormal")
    n_calm = sum(1 for s in pack["scenarios"] if s["kind"] == "calm_control")
    print(f"  {len(pack['scenarios'])} scenarios ({n_abn} abnormal + {n_calm} calm control)")
    print(f"  → {PACK_JSON}")
    print(f"  → {PACK_HTML}")
    if "summary" in pack:
        print(f"  Summary: {json.dumps(pack['summary'], ensure_ascii=False)}")


if __name__ == "__main__":
    main()
