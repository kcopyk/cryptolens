"use client";

import { useState } from "react";
import { Coin, ChartInterval, CHART_INTERVALS, formatNumber, MockOrder } from "@/lib/api";
import { useBinanceChart } from "@/hooks/useBinanceChart";
import { snapshotFromCandles } from "@/lib/indicators";
import CandlestickChart, { MacdMiniChart, RsiMiniChart } from "./CandlestickChart";
import { IndicatorBar, NewsList } from "./IndicatorNews";
import OrderPanel from "./OrderPanel";
import OrderBook from "./OrderBook";
import RecentTrades from "./RecentTrades";

interface Props {
  coin: Coin;
  onAsk: (coin: Coin) => void;
  allCoins?: Coin[];
  onSelectCoin?: (coin: Coin) => void;
  onPlaceOrder?: (order: MockOrder) => void;
  linked?: boolean;
  onLinkClick?: () => void;
}

export default function ChartPanel({
  coin,
  onAsk,
  allCoins = [],
  onSelectCoin,
  onPlaceOrder,
  linked = false,
  onLinkClick,
}: Props) {
  const [interval, setInterval] = useState<ChartInterval>("15m");
  const { candles, loading, error, retry } = useBinanceChart(coin.symbol, interval);

  // Price chosen from the order book / trade tape, forwarded into the order form.
  const [prefill, setPrefill] = useState<{ price: number; tick: number }>({ price: 0, tick: 0 });
  const pickPrice = (price: number) => setPrefill((p) => ({ price, tick: p.tick + 1 }));

  const news = coin.news ?? [];
  const snap = snapshotFromCandles(candles);
  const showChart = candles.length > 0;

  return (
    <section className="flex flex-col gap-4">
      {/* ── Terminal: chart | order book + trades | order form ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Chart column */}
        <div className="xl:col-span-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-100">{coin.symbol}/USDT</span>
              <span className="text-[10px] uppercase tracking-wider text-violet-400 font-medium">Chart</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-zinc-800 rounded-lg p-0.5 flex-wrap">
                {CHART_INTERVALS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setInterval(value)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      interval === value ? "bg-zinc-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => onAsk(coin)}
                className="text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                ถาม AI →
              </button>
            </div>
          </div>

          <div className="p-4 flex-1">
            {loading && !showChart && (
              <div className="h-[420px] bg-zinc-800/50 rounded-xl animate-pulse flex items-center justify-center">
                <span className="text-sm text-zinc-500">กำลังโหลด chart…</span>
              </div>
            )}
            {error && !showChart && (
              <div className="h-[420px] bg-zinc-800/30 rounded-xl flex flex-col items-center justify-center gap-3">
                <span className="text-sm text-red-400">{error}</span>
                <button
                  onClick={retry}
                  className="text-xs border border-zinc-700 px-4 py-2 rounded-lg hover:border-zinc-500 transition-colors text-zinc-300"
                >
                  ลองใหม่
                </button>
              </div>
            )}
            {showChart && (
              <div className={loading ? "opacity-60" : ""}>
                <CandlestickChart
                  key={`${coin.symbol}-${interval}`}
                  candles={candles}
                  interval={interval}
                  height={420}
                />
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">MACD · Signal · Histogram</p>
                  <MacdMiniChart key={`macd-${coin.symbol}-${interval}`} candles={candles} interval={interval} height={100} />
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">RSI (14)</p>
                    {snap && (
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          snap.rsi >= 70 ? "text-red-400" : snap.rsi <= 30 ? "text-emerald-400" : "text-zinc-300"
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

        {/* Order book + recent trades column */}
        <div className="xl:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex flex-col divide-y divide-zinc-800 min-h-[560px]">
          <div className="flex-none">
            <OrderBook symbol={coin.symbol} lastPrice={coin.price} onSelectPrice={pickPrice} />
          </div>
          <div className="flex-1 min-h-[220px]">
            <RecentTrades symbol={coin.symbol} onSelectPrice={pickPrice} />
          </div>
        </div>

        {/* Order form column */}
        <div className="xl:col-span-3">
          <OrderPanel
            coin={coin}
            allCoins={allCoins}
            onSelectCoin={onSelectCoin}
            onPlaceOrder={onPlaceOrder}
            prefillPrice={prefill.price}
            prefillTick={prefill.tick}
            hidePairHeader
            linked={linked}
            onLinkClick={onLinkClick}
          />
        </div>
      </div>

      {/* ── Indicators + news ── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl px-5 py-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Technical Indicators</h3>
          {showChart && <IndicatorBar candles={candles} />}
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-3">ข่าวล่าสุด · ทำไมราคาขยับ</h3>
          <NewsList news={news} />
        </div>
      </div>
    </section>
  );
}
