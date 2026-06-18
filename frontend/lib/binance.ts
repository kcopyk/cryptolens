import type { Candle, ChartInterval } from "./api";
import { CHART_CANDLE_LIMIT } from "./api";

export const PAIRS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  BNB: "BNBUSDT",
  SOL: "SOLUSDT",
};

export const DEFAULT_SYMBOLS = ["BTC", "ETH", "BNB", "SOL"];

/** Top coins by market cap — price scroll ticker (fixed set, repeated to fill width). */
export const TICKER_SYMBOLS = ["BTC", "ETH", "BNB", "SOL", "XRP", "ADA"] as const;

/** @deprecated use TICKER_SYMBOLS — kept for any legacy imports */
export const TOP_MARKET_CAP_SYMBOLS = [...TICKER_SYMBOLS, "DOGE", "DOT"];

const REST = "https://api.binance.com";
const WS = "wss://stream.binance.com:9443";

export interface Ticker24h {
  symbol: string;
  price: number;
  change_24h_pct: number;
  volume_24h: number;
  high_24h: number;
  low_24h: number;
}

function pair(symbol: string): string {
  const s = symbol.toUpperCase();
  // Fall back to `{SYMBOL}USDT` so watchlist coins beyond the default four
  // (BTC/ETH/BNB/SOL) still resolve to a valid Binance stream/REST pair.
  return PAIRS[s] ?? `${s}USDT`;
}

export async function fetchTicker24h(symbol: string): Promise<Ticker24h> {
  const r = await fetch(`${REST}/api/v3/ticker/24hr?symbol=${pair(symbol)}`);
  if (!r.ok) throw new Error(`ticker ${r.status}`);
  const d = await r.json();
  return {
    symbol: symbol.toUpperCase(),
    price: parseFloat(d.lastPrice),
    change_24h_pct: parseFloat(d.priceChangePercent),
    volume_24h: parseFloat(d.quoteVolume),
    high_24h: parseFloat(d.highPrice),
    low_24h: parseFloat(d.lowPrice),
  };
}

export async function fetchKlines(
  symbol: string,
  interval: ChartInterval = "1h",
  limit = CHART_CANDLE_LIMIT
): Promise<Candle[]> {
  const r = await fetch(
    `${REST}/api/v3/klines?symbol=${pair(symbol)}&interval=${interval}&limit=${limit}`
  );
  if (!r.ok) throw new Error(`klines ${r.status}`);
  const data: unknown[][] = await r.json();
  return data.map((c) => ({
    time: Math.floor(Number(c[0]) / 1000),
    open: parseFloat(String(c[1])),
    high: parseFloat(String(c[2])),
    low: parseFloat(String(c[3])),
    close: parseFloat(String(c[4])),
    volume: parseFloat(String(c[5])),
  }));
}

type TickerHandler = (ticker: Ticker24h) => void;

/** Combined 24h ticker stream for multiple symbols. */
export function subscribeTickers(symbols: string[], onTick: TickerHandler): () => void {
  const streams = symbols.map((s) => `${pair(s).toLowerCase()}@ticker`).join("/");
  const ws = new WebSocket(`${WS}/stream?streams=${streams}`);

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string);
      const d = msg.data;
      if (!d?.s) return;
      const sym = d.s.replace("USDT", "");
      onTick({
        symbol: sym,
        price: parseFloat(d.c),
        change_24h_pct: parseFloat(d.P),
        volume_24h: parseFloat(d.q),
        high_24h: parseFloat(d.h),
        low_24h: parseFloat(d.l),
      });
    } catch {
      /* ignore malformed */
    }
  };

  return () => {
    ws.onmessage = null;
    ws.close();
  };
}

// ─── Order book (depth) ────────────────────────────────────────────────

/** One price level: [price, quantity]. */
export type DepthLevel = [number, number];

export interface OrderBook {
  bids: DepthLevel[]; // sorted high → low
  asks: DepthLevel[]; // sorted low → high
}

/**
 * Live partial book depth stream (top 20 levels @100ms).
 * Binance pushes a full snapshot each tick, so no diff bookkeeping needed.
 */
export function subscribeDepth(
  symbol: string,
  onBook: (book: OrderBook) => void
): () => void {
  const stream = `${pair(symbol).toLowerCase()}@depth20@100ms`;
  const ws = new WebSocket(`${WS}/ws/${stream}`);

  ws.onmessage = (ev) => {
    try {
      const d = JSON.parse(ev.data as string);
      const parse = (lvl: string[]): DepthLevel => [parseFloat(lvl[0]), parseFloat(lvl[1])];
      onBook({
        bids: (d.bids ?? []).map(parse),
        asks: (d.asks ?? []).map(parse),
      });
    } catch {
      /* ignore malformed */
    }
  };

  return () => {
    ws.onmessage = null;
    ws.close();
  };
}

// ─── Recent trades (live tape) ─────────────────────────────────────────

export interface TradeTick {
  id: number;
  price: number;
  qty: number;
  time: number;
  isBuyerMaker: boolean; // true → sell (taker hit the bid), false → buy
}

/** Live trade stream — one event per executed trade. */
export function subscribeTrades(
  symbol: string,
  onTrade: (trade: TradeTick) => void
): () => void {
  const stream = `${pair(symbol).toLowerCase()}@trade`;
  const ws = new WebSocket(`${WS}/ws/${stream}`);

  ws.onmessage = (ev) => {
    try {
      const d = JSON.parse(ev.data as string);
      if (!d?.p) return;
      onTrade({
        id: d.t,
        price: parseFloat(d.p),
        qty: parseFloat(d.q),
        time: d.T,
        isBuyerMaker: d.m,
      });
    } catch {
      /* ignore malformed */
    }
  };

  return () => {
    ws.onmessage = null;
    ws.close();
  };
}

/** Seed the trade tape with recent history (REST) before the WS warms up. */
export async function fetchRecentTrades(symbol: string, limit = 30): Promise<TradeTick[]> {
  const r = await fetch(`${REST}/api/v3/trades?symbol=${pair(symbol)}&limit=${limit}`);
  if (!r.ok) throw new Error(`trades ${r.status}`);
  const data: { id: number; price: string; qty: string; time: number; isBuyerMaker: boolean }[] =
    await r.json();
  return data.map((t) => ({
    id: t.id,
    price: parseFloat(t.price),
    qty: parseFloat(t.qty),
    time: t.time,
    isBuyerMaker: t.isBuyerMaker,
  }));
}

export interface KlineUpdate {
  candle: Candle;
  closed: boolean;
}

/** Live kline stream for chart. */
export function subscribeKline(
  symbol: string,
  interval: ChartInterval,
  onKline: (update: KlineUpdate) => void
): () => void {
  const stream = `${pair(symbol).toLowerCase()}@kline_${interval}`;
  const ws = new WebSocket(`${WS}/ws/${stream}`);

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string);
      const k = msg.k;
      if (!k) return;
      onKline({
        candle: {
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        },
        closed: k.x,
      });
    } catch {
      /* ignore */
    }
  };

  return () => {
    ws.onmessage = null;
    ws.close();
  };
}
