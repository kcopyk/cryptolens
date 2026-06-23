# CryptoLens — Product Plan

> **แผนปัจจุบัน: v3.0** (grill 2026-06-22) · v2.0 เก็บไว้ด้านล่างเป็น archive

---

# PLAN v3.0 — "position ฉันเสี่ยงไหมวันนี้" (2026-06-22)

> เขียนจาก grill positioning + competitive landscape · **supersede v2.0** ในเรื่อง persona definition, wedge clarity, และ competitive context
> v2.0 ยังอ้างอิงได้เรื่อง iron rules, business model, Radar — ส่วนที่ v3 ไม่ได้ทับ
> **persona rev 2026-06-22:** retail trader รายย่อยที่กังวล (แทน passive holder / office worker)

## หนึ่งประโยค

**"บอกว่า position คุณเสี่ยงไหมวันนี้"** — triage ก่อน panic ตัดสินใจแทนคุณ ภาษาคน ไม่ต้องไถ chart รอบสอง

## Persona (ชัดขึ้นจาก v2)

**Retail trader รายย่อยที่ manage position เอง — กังวลเมื่อตลาดสวิง หลังข่าว หรือหลังเข้าไม้**

- เทรด/ถือ position เอง ไม่ใช่ pro ไม่มี analyst — เปิดแอป **ตอนกังวล** (reactive) เป็นหลัก ไม่ใช่เฝ้าจอทั้งวัน
- ถาม: "position ฉันเสี่ยงไหมวันนี้" · "เหรียญที่ถือขยับผิดปกติไหม" (A) · "มีข่าวที่ต้องจับตาไหม" (D)
- ไม่ใช่ day trader / quant desk · ไม่ใช่คนรอ signal bot verdict ซื้อ/ขาย · ไม่ต้องการ P&L / tax / order ในแอป

## Job หลัก (ล็อก)

| คำถามที่ตอบ | ไม่ตอบ |
|---|---|
| "position ฉันเสี่ยงไหมวันนี้" (portfolio triage) | P&L / cost basis / tax |
| "เหรียญที่ถือขยับผิดปกติไหม" (deviation A) | คำแนะนำซื้อ/ขาย |
| "มีข่าวที่ต้องจับตาเกี่ยวกับเหรียญฉันไหม" (news D) | order execution |
| "วันนี้ตลาดโดยรวมปกติไหม" (market mood) | signal buy/sell |

## Competitive wedge vs CoinGecko (ข้อมูล เม.ย. 2026)

CoinGecko launch AI features เมษายน 2026: Market Insights (AI summary จาก news+social), Portfolio Insights (P&L + allocation ข้าม wallet), Advanced Charts

**สิ่งที่ CoinGecko ยังไม่มี = wedge เรา:**
- **Deviation band** — "การเคลื่อนไหวนี้ผิดปกติไหม *เทียบกับ baseline ของเหรียญนั้นเอง* (z-score 30 วัน)" — CoinGecko บอกว่า "ขึ้น/ลงเพราะอะไร" แต่ไม่บอกว่า "ปกติหรือเปล่าสำหรับเหรียญนี้"
- **Heat score พร้อม breakdown** — ตัวเลขเดียวบอก "ร้อนแค่ไหน" พร้อมแสดงที่มา (RSI + volatility percentile + news sentiment) → ตรวจสอบได้ ไม่ใช่กล่องดำ
- **Digest นำด้วย "ต้องสนใจไหม"** — hero message คือ "วันนี้ปกติ ไม่มีอะไรต้องห่วง" (ดับ panic) ก่อนลงรายละเอียด

สรุป: เราไม่แข่งด้าน "ข้อมูลมากกว่า" — แข่งด้าน **"บอกว่าต้องสนใจไหม" แบบ one-glance ภาษาคน**

## ทางเลือกที่ retail trader ใช้อยู่ today (pain จริง)

| ทางเลือก | จุดอ่อนสำหรับ persona เรา |
|---|---|
| Binance price alert | แจ้ง threshold ไม่บอก abnormal vs baseline · ไม่ rank ตาม position weight |
| Signal group / X | Noise · FOMO/panic · กดดัน overtrade |
| TradingView | Chart ลึก แต่ไม่ triage "position ไหนควรดูก่อน" แบบ glance |
| CoinGecko AI | บอก "ขึ้น/ลงเพราะอะไร" ไม่ personalize abnormal ตาม holdings |

## กติกาเหล็ก (สืบทอดจาก v2 — ไม่เปลี่ยน)

1. ห้าม print "ควรซื้อ / ควรขาย / น่าซื้อ"
2. Heat & deviation deterministic — LLM ห้ามมโนตัวเลข
3. Digest ใส่บริบทได้ ห้ามสั่ง
4. ไม่แตะเงินผู้ใช้ — deep-link Binance เท่านั้น

