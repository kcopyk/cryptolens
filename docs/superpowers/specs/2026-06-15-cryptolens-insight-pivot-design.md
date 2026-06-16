# CryptoLens — "ผู้ช่วยเข้าใจตลาด" Pivot · Phase 1 Design

> วันที่: 2026-06-15 · ปรับให้ตรงกับ `PLAN.md` ฉบับ 2026-06-16 ("ผู้ช่วยเข้าใจตลาด ไม่ใช่ระบบเทรด")
> ผู้เขียน: dev-intern-2026 (ออกแบบร่วมกับ Claude / Cowork)
> สถานะ: อนุมัติทิศทางแล้ว · พร้อมส่งต่อให้ Claude Code เขียน implementation plan
>
> **หมายเหตุการแก้:** เอกสารนี้ถูกเขียนใหม่ให้ตรงกับ `PLAN.md` (2026-06-16) ซึ่ง **แทนที่** ทั้งแผน trading เดิม (2026-06-11) และร่าง insight-pivot เดิมที่เน้น "watchlist + drawing tools". จุดต่างหลัก: persona แคบลงเป็น glance-and-go, เพิ่ม manual holdings + Heat bar + per-coin fact card + portfolio-weighted digest + push delivery และ **ลดบทบาท** drawing tools (chart = กดเข้าไปดูเอง ไม่ใช่พระเอก)

---

## 1. บริบทและการตัดสินใจเชิงทิศทาง

### 1.1 ปัญหาที่ค้นพบระหว่าง grill
ปัจจุบัน CryptoLens กลายเป็น **สองโปรดักต์มาแปะกัน**:
- **ฝั่ง Insight** (read-only): `/insights`, `/candles`, `/news` (3 แหล่ง), `/mood`, `/ask`, `/digest` + indicators + AI chat (Gemini→Groq) + watchlist — นี่คือส่วนที่ **differentiate ได้จริง**
- **ฝั่ง Trading terminal**: signed `/api/order`, key vault, OrderPanel, balances, order history — ส่วนนี้คือการ **เขียน UI ของ Binance ขึ้นมาใหม่** + ถือ API key ของ user = value ติดลบ (ประสบการณ์เทรดเท่าเดิม แต่ trust/liability เพิ่ม)

`PLAN.md` เดิมวาง trading เป็นเป้า "จริง" และ insight เป็น "แผนสำรอง" — **สรุปว่ากลับหัว** และ `PLAN.md` ฉบับ 2026-06-16 ได้ล็อกทิศทางใหม่นี้แล้ว

### 1.2 ลูกค้าตัวจริง (เลือกคนเดียว)
**Office worker ที่ถือคริปโตอยู่แล้ว แต่ไม่มีเวลา/ความรู้จะตีความกราฟเอง** — กลุ่ม glance-and-go

ไม่ใช่เทรดเดอร์ที่เฝ้าจอทั้งวัน คนกลุ่มนั้นมี Binance + TradingView ที่ดีกว่าเราอยู่แล้ว เราไม่แข่งสนามนั้น

### 1.3 คุณค่าหลัก — "ทำไมคนถึงจะยอมใช้เรา"
**ฆ่า 5 แท็บ** — วันนี้คนกลุ่มนี้ต้องเปิด Binance (ราคา) + TradingView (กราฟ) + Bloomberg + เว็บข่าว แล้วประกอบเองในหัว เรายุบให้เหลือ **หน้าเดียว ภาษาคน** ที่ตอบคำถามเดียวว่า *"วันนี้ต้องสนใจอะไรไหม"* แล้วจบ

ไม่มีเจ้าไหนให้ "มุมรวม + ย่อยแล้ว + ภาษาคน" สำหรับคริปโตรายย่อย — นั่นคือช่องของเรา

### 1.4 การตัดสินใจที่ล็อกแล้ว
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

