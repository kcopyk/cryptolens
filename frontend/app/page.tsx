"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Coin,
  InsightsResponse,
  MoodResponse,
  fetchInsights,
  fetchMood,
  fetchWatchlist,
  reorderWatchlist,
  BinanceOrder,
  BinanceTrade,
  Balance,
  getBinanceKeysStatus,
  getBackendConfig,
  fetchOpenOrders,
  fetchOrderHistory,
  fetchTradeHistory,
  fetchAccountBalances,
  cancelRealOrder,
} from "@/lib/api";
import { useBinanceLive } from "@/hooks/useBinanceLive";
import MoodBar from "@/components/MoodBar";
import CoinCard, { CoinCardSkeleton } from "@/components/CoinCard";
import WatchlistSidebar from "@/components/WatchlistSidebar";
import DailyDigest from "@/components/DailyDigest";
import ChartPanel from "@/components/ChartPanel";
import ChatPanel from "@/components/ChatPanel";
import AppHeader from "@/components/AppHeader";
import SettingsModal from "@/components/SettingsModal";
import MarketTicker from "@/components/MarketTicker";
import OrdersPanel from "@/components/OrdersPanel";

const WATCHLIST_BREAKPOINT = 1024; // below this = mobile → panel floats + auto-collapses
const WATCHLIST_OPEN_KEY = "cryptolens_watchlist_open";

