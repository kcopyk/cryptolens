import type { Balance, BinanceTrade, Coin } from "./api";
import {
  fetchAccountBalances,
  fetchOpenOrders,
  fetchTradeHistory,
  getBinanceKeysStatus,
} from "./api";

export const TRACKED_ASSETS = ["BTC", "ETH", "BNB", "SOL", "USDT"] as const;

const MAJOR_SYMBOLS = ["BTC", "ETH", "BNB", "SOL"];

export interface PortfolioData {
  balances: Balance[];
  allTrades: Record<string, BinanceTrade[]>;
  linked: boolean;
  isMainnet: boolean;
  openOrdersCount: number;
  error?: string;
}

/** Load wallet from linked Spot account (Testnet by default). */
export async function loadPortfolioData(): Promise<PortfolioData> {
  const keyRes = await getBinanceKeysStatus().catch(() => ({ linked: false, is_mainnet: false }));
  if (!keyRes.linked) {
    return {
      balances: [],
      allTrades: {},
      linked: false,
      isMainnet: false,
      openOrdersCount: 0,
    };
  }

  try {
    const [openRes, balRes, ...tradesResults] = await Promise.all([
      fetchOpenOrders(),
      fetchAccountBalances(),
      ...MAJOR_SYMBOLS.map(async (sym) => {
        try {
          return { sym, res: await fetchTradeHistory(sym) };
        } catch {
          return { sym, res: [] as BinanceTrade[] };
        }
      }),
    ]);

    const allTrades: Record<string, BinanceTrade[]> = {};
    tradesResults.forEach((t) => {
      allTrades[t.sym] = t.res;
    });

    return {
      balances: balRes.balances,
      allTrades,
      linked: true,
      isMainnet: !!keyRes.is_mainnet,
      openOrdersCount: openRes.length,
    };
  } catch (err) {
    return {
      balances: [],
      allTrades: {},
      linked: true,
      isMainnet: !!keyRes.is_mainnet,
      openOrdersCount: 0,
      error: err instanceof Error ? err.message : "ไม่สามารถโหลดยอด wallet ได้",
    };
  }
}

export const COIN_META: Record<string, { name: string; color: string }> = {
  BTC: { name: "Bitcoin", color: "#F7931A" },
  ETH: { name: "Ethereum", color: "#627EEA" },
  BNB: { name: "BNB", color: "#F0B90B" },
  SOL: { name: "Solana", color: "#9945FF" },
  USDT: { name: "TetherUS", color: "#26A17B" },
};

const FALLBACK_PRICES: Record<string, number> = {
  BTC: 62000,
  ETH: 3300,
  BNB: 580,
  SOL: 150,
  USDT: 1,
};

export interface PortfolioRow {
  asset: string;
  name: string;
  color: string;
  balance: Balance;
  price: number;
  change24hPct: number;
  usdValue: number;
  avgCost: number;
  pnlUsd: number;
  pnlPct: number;
  hasPnL: boolean;
  todayPnlUsd: number;
  todayPnlPct: number;
  allocationPct: number;
}

export function getAssetPrice(asset: string, liveCoins: Coin[]): number {
  if (asset === "USDT") return 1;
  return liveCoins.find((c) => c.symbol === asset)?.price ?? FALLBACK_PRICES[asset] ?? 0;
}

export function getAssetChange24h(asset: string, liveCoins: Coin[]): number {
  if (asset === "USDT") return 0;
  return liveCoins.find((c) => c.symbol === asset)?.change_24h_pct ?? 0;
}

export function computeAvgCostFromTrades(trades: BinanceTrade[]): number {
  const sorted = [...trades].sort((a, b) => a.time - b.time);
  let totalQty = 0;
  let totalCost = 0;
  let avgBuyPrice = 0;

  for (const t of sorted) {
    const price = parseFloat(t.price);
    const qty = parseFloat(t.qty);
    if (t.isBuyer) {
      totalCost += price * qty;
      totalQty += qty;
      if (totalQty > 0) avgBuyPrice = totalCost / totalQty;
    } else {
      totalQty = Math.max(0, totalQty - qty);
      totalCost = totalQty * avgBuyPrice;
    }
  }

  return totalQty > 0 ? avgBuyPrice : 0;
}

export function buildPortfolioRows(
  balances: Balance[],
  liveCoins: Coin[],
  allTrades: Record<string, BinanceTrade[]>
): PortfolioRow[] {
  const filtered = balances.filter(
    (b) => TRACKED_ASSETS.includes(b.asset as any) && b.total > 0
  );

  const rows = filtered.map((balance) => {
    const asset = balance.asset;
    const meta = COIN_META[asset] ?? { name: asset, color: "#8b5cf6" };
    const price = getAssetPrice(asset, liveCoins);
    const change24hPct = getAssetChange24h(asset, liveCoins);
    const usdValue = balance.total * price;
    const avgCost = asset === "USDT" ? 1 : computeAvgCostFromTrades(allTrades[asset] ?? []);

    let pnlUsd = 0;
    let pnlPct = 0;
    let hasPnL = false;
    if (asset !== "USDT" && avgCost > 0 && balance.total > 0) {
      pnlUsd = (price - avgCost) * balance.total;
      pnlPct = ((price - avgCost) / avgCost) * 100;
      hasPnL = true;
    }

    const todayPnlUsd = asset === "USDT" ? 0 : balance.total * price * (change24hPct / 100);
    const todayPnlPct = change24hPct;

    return {
      asset,
      name: meta.name,
      color: meta.color,
      balance,
      price,
      change24hPct,
      usdValue,
      avgCost,
      pnlUsd,
      pnlPct,
      hasPnL,
      todayPnlUsd,
      todayPnlPct,
      allocationPct: 0,
    };
  });

  const totalUsd = rows.reduce((sum, r) => sum + r.usdValue, 0);
  return rows
    .map((r) => ({
      ...r,
      allocationPct: totalUsd > 0 ? (r.usdValue / totalUsd) * 100 : 0,
    }))
    .sort((a, b) => b.usdValue - a.usdValue);
}

export function summarizePortfolio(rows: PortfolioRow[]) {
  const totalUsd = rows.reduce((sum, r) => sum + r.usdValue, 0);
  const totalPnlUsd = rows.reduce((sum, r) => sum + (r.hasPnL ? r.pnlUsd : 0), 0);
  const totalTodayPnlUsd = rows.reduce((sum, r) => sum + r.todayPnlUsd, 0);
  const btcPrice = rows.find((r) => r.asset === "BTC")?.price ?? FALLBACK_PRICES.BTC;
  const btcEquivalent = btcPrice > 0 ? totalUsd / btcPrice : 0;

  const costBasis = rows.reduce((sum, r) => {
    if (!r.hasPnL) return sum;
    return sum + r.avgCost * r.balance.total;
  }, 0);
  const holdingsValue = rows.reduce((sum, r) => {
    if (!r.hasPnL) return sum;
    return sum + r.usdValue;
  }, 0);
  const totalPnlPct = costBasis > 0 ? ((holdingsValue - costBasis) / costBasis) * 100 : 0;

  const prevTotal = totalUsd - totalTodayPnlUsd;
  const todayPnlPct = prevTotal > 0 ? (totalTodayPnlUsd / prevTotal) * 100 : 0;

  return {
    totalUsd,
    totalPnlUsd,
    totalPnlPct,
    totalTodayPnlUsd,
    todayPnlPct,
    btcEquivalent,
  };
}
