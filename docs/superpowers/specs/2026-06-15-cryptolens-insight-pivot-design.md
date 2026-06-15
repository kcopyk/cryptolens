# CryptoLens — Insight-First Pivot · Phase 1 Design

> วันที่: 2026-06-15 · สรุปจาก session grill + brainstorming
> ผู้เขียน: dev-intern-2026 (ออกแบบร่วมกับ Claude / Cowork)
> สถานะ: อนุมัติทิศทางแล้ว · พร้อมส่งต่อให้ Claude Code เขียน implementation plan

---

## 1. บริบทและการตัดสินใจเชิงทิศทาง

### 1.1 ปัญหาที่ค้นพบระหว่าง grill
ปัจจุบัน CryptoLens กลายเป็น **สองโปรดักต์มาแปะกัน**:
- **ฝั่ง Insight** (read-only): `/insights`, `/candles`, `/news` (3 แหล่ง), `/mood`, `/ask` + indicators + AI chat (Gemini→Groq) — นี่คือส่วนที่ **differentiate ได้จริง**
- **ฝั่ง Trading terminal**: signed `/api/order`, key vault, OrderPanel, balances, order history — ส่วนนี้คือการ **เขียน UI ของ Binance ขึ้นมาใหม่** + ถือ API key ของ user = value ติดลบ (ประสบการณ์เทรดเท่าเดิม แต่ trust/liability เพิ่ม)

`PLAN.md` เดิมวาง trading เป็นเป้า "จริง" และ insight เป็น "แผนสำรอง" — **สรุปว่ากลับหัว**

### 1.2 การตัดสินใจที่ล็อกแล้ว
| หัวข้อ | ตัดสิน | เหตุผล |
|---|---|---|
| เป้าหมายโปรเจกต์ | ship ให้ user จริงใช้ | (ไม่ใช่แค่ demo) |
| Painpoint แกน | **ประหยัดเวลา** — รวมข้อมูลคริปโตที่กระจายหลายแหล่ง/หลาย tab มาไว้ที่เดียว + AI สรุปให้ | โดยเฉพาะมือใหม่ + คนที่ไม่รู้จะหาแหล่งข่าวจากไหน |
| Target หลัก | มือใหม่ / คนอยากประหยัดเวลา (รอง: active trader, long-term) | insight สร้าง value สูงสุดกับกลุ่มที่เครื่องมือเจ้าใหญ่ทิ้งไว้ข้างหลัง |
| ทิศทาง product | **Insight-first** | trading เป็น commodity ที่แข่งกับ Binance เอง + liability สูง |
| Execution (การเทรดจริง) | **ไม่ถือ key / ไม่ทำ order placement เอง** → ใช้ **deep-link ไป Binance** | ได้ value "act fast บน insight" ~90% โดยไม่มี custody/liability/security review |
| โค้ด trading เดิม | **เก็บไว้ที่ testnet** เพื่อโชว์ว่าเคยทำ · ตอน public launch ค่อยพิจารณาตัด | sunk cost ใช้เล่า capstone ได้ |
| แกน retention | **watchlist + daily AI digest** → ต่อยอด alerts | ให้เหตุผลกลับมาใช้ทุกวัน เชื่อมกับ wedge "ประหยัดเวลา" โดยตรง |

### 1.3 ขอบเขตเฟส
- **Phase 1 (เอกสารนี้ — โฟกัส):** watchlist + daily AI digest + deep-link "เทรดบน Binance" + **interactive chart ตีเส้นได้ (drawing tools แบบ TradingView)**
- **Phase 2 (ภายหลัง):** read-only portfolio bridge + smart alerts
- **Phase 0 (ผู้ใช้เลือกข้าม):** ทำ trading surface ให้ปลอดภัยพอ ship — ดู §6 "ความเสี่ยงค้าง"

---

## 2. เป้าหมาย Phase 1 (Definition of Done)

User เปิด CryptoLens แล้ว:
1. **เลือกเหรียญที่สนใจ** เก็บเป็น watchlist ส่วนตัว (persist ข้ามการเข้าใช้)
2. เปิดมาเจอ **"สรุปวันนี้" (daily digest)** ของเหรียญใน watchlist — AI ย่อยข่าว + ความเคลื่อนไหวสำคัญเป็นภาษาคน อ่านจบใน ~30 วิ
3. เมื่ออยากเทรด กด **"เทรดบน Binance"** แล้วเด้งไปหน้า Binance ของ pair นั้นทันที (CryptoLens ไม่ยิงออเดอร์เอง)
4. **วิเคราะห์กราฟเองได้** — ตีเส้น trendline / fib / วัดระยะ บนกราฟ candlestick และเส้นที่วาด **persist** ต่อ user/เหรียญ (กลับมาเปิดยังอยู่)

