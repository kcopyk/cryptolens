"use client";

import { useEffect, useRef, useState } from "react";
import {
  OrderBook,
  TradeTick,
  subscribeDepth,
  subscribeTrades,
  fetchRecentTrades,
} from "@/lib/binance";

const EMPTY_BOOK: OrderBook = { bids: [], asks: [] };

/** Live top-of-book depth for one symbol (full snapshot every 100ms). */
export function useOrderBook(symbol: string): { book: OrderBook; ready: boolean } {
  const [book, setBook] = useState<OrderBook>(EMPTY_BOOK);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setBook(EMPTY_BOOK);
    setReady(false);
    const unsub = subscribeDepth(symbol, (b) => {
      setBook(b);
      setReady(true);
    });
    return unsub;
  }, [symbol]);

  return { book, ready };
}

const MAX_TRADES = 40;

/** Live trade tape for one symbol, seeded from REST history. */
export function useRecentTrades(symbol: string): { trades: TradeTick[]; ready: boolean } {
  const [trades, setTrades] = useState<TradeTick[]>([]);
  const [ready, setReady] = useState(false);
  const seenIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    let alive = true;
    setTrades([]);
    setReady(false);
    seenIds.current = new Set();

    fetchRecentTrades(symbol, MAX_TRADES)
      .then((seed) => {
        if (!alive) return;
        const ordered = seed.slice().reverse(); // newest first
        ordered.forEach((t) => seenIds.current.add(t.id));
        setTrades(ordered);
        setReady(true);
      })
      .catch(() => {
        if (alive) setReady(true);
      });

    const unsub = subscribeTrades(symbol, (t) => {
      if (!alive || seenIds.current.has(t.id)) return;
      seenIds.current.add(t.id);
      setReady(true);
      setTrades((prev) => [t, ...prev].slice(0, MAX_TRADES));
    });

    return () => {
      alive = false;
      unsub();
    };
  }, [symbol]);

  return { trades, ready };
}
