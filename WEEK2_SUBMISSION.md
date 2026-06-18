# CryptoLens — Week 2 Submission

> ผู้ช่วย "เข้าใจตลาดคริปโต" สำหรับ holder ที่ไม่มีเวลาเฝ้าจอ — ไม่ใช่ระบบเทรด
> เอกสารนี้รวม: **(A) Business Model** + **(B) คำตอบ Track 1 (4 ข้อ)** + **(C) Track 2 Design System** + **(D) Track 3 Production** + **(E) Journal**
> อัปเดต: 2026-06-18

---

# A. Business Model

## A.1 ปัญหา & ทำไมตอนนี้ (market + timing)

คนถือคริปโตส่วนใหญ่ขาดทุนเพราะ**อารมณ์ ไม่ใช่ขาดข้อมูล** — มีข้อมูลล้นเกินจนตีความไม่ได้ แล้วตัดสินใจด้วย FOMO/panic:

- **84%** ของเทรดเดอร์รายย่อยขาดทุนภายในปีแรก (สำรวจ ส.ค. 2025, n=1,005); 58% เสียทุนเกือบหมดใน 6 เดือนแรก
- **63%** ของผู้ถือคริปโตบอกว่าขาดทุนเพราะการตัดสินใจจาก FOMO (Kraken survey 2024, n=1,248) — และ 84% ยอมรับว่าเคยตัดสินใจด้วย FOMO
- การศึกษาของ BIS พบ retail Bitcoin buyers **73–81%** ขาดทุน — ส่วนใหญ่โหลดแอป "หลัง" ราคาพุ่งไปแล้ว (buy high)

pain นี้ตรงกับ wedge ของเราเป๊ะ: **"วันนี้ปกติหรือผิดปกติ"** — บริบทที่ดับ panic/FOMO ได้ ซึ่งเป็น pain ที่เจ็บสุดและคนแก้ให้น้อยสุด (เครื่องมือที่มีเน้น "ข้อมูลเยอะ" ไม่ใช่ "สงบลง")

**Timing (ทำไมตอนนี้):** ไทยเป็นผู้นำการเติบโตคริปโตใน SEA — ปริมาณธุรกรรม +65% YoY, บริษัทจดทะเบียน 400+ ราย, คนไทยใช้คริปโต ~13 ล้านคน (~18% ประชากร, 2023) และมี **ยกเว้นภาษี capital gains 5 ปี (2025–2029)** ผ่าน exchange ที่มีใบอนุญาต = แรงส่งให้ retail รายใหม่เข้ามาอีก กลุ่มนี้คือ "มือใหม่กังวล" — กลุ่มเป้าหมายของเรา

## A.2 ลูกค้าเป้าหมาย

**Engaged retail holder** — มนุษย์เงินเดือนที่ถือคริปโตอยู่แล้ว อยากเข้าใจว่าเกิดอะไรกับเหรียญตัวเอง แต่ไม่มีเวลา/ความรู้ตีความกราฟ เปิดดูสัปดาห์ละไม่กี่ครั้ง (glance-and-go)

ไม่ใช่เทรดเดอร์เฝ้าจอ (มี Binance/TradingView ดีกว่าเราอยู่แล้ว) และไม่ใช่ on-chain alpha hunter (มี Nansen)

## A.3 Competitive landscape & positioning

| คู่แข่ง | จับกลุ่ม | ราคา/เดือน | จุดที่เราต่าง |
|---|---|---|---|
| **Nansen** | on-chain pro/institution | $49–69 | เราไม่เล่น on-chain alpha; เราเน้นมือใหม่ + ภาษาคน |
| **Glassnode** | analyst/quant | $29 (Adv) – $799 (Pro) | metric ดิบเยอะ ต้องตีความเอง; เราตีความให้ + ดับ panic |
| **TradingView** | active trader | ~$15–60 | เครื่องมือกราฟ; เราคือ "ไม่ต้องอ่านกราฟ" |
| **CoinMarketCal** | event hunter | freemium | browse event ทั้งตลาด; เราฝัง event ที่กระทบ "เหรียญคุณ" |
| **CoinStats** | portfolio tracker | freemium (~$14) | tracker เฉยๆ ไม่ตอบ "ต้องห่วงไหม" |

