"use client";

import { useCallback, useEffect, useState } from "react";
import { DigestResponse, fetchDigest } from "@/lib/api";
import TradeOnBinanceButton from "./TradeOnBinanceButton";

interface Props {
  /** Join of watchlist symbols — refetches the digest when the list changes. */
  watchlistKey: string;
}

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function DailyDigest({ watchlistKey }: Props) {
  const [data, setData] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchDigest());
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดสรุปไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on mount and whenever the watchlist changes.
  useEffect(() => {
    load();
  }, [load, watchlistKey]);

  const digest = data?.digest;
  const changeBySymbol = new Map(
    (data?.coins ?? []).map((c) => [c.symbol, c.change_24h_pct])
  );

  return (
    <section className="bg-gradient-to-br from-violet-950/30 to-zinc-900/50 border border-violet-900/40 rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.096L15 15l-5.187.904zM18 5.25L17.25 7.5L15 8.25l2.25.75L18 11.25l.75-2.25L21 8.25l-2.25-.75L18 5.25z" />
          </svg>
          <h2 className="text-sm font-bold text-zinc-100">สรุปวันนี้</h2>
          {data?.cached && (
            <span className="text-[10px] text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">cached</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-[10px] text-zinc-500">อัปเดต {formatUpdated(data.as_of)}</span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40 flex items-center gap-1"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            รีเฟรช
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="space-y-2">
          <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-zinc-800 rounded animate-pulse w-2/3" />
          <div className="h-4 bg-zinc-800 rounded animate-pulse w-1/2" />
        </div>
      )}

      {error && !data && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-red-400">{error}</span>
          <button onClick={load} className="text-xs border border-zinc-700 px-3 py-1 rounded-lg hover:border-zinc-500 text-zinc-300">
            ลองใหม่
          </button>
        </div>
      )}

      {digest && (
        <div className={loading ? "opacity-60" : ""}>
          {digest.overview && (
            <p className="text-sm text-zinc-100 leading-relaxed font-medium mb-3">{digest.overview}</p>
          )}

          <ul className="flex flex-col divide-y divide-zinc-800/70">
            {Object.entries(digest.per_coin).map(([symbol, text]) => {
              const change = changeBySymbol.get(symbol);
              return (
                <li key={symbol} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-violet-300">{symbol}</span>
                      {change !== undefined && (
                        <span className={`text-[11px] font-semibold tabular-nums ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-zinc-300 leading-relaxed mt-0.5">{text}</p>
                  </div>
                  <TradeOnBinanceButton symbol={symbol} />
                </li>
              );
            })}
          </ul>

          {digest.disclaimer && (
            <p className="text-[10px] text-zinc-600 mt-3 border-t border-zinc-800/70 pt-2">⚠ {digest.disclaimer}</p>
          )}
        </div>
      )}
    </section>
  );
}
