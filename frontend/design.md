# CryptoLens — Design System

> Single source of truth สำหรับ **สี (tokens)** + **กติกาการใช้** + **สถานะของ component**
> อ้างอิงทิศทางจาก `docs/superpowers/specs/2026-06-15-cryptolens-insight-pivot-design.md` (pivot = "ผู้ช่วยเข้าใจตลาด ไม่ใช่ระบบเทรด")
> tokens จริงนิยามอยู่ใน `app/globals.css` (`@theme`) — ไฟล์นี้คือ "ทำไม/ใช้ยังไง", globals.css คือ "ค่าจริง"

---

## 1. Color tokens

| Token | Hex | หน้าที่ |
|---|---|---|
| `base` | `#0b0e11` | พื้นแอป (app background) |
| `panel` | `#12161c` | พื้นการ์ด / โมดัล / แผง |
| `line` | `rgba(255,255,255,.07)` | เส้นขอบ / divider |
| `ink` | `#f3f5f7` | ตัวอักษรหลัก (foreground) |
| `muted` | `#a7adb5` | ตัวอักษรรอง / label / neutral |
| `mint` | `#27e5b0` | **accent หลักตัวเดียว** · ขึ้น (up/bullish) · CTA |
| `coral` | `#ff6b6b` | ลง (down/bearish) · error |
| `warn` | `#fbbf24` | **system warning** — testnet / risk / notification badge |
| `heat-cold` | `#38bdf8` | Heat bar — โซนเย็น |
| `heat-mid` | `#a7adb5` | Heat bar — โซนกลาง |
| `heat-hot` | `#fb923c` | Heat bar — โซนร้อนเกิน |

ใช้ผ่าน Tailwind: `bg-*`, `text-*`, `border-*`, `ring-*`, `from-*`/`to-*`, `fill-*`/`stroke-*` และ opacity modifier เช่น `text-mint/70`, `bg-warn/10`.

---

## 2. กติกาการใช้สี (iron rules)

1. **`heat-*` สงวนให้ `HeatBar` เท่านั้น** — ห้ามโผล่นอก HeatBar เด็ดขาด (pivot §1.5) เพื่อให้ Heat ramp ไม่มีวันถูกอ่านเป็นสัญญาณซื้อ/ขาย หรือ warning ทั่วไป
2. **Market direction ใช้ได้แค่ 3 สี:** ขึ้น = `mint`, ลง = `coral`, นิ่ง = `muted` — ห้ามใช้ `heat-*` หรือ `warn` กับทิศทางราคา/indicator. ถ้าต้องแยก mild/strong ใช้ **opacity** (เช่น `text-coral/70`) ไม่ใช่สีใหม่
3. **accent หลักมีตัวเดียวคือ `mint`** — digest เป็นพระเอก, mint ใช้ชี้นำสายตา; ห้ามเพิ่ม accent คู่แข่ง (เหตุผลที่ถอน `cyan` ออก)
4. **`warn` = system warning เท่านั้น** (testnet/risk/notify) แยกจาก `coral` (error/ลง) และ `heat-hot` (ความร้อน Heat) อย่างชัดเจน
5. **ห้าม print "ควรซื้อ/ควรขาย/น่าซื้อ"** บนจอ (pivot §1.5) — สีก็ต้องไม่สื่อ verdict

### เลิกใช้ / ห้ามใช้แล้ว
- พาเลตเก่า Tailwind ดิบทั้งหมด: `zinc/violet/emerald/red/amber/orange/...-NNN` → map เป็น token ด้านบน
- `cyan` — ถอนออกจาก theme (YAGNI; ใกล้ `heat-cold` เกินไป)

---

## 3. Component inventory

### Active — pivot core (ลงแรงต่อได้)
| Component | บทบาท |
|---|---|
| `DailyDigest` | พระเอกหน้าแรก — digest เต็มจอ |
| `MoodBar` | ภาพรวมตลาด 1 บรรทัด |
| `CoinCard` | การ์ดต่อเหรียญ (จะ evolve → `CoinFactCard` ดู §4) |
| `MarketTicker` | แถบราคา/ticker |
| `ChartPanel` · `CandlestickChart` · `KLineChartPanel` | กราฟ — **ลดบทบาท** (กดเข้าไปดูเอง ไม่ใช่พระเอก) |
| `WatchlistSidebar` | รายการเหรียญที่ติดตาม |
| `TradeOnBinanceButton` | deep-link ออก Binance (เราไม่ยิงออเดอร์) |
| `AppHeader` · `Logo` · `Sparkline` · `CoinIcon` · `SearchableDropdown` · `IndicatorNews` | shared/primitives |

### Frozen — trading surface (pivot §4 · เงินจริง/trade key)
> recolor ล่าสุดถือเป็น **last cosmetic pass** (ทาให้ไม่ดูพังข้าง UI ใหม่) — หลังจากนี้ **ห้ามลงแรงเพิ่ม feature** และควรย้ายไปหลังธง **Demo (Testnet)**
- `OrderPanel` (ต่อ `/api/order` จริง)
- `OrderBook` · `RecentTrades` · `OrdersPanel`
- ส่วน **key-vault** ใน `SettingsModal` (เก็บ trade key)
- `app/portfolio` (ยอด Spot Testnet)
- backend คู่กัน: `binance_trade.py`, `vault.py`, `/api/order`, `/api/account/*`

### Planned — ยังไม่สร้าง (บล็อกที่ backend)
| Component | รอ backend | หมายเหตุ |
|---|---|---|
| `HeatBar` | `heat.py` + `GET /api/heat` (deterministic) | เจ้าของ `heat-*` ramp เพียงผู้เดียว · กดดู breakdown ได้ |
| `HoldingsPanel` | ตาราง `holding` + `GET/POST/DELETE /api/holdings` | manual holdings (ใช้ `SearchableDropdown` เลือก symbol) |
| `CoinFactCard` | reuse `/api/insights` + `/api/heat` | evolve จาก `CoinCard` — Heat bar + เหตุผลเป็น fact ล้วน + CTA Binance |

---

## 4. แผนถัดไป (ไม่ใช่งานรอบนี้)
1. **Backend ก่อน:** `heat.py` (สูตร RSI + volatility percentile + news sentiment → 0–100 + zone + components) และ holdings (ตาราง + endpoints)
2. **แล้วค่อยสร้าง frontend:** `HeatBar` → `HoldingsPanel` → `CoinFactCard` (evolve `CoinCard`)
3. **ย้าย trading surface** ไปหลังธง Demo (Testnet) ตาม pivot §4