---

> **แผนก่อนหน้า: v2.0** (grill 2026-06-18) · เก็บไว้ด้านล่าง

---

# PLAN v2.0 — Portfolio Care Triage (2026-06-18)

> เขียนจาก grill ทิศทาง + business model · **supersede v1.0** ในเรื่อง positioning, monetization, และ phase plan
> v1.0 ยังอ้างอิงได้เรื่อง iron rules, build log, Radar bonus — ส่วนที่ v2 ไม่ได้ทับ

## หนึ่งประโยค

**Portfolio care triage** — ตอบว่า *"วันนี้พอร์ตฉันปกติไหม ต้องสนใจอะไร"* เป็นภาษาคน

ไม่ใช่ portfolio tracker (CoinStats/Delta) · ไม่ใช่ trading terminal (Binance/TradingView)

Shift จาก pain "office worker ไม่เฝ้าจอ" → **platform ดูแล port** โดยนิยาม "ดูแล" = **triage + context** ไม่ใช่ **manage + execute**

## ลูกค้าตัวจริง

**Engaged retail holder** — ถือคริปโตอยู่แล้ว กังวลเมื่อตลาดผันผวน อยากเข้าใจโดยไม่ต้องไถ chart หรือ doomscroll X

- เปิดเว็บเมื่อ **กังวล** หรืออยากเช็คว่าปกติไหม (สัปดาห์ละไม่กี่ครั้ง)
- ไม่ใช่เทรดเดอร์เฝ้าจอ — สนามนั้นมี Binance + TradingView ดีกว่าเราแล้ว

## Job หลัก (ล็อกจาก grill)

| คำถามที่ product ตอบ | ไม่ตอบ |
|---|---|
| *"วันนี้พอร์ตฉันปกติไหม ต้องทำอะไรไหม"* | P&L / tax / rebalance / สั่งซื้อขาย |

## Output format — A+B

```
[Hero — 5 วินาที]
"วันนี้พอร์ตคุณปกติ ไม่มีอะไรต้องห่วง"
  หรือ "มี 2 เหรียญควรดู"

[Body — ถ้าไม่ปกติ]
1. SOL — ผิดปกติ ~2× สวิงปกติ · 18% ของพอร์ต
2. BTC — เบา ๆ · 45% ของพอร์ต

[Deep — pull, ไม่บังคับ]
Fact card → AI chat → deep-link Binance
```

## Business logic (core loop)

```
Input:  manual holdings (≤5 ช่วง bootstrap) หรือ watchlist fallback
        + market data / news / macro events

Engine: compute_deviation() ต่อเหรียญ (z-score vs 30-day baseline)
        rank ด้วย |z| × portfolio_weight
        digest LLM grounded ในเลขจริง

Output: one-liner (portfolio verdict) + ranked abnormal coins
```

| Layer | Logic | Deterministic? |
|---|---|---|
| Signal | deviation band 30 วัน | ✅ |
| Ranking | `\|z\| × weight_pct` | ✅ |
| Narrative | digest one-liner + body | Grounded |
| Heat | ตัวรอง — "สุดโต่งแค่ไหน" | ✅ |

## กติกาเหล็ก (สืบทอดจาก v1 — ไม่เปลี่ยน)

1. **ห้าม print "ควรซื้อ / ควรขาย / น่าซื้อ"** — อธิบาย ไม่สั่ง
2. **Heat & deviation deterministic** — LLM ห้ามมโนตัวเลข
3. **Heat = ร้อน/เย็น ไม่ใช่ น่าซื้อ**
4. **Digest ใส่บริบทได้ ห้ามสั่ง**
5. **ไม่แตะเงินผู้ใช้** — ไม่ trade key · deep-link Binance เท่านั้น

## Litmus test 4 ข้อ (ยามเฝ้าประตู feature)

1. ช่วยรู้ "วันนี้ปกติหรือผิดปกติ" ไหม?
2. ภาษาคน ไม่เพิ่มศัพท์เทรดไหม?
3. Glance จบ ไม่ใช่ dashboard จ้องไหม?
4. ไม่ verdict · ไม่แตะเงินไหม?

ตกข้อใด → `PARKING_LOT.md`

## Business model

### Phase 0 — Bootstrap (ปัจจุบัน · zero infra cost)

| ด้าน | ตัดสิน |
|---|---|
| User pricing | **ฟรีทุกอย่าง** |
| Channel | **Web pull อย่างเดียว** — ยังไม่ LINE OA / email paid |
| Holdings | **Manual ≤5 เหรียญ** (`HoldingsPanel` + `/api/holdings`) |
| Retention | เปิดเมื่อกังวล · one-liner "ปกติ" สร้าง trust |
| Success metric | คนกลับมาเปิดเมื่อตลาดผันผวน · ไม่ใช่ revenue |

