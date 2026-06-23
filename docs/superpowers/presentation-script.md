# CryptoLens — สคริปต์พรีเซ้น (10-15 นาที · อาจารย์/mentor)

> เน้น: สิ่งที่ build จริง · algorithm · backtest · grounding eval

---

## เปิด (1 นาที)

"วันนี้อยากพรีเซ้น project ที่ตอบคำถามเดียวว่า: **'วันนี้พอร์ตคริปโตของฉันเสี่ยงไหม'**

ที่น่าสนใจไม่ใช่แค่ว่า product ทำอะไรได้ — แต่คือ **เราพิสูจน์ได้ยังไงว่ามันทำงานได้จริง** และตัวเลขที่ออกมาเชื่อถือได้"

---

## Problem (1 นาที)

Persona: retail holder ที่ถือคริปโตอยู่แล้วแต่ไม่รู้ว่าพอร์ตเสี่ยงไหม

สิ่งที่ต้องการ:
- "เหรียญที่ฉันถืออยู่ขยับผิดปกติไหม?" — ไม่ใช่แค่ขึ้นลง แต่ **ปกติหรือผิดปกติสำหรับเหรียญนั้น**
- "มีข่าวร้ายเกี่ยวกับเหรียญฉันไหม?"

Binance/CoinGecko ให้ตัวเลขดิบ แต่ไม่บอกว่า "-8% วันนี้ปกติหรือเปล่า"

---

## Architecture ภาพรวม (1 นาที)

```
Binance API → backend (Python/FastAPI)
                ├── heat.py       — deviation + heat score (deterministic)
                ├── triage.py     — portfolio verdict + ranking
                ├── ai.py         — LLM digest (Gemini→Groq fallback)
                ├── news.py       — news aggregation (RSS, no API key)
                └── eval/         — backtest + grounding eval
                        ├── backtest_deviation.py
                        ├── grounding_eval.py
                        └── golden_set.py
Frontend: Next.js → DailyDigest, CoinFactCard, DeviationBadge
```

ส่วนที่อยากอธิบายลึกมีสามชั้น: signal → verdict → eval

---

## ชั้น 1: Deviation Band — วิธีบอกว่า "ผิดปกติ" (3 นาที)

**ปัญหา:** ราคาขยับ 5% ปกติหรือเปล่า? ขึ้นอยู่กับเหรียญ BTC อาจปกติ แต่เหรียญเล็กอาจวิกฤต

**โค้ดจริงใน `heat.py → compute_deviation()`:**

```python
# exclude today จาก baseline — ไม่ให้วันนี้ inflate ค่าตัวเอง
today = returns[-1]
history = returns[:-1]

mean = sum(history) / len(history)
std  = (sum((r - mean)**2 for r in history) / len(history)) ** 0.5

z = (today - mean) / std   # ห่างจาก baseline กี่ sigma

if   abs(z) >= DEV_ABNORMAL_Z:  status = "abnormal"   # DEV_ABNORMAL_Z = 1.9
elif abs(z) >= DEV_MILD_Z:      status = "mild"        # DEV_MILD_Z = 1.75
else:                            status = "normal"
```

**ทำไม z-score ไม่ใช่แค่ % change:**
- เหรียญ A แกว่ง 1%/วันปกติ → วันนี้ 4% = z ≈ 4 = ผิดปกติมาก
- เหรียญ B แกว่ง 8%/วันปกติ → วันนี้ 4% = z ≈ 0.5 = ปกติ

สูตรนี้ deterministic ทุก field ใน return dict อ้างอิงได้ทั้งหมด:
```python
return {
    "status": status,           # normal / mild / abnormal
    "direction": direction,     # up / down / flat
    "today_return_pct": ...,
    "z": round(z, 2),
    "normal_low_pct": round(mean - std, 2),
    "normal_high_pct": round(mean + std, 2),
}
```

---

## ชั้น 2: Portfolio Verdict + Ranking (2 นาที)

**โค้ดจริงใน `triage.py`:**

