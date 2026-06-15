"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Coin,
  InsightsResponse,
  MoodResponse,
  fetchInsights,
  fetchMood,
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
import ChartPanel from "@/components/ChartPanel";
import ChatPanel from "@/components/ChatPanel";
import AppHeader from "@/components/AppHeader";
import SettingsModal from "@/components/SettingsModal";
import MarketTicker from "@/components/MarketTicker";
import OrdersPanel from "@/components/OrdersPanel";

function Dashboard() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") === "orders" ? "orders" : "trade";
  const [mood, setMood] = useState<MoodResponse | null>(null);
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
  const { coins: liveCoins, ready: marketReady, lastTick, reloadMarket } = useBinanceLive(backendCoins);

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
    const [ins, m] = await Promise.allSettled([fetchInsights(), fetchMood(), loadKeyAndConfigStatus()]);
    if (ins.status === "fulfilled") setBackendInsights(ins.value);
    if (m.status === "fulfilled") setMood(m.value);
    await reloadMarket();
    await loadOrders();
    setMoodLoading(false);
    setAiLoading(false);
  }, [reloadMarket, loadKeyAndConfigStatus, loadOrders]);

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
    <div className="flex flex-col min-h-screen">
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

            {/* Markets overview */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs uppercase tracking-wider text-zinc-500">
                  ตลาด · เลือกเหรียญเพื่อเปลี่ยนกระดาน
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => <CoinCardSkeleton key={i} />)
                  : liveCoins.map((coin) => (
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
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs px-4.5 py-3.5 rounded-full shadow-lg shadow-violet-950/50 hover:shadow-violet-600/30 transition-all hover:scale-105 active:scale-95 duration-200 border border-violet-500/20 cursor-pointer"
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