ตัวชี้วัด: user กลับมาเปิด digest ซ้ำ (retention) ไม่ใช่แค่เปิดครั้งเดียว

---

## 3. ฟีเจอร์ Phase 1 — รายละเอียดการออกแบบ

### 3.1 Watchlist

**Data / identity**
- ใช้ client id ที่มีอยู่แล้ว: `getUserId()` ใน `frontend/lib/api.ts` (ส่งผ่าน header `X-User-ID`) — เพียงพอสำหรับข้อมูล low-stakes แบบ watchlist โดย**ไม่ต้องทำ auth**
- เก็บใน SQLite เดิม (`backend/cryptolens.db`) ตารางใหม่:
  ```
  watchlist(user_id TEXT, symbol TEXT, created_at TIMESTAMP,
            PRIMARY KEY(user_id, symbol))
  ```

**Endpoints (backend, `main.py`)**
- `GET  /api/watchlist`            → คืน list symbol ของ user (จาก `X-User-ID`)
- `POST /api/watchlist`            → `{symbol}` เพิ่มเหรียญ (validate ว่า symbol มีจริงบน Binance)
- `DELETE /api/watchlist/{symbol}` → ลบเหรียญ
- ค่า default ถ้า watchlist ว่าง: BTC, ETH, BNB, SOL (ให้ตรงกับ default เดิมของ `/insights`)

**Frontend**
- คอมโพเนนต์ใหม่ `WatchlistPanel.tsx` — เพิ่ม/ลบเหรียญ (ใช้ `SearchableDropdown` เดิม)
- เพิ่ม fn ใน `lib/api.ts`: `fetchWatchlist()`, `addToWatchlist(symbol)`, `removeFromWatchlist(symbol)`
- หน้า dashboard ดึง insight ตาม watchlist แทน symbol list คงที่

### 3.2 Daily AI Digest

**แนวทาง v1 = in-app pull (ไม่ใช่ push)** — เลือกแบบนี้เพราะ ship ได้ด้วยคนเดียว ไม่ต้องมี email/cron/auth infra (push/email ไป Phase 2)

**Backend**
- `GET /api/digest` → สำหรับ watchlist ของ user:
  1. ดึง snapshot ต่อเหรียญ (ราคา/Δ24h + indicators) reuse logic จาก `/insights`
  2. ดึงข่าวต่อเหรียญ reuse `news.py`
  3. ส่งเข้า AI (เพิ่มฟังก์ชันใน `ai.py` เช่น `daily_digest(coins: list[dict]) -> str`) ให้ย่อยเป็นสรุปสั้น "วันนี้เหรียญคุณมีอะไรเกิดขึ้น" เป็น bullet ต่อเหรียญ
- **Cache รายวัน:** ใช้ `cache.py` เดิม key = `digest:{user_id}:{YYYY-MM-DD}` กันยิง LLM ซ้ำ (free-tier quota จำกัด) — สร้างครั้งแรกของวัน แล้ว serve cache ที่เหลือ
- ใส่ guard: ถ้า watchlist > N เหรียญ (เช่น 10) ตัด/รวมเพื่อคุม token

**AI prompt (กันมั่ว — สำคัญเพราะเป็นข้อมูลการเงิน)**
- ground ด้วยข้อมูลจริงที่ส่งเข้าไปเท่านั้น (ราคา/indicator/หัวข้อข่าว) ห้ามแต่งราคา/ตัวเลข
- โทน: อธิบายภาษาคน เหมาะมือใหม่ ไม่ใช้ศัพท์เทคนิคโดยไม่ขยายความ
- **ไม่ให้คำแนะนำซื้อ/ขาย** (ระบุใน prompt + แสดง disclaimer ใต้ digest) — กัน liability เรื่องคำแนะนำการลงทุน

**Frontend**
- คอมโพเนนต์ `DailyDigest.tsx` แสดงด้านบน dashboard ตอนเปิดหน้า
- มีปุ่ม refresh + แสดง timestamp "อัปเดตล่าสุด"

