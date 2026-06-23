# CryptoLens — Week 2 Submission (ละเอียด พร้อมอ้างอิงโค้ด)

> **CryptoLens** = triage layer สำหรับ retail trader รายย่อยที่กังวล — ตอบคำถามเดียว "วันนี้ position ฉันเสี่ยงไหม ต้องสนใจอะไรไหม" ไม่ใช่ signal bot / trading terminal
> เอกสารนี้รวม: **(A) Business Model · (B) Track 1 (4 ข้อ) · (C) Track 2 Design System · (D) Track 3 Production · (E) Journal · (F) สถานะ & ช่องว่าง · (G) ไฟล์ logic**
> Track 1–3 อ้างอิง **โค้ดจริง** (ไฟล์/ฟังก์ชัน/บรรทัด) ทุกข้อ · อัปเดต 2026-06-22 · อ้างอิง `PLAN.md` v3.0

---

## หลักสถาปัตยกรรม (อ่านอันนี้ก่อน — มันคือคำตอบของทุกข้อ)

กฎเดียวที่ทั้งระบบยืนอยู่บน: **ตัวเลข = deterministic (pure function) · คำพูด = LLM (grounded)**

แยกกันตั้งแต่ระดับไฟล์ ไม่ใช่แค่ความตั้งใจ:

- `heat.py` / `triage.py` (ตัวเลข) **ไม่ import `ai.py` เลย**
- `ai.py` (คำพูด) import `triage` ทางเดียว — เพื่อใช้เป็น fallback ตอน LLM ตายเท่านั้น

ผลคือทุกตัวเลข (Heat, Deviation, verdict) reproducible + อธิบายได้ ส่วน LLM ทำหน้าที่เดียวคือ "เล่าเป็นภาษาคน" จากตัวเลขที่ป้อนให้ ห้ามคิดเลขเอง ห้ามสั่งซื้อ/ขาย นี่คือ unfair advantage — ขาย *trust* ให้คนที่กังวล ไม่ใช่ขายสัญญาณ

---

# A. Business Model

## A.1 ปัญหา & ทำไมตอนนี้

คนถือคริปโตส่วนใหญ่ขาดทุนเพราะ**อารมณ์ ไม่ใช่ขาดข้อมูล** — ข้อมูลล้นจนตีความไม่ได้ แล้วตัดสินใจด้วย FOMO/panic:

- **84%** ของเทรดเดอร์รายย่อยขาดทุนภายในปีแรก (สำรวจ ส.ค. 2025, n=1,005); 58% เสียทุนเกือบหมดใน 6 เดือนแรก
- **63%** ของผู้ถือคริปโตบอกว่าขาดทุนเพราะ FOMO (Kraken survey 2024, n=1,248)
- BIS: retail Bitcoin buyers **73–81%** ขาดทุน — ส่วนใหญ่โหลดแอป "หลัง" ราคาพุ่งไปแล้ว

pain ตรง wedge: **"วันนี้ต้องสนใจอะไรไหม / ผิดปกติไหม"** — บริบทที่ดับ panic/FOMO ไม่ใช่ "ข้อมูลเยอะขึ้น"

**Timing:** ไทยเป็นผู้นำคริปโต SEA · retail ~13M คน · ยกเว้นภาษี capital gains 5 ปี (2025–2029) ผ่าน exchange ที่มีใบอนุญาต → retail รายย่อย "เทรดเอง กังวลเมื่อสวิง" เข้ามาเยอะ

## A.2 ลูกค้าเป้าหมาย (PLAN v3)

**Retail trader รายย่อยที่ manage position เอง — กังวลเมื่อตลาดสวิง หลังข่าว หรือหลังเข้าไม้**

- เปิดแอป**ตอนกังวล** (reactive) ไม่ใช่ day trader เฝ้าจอทั้งวัน
- ถาม: "position ฉันเสี่ยงไหมวันนี้" · "เหรียญที่ถือขยับผิดปกติไหม" · "มีข่าวที่ต้องจับตาไหม"
- ไม่ใช่ pro/quant · ไม่รอ signal verdict · ไม่ต้องการ P&L/tax/order ในแอป

## A.3 Competitive landscape & positioning

| คู่แข่ง | จุดที่เราต่าง |
|---|---|
| **CoinGecko AI** (เม.ย. 2026) | บอก "ขึ้น/ลงเพราะอะไร" + P&L — แต่**ไม่บอกว่าปกติไหมเทียบ baseline ของเหรียญเอง** (deviation band) |
| **Nansen / Glassnode** | on-chain/metric ดิบ — เราเน้นมือใหม่ + ภาษาคน + ดับ panic |
| **TradingView** | เครื่องมือกราฟ — เราคือ "ไม่ต้องอ่านกราฟ" |
| **CoinStats** | tracker — เราตอบ "ต้องห่วงไหม" |

