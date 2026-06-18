"use client";

import { useEffect, useMemo, useState } from "react";
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

type InputMode = "amount" | "usd" | "pct";

const MODE_LABELS: Record<InputMode, string> = {
  amount: "จำนวน",
  usd: "USD",
  pct: "%",
};

const MODE_PLACEHOLDERS: Record<InputMode, string> = {
  amount: "0.5",
  usd: "1000",
  pct: "30",
};

function resolveCoinAmount(
  sym: string,
  raw: number,
  mode: InputMode,
  price: number,
  holdings: Holding[],
  priceBySymbol: Map<string, number>
): { amount: number } | { error: string } {
  if (mode === "amount") return { amount: raw };

  if (price <= 0) {
    return { error: "ยังไม่มีราคาเหรียญนี้ — ลองใหม่ในอีกสักครู่" };
  }

  if (mode === "usd") return { amount: raw / price };

  if (raw >= 100) return { error: "ใส่ % น้อยกว่า 100" };

  const otherTotal = holdings
    .filter((h) => h.symbol !== sym)
    .reduce((s, h) => s + h.amount * (priceBySymbol.get(h.symbol) ?? 0), 0);

  if (otherTotal <= 0) {
    return { error: "ใช้ % ได้เมื่อมีเหรียญอื่นในพอร์ตแล้ว — เหรียญแรกใส่เป็นจำนวนหรือ USD" };
  }

  const targetPct = raw / 100;
  const targetUsd = (targetPct * otherTotal) / (1 - targetPct);
  return { amount: targetUsd / price };
}

/**
 * Manual holdings (PLAN milestone 1). The user types what they hold — no API
 * key, no liability. This turns "the market" into "your money" and feeds the
 * portfolio-weighted digest.
 */
export default function HoldingsPanel({ holdings, liveCoins, onChange }: Props) {
  const [symbol, setSymbol] = useState("");
  const [value, setValue] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("amount");
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
      items: enriched.map((r) => ({
        ...r,
        pct: total > 0 ? (r.value / total) * 100 : 0,
      })),
    };
  }, [holdings, priceBySymbol]);

  const pctModeDisabled = useMemo(() => {
    if (holdings.length === 0) return true;
    const sym = symbol.trim().toUpperCase();
    if (holdings.length === 1 && holdings[0]?.symbol === sym) return true;
    return false;
  }, [holdings, symbol]);

  useEffect(() => {
    if (inputMode === "pct" && pctModeDisabled) setInputMode("amount");
  }, [inputMode, pctModeDisabled]);

  const handleAdd = async () => {
    const sym = symbol.trim().toUpperCase();
    const raw = parseFloat(value);
    if (!sym) return setError("ใส่ชื่อเหรียญ เช่น BTC");
    if (!Number.isFinite(raw) || raw <= 0) return setError("ใส่ค่าที่มากกว่า 0");

    const price = priceBySymbol.get(sym) ?? 0;
    const resolved = resolveCoinAmount(sym, raw, inputMode, price, holdings, priceBySymbol);
    if ("error" in resolved) return setError(resolved.error);

    setBusy(true);
    setError(null);
    try {
      const next = await upsertHolding(sym, resolved.amount);
      onChange(next);
      setSymbol("");
      setValue("");
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

  const handleModeChange = (mode: InputMode) => {
    if (mode === "pct" && pctModeDisabled) return;
    setInputMode(mode);
    setError(null);
  };

  return (
    <section className="bg-panel/60 border border-line rounded-3xl p-5 sm:p-6">
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

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="เหรียญ (BTC)"
              className="w-full sm:w-28 bg-base border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted outline-none focus:border-mint/40 uppercase"
            />
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={
                inputMode === "amount"
                  ? `จำนวน (${MODE_PLACEHOLDERS.amount})`
                  : inputMode === "usd"
                    ? `มูลค่า ($${MODE_PLACEHOLDERS.usd})`
                    : `สัดส่วน (${MODE_PLACEHOLDERS.pct}%)`
              }
              inputMode="decimal"
              className="flex-1 min-w-0 bg-base border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted outline-none focus:border-mint/40 tabular-nums"
            />
            <div className="flex rounded-lg border border-line overflow-hidden shrink-0">
              {(Object.keys(MODE_LABELS) as InputMode[]).map((mode) => {
                const disabled = mode === "pct" && pctModeDisabled;
                const active = inputMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleModeChange(mode)}
                    className={`px-2.5 py-2 text-[11px] font-medium transition-colors ${
                      active
                        ? "bg-mint/15 text-mint"
                        : disabled
                          ? "bg-base text-muted/40 cursor-not-allowed"
                          : "bg-base text-muted hover:text-ink"
                    }`}
                    title={
                      disabled
                        ? "ใช้ % ได้เมื่อมีเหรียญอื่นในพอร์ตแล้ว"
                        : undefined
                    }
                  >
                    {MODE_LABELS[mode]}
                  </button>
                );
              })}
            </div>
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

        {holdings.length === 0 ? (
          <div className="flex items-center gap-3 py-4 px-1 border border-dashed border-line rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-mint/10 border border-mint/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-mint" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm text-ink font-medium">ยังไม่มีเหรียญในพอร์ต</p>
              <p className="text-xs text-muted mt-0.5">
                เพิ่มเหรียญด้านบน — ใส่ได้ทั้งจำนวนเหรียญ มูลค่า USD หรือ % ของพอร์ต
              </p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-line border border-line rounded-2xl overflow-hidden">
            {rows.items.map((r) => (
              <li key={r.symbol} className="py-2.5 px-3 flex items-center gap-3 bg-base/30">
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
        )}
      </div>
    </section>
  );
}