### Phase 1 — Validate (trigger: ~20–30 active users · มีคนถาม "ส่ง LINE ได้ไหม")

| Tier | ราคา | ได้อะไร |
|---|---|---|
| Free | 0 | Web A+B · manual holdings 5 เหรียญ |
| Pro | 99–149 THB/เดือน | **Push เช้า A+B** · LINE primary + email fallback |

### Phase 2 — Expand (เมื่อ push work)

| Tier | ราคา | ได้อะไร |
|---|---|---|
| Pro+ | 199–249 THB/เดือน | Push + **instant alert** เมื่อหลุดกรอบ · holdings unlimited |

> **หมายเหตุ monetization:** ขาย **ส่งถึงมือ + ความสบายใจ** ไม่ใช่ dashboard สวย · free 5 เหรียญ web generous พอ validate ก่อน gate push

## Holdings input

| ช่วง | วิธี |
|---|---|
| **ตอนนี้** | Manual only — ไม่บังคับ API key · cold-open ใช้ watchlist ได้ |
| **ทีหลัง** | Read-only Binance sync (convenience upgrade · encrypt-at-rest) |
| **ไม่ทำ** | Trade key · ยิงออเดอร์ในแอป |

## คู่แข่ง

### ไม่แข่ง (red ocean)

| คู่แข่ง | เหตุผล |
|---|---|
| CoinStats / Delta / Koinly | Tracker — sync, P&L, tax |
| Binance app | ราคา + ยอดจริง ฟรี |
| TradingView | Chart สำหรับเทรดเดอร์ |
| Signal bots | Verdict ซื้อ/ขาย — ขัด iron rules |

### คู่แข่งจริง (ที่ user ใช้อยู่ today)

| คู่แข่ง | จุดอ่อน |
|---|---|
| Binance price alert | ไม่ personalize ตาม weight · ไม่บอก ปกติ/ผิดปกติ |
| Twitter/X doomscroll | Noise · FOMO/panic |
| เปิด 5 แท็บเอง | Cognitive load สูง |
| CoinMarketCal | Browse events · ไม่ triage ตาม holdings |

### Moat

Personalized triage (`|z| × weight`) + ภาษาไทย/คน + **"เงียบ = สบายใจได้"** + deterministic + ไม่สั่งซื้อ/ขาย

## Feature map

| ✅ In (core) | ❌ Out | 🔜 Later |
|---|---|---|
| Manual holdings + weighted digest A+B | Auto trade / order | Read-only Binance sync |
| Deviation + fact card | P&L / tax / rebalance | Push LINE/email (Pro) |
| Macro events ใน digest | Full portfolio dashboard | Instant alert (Pro+) |
| AI chat grounded | Signal buy/sell | Weekly health summary |
| Deep-link Binance | Wallet connect DeFi | Radar `/radar` (glance only) |

## Milestones v2 (ลำดับลงมือ)

### ✅ Done (สืบทอดจาก v1 build log)

- `compute_deviation()` + `DeviationBadge` + `/api/heat`
- Portfolio-weighted `/api/digest` — abnormal→mild→normal
- `HoldingsPanel` + `/api/holdings`
- `CoinFactCard` · `DailyDigest` hero chips
- `MacroEventsPanel` — context layer (ไม่ใช่ hero tab)

### 🎯 Phase 0 — ต่อจากนี้ (zero cost)

1. **One-liner portfolio verdict ชัดขึ้น** — hero ของ `DailyDigest` ต้องอ่าน A ได้ใน 5 วินาที
2. **Cold-open ไม่บังคับ holdings** — watchlist พิสูจน์ค่าก่อน · prompt holdings เป็น upgrade เบา ๆ
3. **"วันเงียบ = ปกติ" ให้เด่น** — differentiator ที่ Binance ไม่ทำ
4. **Heat bar polish** — ตัวรองใน fact card (ถ้ายังไม่ครบ)

### 🔜 Phase 1+ (เมื่อ validate · มีงบ infra)

5. Push delivery — LINE OA + email fallback · cron เช้า ~07:00 ICT
6. Payment / subscription gate
7. Read-only Binance sync (optional convenience)

### 🧪 BONUS — Radar (v1 §ยังใช้ได้)

ดู spec เต็มใน **PLAN v1.0 §Radar** ด้านล่าง — positioning ต้องเป็น glance triage ไม่ใช่ dashboard จ้อง

## Decision log (grill 2026-06-18)