**Unfair advantage:** แยก **ตัวเลข deterministic** ออกจาก **คำพูด LLM** — ทุกตัวเลขอธิบายได้ ไม่ใช่ black-box

## A.4 Revenue model — freemium + affiliate

| Tier | ราคา | ได้อะไร |
|---|---|---|
| **Free** | ฿0 | digest 1 พอร์ต, watchlist/holdings ≤10, สัญญาณ ปกติ/ผิดปกติ, ถาม AI จำกัด/วัน |
| **Plus** | ~฿149/เดือน | push ทุกเช้า, หลายพอร์ต, Radar, ถาม AI ไม่จำกัด |

**Affiliate:** `TradeOnBinanceButton` = deep-link ออก Binance (ไม่ยิงออเดอร์เอง)

## A.5 Unit economics

จาก metrics วัดจริง (ดู B.4): digest call ≈ 1,500–1,600 token ≈ $0.0002/call (paid projection; free tier = $0)

- user เปิด ~3 ครั้ง/สัปดาห์ → ~30–60 call/เดือน ≈ **$0.006–0.012/user/เดือน**
- cost driver จริงตอน scale = hosting + data API มากกว่า LLM

## A.6 ความเสี่ยง

bear market → engagement หด (แก้: "วันเงียบ = สบายใจได้"); free tier ดีเกิน (gate Plus); CoinGecko ลง segment มือใหม่ (กันด้วย deviation + ภาษาไทย + brand "ไม่หลอกให้เทรด")

---

# B. Track 1 — AI Implementation (ตอบ 4 ข้อ)

## B.1 Technical implementation คืออะไร / ทำงานยังไง / ทำไมเลือก

เลือก **system prompt design (grounded generation) + deterministic metrics + guardrails + custom benchmark** ผสมกัน — implement จริง รันได้ ไม่ใช่ mockup

### (a) Grounded generation ผ่าน system prompt — `ai.py`

LLM call ทุกตัวลอดผ่านประตูเดียว: `complete()` (`ai.py:217`) ซึ่งรวม provider-chain + rate-limit + metrics ไว้ที่เดียว มี 4 generation task:

| Task | ฟังก์ชัน | หน้าที่ |
|---|---|---|
| สรุปเหรียญ | `summarize_coin()` `ai.py:537` | 1–2 ประโยค "use ONLY these numbers… do NOT hallucinate" |
| Daily digest (hero) | `daily_digest()` `ai.py:380` | บังคับ format `VERDICT/NARRATIVE/MOOD/per-coin` แล้ว parse กลับ |
| Chat | `ask_coin()` `ai.py:655` | ตอบคำถามจาก snapshot เท่านั้น |
| Market mood | `market_mood()` `ai.py:566` | 1 บรรทัดอารมณ์ตลาด |

จุดที่ลึกกว่า "ยิง prompt เดียวรวด": chat แยกชนิดคำถามก่อน

- `_classify_ask_question()` (`ai.py:476`) → `news / indicators / status / overview / general`
- `_ask_style_rules()` (`ai.py:500`) feed template ต่อชนิด
- `_ask_max_tokens()` (`ai.py:464`) ปรับ budget 320–480 token ตามชนิด → ไม่จ่าย token เกินจำเป็น

### (b) Deterministic engine — `heat.py` + `triage.py`

- **Heat 0–100** — `compute_heat()` (`heat.py:88`) = RSI 0.40 + volatility-percentile 0.40 + news 0.20 (น้ำหนัก `heat.py:24-26`) คืน `components{}` ครบ → UI โชว์ได้ว่า "ทำไม 82"
- **Deviation band (wedge หลัก)** — `compute_deviation()` (`heat.py:202`) = z-score ของ daily return วันนี้เทียบ baseline ~30 วันของเหรียญเอง
  - `history = returns[:-1]` (`heat.py:243`) ตัดวันนี้ออกจาก baseline ไม่ให้ inflate ตัวเอง
  - `if len(returns) < 5` คืน `enough_data:False` (`heat.py:228`) — ไม่พอข้อมูลก็บอกตรง ๆ ไม่เดา
- **Portfolio triage** — `portfolio_verdict()` (`triage.py:99`) deterministic ล้วน:
  - attention score = `|z| × weight` (`triage.py:28`)
  - กรอง hero ที่ `HERO_ATTENTION_MIN = 40` (`triage.py:24`) → ตัด false alarm เหรียญ impact ต่ำ
  - macro mode เมื่อ ≥75% เหรียญผิดปกติทิศเดียว (`is_macro_abnormal()` `triage.py:53`)

