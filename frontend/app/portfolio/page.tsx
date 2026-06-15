"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import SettingsModal from "@/components/SettingsModal";
import AllocationChart from "@/components/AllocationChart";
import CoinIcon from "@/components/CoinIcon";
import { fetchInsights, formatNumber } from "@/lib/api";
import { useBinanceLive } from "@/hooks/useBinanceLive";
import { buildPortfolioRows, loadPortfolioData, summarizePortfolio } from "@/lib/portfolio";

function PnlText({
  value,
  pct,
  size = "sm",
}: {
  value: number;
  pct?: number;
  size?: "sm" | "lg";
}) {
  const color = value > 0 ? "text-emerald-400" : value < 0 ? "text-red-400" : "text-zinc-400";
  const textSize = size === "lg" ? "text-base" : "text-sm";

  return (
    <div className={`${textSize} font-semibold tabular-nums ${color}`}>
      <span>
        {value > 0 ? "+" : ""}${formatNumber(value, 2)}
      </span>
      {pct !== undefined && (
        <span className="text-xs ml-1.5 opacity-80">
          ({pct > 0 ? "+" : ""}
          {pct.toFixed(2)}%)
        </span>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [isMainnet, setIsMainnet] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openOrdersCount, setOpenOrdersCount] = useState(0);
  const [hideBalance, setHideBalance] = useState(false);
  const [search, setSearch] = useState("");
  const [backendCoins, setBackendCoins] = useState<Awaited<ReturnType<typeof fetchInsights>>["coins"] | null>(null);
  const [portfolioState, setPortfolioState] = useState<Awaited<ReturnType<typeof loadPortfolioData>> | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [googleUser, setGoogleUser] = useState<{ name: string; email: string; avatar: string } | null>(null);

  // Load Google User from localStorage on mount & sync auth changes
  useEffect(() => {
    const handleAuthChange = () => {
      const saved = localStorage.getItem("cryptolens_google_user");
      if (saved) {
        try {
          setGoogleUser(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse Google user from storage", e);
        }
      } else {
        setGoogleUser(null);
      }
    };

    handleAuthChange();
    window.addEventListener("cryptolens_auth_changed", handleAuthChange);
    return () => {
      window.removeEventListener("cryptolens_auth_changed", handleAuthChange);
    };
  }, []);

  const { coins: liveCoins, ready: marketReady, lastTick, reloadMarket } = useBinanceLive(backendCoins);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [insightsRes, portfolioRes] = await Promise.allSettled([
        fetchInsights(),
        loadPortfolioData(),
      ]);
      if (insightsRes.status === "fulfilled") setBackendCoins(insightsRes.value.coins);
      await reloadMarket();

      if (portfolioRes.status === "fulfilled") {
        setPortfolioState(portfolioRes.value);
        setLinked(portfolioRes.value.linked);
        setIsMainnet(portfolioRes.value.isMainnet);
        setLoadError(portfolioRes.value.error ?? null);
        setOpenOrdersCount(portfolioRes.value.openOrdersCount);
      }
    } catch (err) {
      console.error("Failed to load portfolio:", err);
    } finally {
      setLoading(false);
    }
  }, [reloadMarket]);

  useEffect(() => {
    load();
  }, [load]);

  const balances = portfolioState?.balances ?? [];
  const allTrades = portfolioState?.allTrades ?? {};

  const rows = useMemo(
    () => buildPortfolioRows(balances, liveCoins, allTrades),
    [balances, liveCoins, allTrades]
  );

  const summary = useMemo(() => summarizePortfolio(rows), [rows]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (r) => r.asset.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, search]);

  const masked = (value: string) => (hideBalance ? "******" : value);

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader
        activeNav="portfolio"
        marketReady={marketReady}
        lastTick={lastTick}
        showNetworkBadge={!!(googleUser && linked)}
        isMainnet={isMainnet}
        openOrdersCount={openOrdersCount}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onRefresh={load}
      />

      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="text-zinc-300 font-medium">พอร์ตของฉัน</span>
            <span>/</span>
            <span>Testnet Wallet</span>
          </div>
        </div>

        {linked && (
          <section className="rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-900 via-zinc-900 to-violet-950/30 p-5 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-zinc-400">มูลค่ารวมโดยประมาณ</p>
                  <button
                    onClick={() => setHideBalance((v) => !v)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                    aria-label={hideBalance ? "Show balance" : "Hide balance"}
                  >
                    {hideBalance ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-3xl sm:text-4xl font-bold text-zinc-50 tabular-nums tracking-tight">
                    {masked(`$${formatNumber(summary.totalUsd, 2)}`)}
                  </span>
                  <span className="text-sm text-zinc-500">USD</span>
                </div>

                <p className="text-sm text-zinc-500 tabular-nums">
                  ≈ {masked(`${formatNumber(summary.btcEquivalent, 6)}`)} BTC
                </p>

                {linked && !isMainnet && (
                  <p className="text-xs text-amber-400/80 leading-relaxed">
                    ยอดดึงจาก Spot Testnet wallet ของบัญชีที่ผูก API Key ไว้
                  </p>
                )}
                {loadError && (
                  <p className="text-xs text-red-400 leading-relaxed">{loadError}</p>
                )}

                <div className="flex flex-wrap gap-6 pt-2">
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">กำไร/ขาดทุนวันนี้</p>
                    {hideBalance ? (
                      <span className="text-sm text-zinc-400">******</span>
                    ) : (
                      <PnlText value={summary.totalTodayPnlUsd} pct={summary.todayPnlPct} />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">กำไร/ขาดทุนรวม</p>
                    {hideBalance ? (
                      <span className="text-sm text-zinc-400">******</span>
                    ) : (
                      <PnlText value={summary.totalPnlUsd} pct={summary.totalPnlPct} />
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-3">
                  <Link
                    href="/"
                    className="text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    เทรดเลย
                  </Link>
                  <Link
                    href="/?tab=orders"
                    className="text-xs font-semibold text-zinc-200 border border-zinc-700 hover:border-zinc-500 bg-zinc-900/40 px-4 py-2 rounded-lg transition-colors"
                  >
                    คำสั่งซื้อขาย
                  </Link>
                  <button
                    onClick={load}
                    className="text-xs font-semibold text-zinc-300 border border-zinc-700 hover:border-zinc-500 bg-zinc-900/40 px-4 py-2 rounded-lg transition-colors cursor-pointer"
                  >
                    รีเฟรช
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 lg:min-w-[220px]">
                <AllocationChart rows={rows} />
                <div className="space-y-2 flex-1 min-w-0">
                  {rows
                    .filter((r) => r.usdValue > 0)
                    .slice(0, 4)
                    .map((r) => (
                      <div key={r.asset} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                          <span className="text-zinc-300 truncate">{r.asset}</span>
                        </div>
                        <span className="text-zinc-500 tabular-nums shrink-0">{r.allocationPct.toFixed(1)}%</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-zinc-950 rounded-lg p-0.5 border border-zinc-800 w-fit">
                <span className="px-3 py-1.5 text-xs font-semibold rounded-md bg-zinc-800 text-zinc-100">
                  Spot
                </span>
              </div>
              <span className="text-xs text-zinc-500">
                ถือครอง{" "}
                <span className="text-zinc-300 font-semibold tabular-nums">{filteredRows.length}</span> สินทรัพย์
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <svg
                  className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาเหรียญ"
                  className="bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-600 w-36 sm:w-44"
                />
              </div>
            </div>
          </div>

          {!linked ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-950/40 border border-amber-900/30 flex items-center justify-center">
                <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">ผูก Testnet API Key ก่อน</p>
                <p className="text-sm text-zinc-500 mt-1 max-w-sm">
                  หน้านี้แสดงยอด wallet จาก Binance Spot Testnet ของบัญชีที่เชื่อมต่อกับ CryptoLens
                </p>
              </div>
              <Link
                href="/"
                className="text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl transition-colors"
              >
                ไปตั้งค่า API Key
              </Link>
            </div>
          ) : loading ? (
            <div className="py-20 flex justify-center">
              <svg className="animate-spin h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-20 text-center text-sm text-zinc-500">
              {search.trim() ? "ไม่พบสินทรัพย์ที่ตรงกับการค้นหา" : "ไม่มียอดใน Testnet wallet"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[860px]">
                <thead>
                  <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
                    <th className="px-4 sm:px-5 py-3 font-semibold">เหรียญ</th>
                    <th className="px-4 py-3 font-semibold text-right">จำนวน</th>
                    <th className="px-4 py-3 font-semibold text-right">ราคา · 24h</th>
                    <th className="px-4 py-3 font-semibold text-right">ใช้งานได้</th>
                    <th className="px-4 py-3 font-semibold text-right">ในคำสั่ง</th>
                    <th className="px-4 py-3 font-semibold text-right">มูลค่า (USD)</th>
                    <th className="px-4 py-3 font-semibold text-right">สัดส่วน</th>
                    <th className="px-4 py-3 font-semibold text-right">PnL วันนี้</th>
                    <th className="px-4 py-3 font-semibold text-right">PnL รวม</th>
                    <th className="px-4 py-3 font-semibold text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {filteredRows.map((row) => (
                    <tr key={row.asset} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 sm:px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <CoinIcon asset={row.asset} />
                          <div>
                            <p className="text-sm font-bold text-zinc-100">{row.asset}</p>
                            <p className="text-xs text-zinc-500">{row.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm tabular-nums text-zinc-200">
                        {hideBalance
                          ? "****"
                          : row.balance.total.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 8,
                          })}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <div className="text-sm text-zinc-300">
                          {row.asset === "USDT"
                            ? "$1.00"
                            : `$${formatNumber(row.price, row.price >= 1 ? 2 : 4)}`}
                        </div>
                        {row.asset !== "USDT" && (
                          <div
                            className={`text-xs ${
                              row.change24hPct > 0
                                ? "text-emerald-400"
                                : row.change24hPct < 0
                                  ? "text-red-400"
                                  : "text-zinc-500"
                            }`}
                          >
                            {row.change24hPct > 0 ? "+" : ""}
                            {row.change24hPct.toFixed(2)}%
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm tabular-nums text-zinc-400">
                        {hideBalance
                          ? "****"
                          : row.balance.free.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 8,
                          })}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm tabular-nums text-zinc-500">
                        {hideBalance
                          ? "****"
                          : row.balance.locked.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 8,
                          })}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm font-semibold tabular-nums text-zinc-100">
                        {hideBalance ? "****" : `$${formatNumber(row.usdValue, 2)}`}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <span className="w-14 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <span
                              className="block h-full rounded-full"
                              style={{ width: `${Math.min(100, row.allocationPct)}%`, backgroundColor: row.color }}
                            />
                          </span>
                          <span className="text-xs tabular-nums text-zinc-400 w-10 text-right">
                            {row.allocationPct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {hideBalance || row.asset === "USDT" ? (
                          <span className="text-sm text-zinc-500">—</span>
                        ) : (
                          <PnlText value={row.todayPnlUsd} pct={row.todayPnlPct} />
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {hideBalance || !row.hasPnL ? (
                          <span className="text-sm text-zinc-500">—</span>
                        ) : (
                          <PnlText value={row.pnlUsd} pct={row.pnlPct} />
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {row.asset !== "USDT" && (
                          <Link
                            href="/"
                            className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                          >
                            Trade
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <footer className="px-6 py-3 border-t border-zinc-800 text-xs text-zinc-600 text-center">
        ยอด wallet จาก Spot Testnet · ราคา real-time · ไม่ใช่คำแนะนำการลงทุน
      </footer>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        googleUser={googleUser}
        setGoogleUser={setGoogleUser}
        onKeysChanged={load}
      />
    </div>
  );
}