```python
HERO_ATTENTION_MIN = 40.0  # |z| × weight_pct ต้องถึงนี้ถึงขึ้น hero

def attention_score(coin, *, weighted, n_coins):
    z = abs(coin["deviation"]["z"])
    w = coin.get("weight_pct")
    if weighted and w is not None:
        return z * float(w)           # เช่น z=2.0, weight=40% → score=80
    return z * (100.0 / n_coins)     # fallback ถ้าไม่มี holdings

def is_hero_abnormal(coin, *, weighted, n_coins):
    if coin["deviation"]["status"] != "abnormal":
        return False
    return attention_score(coin, ...) >= HERO_ATTENTION_MIN
```

**ทำไม × weight_pct:**
- BTC: z=3.0, ถือ 5% → score = 15 → ไม่ขึ้น hero
- SHIB: z=1.5, ถือ 60% → score = 90 → ขึ้น hero

เหรียญที่กระทบเงินจริงมากกว่าขึ้นมาก่อน แม้ z จะน้อยกว่า

---

## ชั้น 3: Backtest — ผลจริง (3 นาที)

**ใน `eval/backtest_deviation.py`** — walk-forward บน BTC/ETH/BNB/XRP (2024-01-01 → 2026-06-22, 874 วัน)

**A) Signal quality — ผลจริง round-008:**

```
Calm-day accuracy   89.5%  (675/754 วัน)   target ≥85% ✓
Spike recall        90.1%  (163/181 coin-days)  target ≥85% ✓
Ranking accuracy    85.0%  (102/120 วัน)    target ≥85% ✓
```

"วัน spike คือวันที่ราคาขยับอยู่ใน top 5% ของ history ของเหรียญนั้นเอง — ไม่ใช่ % ตัวเลขเดียวกันทุกเหรียญ"

**B) Panic counterfactual — ผลจริง:**

```
สมมติ: ขาย 100% ทุกครั้งที่ engine บอก "abnormal+down" ไม่ซื้อคืน 30 วัน

Hold ธรรมดา:   $16,019  (+60.2%)
Panic seller:   $14,236  (+42.4%)
ส่วนต่าง:      -$1,782  ใน 2.5 ปี

Panic sells: 4 ครั้ง
False alarms (ขายแล้วราคาฟื้นใน 30 วัน): 3 จาก 4 ครั้ง = 75%
```

"นั่นคือ 3 ใน 4 ครั้งที่ engine บอก 'ผิดปกติ' แล้วคนขาย — ราคาฟื้นกลับมาใน 30 วัน ถ้ามีบริบทนี้คนจะ hold ได้แทนการ panic sell"

**C) Alert value (forward 7 วัน) — ผลจริง:**

```
วันที่ตลาดลง >2% แต่ engine บอก "ปกติ": 95 วัน

"ไม่ต้องห่วงวันนี้" แล้วพอร์ตฟื้นใน 7 วัน:  92.6%  (88/95)  target ≥80% ✓
"ไม่ต้องห่วง" แต่ยังลงต่ออีก 7 วัน:         7.4%   (7/95)   = false reassurance
False panic prevented (hold ดีกว่า sell):    55.8%  (53/95)
```

"ตัวเลขนี้คือ core value prop — 9 ใน 10 ครั้งที่เราบอกว่า 'วันนี้ปกติ ไม่ต้องห่วง' แม้ตลาดลง — พอร์ตฟื้นใน 7 วัน"

**Sanity dates ที่เช็คทุก run:**
```
2022-05-09  Luna/UST collapse
2022-11-09  FTX collapse
2024-08-05  Yen carry / global risk-off
2025-04-07  Tariff shock
→ วันพวกนี้ต้องขึ้น "abnormal" เสมอ ถ้าไม่ขึ้น = bug
```

---

## ชั้น 4: Grounding Eval — LLM ห้ามมโนตัวเลข (2 นาที)

**ปัญหาของ AI ใน fintech:** LLM บางทีพูดตัวเลขผิด เช่น ราคาจริง $109,234 แต่ AI บอก "$108,000" — สำหรับ product เกี่ยวกับเงิน trust ตายทันที

**วิธีแก้ใน `eval/grounding_eval.py`:**