### 3.3 Deep-link "เทรดบน Binance"

- แทนที่ flow ของ `OrderPanel` (order จริง) ในเส้นทางหลักด้วยปุ่ม CTA
- รูปแบบลิงก์ spot: `https://www.binance.com/en/trade/{BASE}_{QUOTE}?type=spot`
  - เช่น BTC → `https://www.binance.com/en/trade/BTC_USDT?type=spot`
- เปิด tab ใหม่ (`target="_blank" rel="noopener"`)
- วางปุ่มในจุดที่ user เพิ่งอ่าน insight/ข่าวเสร็จ (เช่นใน `CoinCard` / ใต้ digest ต่อเหรียญ) เพื่อคง context "อ่านแล้วลงมือต่อได้เลย"
- **ไม่มี** การส่งออเดอร์ผ่าน backend ในเส้นทางนี้

---

### 3.4 Interactive Chart + Drawing Tools (แบบ TradingView)

**แหล่งข้อมูลกราฟ (ยืนยันจากโค้ด):** ปัจจุบันดึงจาก **Binance ล้วน ไม่มี TradingView** — frontend ยิงตรง REST `https://api.binance.com` + WS `wss://stream.binance.com:9443` ผ่าน `lib/binance.ts` (`fetchKlines`, `subscribeKline`) → `useBinanceChart.ts`; backend `/api/candles` ก็ดึง Binance (`binance.py`). **คง feed เดิม ไม่เปลี่ยนแหล่ง**

**ลิบรารี:** ใช้ **KLineChart** (open source, ฟรี, ไม่ต้องขอ access) ซึ่งมีเครื่องมือวาดในตัว: trendline, horizontal/vertical line, fibonacci retracement, parallel channel, วัดระยะ ฯลฯ
- แทน/เสริม renderer เดิม (`CandlestickChart.tsx` / `ChartPanel.tsx`) ด้วย KLineChart โดยป้อน candle ชุดเดิมจาก `useBinanceChart` (history + realtime merge ยังใช้ logic เดิมได้)
- toolbar เลือกเครื่องมือวาด + ลบ/ล้างเส้น + สลับ interval (reuse `CHART_INTERVALS`)
- **ต่อยอด wedge:** แปะ marker ข่าว/indicator จาก `news.py` / `/insights` ลงบนแกนเวลาเดียวกัน (เช่น จุดข่าวสำคัญบนกราฟ) — ทำให้ "ที่เดียวจบ" มีจริง (Phase 1 อย่างน้อยทำ marker ข่าว, indicator overlay เป็น nice-to-have)

**Persist เส้นที่วาด (per user/เหรียญ)**
- KLineChart export/import overlay เป็น JSON ได้ → เก็บใน SQLite:
  ```
  chart_drawing(user_id TEXT, symbol TEXT, drawings JSON, updated_at TIMESTAMP,
                PRIMARY KEY(user_id, symbol))
  ```
- Endpoints:
  - `GET  /api/chart/drawings?symbol=BTC`  → คืน JSON overlay ของ user/เหรียญนั้น
  - `PUT  /api/chart/drawings`             → `{symbol, drawings}` บันทึก (debounce ฝั่ง client ตอน user หยุดวาด)
- identity ใช้ `X-User-ID` เดิม (low-stakes เหมือน watchlist)

**Frontend**
- คอมโพเนนต์ `lib/api.ts`: `fetchChartDrawings(symbol)`, `saveChartDrawings(symbol, drawings)`
- เส้นที่วาด **ผูกกับเหรียญ** — เปลี่ยนเหรียญแล้วโหลด overlay ของเหรียญนั้น

**หมายเหตุขอบเขต:** เป้าหมายคือ "ตีเส้นวิเคราะห์เองได้ + เซฟไว้" ไม่ใช่ลอก TradingView ครบทุกเครื่องมือ — เอาชุดที่ใช้บ่อย (trendline, horizontal, fib, measure) ให้ดีก่อน เครื่องมือ exotic เก็บทีหลัง

---

## 4. การจัดการโค้ด Trading เดิม (พักไว้ที่ testnet)