| # | หัวข้อ | ตัดสิน |
|---|---|---|
| 1 | Job หลัก | Portfolio care triage — "วันนี้ปกติไหม" |
| 2 | Output | A+B — one-liner + ranked list |
| 3 | Free tier | Web A+B · **5 เหรียญ** manual holdings |
| 4 | Paid (Phase 1) | Push เช้า A+B · instant alert = Pro+ ทีหลัง |
| 5 | Channel (Phase 1) | LINE primary + email fallback |
| 6 | Bootstrap | ฟรีหมด · zero infra cost · web only |
| 7 | Holdings | Manual ก่อน → read-only sync ทีหลัง |

## ของที่แช่แข็ง (สืบทอดจาก v1)

- ❄️ `POST /api/order` + HMAC + trade key vault + OrderPanel mainnet
- ❄️ แท็บ browse macro events ทั้งตลาด (= CoinMarketCal competitor space)

> Read-only key sync = upgrade ทีหลังของ holdings · ไม่ใช่งาน Phase 0

---

# PLAN v1.0 — Archive (2026-06-16)

> **สถานะ: archived** — superseded โดย v2.0 ด้านบน · เก็บไว้อ้างอิง iron rules เดิม, build log, Radar spec
> เขียนใหม่จากการ grill ทิศทาง — 2026-06-16
> แผนนี้ **แทนที่** แผน "Real Trading (Binance)" ฉบับ 2026-06-11 ทั้งฉบับ (ดู §ของเดิมที่ถูกแช่แข็ง)

## ลูกค้าตัวจริง (เลือกคนเดียว)

**Office worker ที่ถือคริปโตอยู่แล้ว แต่ไม่มีเวลา/ความรู้จะตีความกราฟเอง** — กลุ่ม glance-and-go

ไม่ใช่เทรดเดอร์ที่เฝ้าจอทั้งวัน คนกลุ่มนั้นมี Binance + TradingView ที่ดีกว่าเราอยู่แล้ว เราไม่แข่งสนามนั้น

> **ปรับ 2026-06-16 (grill รอบ 2):** persona ขยับเป็น **"engaged retail holder" = ตัวเอง + คนที่เป็นแบบเดียวกัน (holder กังวล อยากเข้าใจ เปิดดูสัปดาห์ละไม่กี่ครั้ง)** เพราะยืนยันให้ "เว็บเป็นพระเอก ครบจบในที่เดียว" — glance-and-go ล้วน ๆ ไม่เปิดเว็บเองเป็นนิสัย ดูรายละเอียดที่ §"Decisions รอบ 2"

## คุณค่าหลัก — "ทำไมคนถึงจะยอมใช้เรา"

**ฆ่า 5 แท็บ** — วันนี้คนกลุ่มนี้ต้องเปิด Binance (ราคา) + TradingView (กราฟ) + Bloomberg + เว็บข่าว แล้วประกอบเองในหัว เรายุบให้เหลือ **หน้าเดียว ภาษาคน** ที่ตอบคำถามเดียวว่า *"วันนี้ต้องสนใจอะไรไหม"* แล้วจบ

ไม่มีเจ้าไหนให้ "มุมรวม + ย่อยแล้ว + ภาษาคน" สำหรับคริปโตรายย่อย — นั่นคือช่องของเรา

## หลักการที่ล็อกแล้ว (Decisions)

| หัวข้อ | ตัดสิน |
|---|---|
| ลูกค้าหลัก | office worker ถือเหรียญอยู่ ไม่มีเวลาเฝ้ากราฟ |
| คุณค่าหลัก | aggregator หน้าเดียว ภาษาคน — แทนที่ 5 แท็บ |
| นิยาม "จบในที่เดียว" | หน้าเดียวตอบ "วันนี้ต้องสนใจอะไรไหม" — **ไม่ใช่** "มีทุกอย่างของ Binance" |
| หน้าแรก | digest เป็นพระเอกเต็มจอ · กราฟ/order book/indicator = กดเข้าไปดูเองได้ ไม่โผล่มาแย่งความสนใจ |
| ระดับคุณค่า | **ระดับ 2** "ช่วยเข้าใจจนตัดสินใจเอง" — **ไม่ใช่** signal "ควรซื้อ/ขาย" |
| การแสดงผลต่อเหรียญ | print "สถานะ + เหตุผลเป็น fact" ให้ผู้ใช้สรุปซื้อ/ขายเองในหัว |
| คะแนนสรุป | แท่งเดียว 0–100 = **"Heat / โซน"** (เย็น–กลาง–ร้อนเกิน) **ไม่ใช่ "ความน่าซื้อ"** |
| การลงมือเทรด | **deep-link ออกไป Binance** — เราไม่ยิงออเดอร์เอง ไม่ถือ trade key |
| การส่งถึงผู้ใช้ | เว็บเป็นหลัก + push (LINE/อีเมล) 1 ครั้ง/วัน เป็น free trial → paid |

## กติกาเหล็ก (ห้ามข้าม)