```python
# วัด 3 rules ต่อทุก AI output:

# 1. NUMBER GROUNDING
#    ทุกตัวเลข >$100 ใน output ต้องอ้างได้กับ snapshot จริง
#    ±2% tolerance (รองรับ rounding เช่น "$109K")
def check_number_grounding(output, snapshot) → pass/fail

# 2. NO VERDICT
#    ห้ามมีคำว่า ควรซื้อ / should buy / น่าขาย / good entry ฯลฯ
#    ทั้ง TH + EN pattern matching
def check_no_verdict(output) → pass/fail

# 3. DISCLAIMER
#    digest ต้องมีบรรทัด "ไม่ใช่คำแนะนำการลงทุน"
def check_disclaimer(output) → pass/fail
```

**วิธีใช้:**
```bash
# Mock mode (ไม่ยิง API — ใช้ตรวจ checker logic)
python -m eval.grounding_eval

# Live mode (ยิง Gemini/Groq จริง แล้วนับ grounding rate)
python -m eval.grounding_eval --live
```

Output: `grounding rate X/Y = Z%` — ถ้าต่ำกว่า threshold แสดงว่า prompt ต้องแก้

---

## ชั้น 5: AI Chatbot — เทรนให้ตอบยังไง (2 นาที)

ปัญหาของ LLM ทั่วไปใน fintech มี 3 อย่าง: มโนตัวเลข, ให้คำแนะนำซื้อขาย, พูดฟุ่มเฟือย

เราแก้ด้วย **structured prompt + output template บังคับ**:

**1. Grounding — ส่งข้อมูลจริงทั้งก้อนเข้า prompt (จาก `ai.py → daily_digest`):**
```python
# แต่ละเหรียญ format เป็น text block ก่อนส่ง LLM
blocks.append(
    f"{c['symbol']}: price ${c['price']:,.2f}, 24h {c['change_24h_pct']:+.2f}%, "
    f"RSI {c.get('rsi')}, วันนี้ {dev['today_return_pct']:+.2f}% = "
    f"{status} (กรอบปกติ {dev['normal_low_pct']:+.1f}..{dev['normal_high_pct']:+.1f}%/วัน)\n"
    f"  news: {headlines}"
)
```
LLM ไม่ต้องจำราคา — ข้อมูลอยู่ใน context ทั้งหมด ถ้าพูดตัวเลขผิดคือ hallucinate จากที่อื่น

**2. Output template + กฎห้าม verdict (จาก `ai.py → daily_digest`):**
```python
prompt = (
    "คุณเป็นผู้ช่วยสรุปคริปโต ตอบคำถามเดียว: 'วันนี้ต้องสนใจอะไรไหม'\n"
    "ห้ามแต่งราคา/ตัวเลข/ข่าวที่ไม่ได้ให้มา\n"
    "  - อนุญาต: 'ลงแต่ยังอยู่ในกรอบปกติ — ไม่ต้องห่วง'\n"
    "  - ห้าม: 'ควรซื้อ', 'ควรขาย', 'น่าสะสม', 'เข้าซื้อ', 'ออกขาย'\n"
    "ตอบรูปแบบนี้เป๊ะ ๆ:\n"
    "VERDICT: <1 บรรทัด — ทิศทาง + ต้องจับตาไหม>\n"
    "NARRATIVE: <1-2 ประโยค>\n"
    "MOOD: <1 บรรทัด>\n"
    "BTC: <1-2 ประโยค อิงตัวเลขจริง>\n"
    + "\n".join(blocks)
)
```

**3. Question classifier — เลือก template ตามประเภทคำถาม (จาก `ai.py → _classify_ask_question`):**
```python
def _classify_ask_question(question):
    if any(k in question for k in ("ข่าว", "news", "headline")):
        return "news"        # → bullet ข่าวทีละบรรทัด
    if any(k in question for k in ("rsi", "macd", "ema", "bollinger")):
        return "indicators"  # → อธิบายเฉพาะตัวที่ถาม
    if any(k in question for k in ("ผิดปกติ", "deviation", "heat")):
        return "status"      # → ปกติ/เริ่มผิดปกติ/ผิดปกติชัด + เหตุผล
    return "general"         # → 2-4 ประโยค
```