- คงไฟล์ `binance_trade.py`, `vault.py`, `OrderPanel.tsx`, endpoints `/api/order`, `/api/account/*` ไว้
- `ENABLE_BINANCE_MAINNET` ล็อก false (ตามเดิม) — mainnet ปิดตาย
- ย้าย trading UI ออกจากเส้นทางหลักของ user → ไปไว้หลัง flag/หน้า "Demo (Testnet)" ที่ติดป้ายชัดว่าเงินปลอม เพื่อให้พี่ๆ ดูได้แต่ไม่ปนกับ value flow
- ตอน public launch จริง: ตัดสินใจตัดออก (ดู §6)

---

## 5. สถาปัตยกรรมโดยรวม (Phase 1)

```
Frontend (Next.js)                 Backend (FastAPI)              External
─────────────────                  ─────────────────             ─────────
WatchlistPanel  ──X-User-ID──►  /api/watchlist        ──►  SQLite (watchlist)
DailyDigest     ──────────────►  /api/digest           ──►  Binance (price/indic)
                                      │                  ──►  news.py (3 sources)
                                      └──►  ai.py (Gemini→Groq) [+cache รายวัน]
Chart(KLineChart) ◄─candles─── lib/binance.ts ─────────►  Binance REST/WS (เดิม)
   └ drawings ───X-User-ID──►  /api/chart/drawings      ──►  SQLite (chart_drawing)
CoinCard CTA    ──(deep-link)────────────────────────────►  Binance trade page
```

หลักการแยกหน่วย: watchlist (storage), digest (aggregation+AI), chart+drawings (Binance feed + overlay persist), deep-link (pure client) แต่ละส่วนทดสอบแยกได้ ไม่พึ่งกันแน่น

---

## 6. ความเสี่ยงค้าง / ต้องเคลียร์ก่อน public launch (ไม่บล็อก Phase 1)

1. **Auth gap (critical):** identity ปัจจุบันมาจาก header `X-User-ID` ที่ client ส่งเอง — ปลอม id คนอื่นได้ ตราบใดที่ยังเปิด per-user key linking (`POST /api/account/keys`) อยู่ = เข้าถึง vault key คนอื่นได้ **ก่อน public launch ต้องทำอย่างใดอย่างหนึ่ง:** (a) ทำ OAuth จริง หรือ (b) ปิด per-user key linking เหลือแค่ shared testnet demo key. สำหรับ watchlist (low-stakes) X-User-ID ยอมรับได้
2. **AI hallucination:** digest เป็นข้อมูลการเงิน — ต้อง ground + disclaimer + ไม่ให้คำแนะนำซื้อขาย (กำหนดใน §3.2)
3. **Free-tier LLM quota:** digest ยิง LLM ต่อ user/วัน — ต้องมี cache รายวัน (กำหนดแล้ว) + จับ quota error fallback (มีใน `ai.py` chain แล้ว)
4. **News source ความเสถียร:** CryptoPanic free tier จบ เม.ย. 2026 — ยืนยันว่ายังมี NS3 + Google News RSS รองรับ

---

## 7. Out of scope (Phase 1)

- ❌ Order placement จริง / mainnet / ถือ key เงินจริงของ user
- ❌ Read-only portfolio bridge (→ Phase 2)
- ❌ Push notification / email digest (→ Phase 2; v1 เป็น in-app pull)
- ❌ Smart alerts (→ Phase 2)
- ❌ OAuth (เป็นเงื่อนไข pre-launch ไม่ใช่ Phase 1)

---

## 8. คำถามที่ยังเปิด (ให้เคาะตอนทำ plan ใน Claude Code)

1. Digest แสดงแบบ "ต่อเหรียญ" ล้วน หรือมี "ภาพรวมตลาด 1 บรรทัด" (reuse `/mood`) นำก่อน? — *แนะนำ: มี mood นำ 1 บรรทัด แล้วตามด้วย bullet ต่อเหรียญ*
2. เพดานจำนวนเหรียญใน watchlist (คุม token/quota) — *แนะนำเริ่มที่ 10*
3. ปุ่ม deep-link fix quote เป็น USDT เสมอ หรือให้เลือก quote? — *แนะนำ: USDT เสมอใน v1*
4. Phase 1 ต้องมี marker ข่าวบนกราฟเลยไหม หรือเริ่มแค่ drawing tools + persist ก่อน? — *แนะนำ: drawing+persist ก่อน, marker ข่าวเป็น stretch ใน Phase 1*
5. เครื่องมือวาดชุดเริ่มต้น (trendline, horizontal, fib, measure) พอไหม หรืออยากได้เพิ่ม? — *แนะนำ: 4 ตัวนี้ก่อน*