### 1.5 กติกาเหล็ก (ห้ามข้าม)
1. **ห้าม print คำว่า "ควรซื้อ / ควรขาย / น่าซื้อ" บนจอ** — วินาทีที่ออก verdict เรากลายเป็นคนขาย signal: รับ liability เต็ม, โดน ก.ล.ต. มอง, ต้องมี track record, และเลขถูกจับผิดได้ทุกวัน
2. **คะแนน Heat ต้อง deterministic** — คำนวณด้วยสูตรจาก RSI + volatility percentile + จำนวนข่าวบวก/ลบ **ห้ามให้ LLM มโนตัวเลข** กดทีไรได้เลขเดิม และกดดู "ทำไมได้ 82" ได้เสมอ
3. **Heat วัด "ร้อน/เย็น" ไม่ใช่ "น่าซื้อ"** — RSI 78 กับ RSI 22 ร้อนทั้งคู่คนละทิศ เราแค่บอกว่า "สุดโต่งแค่ไหน" ไม่ตัดสินทิศ
4. **digest ใส่ "บริบท/ความรุนแรง" ได้ แต่ห้ามสั่ง** — เช่น *"-8% วันนี้ แต่ยังอยู่ในกรอบแกว่งปกติ 30 วัน"* (fact) ไม่ใช่ *"ควรขาย"* (คำสั่ง)
5. **เราไม่แตะเงินผู้ใช้** — ไม่ยิงออเดอร์ ไม่ถือ trade key การลงมือเกิดบน Binance ของผู้ใช้เอง

### 1.6 ขอบเขตเฟส
- **Phase 1 (เอกสารนี้ — โฟกัส):** manual holdings + Heat bar + per-coin fact card + portfolio-weighted digest + deep-link "เทรดบน Binance" + push delivery (free trial → paid)
- **Phase 2 (ภายหลัง):** read-only key สำหรับดึงยอดถืออัตโนมัติ (upgrade ของ manual holdings) + smart alerts + interactive chart drawing tools
- **Phase 0 (ผู้ใช้เลือกข้าม / แช่แข็ง):** trading surface (order placement จริง) — ดู §4 และ §6

---

## 2. เป้าหมาย Phase 1 (Definition of Done)

User เปิด CryptoLens แล้ว:
1. **กรอก holdings ของตัวเอง** (เหรียญไหน กี่หน่วย) เก็บถาวรในบัญชี — ยังไม่แตะ API key
2. เปิดมาเจอ **digest เต็มจอ** ที่ตอบ *"วันนี้ต้องสนใจอะไรไหม"* โดย **ถ่วงน้ำหนักด้วยพอร์ตจริงของ user** — อ่านจบใน ~30 วิ
3. เห็น **Heat bar 0–100** ต่อเหรียญ (โซนเย็น–กลาง–ร้อนเกิน) + กดดู "ทำไมได้คะแนนนี้" ได้
4. เห็น **per-coin fact card** — สถานะ + เหตุผลเป็น fact (เช่น "RSI 78 (overbought) · ลง 12% จากจุดสูง 7 วัน · ข่าวลบ 2/3 วันนี้") โดยเราไม่สรุปซื้อ/ขายแทน
5. เมื่ออยากลงมือ กด **"เทรดบน Binance"** เด้งไปหน้า pair นั้นทันที (CryptoLens ไม่ยิงออเดอร์เอง)
6. ได้รับ **push (LINE/อีเมล) 1 ครั้ง/วัน** เป็น digest สั้น — free trial ก่อน แล้ว upsell เป็น paid

ตัวชี้วัด: user กลับมาเปิด/อ่าน digest ซ้ำ (retention) ไม่ใช่แค่เปิดครั้งเดียว

---

## 3. ฟีเจอร์ Phase 1 — รายละเอียดการออกแบบ

### 3.1 Manual Holdings — ปลดล็อก "พอร์ตของคุณ" ไม่ใช่แค่ "ตลาด"

**เหตุผล:** "ควรห่วงไหม" ตอบไม่ได้ถ้าไม่รู้สัดส่วนถือ — BTC -8% ที่เป็น 3% ของพอร์ต กับ 70% ของพอร์ต คือคนละเรื่อง นี่คือหัวใจของระดับ 2

**Data / identity**
- ต้องมี **user account จริง** สำหรับบันทึก holdings / subscription / push channel — auth นี้เพื่อ **บัญชีผู้ใช้** ไม่ใช่เพื่อถือ trade key
- holdings เป็นข้อมูลส่วนตัว (สัดส่วนเงิน) → ผูกกับ account ไม่ใช่แค่ `X-User-ID` ที่ปลอมได้
- เก็บใน SQLite เดิม (`backend/cryptolens.db`) ตารางใหม่:
  ```
  holding(user_id TEXT, symbol TEXT, amount REAL, created_at TIMESTAMP,
          updated_at TIMESTAMP, PRIMARY KEY(user_id, symbol))
  ```

**Endpoints (backend, `main.py`)**
- `GET    /api/holdings`            → คืน holdings ของ user
- `POST   /api/holdings`            → `{symbol, amount}` เพิ่ม/แก้จำนวน (validate ว่า symbol มีจริงบน Binance)
- `DELETE /api/holdings/{symbol}`   → ลบเหรียญออกจากพอร์ต
- holdings ทำหน้าที่เป็น watchlist โดยปริยาย (เหรียญที่ถือ = เหรียญที่ digest/Heat โฟกัส)

