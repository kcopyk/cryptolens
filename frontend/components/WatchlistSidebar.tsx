"use client";

import { useState } from "react";
import { Coin, addToWatchlist, removeFromWatchlist, formatPrice } from "@/lib/api";

interface Props {
  open: boolean;
  onToggle: () => void;
  symbols: string[];
  coins: Coin[];
  selectedSymbol?: string;
  onSelect: (coin: Coin) => void;
  onChange: (symbols: string[]) => void;
  max?: number;
  /** On mobile the panel floats over content instead of docking — show a backdrop. */
  overlay?: boolean;
}

/**
 * TradingView-style docked watchlist: a collapsible right-side panel with a
 * vertical tab handle. Each row shows live price + 24h change and loads the
 * coin into the main chart on click. Add via the input, remove on hover.
 */
export default function WatchlistSidebar({
  open,
  onToggle,
  symbols,
  coins,
  selectedSymbol,
  onSelect,
  onChange,
  max = 10,
  overlay = false,
}: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bySymbol = new Map(coins.map((c) => [c.symbol, c]));
  const full = symbols.length >= max;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = input.trim().toUpperCase();
    if (!symbol || busy) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await addToWatchlist(symbol));
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "เพิ่มเหรียญไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (symbol: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await removeFromWatchlist(symbol));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบเหรียญไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Mobile: dim + click-to-dismiss backdrop behind the floating panel */}
      {overlay && open && (
        <div className="fixed inset-0 z-30 bg-black/50 transition-opacity" onClick={onToggle} aria-hidden="true" />
      )}

      {/* Vertical tab handle — always visible, rides the panel's left edge */}
      <button
        onClick={onToggle}
        style={{ right: open ? 300 : 0 }}
        aria-label={open ? "ซ่อน Watchlist" : "เปิด Watchlist"}
        className="fixed top-1/2 -translate-y-1/2 z-40 transition-[right] duration-300 bg-zinc-900 border border-zinc-800 border-r-0 rounded-l-lg px-1.5 py-3 flex flex-col items-center gap-2 hover:bg-zinc-800"
      >
        <svg
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${open ? "" : "rotate-180"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] uppercase tracking-wider text-zinc-300 font-semibold">
          Watchlist
        </span>
        <span className="text-[9px] font-bold text-violet-400 tabular-nums">{symbols.length}</span>
      </button>

      {/* Sliding panel (width-based so nothing overflows the viewport) */}
      <aside
        style={{ width: open ? 300 : 0 }}
        className="fixed top-0 right-0 h-screen z-40 overflow-hidden transition-[width] duration-300 bg-zinc-950 border-l border-zinc-800"
      >
        <div className="w-[300px] h-full flex flex-col">
          <div className="px-3.5 pt-4 pb-3 border-b border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Watchlist</h2>
              <span className="text-[10px] text-zinc-600 tabular-nums">
                {symbols.length}/{max}
              </span>
            </div>
            <form onSubmit={handleAdd} className="flex items-center gap-1.5">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={full ? "เต็มแล้ว" : "เพิ่มเหรียญ เช่น XRP"}
                disabled={full || busy}
                maxLength={12}
                className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 rounded-lg text-xs px-2.5 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 uppercase disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={full || busy || !input.trim()}
                className="shrink-0 text-xs font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600 text-white px-2.5 py-2 rounded-lg transition-colors"
              >
                {busy ? "…" : "+"}
              </button>
            </form>
            {error && <p className="text-[11px] text-red-400 mt-2">{error}</p>}
          </div>

          {/* Column header */}
          <div className="flex items-center justify-between px-3.5 py-1.5 text-[10px] uppercase tracking-wider text-zinc-600 border-b border-zinc-800/60">
            <span>Symbol</span>
            <span>Last · 24h</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {symbols.map((sym) => {
              const coin = bySymbol.get(sym);
              const selected = sym === selectedSymbol;
              const positive = (coin?.change_24h_pct ?? 0) >= 0;
              return (
                <div
                  key={sym}
                  onClick={() => {
                    if (!coin) return;
                    onSelect(coin);
                    if (overlay) onToggle(); // close the floating panel to reveal the chart
                  }}
                  className={`group flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-zinc-900 cursor-pointer transition-colors ${
                    selected ? "bg-violet-600/15 border-l-2 border-l-violet-500" : "hover:bg-zinc-900 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-sm font-bold ${selected ? "text-violet-300" : "text-zinc-100"}`}>{sym}</span>
                    <span className="text-[10px] text-zinc-600">/USDT</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {coin ? (
                      <div className="text-right">
                        <div className="text-xs font-semibold text-zinc-200 tabular-nums leading-tight">
                          {formatPrice(coin.price)}
                        </div>
                        <div className={`text-[10px] font-medium tabular-nums leading-tight ${positive ? "text-emerald-400" : "text-red-400"}`}>
                          {positive ? "+" : ""}{coin.change_24h_pct.toFixed(2)}%
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(sym);
                      }}
                      disabled={busy}
                      aria-label={`ลบ ${sym}`}
                      className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all disabled:opacity-40"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
            {symbols.length === 0 && (
              <p className="text-[11px] text-zinc-600 italic px-3.5 py-4">ยังไม่มีเหรียญ — เพิ่มด้านบน</p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
