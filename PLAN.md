# CryptoLens — แผนเดินหน้า Real Trading (Binance)

> สรุปจากการ grill ทิศทางต่อจาก proposal — 2026-06-11

## ตำแหน่งปัจจุบัน

- **Intelligence Hub เสร็จแล้ว** (สิ่งที่ proposal เรียก "แผนสำรอง"): backend มี `/insights`, `/candles`, `/news`, `/mood`, `/ask` ครบ + indicators + ข่าว 3 แหล่ง + AI chat (Gemini→Groq)
- **Real Trading ยังเป็นศูนย์**: `OrderPanel.tsx` เป็น mock ล้วน (balance hardcode $10,000 + เหรียญคงที่, `MockOrder`, ไม่ยิงจริง) · backend **ไม่มี** endpoint ส่งออเดอร์, ไม่มี HMAC signing, ไม่มี auth, ไม่มีการจัดการ API key

## เป้าหมาย (Definition of Done)

ขึ้น **mainnet เทรดเงินจริง** โดยถือ Binance API key ของผู้ใช้ — แต่ผ่าน testnet เป็นสนามพิสูจน์ก่อนเสมอ

## Decisions ที่ล็อกแล้ว

| หัวข้อ | ตัดสิน |
|---|---|
| ทิศทาง | testnet-first → mainnet เป็นเป้า |
| เก็บ API key | encrypt-at-rest ใน DB (master key ใน secrets manager ไม่ใช่ในโค้ด) |
| Auth | OAuth (Google) — ไม่เก็บ password เอง |
| Key scoping | บังคับ trade-only + verify ผ่าน Binance ว่า withdrawal ปิด |
| สร้างจริง | ต่อ mock → real แล้วค่อยจริง (แต่ endpoint แรกยิง testnet จริง อย่า return ปลอม) |

## เงื่อนไขก่อนขึ้น mainnet (ไม่ใช่ทางเลือก)

การปล่อยแพลตฟอร์มที่ถือ key + แตะเงินจริงของผู้ใช้ มี liability จริง ไม่ใช่สิ่งที่ intern ship เองได้ ก่อนแตะ mainnet ต้องมีครบ:

1. **Sign-off เป็นลายลักษณ์อักษร** จากหัวหน้า/บริษัท
2. **Security review** โดยคนที่ไม่ใช่ผู้เขียนโค้ด

จนกว่าจะครบ → mainnet ถูกบล็อกไว้ที่ env flag

## Milestones (ลำดับลงมือ)

### 1. Backend trading endpoint จริงบน testnet ← unknown เสี่ยงสุด ทำก่อน
- `POST /api/order` sign ด้วย HMAC-SHA256, ยิง Binance **Spot Testnet** จริง (key ใน `.env` ก่อน)
- จัดการ `recvWindow` / `timestamp` ให้ถูก
- จัดการ symbol filters: `LOT_SIZE` (rounding ปริมาณ), `minNotional`, `PRICE_FILTER` (rounding ราคา)
- handle error จาก Binance (-2010 insufficient balance, -1013 filter failure ฯลฯ) ให้ผู้ใช้อ่านรู้เรื่อง

### 2. ต่อ OrderPanel → endpoint จริง
- เลิก hardcode balance — ดึงจาก Binance account endpoint (`GET /api/account` แบบ signed) แทน
- map mock order flow → API จริง, แสดงผล fill จริง

### 3. Auth + encrypted key vault
- OAuth (Google) login + DB + user model
- เพิ่ม key flow: ผู้ใช้วาง API key → **verify ทันที** ว่า key enable spot trading และ **withdrawal = DISABLED** (ถ้าถอนได้ → ปฏิเสธ)
- encrypt key ก่อนเก็บ (เช่น Fernet), master key อยู่ใน secrets manager
- (แนะนำเสริม) บอกผู้ใช้ตั้ง IP whitelist บน Binance

### 4. Order safety (gap ที่จดไว้ — ทำก่อน mainnet)
- confirm dialog ก่อนส่งทุกออเดอร์
- max order size cap
- rate-limit ฝั่ง app

### 5. Mainnet gate
- env flag `TRADING_ENV=testnet|mainnet` ปิดไว้ที่ testnet
- ปลดเป็น mainnet ได้ต่อเมื่อมี sign-off + security review จาก milestone "เงื่อนไข" เท่านั้น

## หมายเหตุความเสี่ยง

- Order placement เป็น **irreversible** — bug = เงินจริงหาย จึงต้อง testnet + confirm + size cap ครบก่อน
- ห้าม log API secret หรือ key ลง stdout/ไฟล์เด็ดขาด
- แยก testnet/mainnet base URL ชัดเจน อย่าให้ flag หลุดสลับโดยไม่ตั้งใจ
