# CryptoLens — Design System

> Single source of truth สำหรับ **สี (tokens)** + **กติกาการใช้** + **สถานะของ component**
> อ้างอิงทิศทางจาก `docs/superpowers/specs/2026-06-15-cryptolens-insight-pivot-design.md` (pivot = "ผู้ช่วยเข้าใจตลาด ไม่ใช่ระบบเทรด")
> และ **brand / visual language** จาก `activity/cryptolens-website.html` (marketing reference)
> tokens จริงนิยามอยู่ใน `app/globals.css` (`@theme`) — ไฟล์นี้คือ "ทำไม/ใช้ยังไง", globals.css คือ "ค่าจริง"

---

## 0. Brand identity

| องค์ประกอบ | ค่า |
|---|---|
| **Wordmark** | `Crypto` (ink) + `Lens` (mint) · Sora bold · tracking-tight |
| **Mark** | Aperture lens — dashed ring + 5 blade paths + vertical mint bar + dark aperture cutout · ดู `Logo.tsx` |
| **Tagline** | *Less noise. More signal.* — ใช้ hero / CTA / empty states |
| **Voice** | ภาษาไทยเข้าใจง่าย · อธิบายตัวเลขให้มนุษย์เงินเดือน/มือใหม่ · ไม่สั่งซื้อ-ขาย |

**Logo sizes (app):**
- Header wordmark: icon `w-6 h-6` (24px) + text `text-base font-bold`
- Footer / compact: icon `w-7 h-7` หรือเล็กกว่า mark-only
- ห้าม stretch SVG — ใช้ `viewBox="0 0 48 48"` + class กำหนดขนาด

---

## 1. Color tokens

| Token | Hex | หน้าที่ |
|---|---|---|
| `base` | `#0b0e11` | พื้นแอป (app background) |
| `panel` | `#12161c` | พื้นการ์ด / โมดัล / แผง |
| `panel2` | `#161b22` | พื้นรอง / nested surface (reference site) |
| `line` | `rgba(255,255,255,.07)` | เส้นขอบ / divider |
| `ink` | `#f3f5f7` | ตัวอักษรหลัก (foreground) |
| `muted` | `#a7adb5` | ตัวอักษรรอง / label / neutral |
| `mint` | `#27e5b0` | **accent หลัก** · ขึ้น (up/bullish) · CTA · brand |
| `cyan` | `#19c2d6` | **accent รอง** · หมวดข้อมูล/info (เช่น mood gauge, audience card) — ไม่ใช่ทิศทางราคา |
| `coral` | `#ff6b6b` | ลง (down/bearish) · error |
| `warn` | `#fbbf24` | **system warning** — testnet / risk / notification badge |
| `heat-cold` | `#38bdf8` | Heat bar — โซนเย็น |
| `heat-mid` | `#a7adb5` | Heat bar — โซนกลาง |
| `heat-hot` | `#fb923c` | Heat bar — โซนร้อนเกิน |

ใช้ผ่าน Tailwind: `bg-*`, `text-*`, `border-*`, `ring-*`, `from-*`/`to-*`, `fill-*`/`stroke-*` และ opacity modifier เช่น `text-mint/70`, `bg-warn/10`.

---

## 2. กติกาการใช้สี (iron rules)

1. **`heat-*` สงวนให้ `HeatBar` เท่านั้น** — ห้ามโผล่นอก HeatBar เด็ดขาด (pivot §1.5) เพื่อให้ Heat ramp ไม่มีวันถูกอ่านเป็นสัญญาณซื้อ/ขาย หรือ warning ทั่วไป
2. **Market direction ใช้ได้แค่ 3 สี:** ขึ้น = `mint`, ลง = `coral`, นิ่ง = `muted` — ห้ามใช้ `heat-*`, `warn`, หรือ `cyan` กับทิศทางราคา/indicator. ถ้าต้องแยก mild/strong ใช้ **opacity** (เช่น `text-coral/70`) ไม่ใช่สีใหม่
3. **`mint` = accent หลัก + brand + bullish** · **`cyan` = accent รองสำหรับหมวด UI/info** (icon badge, mood panel tint) — ห้ามใช้ `cyan` แทน `mint` ใน CTA หรือ price delta
4. **`warn` = system warning เท่านั้น** (testnet/risk/notify) แยกจาก `coral` (error/ลง) และ `heat-hot` (ความร้อน Heat) อย่างชัดเจน
5. **ห้าม print "ควรซื้อ/ควรขาย/น่าซื้อ"** บนจอ (pivot §1.5) — สีก็ต้องไม่สื่อ verdict

