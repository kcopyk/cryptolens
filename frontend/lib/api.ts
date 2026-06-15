const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getUserId(): string {
  if (typeof window === "undefined") return "server_side";
  let id = localStorage.getItem("cryptolens_user_id");
  if (!id) {
    id = "user_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
    localStorage.setItem("cryptolens_user_id", id);
  }
  return id;
}

export function getHeaders(): Record<string, string> {
  return {
    "X-User-ID": getUserId(),
  };
}

export interface Indicators {
  rsi: number;
  ema_9: number;
  ema_21: number;
  macd: number;
  macd_signal: number;
  macd_histogram: number;
  bb_upper: number;
  bb_middle: number;
  bb_lower: number;
}

export interface NewsItem {
  title: string;
  url: string;
  published_at: string;
  source: string;
  sentiment: "bullish" | "bearish" | "neutral";
}

export interface Coin {
  symbol: string;
  price: number;
  change_24h_pct: number;
  rsi: number;
  volume_24h: number;
  high_24h?: number;
  low_24h?: number;
  sparkline: number[];
  indicators: Indicators;
  news: NewsItem[];
  summary: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface InsightsResponse {
  as_of: string;
  stale: boolean;
  coins: Coin[];
}

export interface MoodResponse {
  mood: string;
  as_of: string;
  stale: boolean;
}

export interface AskResponse {
  answer: string;
  as_of: string;
}

export interface CandlesResponse {
  symbol: string;
  interval: string;
  as_of: string;
  stale: boolean;
  candles: Candle[];
  indicators: Indicators;
}

export interface NewsResponse {
  symbol: string;
  as_of: string;
  stale: boolean;
  news: NewsItem[];
}

export type ChartInterval = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";

export const CHART_CANDLE_LIMIT = 1000;

export const CHART_INTERVALS: { value: ChartInterval; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1d", label: "1D" },
];

const EMPTY_INDICATORS = (rsi = 50): Indicators => ({
  rsi,
  ema_9: 0,
  ema_21: 0,
  macd: 0,
  macd_signal: 0,
  macd_histogram: 0,
  bb_upper: 0,
  bb_middle: 0,
  bb_lower: 0,
});

/** Backfill fields missing from stale backend cache. */
export function normalizeCoin(raw: Coin): Coin {
  return {
    ...raw,
    sparkline: raw.sparkline ?? [],
    news: raw.news ?? [],
    indicators: raw.indicators ?? EMPTY_INDICATORS(raw.rsi),
    summary: raw.summary ?? "",
  };
}

export async function fetchInsights(symbols = "BTC,ETH,BNB,SOL"): Promise<InsightsResponse> {
  const r = await fetch(`${API}/api/insights?symbols=${symbols}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`insights ${r.status}`);
  const data: InsightsResponse = await r.json();
  return { ...data, coins: data.coins.map(normalizeCoin) };
}

export async function fetchMood(): Promise<MoodResponse> {
  const r = await fetch(`${API}/api/mood`, { cache: "no-store" });
  if (!r.ok) throw new Error(`mood ${r.status}`);
  return r.json();
}

export async function fetchCandles(
  symbol: string,
  interval: ChartInterval = "1h",
  limit = 100
): Promise<CandlesResponse> {
  const r = await fetch(
    `${API}/api/candles?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    { cache: "no-store" }
  );
  if (!r.ok) {
    if (r.status === 404) throw new Error("candles 404 — restart backend");
    throw new Error(`candles ${r.status}`);
  }
  return r.json();
}

export async function fetchNews(symbol: string): Promise<NewsResponse> {
  const r = await fetch(`${API}/api/news?symbol=${symbol}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`news ${r.status}`);
  return r.json();
}

export async function askCoin(symbol: string, question: string): Promise<AskResponse> {
  const r = await fetch(`${API}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, question }),
  });
  if (!r.ok) throw new Error(`ask ${r.status}`);
  return r.json();
}

// ─── Watchlist ────────────────────────────────────────────────────────

export async function fetchWatchlist(): Promise<string[]> {
  const r = await fetch(`${API}/api/watchlist`, { cache: "no-store", headers: getHeaders() });
  if (!r.ok) throw new Error(`watchlist ${r.status}`);
  const data: { symbols: string[] } = await r.json();
  return data.symbols;
}

async function watchlistError(r: Response): Promise<never> {
  const errText = await r.text();
  try {
    throw new Error(JSON.parse(errText).detail || `watchlist ${r.status}`);
  } catch (e) {
    if (e instanceof Error && e.message !== errText) throw e;
    throw new Error(errText || `watchlist ${r.status}`);
  }
}