**Frontend**
- คอมโพเนนต์ใหม่ `HoldingsPanel.tsx` — เพิ่ม/แก้/ลบเหรียญ + จำนวน (ใช้ `SearchableDropdown` เดิมเลือก symbol)
- เพิ่ม fn ใน `lib/api.ts`: `fetchHoldings()`, `upsertHolding(symbol, amount)`, `removeHolding(symbol)`
- คำนวณ % ของพอร์ตต่อเหรียญ (จาก amount × ราคาปัจจุบัน) ไว้ feed digest/fact card

> **อนาคต (Phase 2):** "ดึงยอดถืออัตโนมัติ" ให้ใช้ **read-only key** เท่านั้น (อ่านอย่างเดียว ความเสี่ยงต่ำกว่า trade key มาก) + encrypt-at-rest — เป็น *upgrade ทีหลัง* ไม่ใช่งานตอนนี้

### 3.2 Heat Bar — แท่งเดียว 0–100 glance จบ

**สูตร deterministic (ฝั่ง backend, reproducible)**
- คำนวณจาก: **RSI** + **volatility percentile** (เทียบกรอบแกว่งย้อนหลัง เช่น 30 วัน) + **news sentiment** (จำนวนข่าวบวก/ลบวันนี้)
- ผลลัพธ์ 0–100 → map เป็นโซน: **เย็น / กลาง / ร้อนเกิน**
- **ห้ามให้ LLM คำนวณ** — เป็น pure function บน backend, กดทีไรได้เลขเดิม
- ทุกคะแนนต้อง **เปิดให้ผู้ใช้ตรวจที่มา** ได้ ("ทำไมได้ 82" → แสดง component แต่ละตัวที่ประกอบเป็นคะแนน)

**Backend**
- เพิ่มโมดูล เช่น `heat.py`: `compute_heat(symbol) -> {score: int, zone: str, components: {...}}`
- reuse indicator logic จาก `/insights` (RSI), candle จาก `binance.py` (volatility), sentiment จาก `news.py`
- `GET /api/heat?symbol=BTC` → คืน score + zone + breakdown

**Frontend**
- คอมโพเนนต์ `HeatBar.tsx` — แท่ง 0–100 + label โซน (**ไม่มีคำว่าซื้อ/ขาย** บนแกนหรือ label)
- กดแล้วกาง breakdown ของคะแนน (transparency = เกราะกัน "หาว่าเราชี้นำ")

### 3.3 Per-coin Fact Card — "สถานะ + ทำไม"

- ต่อเหรียญ: Heat bar + เหตุผลเป็น fact ล้วน เช่น *"RSI 78 (overbought) · ลง 12% จากจุดสูง 7 วัน · ข่าวลบ 2/3 วันนี้"*
- **ผู้ใช้สรุปเองว่าจะทำอะไร — เราไม่สรุปแทน**
- มีปุ่ม CTA "เทรดบน Binance" (ดู §3.5) อยู่ในการ์ด เพื่อคง context "อ่านแล้วลงมือต่อได้เลย"
- คอมโพเนนต์ `CoinFactCard.tsx` (ต่อยอด/แทน `CoinCard` เดิม)

### 3.4 Portfolio-weighted Daily Digest — digest ที่พูดถึง "เงินคุณ" จริง

**แนวทาง v1 = in-app pull + push (ดู §3.6)** — ground ด้วยข้อมูลจริงเท่านั้น

**Backend**
- ขยาย `/api/digest` ที่มีอยู่ ให้ **ถ่วงน้ำหนักด้วยสัดส่วน holdings** จาก §3.1:
  1. ดึง snapshot ต่อเหรียญ (ราคา/Δ24h + indicators + Heat) reuse logic จาก `/insights` + `heat.py`
  2. ดึงข่าวต่อเหรียญ reuse `news.py`
  3. คำนวณน้ำหนัก = % ของพอร์ต → จัดอันดับว่า "วันนี้ต้องสนใจ X ก่อน เพราะเป็น Y% ของพอร์ตและกำลังร้อนผิดปกติ"
  4. ส่งเข้า AI (`ai.py`, เช่น `daily_digest(coins_with_weight: list[dict]) -> str`) ให้ย่อยเป็น bullet ภาษาคน