### เลิกใช้ / ห้ามใช้แล้ว
- พาเลตเก่า Tailwind ดิบทั้งหมด: `zinc/violet/emerald/red/amber/orange/...-NNN` → map เป็น token ด้านบน

---

## 3. Typography

| Role | Stack | ใช้เมื่อ |
|---|---|---|
| **Sans** | Sora → IBM Plex Sans Thai → system-ui | UI copy, headings, body |
| **Mono** | JetBrains Mono | ราคา, %, RSI, volume, ticker, timestamps |

**Scale (reference site → app):**
- Hero/display: `text-4xl`–`text-6xl` font-extrabold tracking-tight (marketing only)
- Section title: `text-3xl` font-bold
- Card title: `text-xl` font-semibold
- Body: `text-[15px]`–`text-base` leading-relaxed
- Label/caption: `text-xs` uppercase tracking-wider font-mono สำหรับ section kicker (`text-mint`)

---

## 4. Layout & atmosphere

| Token / pattern | ค่า | หมายเหตุ |
|---|---|---|
| **Shell max-width** | `1240px` (`max-w-[1240px]`) | content column กลาง |
| **Header height** | `68px` (marketing) · `py-3` compact (app) | sticky + `bg-base/80 backdrop-blur-md` |
| **Border radius** | cards `rounded-3xl` · inner `rounded-xl` · pills `rounded-full` | |
| **Grain overlay** | fixed SVG noise · opacity ~5% | `.fx-grain` — ไม่ repaint ตอน scroll |
| **Grid overlay** | 64px grid · radial mask fade | `.fx-grid` — depth บนพื้น `base` |
| **Selection** | `rgba(39,229,176,.25)` on ink | |

**Layout idioms จาก reference (ใช้เมื่อ fit กับ app):**
- Stat strip: `grid` + `gap-px bg-line` — ช่องแยกด้วยเส้น ไม่ใช่กล่องซ้อนกล่อง
- Bento: `md:grid-cols-3` uneven spans (`col-span-2` สำหรับ hero card)
- Divided metrics: `divide-x divide-line` แทน nested bordered boxes

---

## 5. Motion & interaction

Utilities ใน `globals.css` (+ reference site):

| Class / pattern | พฤติกรรม |
|---|---|
| `.live-dot` | mint pulse ring — สถานะ live / market mood |
| `.reveal` + `.in` | fade-up on scroll · IntersectionObserver only |
| `.glow-card` | lift `-4px` on hover |
| `.ticker-track` | seamless price marquee · pause on hover |
| `.shimmer-text` | mint gradient clip on keyword (marketing hero) |
| `prefers-reduced-motion` | ปิด animation ทั้งหมด · reveal แสดงทันที |

**Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` สำหรับ reveal / card hover

---

## 6. Component inventory

### Active — pivot core (ลงแรงต่อได้)
| Component | บทบาท |
|---|---|
| `DailyDigest` | พระเอกหน้าแรก — verdict + narrative + mood + per-coin |
| `PriceScrollTicker` | แถบราคา live วิ่งใต้ header — top 6 market cap, loop ไม่มีช่องว่าง |
| `AppNav` | แท็บ หน้าหลัก / ข่าวใหญ่ |
| `MacroEventsPanel` | นับถอยหลัง FOMC · CPI · NFP (`/events`) |
| `CoinFactCard` | การ์ดต่อเหรียญ — evidence layer (deviation + 2 headlines + facts) |
| `MarketTicker` | แถบราคา/l stats ใน chart section (opt-in) |
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

## 7. แผนถัดไป (ไม่ใช่งานรอบนี้)
1. **Backend ก่อน:** `heat.py` (สูตร RSI + volatility percentile + news sentiment → 0–100 + zone + components) และ holdings (ตาราง + endpoints)
2. **แล้วค่อยสร้าง frontend:** `HeatBar` → `HoldingsPanel` → `CoinFactCard` (evolve `CoinCard`)
3. **ย้าย trading surface** ไปหลังธง Demo (Testnet) ตาม pivot §4
4. **Visual parity (optional):** grain/grid overlays · shimmer hero · glow-card spotlight border — จาก reference site เมื่อ polish marketing หรือ landing
