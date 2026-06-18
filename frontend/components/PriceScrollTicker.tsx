"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { formatPrice } from "@/lib/api";
import CoinIcon from "./CoinIcon";
import {
  fetchTicker24h,
  subscribeTickers,
  TICKER_SYMBOLS,
  type Ticker24h,
} from "@/lib/binance";

const SCROLL_PX_PER_SEC = 48;
const SYMBOLS = [...TICKER_SYMBOLS];

function TickerItem({ tick }: { tick: Ticker24h }) {
  const flat = Math.abs(tick.change_24h_pct) < 0.005;
  const positive = tick.change_24h_pct >= 0;
  const changeClass = flat ? "text-muted" : positive ? "text-mint" : "text-coral";
  const arrow = flat ? "—" : positive ? "▲" : "▼";

  return (
    <span className="inline-flex items-center gap-2 px-6 shrink-0 font-mono tabular-nums text-[13px] whitespace-nowrap">
      <CoinIcon asset={tick.symbol} size="sm" />
      <span className="font-bold text-ink">{tick.symbol}</span>
      <span className="text-muted">${formatPrice(tick.price)}</span>
      <span className={`font-semibold ${changeClass}`}>
        {arrow} {positive && !flat ? "+" : ""}
        {tick.change_24h_pct.toFixed(2)}%
      </span>
    </span>
  );
}

function buildSegment(ticks: Ticker24h[], repeats: number, keyPrefix: string) {
  const items: { key: string; tick: Ticker24h }[] = [];
  for (let r = 0; r < repeats; r++) {
    for (const tick of ticks) {
      items.push({ key: `${keyPrefix}-${r}-${tick.symbol}`, tick });
    }
  }
  return items.map(({ key, tick }) => <TickerItem key={key} tick={tick} />);
}

export default function PriceScrollTicker() {
  const [ticks, setTicks] = useState<Ticker24h[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRef = useRef<HTMLDivElement>(null);
  const [seqRepeats, setSeqRepeats] = useState(2);
  const [loopPx, setLoopPx] = useState(0);
  const [durationSec, setDurationSec] = useState(30);

  const bootstrap = useCallback(async () => {
    const results = await Promise.all(
      SYMBOLS.map(async (sym) => {
        try {
          return await fetchTicker24h(sym);
        } catch {
          return null;
        }
      })
    );
    setTicks(results.filter((t): t is Ticker24h => t !== null));
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!ticks.length) return;
    return subscribeTickers(SYMBOLS, (tick) => {
      setTicks((prev) => prev.map((t) => (t.symbol === tick.symbol ? tick : t)));
    });
  }, [ticks.length]);

  // Repeat the coin set until one segment fills the viewport — no gaps during scroll.
  useLayoutEffect(() => {
    if (!ticks.length) return;

    const remeasure = () => {
      const container = containerRef.current;
      const segment = segmentRef.current;
      if (!container || !segment) return;

      const containerW = container.clientWidth;
      const segmentW = segment.offsetWidth;
      if (segmentW <= 0 || containerW <= 0) return;

      const roundW = segmentW / seqRepeats;
      const minSegmentW = containerW * 1.08;
      const needed = Math.max(2, Math.ceil(minSegmentW / roundW));

      if (needed !== seqRepeats) {
        setSeqRepeats(needed);
        return;
      }

      setLoopPx(segmentW);
      setDurationSec(Math.max(16, segmentW / SCROLL_PX_PER_SEC));
    };

    remeasure();
    const ro = new ResizeObserver(remeasure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [ticks, seqRepeats]);

  if (!ticks.length) {
    return (
      <div className="w-full border-b border-line bg-panel/80 py-2.5">
        <div className="h-4 max-w-xs mx-auto bg-line rounded animate-pulse" />
      </div>
    );
  }

  const segmentA = buildSegment(ticks, seqRepeats, "a");
  const segmentB = buildSegment(ticks, seqRepeats, "b");

  return (
    <div
      ref={containerRef}
      className="w-full border-b border-line bg-panel/80 overflow-hidden py-2.5"
      aria-label="ราคาเหรียญ top market cap real-time"
    >
      <div
        className="ticker-track"
        style={
          loopPx
            ? ({
                "--ticker-shift": `${loopPx}px`,
                animationDuration: `${durationSec}s`,
              } as CSSProperties)
            : undefined
        }
      >
        <div ref={segmentRef} className="flex shrink-0">
          {segmentA}
        </div>
        <div className="flex shrink-0" aria-hidden>
          {segmentB}
        </div>
      </div>
    </div>
  );
}