### (c) Guardrails (กระจายหลายชั้น)

- prompt rules ห้ามคำสั่งซื้อ/ขาย ทุก generation task
- `_clean_ask_response()` (`ai.py:521`) ลบ markdown ที่ chat UI render ไม่ได้
- `DIGEST_DISCLAIMER` (`ai.py:589`) แนบทุก digest
- post-parse override: ถ้า LLM พูดสวนทิศตลาด ใช้ค่า fallback แทน (`ai.py` ช่วง `elif fb_level=="normal" and market_dir=="down"`)

### ทำไม**ไม่**เลือก RAG / Agent / OCR / fine-tune

product ตอบจาก market snapshot **สด** ทุกครั้ง ไม่มี knowledge base / เอกสาร user ให้ retrieve — ใส่ RAG = dead complexity. การ "ไม่ใส่ RAG เพราะไม่ตรงปัญหา" เป็นคำตอบที่ดีกว่าใส่เพราะดูเท่

### Provider chain (`ai.complete()`)

```
gemini-2.5-flash → gemini-2.5-flash-lite → gemini-3.1-flash-lite
→ (Gemini keys อื่น ถ้ามี) → groq llama-3.3-70b → groq2
```

Fallthrough เมื่อ quota/429/auth **และ** transient (503/timeout) · `rate_limit.py` คุม RPM ก่อนยิง

## B.2 รู้ได้ยังไงว่ามันดี (eval / benchmark)

มี eval 2 ตัว แยกตาม 2 ความเสี่ยงของ product:

### Grounding eval — `eval/grounding_eval.py` (วัด LLM ไม่หลอก/ไม่สั่งเทรด)

แปลงสัญญาเป็นตัวเลข **grounding rate** ผ่าน 3 check:

1. `check_numbers()` (`grounding_eval.py:88`) — เลข ≥100 (`_AUDIT_THRESHOLD`) ต้อง trace กลับ snapshot ภายใน tolerance 2% (`_REL_TOL`) · threshold 100 จงใจ กัน false positive จาก RSI/% ที่อยู่ในช่วงปลอดภัย
2. No-verdict — จับคำสั่งซื้อ/ขาย ทั้ง TH + EN
3. Disclaimer — digest ต้องมี disclaimer line

```bash
cd backend
python -m eval.grounding_eval          # mock — validate checker+pipeline, ไม่กิน API
python -m eval.grounding_eval --live   # live — ยิง provider จริง พิมพ์ grounding rate
```

ผล mock = 5/5 (checker จับ output มั่วได้, pipeline ไม่พัง) · **live % ยังไม่ commit ใน repo — ต้องรัน `--live` ก่อน present**

### Deviation backtest — `eval/backtest_deviation.py` (วัด signal deterministic)

วัด 3 metric มี gate `_metrics_passed(target=0.85)` (`backtest_deviation.py:321`):

- `calm_accuracy` — วันเงียบบอกว่าเงียบถูกไหม
- `spike_recall` — วันผิดปกติจับได้ไหม
- `ranking_accuracy` — จัดอันดับเหรียญที่ควรดูถูกไหม

production thresholds `DEV_MILD_Z=1.75`, `DEV_ABNORMAL_Z=1.9` (`heat.py:194-195`) มาจาก sweep บน window 2024–2026

## B.3 ถ้า AI พัง เกิดอะไรขึ้น (fallback)

> guardrails = กันก่อนพัง · fallback = พังแล้วยังไม่ให้ user เจอ slop — ทำทั้งคู่

| ชั้น | โค้ด | พฤติกรรมเมื่อพัง |
|---|---|---|
| 1. Provider chain | `complete()` `ai.py:217` + `_is_quota_error` `ai.py:38` + `_is_transient_error` `ai.py:46` | quota/429/503/timeout → provider ถัดไปอัตโนมัติ (gemini 3 models → extra keys → groq×2) |
| 2. Stale cache | `cache.get_stale()` `cache.py:18`, ใช้ที่ `main.py:96,128,160` | insights/news/candles คืน cache เก่า + `stale:true` แทน error |
| 3. Digest ตายทั้งหมด | `daily_digest()` try/except → `raw=""`, `degraded=True` | ใช้ `triage.portfolio_verdict()` แทน LLM — **engine เดียวกับที่ backtest validate** · ไม่ cache ผลพัง |
| 4. Digest parse ผิด | merge `fb_verdict`/`fb_narrative` | ถ้า market ลงแต่ LLM ไม่พูด "ลง" → ใช้ค่า deterministic |
| 5. Frontend | `inferVerdictFromCoins()` ใน `lib/api.ts` + error state ใน `DailyDigest.tsx` | ยังคำนวณ verdict ฝั่ง client ได้ |
| 6. Deterministic รอด | `heat.py` / `triage.py` | Heat/Deviation/facts ไม่พึ่ง LLM — card ยังขึ้นครบ |