**ช่องว่างที่เรายึด:** ไม่มีใครทำ "ผู้ช่วยภาษาไทย เข้าใจง่าย ตอบว่าปกติ/ผิดปกติ จงใจไม่บอกซื้อ/ขาย" สำหรับมือใหม่กังวล — เป็น positioning ที่ contrarian (ทุกคนแข่งกัน "ให้สัญญาณเทรด" เราขาย "ความสงบ + ความเข้าใจ")

**Unfair advantage:** สถาปัตยกรรมที่**แยก "ตัวเลข" (deterministic, อธิบายได้) ออกจาก "คำพูด" (LLM)** — ในตลาดที่เต็มไป black-box ที่ให้ AI มั่วเลข เราพิสูจน์ทุกตัวเลขได้ = trust ซึ่งเป็นสกุลเงินจริงของ segment "กังวล"

## A.4 Revenue model — freemium subscription + exchange affiliate

**Tier (ราคาตั้งต่ำกว่าคู่แข่ง pro มากเพราะคนละ segment):**

| Tier | ราคา | ได้อะไร |
|---|---|---|
| **Free** | ฿0 | digest รายวัน 1 พอร์ต, watchlist ≤10, สัญญาณ ปกติ/ผิดปกติ, ถาม AI จำกัด/วัน |
| **Plus** | **~฿149/เดือน** (~$4.5) | push สรุปทุกเช้า, หลายพอร์ต, Radar, ถาม AI ไม่จำกัด, event layer |

**รายได้เสริม — exchange affiliate:** ปุ่ม `TradeOnBinanceButton` (มีอยู่แล้วในโค้ด) เป็น deep-link ออก Binance — ต่อ referral/affiliate ได้ทันทีโดยไม่ขัด "เราไม่ยิงออเดอร์เอง" (เคารพกติกาเหล็ก)

## A.5 Unit economics — ทำไม freemium ยั่งยืน

จาก cost ที่**วัดจริง** (ดู B.4): 1 AI call ≈ 1,380 token ≈ **$0.000192** (projection ราคา paid tier; free tier = $0)

- 1 active user เปิดดูสัปดาห์ละ ~3 ครั้ง → digest (cache/วัน) + mood + ถามไม่กี่ครั้ง ≈ **30–60 call/เดือน** ≈ **$0.006–0.012/user/เดือน** ที่ราคา paid tier
- แปลว่า **ต้นทุน LLM ต่อ user แทบเป็นศูนย์** — cost driver จริงตอน scale คือ hosting + data API ไม่ใช่ LLM
- WATCHLIST_MAX=10 + cache ฝั่ง server (digest cache รายวัน) คุม token ไม่ให้บานตามจำนวนเหรียญ

→ free tier เลี้ยงได้แทบฟรี, conversion เป็น Plus แม้แค่ 2–3% ก็เป็นกำไร เพราะต้นทุนแปรผันต่ำมาก

## A.6 ความเสี่ยง

ตลาด bear → engagement หด (แก้: "วันเงียบก็มีคุณค่า" — สอนว่าเงียบ = สบายใจได้, retention ผ่าน push); free tier ดีพอจน conversion ต่ำ (แก้: gate Radar + push + หลายพอร์ตไว้ Plus); คู่แข่งใหญ่ลงมาเล่น segment มือใหม่ (กันด้วยภาษาไทย + ความเร็ว + brand "ผู้ช่วยที่ไม่หลอกให้เทรด")

---

# B. Track 1 — AI Implementation (ตอบ 4 ข้อ)

## B.1 Technical implementation คืออะไร — ใช้ technique ไหน ทำงานยังไง ทำไมเลือก

