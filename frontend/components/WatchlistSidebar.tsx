"use client";

import { useEffect, useRef, useState } from "react";
import { Coin, addToWatchlist, removeFromWatchlist, formatPrice } from "@/lib/api";

interface Props {
  open: boolean;
  onToggle: () => void;
  symbols: string[];
  coins: Coin[];
  selectedSymbol?: string;
  onSelect: (coin: Coin) => void;
  onChange: (symbols: string[]) => void;
  /** Persist a new symbol order after drag-to-reorder. */
  onReorder: (symbols: string[]) => void;
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
  onReorder,
  max = 10,
  overlay = false,
}: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local order for snappy drag feedback; resynced when the parent list changes.
  const [items, setItems] = useState(symbols);
  useEffect(() => setItems(symbols), [symbols.join(",")]);
  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleDragStart = (i: number) => () => {
    dragFrom.current = i;
  };
  const handleDragOver = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragOver !== i) setDragOver(i);
  };
  const handleDrop = (i: number) => () => {
    const from = dragFrom.current;
    dragFrom.current = null;
    setDragOver(null);
    if (from === null || from === i) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    setItems(next);
    onReorder(next);
  };
  const handleDragEnd = () => {
    dragFrom.current = null;
    setDragOver(null);
  };

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
        className="fixed top-1/2 -translate-y-1/2 z-40 transition-[right] duration-300 bg-panel border border-line border-r-0 rounded-l-lg px-1.5 py-3 flex flex-col items-center gap-2 hover:bg-ink/6"
      >
        <svg
          className={`w-3.5 h-3.5 text-muted transition-transform ${open ? "" : "rotate-180"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] uppercase tracking-wider text-ink font-semibold">
          Watchlist
        </span>
        <span className="text-[9px] font-bold text-mint font-mono tabular-nums">{symbols.length}</span>
      </button>

      {/* Sliding panel (width-based so nothing overflows the viewport) */}
      <aside
        style={{ width: open ? 300 : 0 }}
        className="fixed top-0 right-0 h-screen z-40 overflow-hidden transition-[width] duration-300 bg-base border-l border-line"
      >
        <div className="w-[300px] h-full flex flex-col">
          <div className="px-3.5 pt-4 pb-3 border-b border-line">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink">Watchlist</h2>
              <span className="text-[10px] text-muted font-mono tabular-nums">
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
                className="flex-1 min-w-0 bg-panel border border-line rounded-lg text-xs px-2.5 py-2 text-ink placeholder-muted focus:outline-none focus:border-mint focus:ring-1 focus:ring-mint/20 uppercase disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={full || busy || !input.trim()}
                className="shrink-0 text-xs font-medium bg-mint hover:bg-mint/90 disabled:opacity-40 disabled:hover:bg-mint text-base px-2.5 py-2 rounded-lg transition-colors"
              >
                {busy ? "…" : "+"}
              </button>
            </form>
            {error && <p className="text-[11px] text-coral mt-2">{error}</p>}
          </div>

          {/* Column header */}
          <div className="flex items-center justify-between px-3.5 py-1.5 text-[10px] uppercase tracking-wider text-muted border-b border-line">
            <span>Symbol</span>
            <span>Last · 24h</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {items.map((sym, i) => {
              const coin = bySymbol.get(sym);
              const selected = sym === selectedSymbol;
              const positive = (coin?.change_24h_pct ?? 0) >= 0;
              return (
                <div
                  key={sym}
                  draggable
                  onDragStart={handleDragStart(i)}
                  onDragOver={handleDragOver(i)}
                  onDrop={handleDrop(i)}
                  onDragEnd={handleDragEnd}
                  onClick={() => {
                    if (!coin) return;
                    onSelect(coin);
                    if (overlay) onToggle(); // close the floating panel to reveal the chart
                  }}
                  className={`group flex items-center gap-2 px-2.5 py-2.5 border-b border-line cursor-pointer transition-colors ${
                    dragOver === i ? "border-t-2 border-t-mint" : ""
                  } ${
                    selected ? "bg-mint/15 border-l-2 border-l-mint" : "hover:bg-ink/5 border-l-2 border-l-transparent"
                  }`}
                >
                  <span
                    className="shrink-0 text-muted group-hover:text-ink cursor-grab active:cursor-grabbing"
                    aria-hidden="true"
                    title="ลากเพื่อสลับตำแหน่ง"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
                      <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
                      <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
                    </svg>
                  </span>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`text-sm font-bold ${selected ? "text-mint" : "text-ink"}`}>{sym}</span>
                    <span className="text-[10px] text-muted">/USDT</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {coin ? (
                      <div className="text-right">
                        <div className="text-xs font-semibold text-ink font-mono tabular-nums leading-tight">
                          {formatPrice(coin.price)}
                        </div>
                        <div className={`text-[10px] font-medium font-mono tabular-nums leading-tight ${positive ? "text-mint" : "text-coral"}`}>
                          {positive ? "+" : ""}{coin.change_24h_pct.toFixed(2)}%
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(sym);
                      }}
                      disabled={busy}
                      aria-label={`ลบ ${sym}`}
                      className="opacity-0 group-hover:opacity-100 text-muted hover:text-coral transition-all disabled:opacity-40"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
            {items.length === 0 && (
              <p className="text-[11px] text-muted italic px-3.5 py-4">ยังไม่มีเหรียญ — เพิ่มด้านบน</p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