**ช่องว่างที่ verify จากโค้ดแล้วว่ามีจริง:** `/api/ask` (`main.py:206`) → `except Exception: raise HTTPException(502)` (`main.py:238`) — ต่างจาก digest ตรงนี้ยังไม่มี deterministic fallback ถ้า provider หมด chat = 502 · ChatPanel แสดง "ลองอีกครั้ง"
*(แก้ง่าย: catch แล้วคืนข้อความจาก `compute_facts()` ที่มีอยู่ใน `snap` แล้ว)*

## B.4 กินเงิน + เวลาเท่าไหร่ (cost & latency)

วัดจริงทุก call ผ่าน `metrics.py`:

- `metrics.record()` เรียกใน `complete()` (`ai.py:248`) เก็บ provider / latency / token ต่อ call
- rolling 500 sample ใน memory → `snapshot()` (`metrics.py:96`) → `GET /api/metrics`
- `PRICING` (`metrics.py:30`) = paid-tier reference rate · free tier จริง = **$0** แต่ projection โชว์ "cost at scale"

**ตัวเลขวัดจริง (daily_digest, gemini-2.5-flash-lite):**

| Metric | ค่า |
|---|---|
| Tokens/call | ~1,563 (prompt ~1,333 + completion ~230) |
| Latency | ~2.9s |
| Cost/call (paid projection) | ~$0.00023 |
| Cost จริงวันนี้ | **$0** (free tier) |

**กลไกคุม cost ในโค้ด:**

- `rate_limit.acquire()` (`rate_limit.py:25`) — rolling 60s window, `AI_MAX_RPM=4` กันชน Gemini free 5 RPM
- `summarize_coin` lazy — ไม่ generate ตอน insights load, สร้างตอน `/api/ask` ครั้งแรกแล้ว cache กลับ (`main.py:229-233`)
- `max_tokens` cap ต่อ op + ปรับตามชนิดคำถาม
- digest cache ราย UTC ชั่วโมง (`digest_bucket()` `main.py:41`)

**ระหว่างรอ:** skeleton/spinner + digest จาก cache ขึ้นทันที · **ยังไม่มี token streaming** (digest ~2.9s เห็นแค่ spinner)

---

# C. Track 2 — Design System

มี system ที่ AI generate UI ใหม่แล้วยังตรง style:

- **Tokens** — `frontend/app/globals.css` `@theme`: 11 color token + Sora / IBM Plex Sans Thai / JetBrains Mono + motion utilities
- **กติกา** — `frontend/design.md`: iron rules (เช่น `heat-*` สงวนให้ `HeatBar`, ทิศทางราคาใช้ mint/coral/muted เท่านั้น)
- **Feed ให้ AI** — `AGENTS.md`, `frontend/AGENTS.md`, `CLAUDE.md` → AI อ่าน rule ก่อน generate
- **Component ที่ใช้ token ตาม system แล้ว** — `HeatBar`, `HoldingsPanel`, `DeviationBadge`, `CoinFactCard`, `DailyDigest`

System in action: `DeviationBadge` ใช้ coral/warn/muted ไม่แตะ `heat-*` · `HeatBar` เป็นเจ้าของ ramp เดียว → สีไม่ชนกันข้ามหน้า

หมายเหตุ: `design.md §6` ยัง mark บาง component เป็น "planned" ทั้งที่โค้ดมีแล้ว — ต้อง sync doc ให้ตรง

---

# D. Track 3 — Production Grade (คิดไว้ · ยังไม่ deploy)

| หัวข้อ | สถานะปัจจุบัน | ขั้นถัดไป |
|---|---|---|
| **Deployment** | local dev | FE → Vercel · BE → Render/Railway/Fly · Dockerize backend |
| **Scaling 100–1k users** | in-memory `cache.py` (single process), sync AI, SQLite | Redis cache · async queue · Postgres — in-memory cache + rate limiter พังก่อนเมื่อ multi-process |
| **Reliability** | provider chain + stale cache + digest degraded ✅ | health-check UI · ask fallback |
| **Database** | SQLite 7 ตาราง (`watchlist`, `holding`, `chart_drawing`, `digest_cache`, `digest_shared_cache`, `digest_force_refresh`, `api_keys`) | Postgres + index `(user_id, bucket)` กัน digest query ช้าตอน data โต |
| **Data / privacy** | trade key เข้ารหัส AES-GCM (`vault.py`) · ไม่มี OCR/RAG บน PII | บังคับ `CRYPTOLENS_MASTER_KEY` จาก secret manager · ถอด dev fallback |

