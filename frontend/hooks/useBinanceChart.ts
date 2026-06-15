"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Candle, ChartInterval, Indicators } from "@/lib/api";
import { CHART_CANDLE_LIMIT } from "@/lib/api";
import { fetchKlines, subscribeKline, subscribeTickers } from "@/lib/binance";
import { computeAll } from "@/lib/indicators";

const LIMIT = CHART_CANDLE_LIMIT;

function mergeCandle(history: Candle[], candle: Candle): Candle[] {
  if (!history.length) return [candle];
  const next = [...history];
  const idx = next.findIndex((c) => c.time === candle.time);
  if (idx >= 0) {
    next[idx] = candle;
  } else {
    next.push(candle);
    if (next.length > LIMIT) next.shift();
  }
  return next;
}

function applyTickerToLast(candles: Candle[], price: number): Candle[] {
  if (!candles.length) return candles;
  const next = [...candles];
  const last = { ...next[next.length - 1] };
  last.close = price;
  last.high = Math.max(last.high, price);
  last.low = Math.min(last.low, price);
  next[next.length - 1] = last;
  return next;
}

export function useBinanceChart(symbol: string, interval: ChartInterval) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicators, setIndicators] = useState<Indicators | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const candlesRef = useRef<Candle[]>([]);

  const publish = useCallback((next: Candle[]) => {
    candlesRef.current = next;
    setCandles(next);
    if (next.length) setIndicators(computeAll(next.map((c) => c.close)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    candlesRef.current = [];
    setCandles([]);
    setIndicators(null);
    setLoading(true);
    setError(null);

    const onKline = ({ candle }: { candle: Candle }) => {
      if (cancelled) return;
      publish(mergeCandle(candlesRef.current, candle));
      setLoading(false);
    };

    const unsubKline = subscribeKline(symbol, interval, onKline);
    const unsubTicker = subscribeTickers([symbol], (tick) => {
      if (cancelled || !candlesRef.current.length) return;
      publish(applyTickerToLast(candlesRef.current, tick.price));
    });

    fetchKlines(symbol, interval, LIMIT)
      .then((data) => {
        if (cancelled) return;
        let merged = data;
        if (candlesRef.current.length) {
          merged = mergeCandle(data, candlesRef.current[candlesRef.current.length - 1]);
        }
        publish(merged);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        if (!candlesRef.current.length) setError("โหลด chart ไม่สำเร็จ");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      unsubKline();
      unsubTicker();
    };
  }, [symbol, interval, reloadKey, publish]);

  return {
    candles,
    indicators,
    loading,
    error,
    retry: () => setReloadKey((k) => k + 1),
  };
}
