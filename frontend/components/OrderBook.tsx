"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useOrderBook } from "@/hooks/useOrderBook";
import type { DepthLevel } from "@/lib/binance";

const ROWS = 11;

function priceDecimals(price: number): number {
  if (price >= 1000) return 2;
  if (price >= 1) return 2;
  return 4;
}

interface Row {
  price: number;
  qty: number;
  cumulative: number;
  depthPct: number;
}

/** Build display rows with running cumulative totals + depth-bar widths. */
function buildRows(levels: DepthLevel[], maxTotal: number): Row[] {
  let cumulative = 0;
  return levels.slice(0, ROWS).map(([price, qty]) => {
    cumulative += qty;
    return {
      price,
      qty,
      cumulative,
      depthPct: maxTotal > 0 ? Math.min(100, (cumulative / maxTotal) * 100) : 0,
    };
  });
}

interface Props {
  symbol: string;
  lastPrice: number;
  onSelectPrice?: (price: number) => void;
}

export default function OrderBook({ symbol, lastPrice, onSelectPrice }: Props) {
  const { book, ready } = useOrderBook(symbol);

  // Track last-price direction for the centre ticker colour.
  const prevPrice = useRef(lastPrice);
  const [dir, setDir] = useState<"up" | "down">("up");
  useEffect(() => {
    if (lastPrice > prevPrice.current) setDir("up");
    else if (lastPrice < prevPrice.current) setDir("down");
    prevPrice.current = lastPrice;
  }, [lastPrice]);

  const dec = priceDecimals(lastPrice || book.asks[0]?.[0] || 1);

  const { askRows, bidRows, spread, spreadPct } = useMemo(() => {
    const askSlice = book.asks.slice(0, ROWS);
    const bidSlice = book.bids.slice(0, ROWS);
    const askTotal = askSlice.reduce((s, [, q]) => s + q, 0);
    const bidTotal = bidSlice.reduce((s, [, q]) => s + q, 0);
    const maxTotal = Math.max(askTotal, bidTotal);

    const asks = buildRows(askSlice, maxTotal);
    const bids = buildRows(bidSlice, maxTotal);

    const bestAsk = askSlice[0]?.[0] ?? 0;
    const bestBid = bidSlice[0]?.[0] ?? 0;
    const sp = bestAsk && bestBid ? bestAsk - bestBid : 0;
    const spPct = bestBid ? (sp / bestBid) * 100 : 0;

    return { askRows: asks, bidRows: bids, spread: sp, spreadPct: spPct };
  }, [book]);

  const fmtPrice = (p: number) =>
    p.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const fmtQty = (q: number) => q.toFixed(q >= 1000 ? 1 : 4);

  const renderRow = (r: Row, side: "ask" | "bid") => (
    <button
      key={`${side}-${r.price}`}
      type="button"
      onClick={() => onSelectPrice?.(r.price)}
      className="relative grid grid-cols-3 w-full px-3 py-[3px] text-right font-mono text-[11px] leading-tight hover:bg-ink/6 transition-colors"
    >
      <span
        className={`absolute inset-y-0 right-0 ${side === "ask" ? "bg-coral/10" : "bg-mint/10"}`}
        style={{ width: `${r.depthPct}%` }}
      />
      <span className={`relative z-10 text-left ${side === "ask" ? "text-coral" : "text-mint"}`}>
        {fmtPrice(r.price)}
      </span>
      <span className="relative z-10 text-ink">{fmtQty(r.qty)}</span>
      <span className="relative z-10 text-muted">{fmtQty(r.cumulative)}</span>
    </button>
  );

  // Pad short sides so the layout never jumps before the book warms up.
  const pad = (rows: Row[]): (Row | undefined)[] =>
    rows.length >= ROWS
      ? rows
      : [...rows, ...Array.from({ length: ROWS - rows.length }, () => undefined)];

  return (
    <div className="flex flex-col h-full text-xs select-none">
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink">Order Book</span>
        <span className="text-[10px] text-muted font-mono">{symbol}/USDT</span>
      </div>

      <div className="grid grid-cols-3 px-3 pb-1 text-right text-[10px] uppercase tracking-wide text-muted">
        <span className="text-left">ราคา</span>
        <span>จำนวน</span>
        <span>รวม</span>
      </div>

      {/* Asks (reversed so best ask sits just above the spread) */}
      <div className="flex flex-col-reverse">
        {pad(askRows).map((r, i) =>
          r ? renderRow(r, "ask") : <div key={`ask-pad-${i}`} className="py-[3px] text-[11px]">&nbsp;</div>
        )}
      </div>

      {/* Spread / last price */}
      <div className="flex items-center justify-between px-3 py-2 my-0.5 border-y border-line bg-panel/40">
        <span
          className={`flex items-center gap-1.5 font-mono text-base font-bold tabular-nums ${
            dir === "up" ? "text-mint" : "text-coral"
          }`}
        >
          {ready ? fmtPrice(lastPrice) : "—"}
          <svg
            className={`w-3.5 h-3.5 ${dir === "up" ? "" : "rotate-180"}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </span>
        <span className="text-[10px] text-muted font-mono text-right">
          <span className="text-muted mr-1">Spread</span>
          {spread > 0 ? `${fmtPrice(spread)} (${spreadPct.toFixed(2)}%)` : "—"}
        </span>
      </div>

      {/* Bids */}
      <div className="flex flex-col">
        {pad(bidRows).map((r, i) =>
          r ? renderRow(r, "bid") : <div key={`bid-pad-${i}`} className="py-[3px] text-[11px]">&nbsp;</div>
        )}
      </div>
    </div>
  );
}
