"use client";

import { useMemo, useState } from "react";
import {
  Coin,
  Holding,
  formatNumber,
  upsertHolding,
  removeHolding,
} from "@/lib/api";
import CoinIcon from "./CoinIcon";

interface Props {
  holdings: Holding[];
  /** Live coins (for prices). Held coins are kept in the live set by the page. */
  liveCoins: Coin[];
  onChange: (next: Holding[]) => void;
}

/**
 * Manual holdings (PLAN milestone 1). The user types what they hold — no API
 * key, no liability. This turns "the market" into "your money" and feeds the
 * portfolio-weighted digest.
 */
export default function HoldingsPanel({ holdings, liveCoins, onChange }: Props) {
  const [symbol, setSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceBySymbol = useMemo(
    () => new Map(liveCoins.map((c) => [c.symbol, c.price])),
    [liveCoins]
  );

  const rows = useMemo(() => {
    const enriched = holdings.map((h) => {
      const price = priceBySymbol.get(h.symbol) ?? 0;
      return { ...h, price, value: h.amount * price };
    });
    const total = enriched.reduce((s, r) => s + r.value, 0);
    return {
      total,
      items: enriched
        .map((r) => ({ ...r, pct: total > 0 ? (r.value / total) * 100 : 0 }))
        .sort((a, b) => b.value - a.value),
    };
  }, [holdings, priceBySymbol]);

  const handleAdd = async () => {
    const sym = symbol.trim().toUpperCase();
    const amt = parseFloat(amount);
    if (!sym) return setError("ใส่ชื่อเหรียญ เช่น BTC");
    if (!Number.isFinite(amt) || amt <= 0) return setError("ใส่จำนวนที่มากกว่า 0");
    setBusy(true);
    setError(null);
    try {
      const next = await upsertHolding(sym, amt);
      onChange(next);
      setSymbol("");
      setAmount("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (sym: string) => {
    try {
      onChange(await removeHolding(sym));
    } catch {
      /* keep current list on failure */
    }
  };

  const addForm = (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="เหรียญ (BTC)"
          className="w-24 bg-base border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted outline-none focus:border-mint/40 uppercase"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="จำนวน (0.5)"
          inputMode="decimal"
          className="flex-1 min-w-0 bg-base border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted outline-none focus:border-mint/40 tabular-nums"
        />
        <button
          onClick={handleAdd}
          disabled={busy}
          className="shrink-0 px-4 py-2 rounded-lg text-sm font-bold bg-mint text-base hover:bg-mint/90 transition-colors disabled:opacity-50"
        >
          เพิ่ม
        </button>
      </div>
      {error && <p className="text-xs text-coral">{error}</p>}
    </div>
  );

  return (
    <section className="bg-panel/50 border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold text-ink">พอร์ตของคุณ</h2>
          <p className="text-[11px] text-muted mt-0.5">
            กรอกเหรียญที่ถือ เพื่อให้สรุปรายวันพูดถึง &quot;เงินของคุณ&quot; จริง
          </p>
        </div>
        {rows.total > 0 && (
          <div className="text-right">
            <p className="text-[10px] text-muted uppercase tracking-wider">มูลค่ารวม</p>
            <p className="text-lg font-bold text-ink tabular-nums">
              ${formatNumber(rows.total, 2)}
            </p>
          </div>
        )}
      </div>

      {holdings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-mint/10 border border-mint/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-mint" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <p className="text-sm text-ink font-medium">ยังไม่มีเหรียญในพอร์ต</p>
          <p className="text-xs text-muted max-w-xs">
            เพิ่มเหรียญแรกที่คุณถืออยู่ แล้วเราจะถ่วงน้ำหนักสรุปรายวันให้ตรงกับพอร์ตจริง
          </p>
          <div className="w-full max-w-sm mt-1">{addForm}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col divide-y divide-line">
            {rows.items.map((r) => (
              <li key={r.symbol} className="py-2.5 flex items-center gap-3">
                <CoinIcon asset={r.symbol} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink">{r.symbol}</span>
                    <span className="text-[11px] text-muted tabular-nums">
                      {r.amount} หน่วย
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="h-1.5 w-20 bg-line rounded-full overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-mint"
                        style={{ width: `${Math.min(100, r.pct)}%` }}
                      />
                    </span>
                    <span className="text-[10px] text-muted tabular-nums">
                      {r.pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-ink font-medium tabular-nums">
                    {r.price > 0 ? `$${formatNumber(r.value, 2)}` : "—"}
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(r.symbol)}
                  className="shrink-0 text-muted hover:text-coral transition-colors p-1"
                  aria-label={`ลบ ${r.symbol}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-line pt-3">{addForm}</div>
        </div>
      )}
    </section>
  );
}