- **Cache รายวัน:** ใช้ `cache.py` เดิม key = `digest:{user_id}:{YYYY-MM-DD}` กันยิง LLM ซ้ำ (free-tier quota จำกัด)
- guard: ถ้า holdings > N เหรียญ (เช่น 10) โฟกัสตัวที่น้ำหนัก/Heat สูงสุดเพื่อคุม token

**AI prompt (กันมั่ว — สำคัญเพราะเป็นข้อมูลการเงิน)**
- ground ด้วยข้อมูลจริงที่ส่งเข้าไปเท่านั้น (ราคา/indicator/Heat/หัวข้อข่าว) **ห้ามแต่งราคา/ตัวเลข** — ทุกคำกล่าวต้องอ้างถึงเลข/ข่าวที่มีจริง
- โทน: ภาษาคน เหมาะคนไม่มีเวลา ใส่ "บริบท/ความรุนแรง" ได้ แต่ **ห้ามข้ามเส้นเป็นคำสั่งซื้อ/ขาย** (review prompt เป็นระยะ)
- มี disclaimer ใต้ digest

**Frontend**
- คอมโพเนนต์ `DailyDigest.tsx` แสดง **เต็มจอด้านบน** dashboard ตอนเปิดหน้า (digest = พระเอก)
- มีปุ่ม refresh + timestamp "อัปเดตล่าสุด"
- กราฟ/order book/indicator = ซ่อนใต้การกดเข้าไปดู ไม่โผล่มาแย่งความสนใจ

### 3.5 Deep-link "เทรดบน Binance"

- ใช้ `TradeOnBinanceButton.tsx` ที่ **มีอยู่แล้ว** — ไม่ต้องสร้างระบบเทรดเอง
- รูปแบบลิงก์ spot: `https://www.binance.com/en/trade/{BASE}_{QUOTE}?type=spot`
  - เช่น BTC → `https://www.binance.com/en/trade/BTC_USDT?type=spot` (v1 fix quote = USDT เสมอ)
- เปิด tab ใหม่ (`target="_blank" rel="noopener"`)
- วางปุ่มในจุดที่ user เพิ่งอ่าน fact card/ digest เสร็จ
- **ไม่มี** การส่งออเดอร์ผ่าน backend ในเส้นทางนี้ — ลบความจำเป็นของ vault / HMAC / order endpoint / mainnet gate ทั้งหมดออกจากเส้นทางหลัก

### 3.6 Push Delivery (LINE / อีเมล) — free trial → paid

**เหตุผล:** คนไม่มีเวลา = คนที่จะไม่เปิดเว็บเอง ต้องให้ push วิ่งไปหา และต้องให้ชิมฟรีก่อนถึงจะเห็นค่า

- ส่ง digest 3–5 บรรทัด เช้าก่อนเข้างาน **1 ครั้ง/วัน** (เนื้อหา = ก้อน digest จาก §3.4)
- **free (trial):** push แบบจำกัด (เช่น 1 เหรียญ / สรุปสั้น) ให้ผู้ใช้ "ติด" ก่อน
- **paid:** push ทั้งพอร์ต + ลึกกว่า + ถามต่อใน AI chat ได้
- **Backend:**
  - เก็บ push channel + subscription tier ใน account (§3.1)
  - cron/scheduler ยิง digest ที่ cache ไว้ของวัน (reuse §3.4 ไม่ยิง LLM ซ้ำ)
  - integration: LINE Messaging API และ/หรือ SMTP สำหรับอีเมล
- v1 อาจเริ่มที่ช่องทางเดียวก่อน (เลือก LINE หรืออีเมล) แล้วค่อยเพิ่ม

---

## 4. การจัดการโค้ด Trading เดิม (แช่แข็ง — อย่าลงแรงต่อ)

ระบบยิงออเดอร์ในแอปทั้งหมดถูกพักไว้ เพราะ (1) เสิร์ฟ persona เทรดเดอร์ที่เราตัดทิ้ง (2) intern ship เองไม่ได้ ต้องรอ sign-off + security review (3) ดูดเวลา dev จาก differentiator จริง:

- ❄️ `POST /api/order` + HMAC signing + ยิง Binance จริง (testnet/mainnet)
- ❄️ ต่อ `OrderPanel` → endpoint จริง
- ❄️ encrypted key vault สำหรับ **trade key** + verify withdrawal-disabled
- ❄️ order safety (confirm / size cap / rate-limit ของการยิงออเดอร์)
- ❄️ mainnet gate (`ENABLE_BINANCE_MAINNET` ล็อก false ตามเดิม)