1. **ห้าม print คำว่า "ควรซื้อ / ควรขาย / น่าซื้อ" บนจอ** — วินาทีที่ออก verdict เรากลายเป็นคนขาย signal: รับ liability เต็ม, โดน ก.ล.ต. มอง, ต้องมี track record, และเลขถูกจับผิดได้ทุกวัน
2. **คะแนน Heat ต้อง deterministic** — คำนวณด้วยสูตรจาก RSI + volatility percentile + จำนวนข่าวบวก/ลบ **ห้ามให้ LLM มโนตัวเลข** กดทีไรได้เลขเดิม และกดดู "ทำไมได้ 82" ได้เสมอ
3. **Heat วัด "ร้อน/เย็น" ไม่ใช่ "น่าซื้อ"** — RSI 78 กับ RSI 22 ร้อนทั้งคู่คนละทิศ เราแค่บอกว่า "สุดโต่งแค่ไหน" ไม่ตัดสินทิศ เพราะคริปโตไม่มีมูลค่าพื้นฐาน (กำไร/P/E) ให้ยึดแบบหุ้น ป้าย "น่าซื้อ" จึงเป็นความแม่นปลอม
4. **digest ใส่ "บริบท/ความรุนแรง" ได้ แต่ห้ามสั่ง** — เช่น *"-8% วันนี้ แต่ยังอยู่ในกรอบแกว่งปกติ 30 วัน"* (fact) ไม่ใช่ *"ควรขาย"* (คำสั่ง)
5. **เราไม่แตะเงินผู้ใช้** — ไม่ยิงออเดอร์ ไม่ถือ trade key การลงมือเกิดบน Binance ของผู้ใช้เอง

## ตำแหน่งปัจจุบัน

- **Intelligence Hub มีของแล้ว**: backend `/insights`, `/candles`, `/news`, `/mood`, `/ask`, `/digest` + indicators + ข่าว 3 แหล่ง + AI chat (Gemini→Groq) + watchlist
- **`TradeOnBinanceButton.tsx` มีอยู่แล้ว** ← นี่คือทางลงมือที่เราจะใช้ (deep-link) แทนการสร้างระบบเทรดเอง
- **ช่องว่างที่ต้องสร้าง**: manual holdings, portfolio-weighted digest, Heat bar, per-coin fact card, push delivery

## Milestones (ลำดับลงมือ)

### 1. Manual holdings — ปลดล็อก "พอร์ตของคุณ" ไม่ใช่แค่ "ตลาด"
- ผู้ใช้กรอกเองว่าถือเหรียญไหนกี่หน่วย (ยังไม่แตะ API key, ไม่มี liability, เริ่มได้ทันที)
- เก็บใน user account ปกติ (auth สำหรับบัญชี/บันทึก holdings/subscription — **ไม่ใช่** auth เพื่อถือ trade key)
- เหตุผล: "ควรห่วงไหม" ตอบไม่ได้ถ้าไม่รู้สัดส่วนถือ — BTC -8% ที่เป็น 3% ของพอร์ต กับ 70% ของพอร์ต คือคนละเรื่อง นี่คือหัวใจของระดับ 2

### 2. Heat bar — แท่งเดียว 0–100 glance จบ
- สูตร deterministic จาก RSI + volatility percentile + news sentiment (ฝั่ง backend, reproducible)
- โซน เย็น–กลาง–ร้อนเกิน + กดดูที่มาของคะแนนได้ทุกตัว
- **ไม่มีคำว่าซื้อ/ขาย** บนแกนหรือ label

### 3. Per-coin fact card — "สถานะ + ทำไม"
- ต่อเหรียญ: Heat + เหตุผลเป็น fact เช่น *"RSI 78 (overbought) · ลง 12% จากจุดสูง 7 วัน · ข่าวลบ 2/3 วันนี้"*
- ผู้ใช้สรุปเองว่าจะทำอะไร — เราไม่สรุปแทน

### 4. Portfolio-weighted digest — digest ที่พูดถึง "เงินคุณ" จริง
- ถ่วงน้ำหนัก digest ด้วยสัดส่วนถือจาก milestone 1
- "วันนี้ต้องสนใจ X เพราะมันเป็น Y% ของพอร์ตคุณ และกำลังร้อนผิดปกติ"

### 5. ปุ่มลงมือ = deep-link Binance
- ใช้ `TradeOnBinanceButton.tsx` ที่มีอยู่ — "เข้าใจที่นี่ → กดปุ่ม → ไปกดซื้อ/ขายเองบน Binance"
- ลบความจำเป็นของ vault / HMAC / order endpoint / mainnet gate ทั้งหมด

