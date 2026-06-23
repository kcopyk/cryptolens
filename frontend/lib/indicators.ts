import type { Indicators } from "./api";

export type CandleLike = { close: number };

/** Latest indicator values from candle closes — matches chart series exactly. */
export function snapshotFromCloses(closes: number[]): Indicators | null {
  if (closes.length < 2) return null;
  return computeAll(closes);
}

export function snapshotFromCandles(candles: CandleLike[]): Indicators | null {
  return snapshotFromCloses(candles.map((c) => c.close));
}

export function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  const deltas = closes.slice(1).map((c, i) => c - closes[i]);
  const gains = deltas.slice(-period).map((d) => Math.max(d, 0));
  const losses = deltas.slice(-period).map((d) => Math.abs(Math.min(d, 0)));
  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  return Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100;
}

/** RSI value at each bar (for chart series). */
export function rsiSeries(closes: number[], period = 14): number[] {
  return closes.map((_, i) => rsi(closes.slice(0, i + 1), period));
}

export function sparkline(closes: number[]): number[] {
  return closes.slice(-24).map((c) => Math.round(c * 100) / 100);
}

export function emaSeries(values: number[], period: number): number[] {
  if (!values.length) return [];
  if (values.length < period) return values.map(() => values[values.length - 1]);
  const k = 2 / (period + 1);
  const out: number[] = [];
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(...Array(period).fill(ema));
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out.push(ema);
  }
  return out;
}

function ema(closes: number[], period: number): number {
  const s = emaSeries(closes, period);
  return s.length ? Math.round(s[s.length - 1] * 100) / 100 : 0;
}

function macd(closes: number[]) {
  if (closes.length < 35) return { macd: 0, signal: 0, histogram: 0 };
  const fast = emaSeries(closes, 12);
  const slow = emaSeries(closes, 26);
  const line = fast.map((f, i) => f - slow[i]);
  const signal = emaSeries(line, 9);
  const macdVal = line[line.length - 1];
  const signalVal = signal[signal.length - 1];
  return {
    macd: Math.round(macdVal * 10000) / 10000,
    signal: Math.round(signalVal * 10000) / 10000,
    histogram: Math.round((macdVal - signalVal) * 10000) / 10000,
  };
}

function bollinger(closes: number[], period = 20, stdDev = 2) {
  if (closes.length < period) {
    const mid = closes[closes.length - 1] ?? 0;
    return { upper: mid, middle: mid, lower: mid };
  }
  const window = closes.slice(-period);
  const middle = window.reduce((a, b) => a + b, 0) / period;
  const variance = window.reduce((a, x) => a + (x - middle) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  return {
    upper: Math.round((middle + stdDev * std) * 100) / 100,
    middle: Math.round(middle * 100) / 100,
    lower: Math.round((middle - stdDev * std) * 100) / 100,
  };
}

export function bollingerSeries(closes: number[], period = 20, stdDev = 2) {
  const upper: number[] = [];
  const middle: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const bb = bollinger(closes.slice(0, i + 1), period, stdDev);
    upper.push(bb.upper);
    middle.push(bb.middle);
    lower.push(bb.lower);
  }
  return { upper, middle, lower };
}

export function macdSeries(closes: number[]) {
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const line = ema12.map((f, i) => f - ema26[i]);
  const signal = emaSeries(line, 9);
  const histogram = line.map((v, i) => v - signal[i]);
  return { line, signal, histogram };
}

export function computeAll(closes: number[]): Indicators {
  const m = macd(closes);
  const bb = bollinger(closes);
  return {
    rsi: rsi(closes),
    ema_9: ema(closes, 9),
    ema_21: ema(closes, 21),
    macd: m.macd,
    macd_signal: m.signal,
    macd_histogram: m.histogram,
    bb_upper: bb.upper,
    bb_middle: bb.middle,
    bb_lower: bb.lower,
  };
}
