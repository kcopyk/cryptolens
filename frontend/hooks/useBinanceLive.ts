"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Coin } from "@/lib/api";
import { normalizeCoin } from "@/lib/api";
import {
  DEFAULT_SYMBOLS,
  fetchKlines,
  fetchTicker24h,
  subscribeTickers,
} from "@/lib/binance";
import { computeAll, sparkline } from "@/lib/indicators";

function mergeCoin(
  symbol: string,
  closes: number[],
  ticker: { price: number; change_24h_pct: number; volume_24h: number; high_24h: number; low_24h: number },
  meta?: Partial<Coin>
): Coin {
  const indicators = computeAll(closes);
  return normalizeCoin({
    symbol,
    price: ticker.price,
    change_24h_pct: ticker.change_24h_pct,
    volume_24h: ticker.volume_24h,
    high_24h: ticker.high_24h,
    low_24h: ticker.low_24h,
    rsi: indicators.rsi,
    sparkline: sparkline(closes),
    indicators,
    news: meta?.news ?? [],
    summary: meta?.summary ?? "",
  });
}

export function useBinanceLive(backendCoins: Coin[] | null) {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [ready, setReady] = useState(false);
  const [lastTick, setLastTick] = useState<number | null>(null);
  const closesRef = useRef<Map<string, number[]>>(new Map());
  const metaRef = useRef<Map<string, Partial<Coin>>>(new Map());

  // Sync AI summary + news from backend
  useEffect(() => {
    if (!backendCoins) return;
    for (const c of backendCoins) {
      metaRef.current.set(c.symbol, { summary: c.summary, news: c.news });
    }
    setCoins((prev) => {
      if (!prev.length) return prev;
      return prev.map((c) => {
        const meta = metaRef.current.get(c.symbol);
        if (!meta) return c;
        return { ...c, summary: meta.summary ?? c.summary, news: meta.news ?? c.news };
      });
    });
  }, [backendCoins]);

  const bootstrap = useCallback(async () => {
    const results = await Promise.all(
      DEFAULT_SYMBOLS.map(async (sym) => {
        const [klines, ticker] = await Promise.all([
          fetchKlines(sym, "1h", 100),
          fetchTicker24h(sym),
        ]);
        const closes = klines.map((k) => k.close);
        closesRef.current.set(sym, closes);
        const meta = metaRef.current.get(sym);
        return mergeCoin(sym, closes, ticker, meta);
      })
    );
    setCoins(results);
    setReady(true);
    setLastTick(Date.now());
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Live ticker WebSocket
  useEffect(() => {
    if (!ready) return;
    const unsub = subscribeTickers(DEFAULT_SYMBOLS, (tick) => {
      const closes = closesRef.current.get(tick.symbol);
      if (closes?.length) {
        closes[closes.length - 1] = tick.price;
      }
      setCoins((prev) =>
        prev.map((c) => {
          if (c.symbol !== tick.symbol) return c;
          const cl = closesRef.current.get(tick.symbol) ?? [];
          const indicators = cl.length ? computeAll(cl) : c.indicators;
          return {
            ...c,
            price: tick.price,
            change_24h_pct: tick.change_24h_pct,
            volume_24h: tick.volume_24h,
            high_24h: tick.high_24h,
            low_24h: tick.low_24h,
            rsi: indicators.rsi,
            sparkline: cl.length ? sparkline(cl) : c.sparkline,
            indicators,
          };
        })
      );
      setLastTick(Date.now());
    });
    return unsub;
  }, [ready]);

  return { coins, ready, lastTick, reloadMarket: bootstrap };
}