แนวทาง: คงไฟล์ `binance_trade.py`, `vault.py`, `OrderPanel.tsx`, endpoints `/api/order`, `/api/account/*` ไว้แต่ย้ายออกจากเส้นทางหลักของ user → หลัง flag/หน้า "Demo (Testnet)" ที่ติดป้ายชัดว่าเงินปลอม ตอน public launch จริงค่อยตัดสินใจตัดออก (ดู §6)

---

## 5. สถาปัตยกรรมโดยรวม (Phase 1)

```
Frontend (Next.js)                 Backend (FastAPI)              External
─────────────────                  ─────────────────             ─────────
HoldingsPanel   ──account auth─►  /api/holdings        ──►  SQLite (holding)
DailyDigest     ──────────────►  /api/digest (weighted)──►  Binance (price/indic)
HeatBar         ──────────────►  /api/heat             ──►  news.py (3 sources)
                                      │                  ──►  heat.py (deterministic)
                                      └──►  ai.py (Gemini→Groq) [+cache รายวัน]
CoinFactCard CTA ─(deep-link)─────────────────────────────►  Binance trade page
Push (LINE/email) ◄── scheduler ── cached digest         ──►  LINE API / SMTP
```

หลักการแยกหน่วย: holdings (storage), heat (deterministic compute), digest (aggregation+AI, weighted), deep-link (pure client), push (delivery) — แต่ละส่วนทดสอบแยกได้ ไม่พึ่งกันแน่น

---

## 6. ความเสี่ยงค้าง / ต้องเคลียร์ก่อน public launch

1. **Auth สำหรับ holdings (สำคัญขึ้น):** holdings = สัดส่วนเงินส่วนตัว ไม่ควรอยู่บน `X-User-ID` ที่ปลอมได้ → Phase 1 ต้องมี account auth จริงสำหรับบันทึก holdings/subscription/push channel (auth เพื่อบัญชี ไม่ใช่เพื่อ trade key)
2. **Heat/digest ต้อง grounded กับเลขจริง:** ถ้า AI มโน ข้อมูลผิดเรื่องเงินคน trust ตายทันที — ทุกคำกล่าวต้องอ้างถึงตัวเลข/ข่าวที่มีจริง
3. **ห้ามให้ภาษา "บริบท" ไหลข้ามเส้นเป็นคำแนะนำ:** review prompt ของ digest เป็นระยะ
4. **เลขที่ deterministic ต้องเปิดให้ผู้ใช้ตรวจที่มา:** โปร่งใสคือเกราะกัน "หาว่าเราชี้นำ"
5. **Free-tier LLM quota:** digest ยิง LLM ต่อ user/วัน — cache รายวัน (กำหนดแล้ว) + จับ quota error fallback (มีใน `ai.py` chain แล้ว)
6. **News source ความเสถียร:** CryptoPanic free tier จบ เม.ย. 2026 — ยืนยันว่ายังมี NS3 + Google News RSS รองรับ

---

## 7. Out of scope (Phase 1)

- ❌ Order placement จริง / mainnet / ถือ trade key เงินจริงของ user (แช่แข็ง §4)
- ❌ Read-only portfolio bridge / ดึงยอดถืออัตโนมัติ (→ Phase 2, upgrade ของ §3.1)
- ❌ Interactive chart drawing tools (trendline/fib/measure แบบ TradingView) (→ Phase 2; Phase 1 กราฟ = กดเข้าไปดูเอง ไม่ใช่พระเอก)
- ❌ Smart alerts (→ Phase 2)

---

## 8. คำถามที่ยังเปิด (ให้เคาะตอนทำ plan ใน Claude Code)

1. สูตร Heat ถ่วงน้ำหนัก RSI / volatility / news sentiment สัดส่วนเท่าไร และ map เป็นโซนที่ขอบไหน?
2. Digest มี "ภาพรวมตลาด 1 บรรทัด" (reuse `/mood`) นำก่อน bullet ต่อเหรียญไหม? — *แนะนำ: มี mood นำ 1 บรรทัด*
3. เพดานจำนวนเหรียญในพอร์ตที่ digest โฟกัส (คุม token/quota) — *แนะนำเริ่มที่ 10 ตัวน้ำหนัก/Heat สูงสุด*
4. ปุ่ม deep-link fix quote เป็น USDT เสมอ หรือให้เลือก quote? — *แนะนำ: USDT เสมอใน v1*
5. Push v1 เริ่มช่องทางไหนก่อน (LINE หรืออีเมล) และเส้นแบ่ง free trial vs paid อยู่ตรงไหน?
6. Account auth ใช้อะไร (OAuth / email-password / magic link) สำหรับเก็บ holdings ใน Phase 1?
