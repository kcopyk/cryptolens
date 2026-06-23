"use client";

import { useState } from "react";
import { Coin, ChartInterval, CHART_INTERVALS, formatNumber, INDICATOR_INTERVAL } from "@/lib/api";
import { useBinanceChart } from "@/hooks/useBinanceChart";
import { snapshotFromCandles } from "@/lib/indicators";
import { MacdMiniChart, RsiMiniChart } from "./CandlestickChart";
import KLineChartPanel from "./KLineChartPanel";
import TradeOnBinanceButton from "./TradeOnBinanceButton";
import { IndicatorBar, NewsList } from "./IndicatorNews";
import OrderBook from "./OrderBook";
import RecentTrades from "./RecentTrades";

interface Props {
  coin: Coin;
  onAsk: (coin: Coin) => void;
}

export default function ChartPanel({ coin, onAsk }: Props) {
  const [interval, setInterval] = useState<ChartInterval>(INDICATOR_INTERVAL);
  const { candles, loading, error, retry } = useBinanceChart(coin.symbol, interval);

  const news = coin.news ?? [];
  const snap = snapshotFromCandles(candles);
  const showChart = candles.length > 0;
  const indicatorsMatchCard = interval === INDICATOR_INTERVAL;

  return (
    <section className="flex flex-col gap-4">
      {/* ── Read-only deep look: chart | order book + trades.
          No order form — acting on it happens on Binance (deep-link). ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Chart column */}
        <div className="xl:col-span-8 bg-panel/50 border border-line rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-ink">{coin.symbol}/USDT</span>
              <span className="text-[10px] uppercase tracking-wider text-mint font-medium">Chart</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-ink/6 rounded-lg p-0.5 flex-wrap">
                {CHART_INTERVALS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setInterval(value)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      interval === value ? "bg-ink/10 text-ink" : "text-muted hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <TradeOnBinanceButton symbol={coin.symbol} />
              <button
                onClick={() => onAsk(coin)}
                className="text-xs font-medium bg-mint hover:bg-mint/90 text-base px-3 py-1.5 rounded-lg transition-colors"
              >
                ถาม AI →
              </button>
            </div>
          </div>

          <div className="p-4 flex-1">
            {loading && !showChart && (
              <div className="h-[420px] bg-ink/6 rounded-xl animate-pulse flex items-center justify-center">
                <span className="text-sm text-muted">กำลังโหลด chart…</span>
              </div>
            )}
            {error && !showChart && (
              <div className="h-[420px] bg-ink/6 rounded-xl flex flex-col items-center justify-center gap-3">
                <span className="text-sm text-coral">{error}</span>
                <button
                  onClick={retry}
                  className="text-xs border border-line px-4 py-2 rounded-lg hover:border-mint/30 transition-colors text-ink"
                >
                  ลองใหม่
                </button>
              </div>
            )}
            {showChart && (
              <div className={loading ? "opacity-60" : ""}>
                <KLineChartPanel
                  symbol={coin.symbol}
                  candles={candles}
                  interval={interval}
                  height={420}
                />
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted mb-2">MACD · Signal · Histogram</p>
                  <MacdMiniChart key={`macd-${coin.symbol}-${interval}`} candles={candles} interval={interval} height={100} />
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted">RSI (14)</p>
                    {snap && (
                      <span
                        className={`text-xs font-semibold tabular-nums font-mono ${
                          snap.rsi >= 70 ? "text-coral" : snap.rsi <= 30 ? "text-mint" : "text-ink"
                        }`}
                      >
                        {formatNumber(snap.rsi, 1)}
                        {snap.rsi >= 70 ? " · Overbought" : snap.rsi <= 30 ? " · Oversold" : ""}
                      </span>
                    )}
                  </div>
                  <RsiMiniChart key={`rsi-${coin.symbol}-${interval}`} candles={candles} interval={interval} height={80} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Order book + recent trades column (read-only market depth). On xl its
            height is bounded to the chart column so the trades list scrolls
            inside instead of stretching the whole row. */}
        <div className="xl:col-span-4 bg-panel/50 border border-line rounded-2xl flex flex-col divide-y divide-line min-h-[560px] xl:min-h-0 xl:overflow-hidden">
          <div className="flex-none">
            <OrderBook symbol={coin.symbol} lastPrice={coin.price} />
          </div>
          <div className="flex-1 min-h-[220px] xl:min-h-0 xl:relative">
            <div className="xl:absolute xl:inset-0">
              <RecentTrades symbol={coin.symbol} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Indicators + news ── */}
      <div className="bg-panel/50 border border-line rounded-2xl px-5 py-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-xs uppercase tracking-wider text-muted">Technical Indicators</h3>
            {!indicatorsMatchCard && (
              <span className="text-[10px] text-warn/90">
                ตาม {interval.toUpperCase()} — การ์ดใช้ {INDICATOR_INTERVAL.toUpperCase()}
              </span>
            )}
          </div>
          {showChart && <IndicatorBar candles={candles} />}
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-wider text-muted mb-3">ข่าวล่าสุด · ทำไมราคาขยับ</h3>
          <NewsList news={news} />
        </div>
      </div>
    </section>
  );
}
