"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Coin,
  CoinHeat,
  Holding,
  InsightsResponse,
  fetchInsights,
  fetchWatchlist,
  fetchHoldings,
  fetchHeat,
} from "@/lib/api";
import { useBinanceLive } from "@/hooks/useBinanceLive";
import PriceScrollTicker from "@/components/PriceScrollTicker";
import CoinFactCard, { CoinFactCardSkeleton } from "@/components/CoinFactCard";
import HoldingsPanel from "@/components/HoldingsPanel";
import DailyDigest from "@/components/DailyDigest";
import ChartPanel from "@/components/ChartPanel";
import ChatPanel from "@/components/ChatPanel";
import AppHeader from "@/components/AppHeader";
import AppNav from "@/components/AppNav";
import SettingsModal from "@/components/SettingsModal";
import MarketTicker from "@/components/MarketTicker";
import RevealSection from "@/components/RevealSection";

const DEFAULT_SYMBOLS = ["BTC", "ETH", "BNB", "SOL"];

export default function Dashboard() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [backendInsights, setBackendInsights] = useState<InsightsResponse | null>(null);
  const [heat, setHeat] = useState<Record<string, CoinHeat>>({});
  const [insightsLoading, setInsightsLoading] = useState(true);

  const [chartCoin, setChartCoin] = useState<Coin | null>(null);
  const [chartOpen, setChartOpen] = useState(false);
  const [activeCoin, setActiveCoin] = useState<Coin | null>(null);

  const [googleUser, setGoogleUser] = useState<{ name: string; email: string; avatar: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const heldSymbols = holdings.map((h) => h.symbol);
  const displaySymbols = heldSymbols.length
    ? heldSymbols
    : watchlist.length
      ? watchlist
      : DEFAULT_SYMBOLS;
  const displayKey = displaySymbols.join(",");

  const { coins: liveCoins, ready: marketReady, lastTick } = useBinanceLive(
    backendInsights?.coins ?? null,
    displaySymbols
  );

  const weightBySymbol = useMemo(() => {
    const prices = new Map(liveCoins.map((c) => [c.symbol, c.price]));
    const enriched = holdings.map((h) => ({
      symbol: h.symbol,
      value: h.amount * (prices.get(h.symbol) ?? 0),
    }));
    const total = enriched.reduce((s, r) => s + r.value, 0);
    const map = new Map<string, number>();
    if (total > 0) {
      for (const r of enriched) map.set(r.symbol, Math.round((r.value / total) * 1000) / 10);
    }
    return map;
  }, [holdings, liveCoins]);

  const amountBySymbol = useMemo(
    () => new Map(holdings.map((h) => [h.symbol, h.amount])),
    [holdings]
  );

  useEffect(() => {
    const handleAuthChange = () => {
      const saved = localStorage.getItem("cryptolens_google_user");
      if (saved) {
        try {
          setGoogleUser(JSON.parse(saved));
        } catch {
          setGoogleUser(null);
        }
      } else {
        setGoogleUser(null);
      }
    };
    handleAuthChange();
    window.addEventListener("cryptolens_auth_changed", handleAuthChange);
    return () => window.removeEventListener("cryptolens_auth_changed", handleAuthChange);
  }, []);

  const loadBase = useCallback(async () => {
    const [hold, wl] = await Promise.allSettled([fetchHoldings(), fetchWatchlist()]);
    if (hold.status === "fulfilled") setHoldings(hold.value);
    if (wl.status === "fulfilled") setWatchlist(wl.value);
  }, []);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    let cancelled = false;
    setInsightsLoading(true);
    Promise.allSettled([fetchInsights(displayKey), fetchHeat(displaySymbols)])
      .then(([ins, ht]) => {
        if (cancelled) return;
        if (ins.status === "fulfilled") setBackendInsights(ins.value);
        if (ht.status === "fulfilled") setHeat(ht.value.heat);
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayKey]);

  useEffect(() => {
    if (!chartCoin || !liveCoins.length) return;
    const updated = liveCoins.find((c) => c.symbol === chartCoin.symbol);
    if (updated && updated.price !== chartCoin.price) setChartCoin(updated);
  }, [liveCoins, chartCoin]);

  const handleOpenChart = (coin: Coin) => {
    setChartCoin(coin);
    setChartOpen(true);
    setTimeout(() => {
      document.getElementById("chart-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const handleHoldingsChange = useCallback((next: Holding[]) => {
    setHoldings(next);
    setChartOpen(false);
  }, []);

  const orderedCoins = useMemo(() => {
    if (!holdings.length) return liveCoins;
    const idx = new Map(heldSymbols.map((s, i) => [s, i]));
    return [...liveCoins].sort(
      (a, b) => (idx.get(a.symbol) ?? 999) - (idx.get(b.symbol) ?? 999)
    );
  }, [liveCoins, holdings.length, heldSymbols]);

  const refresh = useCallback(() => {
    loadBase();
    fetchInsights(displayKey).then(setBackendInsights).catch(() => {});
    fetchHeat(displaySymbols).then((r) => setHeat(r.heat)).catch(() => {});
  }, [loadBase, displayKey, displaySymbols]);

  const gridLoading = insightsLoading && !liveCoins.length;

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader
        marketReady={marketReady}
        lastTick={lastTick}
        googleUser={googleUser}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onRefresh={refresh}
      />
      <AppNav />

      <PriceScrollTicker />

      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-8 sm:gap-10">
        <RevealSection>
          <DailyDigest refreshKey={displayKey} heat={heat} />
        </RevealSection>

        <RevealSection>
          <HoldingsPanel holdings={holdings} liveCoins={liveCoins} onChange={handleHoldingsChange} />
        </RevealSection>

        <RevealSection as="section">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-5">
            <div>
              <h2 className="text-xl font-bold text-ink tracking-tight">
                {holdings.length ? "เหรียญในพอร์ตของคุณ" : "เหรียญยอดนิยม"}
              </h2>
              <p className="text-[13px] text-muted mt-1">
                สถานะ + ข่าว + ข้อเท็จจริง · Heat คือระดับความร้อน ไม่ใช่คำแนะนำซื้อ/ขาย
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {gridLoading
              ? Array.from({ length: 3 }).map((_, i) => <CoinFactCardSkeleton key={i} />)
              : orderedCoins.map((coin) => (
                  <CoinFactCard
                    key={coin.symbol}
                    coin={coin}
                    heat={heat[coin.symbol]}
                    stale={backendInsights?.stale ?? false}
                    amount={amountBySymbol.get(coin.symbol)}
                    weightPct={weightBySymbol.get(coin.symbol)}
                    selected={chartCoin?.symbol === coin.symbol && chartOpen}
                    onSelect={handleOpenChart}
                    onAsk={setActiveCoin}
                  />
                ))}
          </div>

          {!gridLoading && liveCoins.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted">
              <p className="text-sm">ไม่สามารถโหลดข้อมูลได้</p>
              <button
                onClick={refresh}
                className="mt-4 text-xs border border-line px-4 py-2 rounded-xl hover:border-mint/40 transition-colors"
              >
                ลองใหม่
              </button>
            </div>
          )}
        </RevealSection>

        {chartOpen && chartCoin && (
          <RevealSection as="section" className="flex flex-col gap-4">
            <div id="chart-section" className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">กราฟ {chartCoin.symbol}</h2>
              <button
                onClick={() => setChartOpen(false)}
                className="text-xs text-muted hover:text-ink border border-line px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                ปิดกราฟ
              </button>
            </div>
            <MarketTicker coin={chartCoin} allCoins={liveCoins} onSelectCoin={setChartCoin} />
            <ChartPanel coin={chartCoin} onAsk={setActiveCoin} />
            </div>
          </RevealSection>
        )}
      </main>

      <footer className="px-6 py-3 border-t border-line text-xs text-muted text-center">
        ราคา real-time จาก Binance · ข่าว/AI จาก backend · Heat คำนวณจากสูตร ไม่ใช่คำแนะนำการลงทุน
      </footer>

      {!gridLoading && liveCoins.length > 0 && (
        <button
          onClick={() => setActiveCoin(chartCoin || liveCoins[0])}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-mint text-base font-bold text-xs px-5 py-3.5 rounded-full shadow-[0_24px_64px_-32px_rgba(39,229,176,0.55)] transition-transform hover:scale-[1.03] active:scale-[0.97] duration-200 cursor-pointer"
        >
          <svg className="w-4.5 h-4.5 text-base" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.096L15 15l-5.187.904zM18 5.25L17.25 7.5L15 8.25l2.25.75L18 11.25l.75-2.25L21 8.25l-2.25-.75L18 5.25z" />
          </svg>
          <span>ถาม AI ({chartCoin ? chartCoin.symbol : liveCoins[0]?.symbol})</span>
        </button>
      )}

      <ChatPanel
        coin={activeCoin}
        allCoins={liveCoins}
        onSelectCoin={setActiveCoin}
        onClose={() => setActiveCoin(null)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        googleUser={googleUser}
        setGoogleUser={setGoogleUser}
      />
    </div>
  );
}