### 6. Push delivery (LINE/อีเมล) — free trial → paid
- ส่ง digest 3–5 บรรทัด เช้าก่อนเข้างาน 1 ครั้ง/วัน (เนื้อหา = ก้อน digest ที่มีอยู่)
- **free**: push แบบ trial (เช่น 1 เหรียญ / สรุปสั้น) ให้ผู้ใช้ "ติด" ก่อน
- **paid**: push ทั้ง watchlist + ลึกกว่า + ถามต่อใน AI chat ได้
- เหตุผล: คนไม่มีเวลา = คนที่จะไม่เปิดเว็บเอง ต้องให้ push วิ่งไปหา และต้องให้ชิมฟรีก่อนถึงจะเห็นค่า

## ของเดิมที่ถูก "แช่แข็ง" (อย่าลงแรงต่อ)

ระบบยิงออเดอร์ในแอปทั้งหมดถูกพักไว้ เพราะ (1) เสิร์ฟ persona เทรดเดอร์ที่เราตัดทิ้ง (2) intern ship เองไม่ได้ ต้องรอ sign-off + security review (3) ดูดเวลา dev จาก differentiator จริง:

- ❄️ `POST /api/order` + HMAC signing + ยิง Binance จริง (testnet/mainnet)
- ❄️ ต่อ `OrderPanel` → endpoint จริง
- ❄️ encrypted key vault สำหรับ **trade key** + verify withdrawal-disabled
- ❄️ order safety (confirm / size cap / rate-limit ของการยิงออเดอร์)
- ❄️ mainnet gate (`TRADING_ENV`)

> หมายเหตุ: ถ้าอนาคตอยากทำ "ดึงยอดถืออัตโนมัติ" ให้ใช้ **read-only key** เท่านั้น (อ่านอย่างเดียว ความเสี่ยงต่ำกว่า trade key มาก) และยังต้อง encrypt-at-rest — แต่เป็น *upgrade ทีหลัง* ของ milestone 1 ไม่ใช่งานตอนนี้

## หมายเหตุความเสี่ยงที่ยังเหลือ

- **Heat/digest ต้อง grounded กับเลขจริง** — ถ้า AI มโน ข้อมูลผิดเรื่องเงินคน trust ตายทันที ทุกคำกล่าวต้องอ้างถึงตัวเลข/ข่าวที่มีจริง
- **ห้ามให้ภาษา "บริบท" ไหลข้ามเส้นเป็นคำแนะนำ** — review prompt ของ digest เป็นระยะ
- **เลขที่ deterministic ต้องเปิดให้ผู้ใช้ตรวจที่มาได้** — โปร่งใสคือเกราะกัน "หาว่าเราชี้นำ"

---

## Decisions รอบ 2 — first-open & retention (grill 2026-06-16)

> โฟกัส: "user เปิดมาควรเห็นอะไร ถึงสนใจและใช้ต่อยาว ๆ"

| หัวข้อ | ตัดสิน |
|---|---|
| persona | **engaged retail holder** = ตัวเอง + คนแบบเดียวกัน (holder กังวล อยากเข้าใจ ไม่ใช่เทรดเดอร์เฝ้าจอ) |
| นิยาม "ครบจบในที่เดียว" | ครบเรื่อง **เข้าใจ** — **ไม่ใช่** ครบเครื่องมือ **เทรด** (กันไหลกลับสนาม TradingView/Binance) |
| wedge เดียว | **ดับ panic/FOMO ด้วยบริบท "ปกติ/ผิดปกติ"** — pain ที่เจ็บสุดและคนแก้ให้น้อยสุด |
| cold-open (เปิดครั้งแรก) | **พิสูจน์คุณค่าก่อน ไม่ gate ด้วยการกรอกพอร์ต** — one-liner + signal ที่กดดูที่มาได้ทันที แล้วค่อย prompt กรอกพอร์ตเป็น *upgrade* บาง ๆ |
| one-liner | "ความผิดปกติ + บริบท" ไม่ใช่สรุปตลาดจืด ๆ · **"วันนี้ไม่มีอะไรต้องห่วง" = ข้อความที่ valid** และสร้าง trust (สอนว่า "เงียบ = สบายใจได้") |
| signal พระเอกต่อเหรียญ | **"ในกรอบ/หลุดกรอบ baseline ตัวเอง"** (deviation band ~30 วัน) ขึ้นเป็นบรรทัดแรก · **Heat bar ลดเป็นตัวรอง** (บอก "สุดโต่งแค่ไหน" ประกอบ) |
| retention model | **push = ความถี่/หัวใจเต้น · เว็บ = ความเข้าใจ/anti-doomscroll** (เปิดเพื่อดับกังวลแทนไถ X) — สอง surface คนละหน้าที่ |
| สุขภาพพอร์ตรายสัปดาห์ | **optional** — เหตุผลให้เปิดเว็บแม้วันตลาดเงียบ (ยังไม่ใช่ core) |
| CTA สำคัญสุดบน cold-open | **"รับสรุปทุกเช้า" (เปิด push)** > "กรอกพอร์ต" |
| crypto events | **เลเยอร์ ไม่ใช่แท็บ** — ฝัง event ที่กระทบเหรียญที่ถือ/watch เข้า digest + fact card เป็น context มองไปข้างหน้า ("จับตา: พรุ่งนี้มี X") + แปลว่า "มันแปลว่าอะไรกับเหรียญคุณ" · **แท็บ browse event ทั้งตลาด → parking lot** (= CoinMarketCal, persona alpha-hunter, และเท่ากับสร้างแท็บที่เพิ่งฆ่ากลับมา) |