เลือก **4 techniques ผสมกัน** (ทุกตัว implement จริง รันได้ ไม่ใช่ mockup):

**1) System prompt design (grounded generation)** — แกนหลัก. ทุก prompt (`summarize_coin`, `market_mood`, `daily_digest`, `ask_coin`) บังคับให้ใช้**เฉพาะตัวเลข/ข่าวที่ป้อนให้** ห้ามแต่งราคา/เหตุการณ์ และห้ามบอกซื้อ/ขาย. ป้อน price/indicators/news headlines เข้า prompt แล้วให้ตอบสั้นภาษาคน → *เลือกเพราะ* product คือ "ตีความให้ฟัง" ไม่ใช่ chatbot ทั่วไป โทน/โครงสร้างต้องคุมได้

**2) Custom deterministic metric (Heat + Deviation)** — `heat.py`: Heat score (RSI 0.40 + volatility percentile 0.40 + news sentiment 0.20 → 0–100) และ `compute_deviation()` (z-score ของ daily return เทียบ baseline ~30 วันของเหรียญเอง). **LLM ไม่แตะตัวเลขนี้เลย** — input เดียวกัน → ผลเดียวกันเสมอ, "ทำไม 82" ตอบได้ทุกครั้ง → *เลือกเพราะ* trust ของ segment กังวลมาจากความอธิบายได้ ไม่ใช่ความฉลาดของ AI

**3) Guardrails** — กันที่ระดับ prompt (ห้าม verdict/hallucinate) + แยกเลขออกจาก LLM (LLM พังก็ไม่ทำให้เลขเพี้ยน) + disclaimer ติดทุก digest

**4) Custom benchmark (grounding eval)** — `eval/grounding_eval.py` วัดว่า AI "ดี" ตามนิยามเรา = พูดเฉพาะข้อมูลจริง + ไม่บอกซื้อ/ขาย (ดู B.2)

**Provider chain:** `ai.py` ลองตามลำดับ Gemini 2.0 Flash → Gemini#2 → Groq (llama-3.3-70b) → Groq#2, fallthrough เมื่อเจอ quota/429/auth error — provider-neutral, สลับได้โดยไม่แตะ business logic

## B.2 รู้ได้ยังไงว่ามันดี — benchmark / eval

**Grounding eval** (`backend/eval/`) วัด **grounding rate** เป็น % ด้วย 3 checks ต่อ output:
1. **Number grounding** — เลขระดับราคาในคำตอบต้อง trace กลับ snapshot ได้ (เผื่อปัดเศษ/ย่อ $109K) → ราคามั่ว = fail
2. **No verdict** — ไม่มีคำสั่งซื้อ/ขาย (ไทย+อังกฤษ)
3. **Disclaimer** — digest ต้องมีบรรทัด "ไม่ใช่คำแนะนำการลงทุน"

2 โหมด: **mock** (เช็ค logic + pipeline ไม่กิน API, รัน CI ได้) และ **live** (`--live` ยิงจริง → grounding rate จริง). golden set อยู่ที่ `eval/golden_set.py`

**ผลที่รันแล้ว (mock):** ผ่าน **5/5 (100%)** — checker พิสูจน์แล้วว่าจับ output มั่ว (เลขปลอม + "ควรซื้อ") ได้จริง และยอมรับเลขจริง/เลขย่อ; pipeline (summarize/ask/digest) ไม่พัง

> ข้อจำกัดที่พูดตรงๆ: number check ตรวจเฉพาะเลข ≥ 100 (โซนราคา) เพื่อลด false positive กับ RSI/%; เป็น rule-based ไม่ใช่ LLM-judge — จงใจให้ deterministic + อธิบายได้

## B.3 ถ้า AI พังจะเกิดอะไรขึ้น — fallback

หลายชั้น, ดีกราดทีละขั้น ไม่มีจอขาว/ขยะ:

