# Week 2 — AI eval + cost/latency (สิ่งที่เพิ่ม)

ปิด 2 ช่องของ Track 1 ที่ยังตอบไม่แน่น: **(ข้อ 2) รู้ได้ยังไงว่าดี** และ **(ข้อ 4) กินเงิน+เวลาเท่าไหร่**

## 1. Grounding / hallucination eval — "รู้ได้ยังไงว่าดี"

วัด **grounding rate**: AI พูดเฉพาะตัวเลข/ข่าวที่เราป้อนให้ และไม่บอกซื้อ/ขาย เป็น %

3 checks ต่อ output:
1. **Number grounding** — ตัวเลขระดับราคาในข้อความต้อง trace กลับไปที่ snapshot ได้ (เผื่อปัดเศษ/ย่อ $109K) — ราคามั่วไม่ผ่าน
2. **No verdict** — ห้ามมีคำสั่งซื้อ/ขาย (ไทย+อังกฤษ)
3. **Disclaimer** — daily digest ต้องมีบรรทัด "ไม่ใช่คำแนะนำการลงทุน"

```bash
cd backend
python -m eval.grounding_eval          # mock: เช็ค logic + pipeline, ไม่กิน API
python -m eval.grounding_eval --live   # live: ยิง provider จริง → ได้ grounding rate จริง
```

- **mock** ใช้พิสูจน์ว่า checker ทำงาน (ป้อน output ดี→ผ่าน, output มั่ว→จับได้) + pipeline ไม่พัง — รันใน CI ได้ ไม่ต้องมี key
- **live** ยิง summarize_coin / ask_coin / daily_digest จริงกับ golden set แล้วสรุป % ที่ผ่าน

golden set แก้ได้ที่ `eval/golden_set.py` (เพิ่มเหรียญ/คำถาม)

> ข้อจำกัดที่พูดได้ตอน present: number check ตรวจเฉพาะเลข ≥ 100 (โซนราคา) เพื่อลด false positive กับ RSI/%; checker เป็น rule-based ไม่ใช่ LLM-judge — ตั้งใจให้ deterministic + อธิบายได้

## 2. Cost & latency metrics — "กินเงิน+เวลาเท่าไหร่"

ทุก AI call บันทึก provider, latency, token (prompt/completion), และ cost ประมาณการ

- `metrics.py` — rolling window ในหน่วยความจำ + คำนวณ cost
- `ai.complete()` จับเวลา + token ทุก call (label ตาม feature: summarize_coin / market_mood / daily_digest / ask_coin)
- `GET /api/metrics` — ดูสรุป: calls, latency avg/p50/p95/max, token/call, cost/call

```bash
curl http://localhost:8000/api/metrics
```

> **เงินจริง = $0** เพราะรันบน free tier — `est_cost_usd` คือ projection ราคา paid tier (Gemini 2.0 Flash $0.10/$0.40, Groq 70b $0.59/$0.79 ต่อ 1M token) ไว้ตอบว่า "ถ้า scale แล้วจะกินเท่าไหร่" ซึ่งคือเลขที่ต้องบริหาร
> ตัวอย่างที่วัดได้: ~1,380 token/call → ~$0.0002/call (paid-tier projection)

## ผูกกับข้ออื่น
- live eval จะ print cost/latency ที่มันใช้ไปด้วย (ข้อ 2 + ข้อ 4 ในรันเดียว)
- fallback (ข้อ 3) มีอยู่แล้ว: provider chain + stale cache