export async function addToWatchlist(symbol: string): Promise<string[]> {
  const r = await fetch(`${API}/api/watchlist`, {
    method: "POST",
    headers: { ...getHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ symbol }),
  });
  if (!r.ok) await watchlistError(r);
  return (await r.json()).symbols;
}

export async function removeFromWatchlist(symbol: string): Promise<string[]> {
  const r = await fetch(`${API}/api/watchlist/${symbol.toUpperCase()}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!r.ok) await watchlistError(r);
  return (await r.json()).symbols;
}

// ─── Daily AI digest ──────────────────────────────────────────────────

export interface DigestBody {
  overview: string;
  per_coin: Record<string, string>;
  disclaimer: string;
}

export interface DigestResponse {
  as_of: string;
  day: string;
  symbols: string[];
  digest: DigestBody;
  coins: { symbol: string; price: number; change_24h_pct: number }[];
  cached: boolean;
}

export async function fetchDigest(): Promise<DigestResponse> {
  const r = await fetch(`${API}/api/digest`, { cache: "no-store", headers: getHeaders() });
  if (!r.ok) throw new Error(`digest ${r.status}`);
  return r.json();
}

// ─── Chart drawings (per user/symbol overlay persistence) ─────────────

export async function fetchChartDrawings(symbol: string): Promise<unknown[]> {
  const r = await fetch(`${API}/api/chart/drawings?symbol=${symbol.toUpperCase()}`, {
    cache: "no-store",
    headers: getHeaders(),
  });
  if (!r.ok) throw new Error(`chart drawings ${r.status}`);
  return (await r.json()).drawings ?? [];
}

export async function saveChartDrawings(symbol: string, drawings: unknown[]): Promise<void> {
  const r = await fetch(`${API}/api/chart/drawings`, {
    method: "PUT",
    headers: { ...getHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ symbol: symbol.toUpperCase(), drawings }),
  });
  if (!r.ok) throw new Error(`save chart drawings ${r.status}`);
}

// ─── Binance deep-link (act-fast CTA; CryptoLens places no orders) ─────

/** Spot trade page for a coin, quoted in USDT (spec §3.3 / §8 Q3). */
export function binanceTradeUrl(symbol: string): string {
  return `https://www.binance.com/en/trade/${symbol.toUpperCase()}_USDT?type=spot`;
}

export interface Balance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

export interface BalancesResponse {
  balances: Balance[];
}

export async function fetchAccountBalances(): Promise<BalancesResponse> {
  const r = await fetch(`${API}/api/account/balances`, {
    cache: "no-store",
    headers: getHeaders(),
  });
  if (!r.ok) {
    const errText = await r.text();
    try {
      const errJSON = JSON.parse(errText);
      throw new Error(errJSON.detail || `balances ${r.status}`);
    } catch {
      throw new Error(errText || `balances ${r.status}`);
    }
  }
  return r.json();
}

export interface PlaceOrderParams {
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET";
  quantity: number;
  price?: number;
}

export async function placeRealOrder(params: PlaceOrderParams): Promise<any> {
  const r = await fetch(`${API}/api/order`, {
    method: "POST",
    headers: {
      ...getHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!r.ok) {
    const errText = await r.text();
    try {
      const errJSON = JSON.parse(errText);
      throw new Error(errJSON.detail || `order ${r.status}`);
    } catch {
      throw new Error(errText || `order ${r.status}`);
    }
  }
  return r.json();
}

export async function saveBinanceKeys(apiKey: string, secretKey: string): Promise<any> {
  const r = await fetch(`${API}/api/account/keys`, {
    method: "POST",
    headers: {
      ...getHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ api_key: apiKey, secret_key: secretKey }),
  });
  if (!r.ok) {
    const errText = await r.text();
    try {
      const errJSON = JSON.parse(errText);
      throw new Error(errJSON.detail || `save keys ${r.status}`);
    } catch {
      throw new Error(errText || `save keys ${r.status}`);
    }
  }
  return r.json();
}

export async function deleteBinanceKeys(): Promise<any> {
  const r = await fetch(`${API}/api/account/keys`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!r.ok) throw new Error(`delete keys ${r.status}`);
  return r.json();
}

export async function getBinanceKeysStatus(): Promise<{ linked: boolean; api_key_masked?: string; is_mainnet?: boolean }> {
  const r = await fetch(`${API}/api/account/keys/status`, {
    cache: "no-store",
    headers: getHeaders(),
  });
  if (!r.ok) throw new Error(`keys status ${r.status}`);
  return r.json();
}

export async function getBackendConfig(): Promise<{ is_mainnet: boolean; base_url: string }> {
  const r = await fetch(`${API}/api/config`, { cache: "no-store" });
  if (!r.ok) throw new Error(`config ${r.status}`);
  return r.json();
}

export function formatPrice(p: number): string {
  const abs = Math.abs(p);
  if (abs >= 1000) {
    return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (abs >= 1) return p.toFixed(4);
  return p.toFixed(6);
}

/** Format number with commas when |value| ≥ 1,000 (works for +/-). */
export function formatNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return value.toFixed(decimals);
}

export function formatSignedNumber(value: number, decimals = 4): string {
  const formatted = formatNumber(value, decimals);
  return value > 0 ? `+${formatted}` : formatted;
}

export function formatNewsDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toFixed(0)}`;
}

export function macdTrend(histogram: number): { label: string; color: string } {
  if (histogram > 0.5) return { label: "Bullish crossover", color: "text-emerald-400" };
  if (histogram > 0) return { label: "Mild bullish", color: "text-emerald-300" };
  if (histogram < -0.5) return { label: "Bearish crossover", color: "text-red-400" };
  if (histogram < 0) return { label: "Mild bearish", color: "text-orange-400" };
  return { label: "Neutral", color: "text-zinc-400" };
}

export function bbPosition(price: number, ind: Indicators): { label: string; color: string } {
  if (price >= ind.bb_upper) return { label: "Above upper band", color: "text-red-400" };
  if (price <= ind.bb_lower) return { label: "Below lower band", color: "text-emerald-400" };
  if (price > ind.bb_middle) return { label: "Upper half", color: "text-zinc-300" };
  return { label: "Lower half", color: "text-zinc-400" };
}

export interface MockOrder {
  id: string;
  timestamp: string;
  symbol: string;
  type: "Limit" | "Market";
  side: "Buy" | "Sell";
  price: number;
  amount: number;
  total: number;
  status: "Completed";
}

export interface BinanceOrder {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string; // NEW, FILLED, CANCELED, REJECTED, PARTIALLY_FILLED, etc.
  timeInForce: string;
  type: string;
  side: "BUY" | "SELL";
  time: number;
  updateTime: number;
}

export async function fetchOpenOrders(symbol?: string): Promise<BinanceOrder[]> {
  const query = symbol ? `?symbol=${symbol}` : "";
  const r = await fetch(`${API}/api/account/orders/open${query}`, {
    cache: "no-store",
    headers: getHeaders(),
  });
  if (!r.ok) {
    const errText = await r.text();
    try {
      const errJSON = JSON.parse(errText);
      throw new Error(errJSON.detail || `open orders ${r.status}`);
    } catch {
      throw new Error(errText || `open orders ${r.status}`);
    }
  }
  return r.json();
}

export async function fetchOrderHistory(symbol: string): Promise<BinanceOrder[]> {
  const r = await fetch(`${API}/api/account/orders/history?symbol=${symbol}`, {
    cache: "no-store",
    headers: getHeaders(),
  });
  if (!r.ok) {
    const errText = await r.text();
    try {
      const errJSON = JSON.parse(errText);
      throw new Error(errJSON.detail || `order history ${r.status}`);
    } catch {
      throw new Error(errText || `order history ${r.status}`);
    }
  }
  return r.json();
}

export interface BinanceTrade {
  symbol: string;
  id: number;
  orderId: number;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
}

export async function fetchTradeHistory(symbol: string): Promise<BinanceTrade[]> {
  const r = await fetch(`${API}/api/account/trades?symbol=${symbol}`, {
    cache: "no-store",
    headers: getHeaders(),
  });
  if (!r.ok) {
    const errText = await r.text();
    try {
      const errJSON = JSON.parse(errText);
      throw new Error(errJSON.detail || `trade history ${r.status}`);
    } catch {
      throw new Error(errText || `trade history ${r.status}`);
    }
  }
  return r.json();
}


export async function cancelRealOrder(symbol: string, orderId: number): Promise<any> {
  const r = await fetch(`${API}/api/order?symbol=${symbol}&order_id=${orderId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!r.ok) {
    const errText = await r.text();
    try {
      const errJSON = JSON.parse(errText);
      throw new Error(errJSON.detail || `cancel order ${r.status}`);
    } catch {
      throw new Error(errText || `cancel order ${r.status}`);
    }
  }
  return r.json();
}