1. **Provider chain** — provider แรกเจอ quota/429/auth → ข้ามไปตัวถัดไปอัตโนมัติ (Gemini→Gemini2→Groq→Groq2)
2. **Stale cache** — ทุก endpoint หลัก (insights/mood/news/candles) ถ้า fetch พัง → คืน cache เก่าพร้อม flag `stale:true` แทนพัง 502
3. **Empty/format fallback** — `daily_digest` ถ้า model คืน format ผิด → surface raw text แทนแสดงว่างเปล่า
4. **Deterministic survives** — เลข Heat/Deviation ไม่พึ่ง LLM เลย → AI ตายแต่ตัวเลข + breakdown ยังขึ้นครบ (จุดแข็งของ glass-box)
5. **Frontend** — `DailyDigest` ฯลฯ มี error state ชัดเจน (ข้อความ + ตัวเลขที่ยังมี) ไม่ใช่จอขาว

## B.4 กินเงิน + เวลาเท่าไหร่ — cost & latency

ใส่ **metrics module** (`metrics.py`) จับ token + latency + cost ทุก call แยกตาม feature, เปิดดูที่ `GET /api/metrics`

- **Token/call:** ~1,380 token (วัดจริง) — prompt หนักกว่า completion เพราะป้อน indicators+news เข้าไป
- **Cost/call:** **$0** จริง (รันบน free tier) — `est_cost_usd` เป็น projection ราคา paid tier (Gemini 2.0 Flash $0.10/$0.40 ต่อ 1M token) ≈ **$0.000192/call** ไว้ตอบ "ถ้า scale จะกินเท่าไหร่"
- **Latency:** วัดจริงต่อ call ผ่าน `/api/metrics` (avg/p50/p95/max) — แยกตาม provider
- **คุม cost:** `max_tokens` cap ต่อ op + cache ฝั่ง server (digest cache รายวันต่อ user, insights cache 60s) + WATCHLIST_MAX=10 บัง token bloat
- **ระหว่างรอ user เห็นอะไร:** ตอนนี้เป็น **loading spinner/skeleton** + digest แคชรายวัน (เปิดซ้ำขึ้นทันที) — *ยังไม่มี token streaming* (อยู่ใน roadmap ข้อถัดไป เพราะ call สั้น 1–3 วิ ยอมรับได้)

---

# C. Track 2 — Design System

มี design system จริงที่ AI ใช้ต่อได้ (ไม่ใช่แค่หน้าตา):

- **Tokens** — `app/globals.css` `@theme` นิยาม 11 color tokens (base/panel/line/ink/muted/mint/coral/warn/heat-cold/mid/hot) + typography (Sora/IBM Plex Sans Thai ผ่าน next/font) + motion utilities
- **เอกสารกติกา** — `design.md` = single source of truth: token + **iron rules** (เช่น `heat-*` สงวนให้ HeatBar เท่านั้น, ทิศทางใช้แค่ mint/coral/muted + ใช้ opacity แทนการเพิ่มสี, accent หลักตัวเดียว = mint) + component inventory + สถานะ (active/frozen/planned)
- **ให้ AI ใช้ต่อได้** — มี `CLAUDE.md` + `AGENTS.md` feed กติกาเข้า AI → generate component ใหม่แล้วยังตรง style เพราะมี rule คุม ไม่ใช่สุ่ม
- **พิสูจน์ว่าระบบทำงาน:** ฟีเจอร์ Radar (ส่วนเสริมใน PLAN.md) ออกแบบโดย**ไม่แตะ `heat-*`** เพราะเป็นเรื่อง deviation ไม่ใช่ Heat — design system ตัดสินใจสีให้แทนการเดา = "system in action"

---

# D. Track 3 — Production Grade (เริ่มคิด/ทำ)