### Litmus test 4 ข้อ — ยามเฝ้าประตู feature
ทุก idea ต้องผ่านครบ 4 ข้อ ถึงอยู่ใน product นี้ ตกข้อใด = เป็น *product อีกตัว* → เข้า `PARKING_LOT.md`

1. ช่วยให้ holder ที่กังวลรู้ว่า "วันนี้ปกติหรือผิดปกติ" ไหม?
2. พูด "ภาษาคน" หรือเพิ่มศัพท์/เครื่องมือที่ต้องเรียนรู้?
3. อยู่ใน "หน้าเดียว glance จบ" หรือดึงไปทาง dashboard เฝ้าจอ?
4. เคารพกติกาเหล็ก (ไม่ verdict ซื้อ/ขาย · ไม่แตะเงิน) ไหม?

### สถานะการลงมือ (build log)
- ✅ **signal "ปกติ/ผิดปกติ" เป็นพระเอก** — `compute_deviation()` (z-score ของ daily return เทียบ baseline 30 วัน, deterministic) → `/api/heat` · `DeviationBadge` เป็นบรรทัดบนสุดของ fact card · Heat ถอยอยู่หลัง `<details>`
- ✅ **digest นำด้วยเหรียญผิดปกติ** — `/api/digest` คำนวณ deviation, จัดลำดับ abnormal→mild→normal (น้ำหนักพอร์ตเป็น tiebreak), ป้อนสถานะให้ LLM และบังคับ "วันเงียบให้บอกตรง ๆ ว่าปกติ ไม่ปั้นดราม่า" · chip "ปกติ/ผิดปกติ" ขึ้นเป็น hero ใน DailyDigest

### บันทึก self-awareness
สร้างของแก้ให้ตัวเอง = ดี (เป็น user จริง) **ปัญหาคือสร้างให้ "ตัวเองหลายเวอร์ชัน" พร้อมกัน** (holder กังวล / tinkerer / would-be trader) ซึ่งคือคนละ persona idea ของเวอร์ชันอื่นไม่แย่ — แค่เป็นของ product อื่น เก็บไว้ที่ `PARKING_LOT.md` อย่ายัดเข้าธีมนี้

---

## 🧪 ส่วนเสริม (BONUS — nice-to-have, ไม่ใช่ core) — "Radar" attention router

> **สถานะ: ส่วนเสริม.** core ของ Week 2 (AI implementation จริง + eval + cost/latency + design system) ต้องเสร็จก่อน. Radar คือตัว **"ว้าว/เด่นออกมา"** ตอน present ถ้ามีเวลาเหลือ — ออกแบบจาก grill 2026-06-18 ผูกกับ asset ที่มีอยู่แล้ว (ไม่สร้าง persona ใหม่)
> **ทำไมถึงเข้าธีมได้ (ไม่ใช่ product อื่น):** ต่อยอด `compute_deviation()` ที่เป็นพระเอกอยู่แล้ว — แค่เปลี่ยน "อ่านทีละเหรียญ" เป็น "เห็นทั้งพอร์ตในแวบเดียวว่าตัวไหนต้องดู"

### ไอเดียหนึ่งประโยค
หน้าแยก `/radar` ที่ตอบ **"วันนี้เอาสายตาไปที่เหรียญไหน"** ในแวบเดียว — bubble field ที่ตัวซึ่ง **ผิดปกติ + ถือเงินเยอะ** เด้งเต้นออกมาเอง

### Attention score (deterministic, อธิบายได้เหมือน Heat)
```
attention = normalize(|z|) × weight_pct
```
- `|z|` = ขนาดความผิดปกติเทียบ baseline 30 วันของเหรียญเอง (จาก `compute_deviation()` — มีอยู่แล้ว)
- `weight_pct` = น้ำหนักเงินในพอร์ต (holdings × price)
- **ทำไม |z| × weight ดีกว่า Heat ดิบ:** Heat ดิบ × weight จะโชว์เหรียญเดิมตลอด (ตัวที่ผันผวนเป็นนิสัย + ถือเยอะ เช่น BTC). attention = **"เซอร์ไพรส์ × เงินที่เสี่ยง"** — surface สิ่งที่ผิดจากนิสัยตัวเองจริง ๆ ในเหรียญที่กระทบเงินคุณ = สิ่งที่คู่ควรกับสายตาที่มีจำกัด