surface ข้อมูล user จำกัด (watchlist / holdings / trade key) → privacy footprint เล็ก

---

# E. Journal

**เลือก technique ไหน เพราะอะไร:** grounded prompt + deterministic Heat/Deviation/triage + guardrails + custom eval — เพราะ product ขาย trust ให้ retail trader ที่กังวล ไม่ใช่สัญญาณเทรด จึงแยก "ตัวเลข" ออกจาก "LLM" ตั้งแต่ระดับสถาปัตยกรรม ไม่ใช้ RAG/Agent เพราะไม่มี KB ให้ retrieve

**เจออะไรตอน implement จริงที่ mockup มองไม่เห็น:**

- ให้ AI คืน Heat = อธิบายไม่ได้ + ไม่ reproducible → ดึงเป็น pure function ใน `heat.py`
- "รู้ว่าดี" ต้องนิยามให้วัดได้ → grounding eval + deviation backtest · number check ต้องตั้ง threshold ≥100 ลด false positive จาก RSI/%
- RPM free tier พังเร็วมาก → ยก `summarize_coin` ออกจาก insights load ทำเป็น lazy ตอน ask + เพิ่ม `rate_limit.py`
- Digest hero false alarm เยอะ → แยก `triage.py` ออกมา filter `|z|×weight ≥ 40` + macro mode
- LLM ตายทั้งหมดแล้ว digest ยังต้องใช้ได้ → deterministic verdict จาก triage (backtest-validated) แทนจอขาว
- cost จริงต่ำกว่าที่กลัว — driver คือ hosting/cache มากกว่า token

---

# F. สถานะ & ช่องว่างที่ต้องปิดก่อน present (เรียงตามผลตอบแทน)

| สิ่งที่ต้องทำ | ทำไม | สถานะ |
|---|---|---|
| 1. รัน `grounding_eval --live` แล้ว commit % | ตอนนี้มีแค่ mock — "รู้ว่าดี" จะอ่อนถ้าตอบได้แค่ mock | ❌ |
| 2. ใส่ deterministic fallback ให้ `/api/ask` | `main.py:238` ยัง 502 — ขัดหลัก fallback ของ brief เอง | ❌ |
| 3. Token streaming | digest ~2.9s เห็นแค่ spinner — brief ถามตรง ๆ | ❌ |
| 4. Sync `design.md §6` กับโค้ดจริง | doc mark "planned" ทั้งที่ implement แล้ว | ⚠️ |

โปรเจกต์ **เกิน bar Week 2** — ไม่ใช่ mockup แล้ว implementation มีจริงตามที่เคลม ปัญหาที่เหลือคือ document นำหน้าโค้ดบางจุด (eval, ask fallback)

---

# G. ไฟล์ logic หลัก (อ้างอิงเร็ว)

| หน้าที่ | ไฟล์ |
|---|---|
| API routes | `backend/main.py` |
| LLM + provider chain | `backend/ai.py` |
| Portfolio verdict (deterministic) | `backend/triage.py` |
| Heat / Deviation / facts | `backend/heat.py` |
| Cost / latency | `backend/metrics.py` |
| Rate limit | `backend/rate_limit.py` |
| Cache + stale fallback | `backend/cache.py` |
| Grounding eval | `backend/eval/grounding_eval.py` |
| Deviation backtest | `backend/eval/backtest_deviation.py` |
| Design tokens / rules | `frontend/app/globals.css`, `frontend/design.md` |

---

## Sources (business model / market research)

- [BIS / FOMO & retail crypto losses — Kraken survey summary](https://www.kraken.com/learn/crypto-fomo)
- [Retail crypto trader loss & FOMO behavior study (FinanceFeeds)](https://financefeeds.com/crypto-trading-psychology/)
- [Cryptocurrencies in Thailand — statistics & facts (Statista)](https://www.statista.com/topics/10781/cryptocurrencies-in-thailand/)
- [Thailand crypto tax exemption 2025 (AIM Bangkok)](https://aimbangkok.com/thailand-crypto-tax-exemption-2025/)
- [Nansen pricing 2025](https://www.nansen.ai/post/top-crypto-analytics-platforms-2025-guide)
- [Glassnode Studio pricing](https://studio.glassnode.com/pricing)
