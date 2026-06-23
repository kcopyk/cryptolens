"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Coin,
  Holding,
  formatNumber,
  getBinanceKeysStatus,
  syncHoldingsFromBinance,
  upsertHolding,
  removeHolding,
} from "@/lib/api";
import CoinIcon from "./CoinIcon";
import BinanceNetworkBadge from "./BinanceNetworkBadge";
import DemoModeBadge from "./DemoModeBadge";
import type { PortfolioMode } from "@/hooks/useBinanceNetwork";

interface Props {
  holdings: Holding[];
  liveCoins: Coin[];
  onChange: (next: Holding[]) => void;
  onLinkBinance?: () => void;
  portfolioMode?: PortfolioMode;
}

/**
 * Manual holdings + optional read-only Binance sync. Feeds the portfolio-weighted digest.
 */
export default function HoldingsPanel({
  holdings,
  liveCoins,
  onChange,
  onLinkBinance,
  portfolioMode = "demo",
}: Props) {
  const isDemo = portfolioMode === "demo";
  const isTestnet = portfolioMode === "testnet";
  const [symbol, setSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [avgPrice, setAvgPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [binanceLinked, setBinanceLinked] = useState(false);
  const [binanceMasked, setBinanceMasked] = useState<string | null>(null);

  const refreshKeyStatus = useCallback(async () => {
    try {
      const status = await getBinanceKeysStatus();
      setBinanceLinked(status.linked);
      setBinanceMasked(status.api_key_masked ?? null);
    } catch {
      setBinanceLinked(false);
      setBinanceMasked(null);
    }
  }, []);

  useEffect(() => {
    refreshKeyStatus();
    const onChange = () => refreshKeyStatus();
    window.addEventListener("cryptolens_binance_keys_changed", onChange);
    window.addEventListener("cryptolens_network_changed", onChange);
    return () => {
      window.removeEventListener("cryptolens_binance_keys_changed", onChange);
      window.removeEventListener("cryptolens_network_changed", onChange);
    };
  }, [refreshKeyStatus]);

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

  const handleAdd = async () => {
    const sym = symbol.trim().toUpperCase();
    const qty = parseFloat(amount);
    const avg = avgPrice.trim() ? parseFloat(avgPrice) : null;

    if (!sym) return setError("ใส่ชื่อเหรียญ เช่น BTC");
    if (!Number.isFinite(qty) || qty <= 0) return setError("ใส่จำนวนเหรียญที่มากกว่า 0");
    if (avg != null && (!Number.isFinite(avg) || avg <= 0)) {
      return setError("ราคาเฉลี่ยต้องมากกว่า 0");
    }

    setBusy(true);
    setError(null);
    try {
      const next = await upsertHolding(sym, qty, avg);
      onChange(next);
      setSymbol("");
      setAmount("");
      setAvgPrice("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    if (isDemo) {
      setError("ซิงก์ Binance ได้ในโหมด Testnet เท่านั้น — เปลี่ยนในการตั้งค่า");
      return;
    }
    if (!binanceLinked) {
      onLinkBinance?.();
      return;
    }
    setSyncing(true);
    setError(null);
    try {
      const { holdings: next } = await syncHoldingsFromBinance();
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ซิงก์ไม่สำเร็จ");
    } finally {
      setSyncing(false);
    }
  };

  const handleRemove = async (sym: string) => {
    try {
      onChange(await removeHolding(sym));
    } catch {
      /* keep current list on failure */
    }
  };

  return (
    <section className="bg-panel/60 border border-line rounded-3xl p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-ink">พอร์ตของคุณ</h2>
            {isDemo && <DemoModeBadge />}
            {isTestnet && <BinanceNetworkBadge />}
          </div>
          <p className="text-[11px] text-muted mt-0.5">
            {isDemo
              ? "กรอกพอร์ตเองสำหรับนำเสนอ — สรุปถ่วงน้ำหนักตามที่ใส่"
              : "กรอกเองหรือซิงก์จาก Binance Testnet"}
          </p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
          {rows.total > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-muted uppercase tracking-wider">มูลค่ารวม</p>
              <p className="text-lg font-bold text-ink tabular-nums">
                ${formatNumber(rows.total, 2)}
              </p>
            </div>
          )}
          {isTestnet && (
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold border border-line bg-base hover:border-mint/40 hover:text-mint transition-colors disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? "กำลังซิงก์…" : binanceLinked ? "ซิงก์จาก Binance" : "เชื่อม Binance ก่อน"}
          </button>
          )}
          {isTestnet && binanceLinked && binanceMasked && (
            <p className="text-[10px] text-muted text-right">
              Testnet · {binanceMasked}
            </p>
          )}
          {isDemo && (
            <button
              type="button"
              onClick={onLinkBinance}
              className="text-[11px] text-muted hover:text-ink border border-line px-3 py-2 rounded-lg transition-colors"
            >
              เปิด Testnet เพื่อซิงก์
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="เหรียญ (BTC)"
              className="w-full sm:w-24 bg-base border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted outline-none focus:border-mint/40 uppercase"
            />
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="จำนวน (0.5)"
              inputMode="decimal"
              className="flex-1 min-w-0 bg-base border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-muted outline-none focus:border-mint/40 tabular-nums"
            />
            <input
              value={avgPrice}
              onChange={(e) => setAvgPrice(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="ราคาเฉลี่ย ($)"
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
                {isDemo
                  ? "เพิ่มเหรียญด้านบน — โหมด Demo กรอกเอง ไม่ซิงก์ Binance"
                  : "เพิ่มด้านบน หรือซิงก์จาก Binance Testnet"}
              </p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-line border border-line rounded-2xl overflow-hidden">
            {rows.items.map((r) => (
              <li key={r.symbol} className="py-2.5 px-3 flex items-center gap-3 bg-base/30">
                <CoinIcon asset={r.symbol} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-ink">{r.symbol}</span>
                    <span className="text-[11px] text-muted tabular-nums">
                      {r.amount} หน่วย
                    </span>
                    {r.avg_price != null && r.avg_price > 0 && (
                      <span className="text-[10px] text-muted tabular-nums">
                        เฉลี่ย ${formatNumber(r.avg_price, r.avg_price >= 1 ? 2 : 4)}
                      </span>
                    )}
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