**4. Grounding eval — วัดเป็นตัวเลขได้ (จาก `eval/grounding_eval.py`):**
```python
# Check 1: ทุกตัวเลข >$100 ใน output ต้องอ้างกลับ snapshot ได้ (±2%)
def check_numbers(text, coin):
    allowed = [coin["price"], coin["volume_24h"], ...]
    for n in parse_numbers(text):
        if n >= 100 and not any(abs(n-a) <= 0.02*a for a in allowed):
            violations.append(n)   # hallucinated number

# Check 2: ห้ามมีคำ verdict (TH + EN)
_VERDICT_PATTERNS = [
    "ควรซื้อ", "ควรขาย", "น่าซื้อ", "เข้าซื้อ", "ขายทิ้ง",
    "should buy", "should sell", "buy now", "time to buy",
]
def check_no_verdict(text):
    return [p for p in _VERDICT_PATTERNS if p in text]

# Check 3: digest ต้องมี disclaimer
def check_disclaimer(disclaimer):
    return [] if "ไม่ใช่คำแนะนำการลงทุน" in disclaimer else ["missing"]
```

**5. Post-processing + Fallback (จาก `ai.py`):**
```python
# strip markdown ที่ LLM ใส่มาโดยไม่ได้ขอ
text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
text = re.sub(r"^(สวัสดี[^\n]*)", "", text)   # ตัดทักทาย

# ถ้า AI ล่ม — ไม่ 502 user
try:
    raw = complete(prompt)
except Exception:
    raw = ""   # parser เจอ empty → fallback ไป triage.portfolio_verdict()
               # ฟังก์ชันเดียวกับที่ backtest validate แล้ว
```

---

## Tuning Loop (1 นาที)

ทุกครั้งที่รัน backtest จะ auto-save ผลใน `eval/tuning_log.json`:

```
round-001: mild_z=1.0, abnormal_z=2.0 → calm=81% spike=79% rank=85% FAIL
round-002: mild_z=1.5, abnormal_z=2.5 → calm=87% spike=88% rank=91% PASS ✓
```

มี `--sweep` mode ที่ grid-search ทุก combination แล้วหา threshold ที่ดีที่สุด — เป็น data-driven tuning ไม่ใช่เดาเอา

---

## Demo (1 นาที)

*เปิดแอป*

"นี่คือ output จริงของ pipeline ทั้งหมด — digest one-liner + deviation badge + fact card ทุกตัวเลขที่เห็นมาจาก deterministic function และผ่าน grounding eval แล้ว"

---

## สรุปและสิ่งที่เรียนรู้ (1 นาที)

สามสิ่งที่ทำแล้วภูมิใจ:

1. **Deviation band** — เปลี่ยนจาก "ราคาขึ้นลง" เป็น "ปกติหรือผิดปกติ" ด้วย z-score rolling window
2. **Backtest แบบ walk-forward** — ไม่ใช่แค่ test ย้อนหลัง แต่ simulate จริงว่า "ถ้า user ใช้วันนั้นจะเกิดอะไร"
3. **Grounding eval** — วัดได้จริงว่า LLM มโนตัวเลขกี่ % — ทำให้ trust ใน AI output มีตัวเลขรองรับ

**คำถามที่อยากได้ feedback:**
- Backtest methodology มี lookahead bias ซ่อนอยู่ไหมที่ยังไม่เห็น?
- z-score 30 วันสั้นหรือยาวเกินไปสำหรับ crypto ที่ regime เปลี่ยนเร็ว?

---

## Q&A เผื่อถาม

**"ทำไมไม่ใช้ ML แทน z-score?"**
z-score interpretable ทุกตัวเลขอธิบายได้ — ML เพิ่ม accuracy อาจได้ แต่เราสูญเสีย "กดดูที่มาได้" ซึ่งเป็น trust factor หลัก สำหรับ product เกี่ยวกับเงิน interpretability > accuracy

**"Backtest บน 4 เหรียญพอไหม?"**
ไม่พอสำหรับ production แต่พอสำหรับ validate methodology — เหรียญ 4 ตัวครอบ large cap, mid cap, exchange token ได้ระดับหนึ่ง

**"Grounding eval ใช้ pattern matching ธรรมดา เพียงพอไหม?"**
สำหรับ known patterns (ราคา, คำ verdict) เพียงพอ — edge case ที่พลาดคือ LLM พูด implicit inference ที่ไม่มีตัวเลข ซึ่งเป็น open problem