- **Deployment:** frontend = Next.js → Vercel (ตรงไปตรงมา); backend FastAPI → ต้อง host แยก (Render/Railway/Fly) + ENV สำหรับ API keys + master key. *ยังเป็น greenfield* — ขั้นถัดไปคือ Dockerize backend
- **Scaling — อะไรพังก่อนที่ 100/1,000 users:** (1) **in-process cache** (`cache.py` dict ใน memory) พังเมื่อมีหลาย worker → ย้ายไป Redis; (2) **AI call แบบ sync** บล็อก worker → คิว/async + cache แชร์; (3) **SQLite** เขียนพร้อมกันหลาย user จะล็อก → ย้าย Postgres
- **Reliability:** provider chain + stale cache (ทำแล้ว) รับ AI/data down ได้; ขั้นต่อไป = health check + graceful degradation หน้า UI
- **Database:** SQLite, 7 ตาราง (watchlist, holding, chart_drawing, digest_cache, digest_shared_cache, digest_force_refresh, api_keys). query ที่จะช้าตอน data เยอะ = digest_cache lookup ต่อ user/วัน → index ที่ (user_id, day); แผนย้าย Postgres + connection pool
- **Data / privacy:** API key เทรดของ user เก็บ **เข้ารหัส AES-GCM** (`vault.py`) ไม่ใช่ plaintext = ดี. **ความเสี่ยงที่ต้องแก้ก่อน prod:** master key มี dev fallback hardcode + `.env` อยู่ใน repo → ต้องบังคับ `CRYPTOLENS_MASTER_KEY` จาก secret manager และถอด fallback. ไม่มี OCR/RAG บนข้อมูล user ส่วนตัว → PII surface จำกัด (มีแค่ watchlist/holdings/trade key)

---

# E. Journal

**เลือก technique ไหน เพราะอะไร:** system prompt grounding + deterministic metric (Heat/Deviation) + guardrails + custom eval — เพราะ product ขาย "ความเข้าใจ + trust" ให้มือใหม่กังวล ไม่ใช่ "สัญญาณเทรดแม่นๆ" trust มาจากความอธิบายได้ → จึงแยกตัวเลข (deterministic) ออกจากคำพูด (LLM) ตั้งแต่สถาปัตยกรรม

**เจออะไรตอน implement จริงที่ตอน mockup ไม่เห็น:**
- ตอน mockup คิดว่า "ให้ AI คืนตัวเลข Heat" ก็พอ — พอลงจริงเห็นว่า**ถ้า LLM แตะตัวเลข = อธิบายไม่ได้ + reproduce ไม่ได้** เลยต้องดึงการคำนวณออกมาเป็น pure function แยก
- "รู้ว่าดี" ฟังดูง่ายตอน mockup — พอทำจริงต้องนิยาม "ดี" ให้**วัดได้** (grounding rate) ไม่งั้นเป็นแค่ vibe; และพบว่า number-grounding check มี false positive กับเลขเล็ก (RSI/%) เลยต้องตั้ง threshold
- cost ที่คิดว่าต้องห่วง — พอวัดจริงพบว่า **LLM แทบไม่ใช่ cost driver** (ต่ำกว่าที่กลัว) ตัวที่ต้องบริหารคือ hosting/cache มากกว่า

---

## Sources (business model / market research)
- [BIS / FOMO & retail crypto losses — Kraken survey summary](https://www.kraken.com/learn/crypto-fomo)
- [Retail crypto trader loss & FOMO behavior study (FinanceFeeds)](https://financefeeds.com/crypto-trading-psychology/)
- [Cryptocurrencies in Thailand — statistics & facts (Statista)](https://www.statista.com/topics/10781/cryptocurrencies-in-thailand/)
- [Thailand crypto tax exemption 2025 (AIM Bangkok)](https://aimbangkok.com/thailand-crypto-tax-exemption-2025/)
- [Thailand as Asia crypto hub — ETF/futures regs (Yahoo Finance)](https://finance.yahoo.com/news/thailand-accelerates-bid-become-asia-104715650.html)
- [Nansen pricing & analytics platforms 2025](https://www.nansen.ai/post/top-crypto-analytics-platforms-2025-guide)
- [Glassnode Studio pricing](https://studio.glassnode.com/pricing)
- [Crypto analysis tools landscape 2025 (Milk Road)](https://milkroad.com/research/)
