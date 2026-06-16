"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Coin,
  CoinHeat,
  Holding,
  InsightsResponse,
  MoodResponse,
  fetchInsights,
  fetchMood,
  fetchWatchlist,
  fetchHoldings,
  fetchHeat,
} from "@/lib/api";
import { useBinanceLive } from "@/hooks/useBinanceLive";
import MoodBar from "@/components/MoodBar";
import CoinFactCard, { CoinFactCardSkeleton } from "@/components/CoinFactCard";
import HoldingsPanel from "@/components/HoldingsPanel";
import DailyDigest from "@/components/DailyDigest";
import ChartPanel from "@/components/ChartPanel";
import ChatPanel from "@/components/ChatPanel";
import AppHeader from "@/components/AppHeader";
import SettingsModal from "@/components/SettingsModal";
import MarketTicker from "@/components/MarketTicker";

const DEFAULT_SYMBOLS = ["BTC", "ETH", "BNB", "SOL"];

export default function Dashboard() {
  const [mood, setMood] = useState<MoodResponse | null>(null);
  const [moodLoading, setMoodLoading] = useState(true);

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

  // The coins we focus on = the user's holdings (their money). Fall back to the
  // watchlist / defaults so the page is never empty before they enter any.
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

  // ─── Account auth sync ──────────────────────────────────────────────
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

  // ─── Bootstrap: holdings + watchlist + mood ─────────────────────────
  const loadBase = useCallback(async () => {
    setMoodLoading(true);
    const [hold, wl, m] = await Promise.allSettled([
      fetchHoldings(),
      fetchWatchlist(),
      fetchMood(),
    ]);
    if (hold.status === "fulfilled") setHoldings(hold.value);
    if (wl.status === "fulfilled") setWatchlist(wl.value);
    if (m.status === "fulfilled") setMood(m.value);
    setMoodLoading(false);
  }, []);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  // ─── Insights + Heat follow the focused symbols ─────────────────────
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

  // Keep the selected chart coin synced with live prices.
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

  // Order the fact-card grid: held coins first (heaviest order), then the rest.
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

      <MoodBar mood={mood} loading={moodLoading} />

      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full flex flex-col gap-6">
        {/* HERO — the one question: "วันนี้ต้องสนใจอะไรไหม" */}
        <DailyDigest refreshKey={displayKey} heat={heat} />

        {/* Your portfolio (manual holdings) */}
        <HoldingsPanel holdings={holdings} liveCoins={liveCoins} onChange={setHoldings} />

        {/* Your coins — status + why, at a glance */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-ink">
              {holdings.length ? "เหรียญในพอร์ตของคุณ" : "เหรียญยอดนิยม"}
            </h2>
            <span className="text-[11px] text-muted">
              Heat = ระดับความร้อน (ไม่ใช่ควรซื้อ/ขาย)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {gridLoading
              ? Array.from({ length: 3 }).map((_, i) => <CoinFactCardSkeleton key={i} />)
              : orderedCoins.map((coin) => (
                  <CoinFactCard
                    key={coin.symbol}
                    coin={coin}
                    heat={heat[coin.symbol]}
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
                className="mt-4 text-xs border border-line px-4 py-2 rounded-lg hover:border-mint/40 transition-colors"
              >
                ลองใหม่
              </button>
            </div>
          )}
        </section>

        {/* Chart — opt-in only; it never steals attention on load */}
        {chartOpen && chartCoin && (
          <section id="chart-section" className="flex flex-col gap-4">
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
          </section>
        )}
      </main>

      <footer className="px-6 py-3 border-t border-line text-xs text-muted text-center">
        ราคา real-time จาก Binance · ข่าว/AI จาก backend · Heat คำนวณจากสูตร ไม่ใช่คำแนะนำการลงทุน
      </footer>

      {/* Floating Ask AI FAB */}
      {!gridLoading && liveCoins.length > 0 && (
        <button
          onClick={() => setActiveCoin(chartCoin || liveCoins[0])}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 bg-mint text-base font-bold text-xs px-4.5 py-3.5 rounded-full shadow-[0_30px_80px_-40px_rgba(39,229,176,0.45)] transition-all hover:scale-105 active:scale-95 duration-200 cursor-pointer"
        >
          <svg className="w-4.5 h-4.5 text-base" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.096L15 15l-5.187.904zM18 5.25L17.25 7.5L15 8.25l2.25.75L18 11.25l.75-2.25L21 8.25l-2.25-.75L18 5.25z" />
          </svg>
          <span>ถาม AI ({chartCoin ? chartCoin.symbol : liveCoins[0]?.symbol})</span>
        </button>
      )}

      <ChatPanel coin={activeCoin} onClose={() => setActiveCoin(null)} />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        googleUser={googleUser}
        setGoogleUser={setGoogleUser}
      />
    </div>
  );
}