function Dashboard() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") === "orders" ? "orders" : "trade";
  const [mood, setMood] = useState<MoodResponse | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  // Default closed for SSR/first paint (avoids hydration mismatch); the effect
  // below resolves the real state from saved preference + viewport width.
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [watchlistMobile, setWatchlistMobile] = useState(false);
  const [backendInsights, setBackendInsights] = useState<InsightsResponse | null>(null);
  const [moodLoading, setMoodLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(true);
  const [chartCoin, setChartCoin] = useState<Coin | null>(null);
  const [activeCoin, setActiveCoin] = useState<Coin | null>(null);
  const [openOrders, setOpenOrders] = useState<BinanceOrder[]>([]);
  const [allOrderHistory, setAllOrderHistory] = useState<Record<string, BinanceOrder[]>>({});
  const [allTrades, setAllTrades] = useState<Record<string, BinanceTrade[]>>({});
  const [balances, setBalances] = useState<Balance[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Authentication & Settings states
  const [googleUser, setGoogleUser] = useState<{ name: string; email: string; avatar: string } | null>(null);
  const [keyStatus, setKeyStatus] = useState<{ linked: boolean; api_key_masked?: string; is_mainnet?: boolean } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [backendConfig, setBackendConfig] = useState<{ is_mainnet: boolean; base_url: string } | null>(null);

  const backendCoins = backendInsights?.coins ?? null;
  const { coins: liveCoins, ready: marketReady, lastTick, reloadMarket } = useBinanceLive(backendCoins, watchlist);
  const watchlistKey = watchlist.join(",");

  // Resolve watchlist panel state from saved preference + viewport, and keep it
  // in sync on resize: mobile widths auto-collapse (and float), desktop restores
  // the user's saved choice.
  useEffect(() => {
    const apply = () => {
      const mobile = window.innerWidth < WATCHLIST_BREAKPOINT;
      setWatchlistMobile(mobile);
      if (mobile) {
        setWatchlistOpen(false);
      } else {
        const saved = localStorage.getItem(WATCHLIST_OPEN_KEY);
        setWatchlistOpen(saved != null ? saved === "1" : true);
      }
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  const toggleWatchlist = useCallback(() => {
    setWatchlistOpen((o) => {
      const next = !o;
      // Persist intent only on desktop — a mobile open is a transient overlay.
      if (window.innerWidth >= WATCHLIST_BREAKPOINT) {
        localStorage.setItem(WATCHLIST_OPEN_KEY, next ? "1" : "0");
      }
      return next;
    });
  }, []);

  // Content docks (reserves space) only when the panel is open AND docked.
  const watchlistDocked = watchlistOpen && !watchlistMobile;

  // Load Google User from localStorage on mount & sync auth changes
  useEffect(() => {
    const handleAuthChange = () => {
      const saved = localStorage.getItem("cryptolens_google_user");
      if (saved) {
        try {
          setGoogleUser(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse Google user from storage", e);
        }
      } else {
        setGoogleUser(null);
      }
    };

    handleAuthChange();
    window.addEventListener("cryptolens_auth_changed", handleAuthChange);
    return () => {
      window.removeEventListener("cryptolens_auth_changed", handleAuthChange);
    };
  }, []);

  const loadKeyAndConfigStatus = useCallback(async () => {
    try {
      const [statusRes, configRes] = await Promise.allSettled([
        getBinanceKeysStatus(),
        getBackendConfig(),
      ]);
      if (statusRes.status === "fulfilled") setKeyStatus(statusRes.value);
      if (configRes.status === "fulfilled") setBackendConfig(configRes.value);
    } catch (err) {
      console.error("Failed to load key/config status", err);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    if (!keyStatus?.linked) return;
    setOrdersLoading(true);
    try {
      const openRes = await fetchOpenOrders();
      setOpenOrders(openRes);

      const majorSymbols = ["BTC", "ETH", "BNB", "SOL"];

      const tradesPromises = majorSymbols.map(async (sym) => {
        try {
          const res = await fetchTradeHistory(sym);
          return { sym, res };
        } catch (err) {
          console.warn(`Failed to fetch trades for ${sym}:`, err);
          return { sym, res: [] };
        }
      });

      const historyPromises = majorSymbols.map(async (sym) => {
        try {
          const res = await fetchOrderHistory(sym);
          return { sym, res };
        } catch (err) {
          console.warn(`Failed to fetch order history for ${sym}:`, err);
          return { sym, res: [] };
        }
      });

      const [tradesResults, historyResults, balRes] = await Promise.all([
        Promise.all(tradesPromises),
        Promise.all(historyPromises),
        fetchAccountBalances().catch((err) => {
          console.warn("Failed to fetch balances:", err);
          return { balances: [] };
        }),
      ]);

      const newAllTrades: Record<string, BinanceTrade[]> = {};
      tradesResults.forEach((t) => {
        newAllTrades[t.sym] = t.res;
      });

      const newAllHistory: Record<string, BinanceOrder[]> = {};
      historyResults.forEach((h) => {
        newAllHistory[h.sym] = h.res;
      });

      setAllTrades(newAllTrades);
      setAllOrderHistory(newAllHistory);
      setBalances(balRes.balances);
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  }, [keyStatus?.linked]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const load = useCallback(async () => {
    setMoodLoading(true);
    setAiLoading(true);
    // Resolve the user's watchlist first — insights + live market follow it.
    let symbols = watchlist;
    try {
      symbols = await fetchWatchlist();
      setWatchlist(symbols);
    } catch {
      /* fall back to whatever we already have (or hook defaults) */
    }
    const symbolParam = symbols.length ? symbols.join(",") : undefined;
    const [ins, m] = await Promise.allSettled([
      symbolParam ? fetchInsights(symbolParam) : fetchInsights(),
      fetchMood(),
      loadKeyAndConfigStatus(),
    ]);
    if (ins.status === "fulfilled") setBackendInsights(ins.value);
    if (m.status === "fulfilled") setMood(m.value);
    await loadOrders();
    setMoodLoading(false);
    setAiLoading(false);
    // watchlist intentionally omitted: load re-reads it from the server each call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKeyAndConfigStatus, loadOrders]);

  // Re-sync insights to the watchlist whenever the user edits it (separate from
  // the full `load` so add/remove feels instant without re-pulling everything).
  const handleWatchlistChange = useCallback((next: string[]) => {
    setWatchlist(next);
    setAiLoading(true);
    fetchInsights(next.join(","))
      .then(setBackendInsights)
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, []);

  // Pure reorder: persist the new order; no need to re-pull insights/market data.
  const handleWatchlistReorder = useCallback((next: string[]) => {
    setWatchlist(next);
    reorderWatchlist(next).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Default-select the first coin so the terminal always shows a pair (Binance style)
  useEffect(() => {
    if (!chartCoin && liveCoins.length) setChartCoin(liveCoins[0]);
  }, [liveCoins, chartCoin]);

  // Keep selected chart coin in sync with live prices
  useEffect(() => {
    if (!chartCoin || !liveCoins.length) return;
    const updated = liveCoins.find((c) => c.symbol === chartCoin.symbol);
    if (updated) setChartCoin(updated);
  }, [liveCoins, chartCoin?.symbol]);

  const handleSelectCoin = (coin: Coin) => setChartCoin(coin);
  const loading = aiLoading || !marketReady;

  // Market grid follows the watchlist order (liveCoins keeps bootstrap order).
  const orderedCoins = watchlist.length
    ? [...liveCoins].sort((a, b) => {
        const ia = watchlist.indexOf(a.symbol);
        const ib = watchlist.indexOf(b.symbol);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      })
    : liveCoins;

  const handleCancelOrder = useCallback(
    async (symbol: string, orderId: number) => {
      await cancelRealOrder(symbol, orderId);
      await loadOrders();
      await load();
    },
    [loadOrders, load]
  );

  const handleCancelAll = useCallback(
    async (orders: BinanceOrder[]) => {
      for (const o of orders) {
        await cancelRealOrder(o.symbol, o.orderId);
      }
      await loadOrders();
      await load();
    },
    [loadOrders, load]
  );

  return (
    <div
      className="flex flex-col min-h-screen transition-[padding] duration-300"
      style={{ paddingRight: watchlistDocked ? 300 : 0 }}
    >
      <AppHeader
        activeNav={currentTab === "orders" ? "orders" : "trading"}
        marketReady={marketReady}
        lastTick={lastTick}
        showNetworkBadge={!!(googleUser && keyStatus?.linked)}
        isMainnet={keyStatus?.is_mainnet}
        openOrdersCount={openOrders.length}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onRefresh={load}
      />

      <MoodBar mood={mood} loading={moodLoading} />

      <main className="flex-1 p-4 sm:p-6 max-w-[1680px] mx-auto w-full flex flex-col gap-5">
        {currentTab === "trade" ? (
          <>
            {/* Insight-first: today's digest up top; watchlist lives in the side panel */}
            <DailyDigest watchlistKey={watchlistKey} />

            {/* Markets overview — pick a coin, chart updates below */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs uppercase tracking-wider text-zinc-500">
                  ตลาด · เลือกเหรียญเพื่อเปลี่ยนกระดาน
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => <CoinCardSkeleton key={i} />)
                  : orderedCoins.map((coin) => (
                      <CoinCard
                        key={coin.symbol}
                        coin={coin}
                        stale={backendInsights?.stale ?? false}
                        selected={chartCoin?.symbol === coin.symbol}
                        onSelect={handleSelectCoin}
                        onAsk={setActiveCoin}
                      />
                    ))}
              </div>

              {!loading && liveCoins.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
                  <p className="text-sm">ไม่สามารถโหลดข้อมูลได้</p>
                  <button
                    onClick={load}
                    className="mt-4 text-xs border border-zinc-700 px-4 py-2 rounded-lg hover:border-zinc-500 transition-colors"
                  >
                    ลองใหม่
                  </button>
                </div>
              )}
            </section>

            {chartCoin ? (
              <>
                <MarketTicker coin={chartCoin} allCoins={liveCoins} onSelectCoin={handleSelectCoin} />
                <ChartPanel
                  coin={chartCoin}
                  onAsk={setActiveCoin}
                  allCoins={liveCoins}
                  onSelectCoin={handleSelectCoin}
                  onPlaceOrder={loadOrders}
                  linked={!!keyStatus?.linked}
                  onLinkClick={() => setIsSettingsOpen(true)}
                />
                {keyStatus?.linked && (
                  <OrdersPanel
                    compact
                    openOrders={openOrders}
                    orderHistoryMap={allOrderHistory}
                    tradesMap={allTrades}
                    balances={balances}
                    liveCoins={liveCoins}
                    loading={ordersLoading}
                    onCancel={handleCancelOrder}
                    onCancelAll={handleCancelAll}
                  />
                )}
              </>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-6 h-[520px] bg-zinc-900/40 border border-zinc-800 rounded-2xl animate-pulse" />
                <div className="xl:col-span-3 h-[520px] bg-zinc-900/40 border border-zinc-800 rounded-2xl animate-pulse" />
                <div className="xl:col-span-3 h-[520px] bg-zinc-900/40 border border-zinc-800 rounded-2xl animate-pulse" />
              </div>
            )}

          </>
        ) : (
          <OrdersPanel
            openOrders={openOrders}
            orderHistoryMap={allOrderHistory}
            tradesMap={allTrades}
            balances={balances}
            liveCoins={liveCoins}
            loading={ordersLoading}
            onCancel={handleCancelOrder}
            onCancelAll={handleCancelAll}
          />
        )}
      </main>

      <footer className="px-6 py-3 border-t border-zinc-800 text-xs text-zinc-600 text-center">
        ราคา real-time จาก Binance WebSocket · ข่าว/AI จาก backend · ไม่ใช่คำแนะนำการลงทุน
      </footer>

      {/* Floating Ask AI FAB */}
      {!loading && liveCoins.length > 0 && (
        <button
          onClick={() => {
            const coinToAsk = chartCoin || liveCoins[0];
            if (coinToAsk) setActiveCoin(coinToAsk);
          }}
          style={{ right: watchlistDocked ? 324 : 24 }}
          className="fixed bottom-6 z-40 flex items-center gap-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs px-4.5 py-3.5 rounded-full shadow-lg shadow-violet-950/50 hover:shadow-violet-600/30 transition-all hover:scale-105 active:scale-95 duration-200 border border-violet-500/20 cursor-pointer"
        >
          <svg className="w-4.5 h-4.5 text-violet-100" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.096L15 15l-5.187.904zM18 5.25L17.25 7.5L15 8.25l2.25.75L18 11.25l.75-2.25L21 8.25l-2.25-.75L18 5.25z" />
          </svg>
          <span>ถาม AI ({chartCoin ? chartCoin.symbol : "BTC"})</span>
        </button>
      )}

      <ChatPanel coin={activeCoin} onClose={() => setActiveCoin(null)} />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        googleUser={googleUser}
        setGoogleUser={setGoogleUser}
        onKeysChanged={load}
      />

      {/* TradingView-style docked watchlist */}
      <WatchlistSidebar
        open={watchlistOpen}
        onToggle={toggleWatchlist}
        symbols={watchlist}
        coins={liveCoins}
        selectedSymbol={chartCoin?.symbol}
        onSelect={handleSelectCoin}
        onChange={handleWatchlistChange}
        onReorder={handleWatchlistReorder}
        max={10}
        overlay={watchlistMobile}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <Dashboard />
    </Suspense>
  );
}