### Visual (bubble field)
| encode | mapping |
|---|---|
| ขนาด bubble | น้ำหนักเงินในพอร์ต (`weight_pct`) |
| pulse (เต้น) | `∝ |z|` — ผิดปกติมาก = เต้นถี่/แรง · CSS ล้วน ไม่กิน data |
| สี | **ทิศทางเท่านั้น** — เขียว(`mint`)ขึ้น / แดง(`coral`)ลง / เทา(`muted`)ปกติ-นิ่ง |
| ตำแหน่ง | deterministic ตาม rank (grid/spiral) — **ไม่ใช้ d3-force เต็มสูบ** (≤8 เหรียญ ไม่จำเป็น คุมแรง) |

> **กติกาสี:** viz นี้เป็นเรื่อง **deviation ไม่ใช่ Heat** → ไม่แตะ `heat-*` เลย ไม่ชน iron rule §design.md และเป็น "design system in action" ให้โชว์ Track 2 ได้

### Interaction — คลิก bubble → glass-box + AI
- เปิด panel: breakdown **deterministic** (z, ช่วงปกติ ±SD, มูฟวันนี้, จำนวนข่าว) — ตัวเลขจาก `compute_deviation()` + `compute_facts()` ที่มีอยู่
- ต่อด้วย **AI 1 ประโยค** (op ใหม่ `explain_move(coin, deviation)`) grounded อธิบาย "อะไรขยับ/ทำไม" — สตรีมระหว่างรอ
- **lazy ตอนคลิก + cache** ต่อ `(symbol, snapshot.as_of)` → จ่ายเฉพาะ bubble ที่เปิด, คลิกซ้ำไม่จ่ายซ้ำ

### Fallback (กันพังตอน demo · ผูก Track 1 ข้อ 3)
- **ไม่มี holdings** → ใช้ watchlist ถ่วงเท่ากัน, rank ด้วย `|z|` ล้วน + hint "ใส่ holdings เพื่อถ่วงตามเงินจริง" → Radar ใช้ได้เสมอ ไม่ต้อง setup ก่อน demo
- **ประวัติ <5 วัน** (`enough_data=False`) → bubble เทา "ข้อมูลไม่พอประเมิน" ไม่เข้าอันดับ (ซื่อสัตย์)
- **AI explain พัง** → ตัวเลข glass-box ยังขึ้นครบ (deterministic ไม่ตาย) บรรทัด AI โชว์ fallback — จุดแข็งที่พูดได้

### ขอบเขตงาน
- **Backend (เล็ก):** `/api/heat` คืน deviation+price แล้ว · weight คำนวณ frontend จาก `/api/holdings` × price · **เพิ่มแค่** op `explain_move` + endpoint (lazy+cache) + เพิ่มเข้า golden-set eval + metrics op แยก
- **Frontend (ใหม่):** route `/radar` · `RadarField` · `RadarBubble` · `AttentionPanel`
- ประเมิน ~2–3 วัน solo

### Litmus test 4 ข้อ (เช็คตรง ๆ ตามกติกายามเฝ้าประตู)
1. ช่วยรู้ "ปกติ/ผิดปกติ" ไหม? — ✅ สร้างบน `|z|` โดยตรง
2. ภาษาคน? — ✅ ถ้าแปลง z เป็น "ผิดปกติ ~2 เท่าของช่วงสวิงปกติ" ไม่โชว์ "z=-2.3" ดิบ ๆ ลำพัง
3. หน้าเดียว glance จบ หรือดึงไป dashboard เฝ้าจอ? — ⚠️ **จุดต้องระวังสุด** — Radar เป็นแท็บแยก เสี่ยงดริฟต์ไปทาง "จอเฝ้า". ต้อง positioning เป็น **glance view** (เปิด → triage แวบเดียว → ปิด) **ไม่ใช่** หน้าที่เปิดค้างจ้อง — ถ้าเริ่มไถ/จ้องนาน = หลุดธีม
4. เคารพกติกาเหล็ก? — ✅ deviation ไม่ใช่ verdict · ไม่แตะเงิน · `explain_move` ต้องผ่าน grounding eval (ห้ามซื้อ/ขาย) — **AI surface ที่เสี่ยงสุด** เพราะ "ผิดปกติขาลง" ล่อให้ขึ้นคำว่าขาย → eval ต้องครอบตัวนี้แน่นเป็นพิเศษ
