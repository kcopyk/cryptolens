"use client";

import { useState } from "react";
import { Coin, formatPrice, formatVolume, macdTrend } from "@/lib/api";
import Sparkline from "./Sparkline";
import { NewsList } from "./IndicatorNews";

interface Props {
  coin: Coin;
  stale: boolean;
  selected?: boolean;
  onSelect: (coin: Coin) => void;
  onAsk: (coin: Coin) => void;
}

function rsiLabel(rsi: number): { label: string; color: string } {
  if (rsi >= 70) return { label: "Overbought", color: "text-red-400" };
  if (rsi >= 55) return { label: "Bullish", color: "text-emerald-400" };
  if (rsi >= 45) return { label: "Neutral", color: "text-zinc-400" };
  if (rsi >= 30) return { label: "Bearish", color: "text-orange-400" };
  return { label: "Oversold", color: "text-red-400" };
}

export default function CoinCard({ coin, stale, selected, onSelect, onAsk }: Props) {
  const [expanded, setExpanded] = useState(false);
  const positive = coin.change_24h_pct >= 0;
  const changeColor = positive ? "text-emerald-400" : "text-red-400";
  const { label: rsiLbl, color: rsiColor } = rsiLabel(coin.rsi);
  const news = coin.news ?? [];
  const indicators = coin.indicators;
  const macd = indicators ? macdTrend(indicators.macd_histogram) : null;

  return (
    <div
      className={`bg-zinc-900 border rounded-2xl p-5 flex flex-col gap-3 transition-colors cursor-pointer ${
        selected
          ? "border-violet-500 ring-1 ring-violet-500/30"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
      onClick={() => onSelect(coin)}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-zinc-100">{coin.symbol}</span>
            {stale && (
              <span className="text-xs text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded">
                stale
              </span>
            )}
          </div>
          <span className="text-2xl font-semibold text-white tabular-nums transition-colors duration-300">
            ${formatPrice(coin.price)}
          </span>
        </div>
        <div className="text-right flex flex-col items-end">
          <span className={`text-base font-semibold tabular-nums ${changeColor}`}>
            {positive ? "+" : ""}{coin.change_24h_pct.toFixed(2)}%
          </span>
          <span className="text-[10px] text-zinc-500 font-medium">last 24 hr</span>
        </div>
      </div>

      <div className="flex justify-center py-1">
        <Sparkline data={coin.sparkline} positive={positive} width={200} height={48} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-zinc-500 uppercase tracking-wider">RSI 14</span>
          <span className={`font-semibold ${rsiColor}`}>{coin.rsi} · {rsiLbl}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-zinc-500 uppercase tracking-wider">Volume 24h</span>
          <span className="font-semibold text-zinc-300">{formatVolume(coin.volume_24h)}</span>
        </div>
        {indicators && macd && (
          <>
            <div className="flex flex-col gap-0.5">
              <span className="text-zinc-500 uppercase tracking-wider">MACD</span>
              <span className={`font-semibold ${macd.color}`}>{macd.label}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-zinc-500 uppercase tracking-wider">EMA 9/21</span>
              <span className={`font-semibold ${
                indicators.ema_9 > indicators.ema_21 ? "text-emerald-400" : "text-red-400"
              }`}>
                {indicators.ema_9 > indicators.ema_21 ? "Bullish" : "Bearish"}
              </span>
            </div>
          </>
        )}
      </div>

      {news.length > 0 && (
        <div className="border-t border-zinc-800 pt-2" onClick={(e) => e.stopPropagation()}>
          <NewsList news={news.slice(0, 2)} compact />
        </div>
      )}

      <div className="border-t border-zinc-800 pt-3">
        <p className={`text-[11px] text-zinc-300 leading-relaxed font-sans ${!expanded ? "line-clamp-2" : ""}`}>
          {coin.summary || <span className="text-zinc-500 italic">summary unavailable</span>}
        </p>
        {coin.summary && coin.summary.length > 100 && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="mt-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      <div className="flex gap-2 mt-auto">
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(coin); }}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
            selected
              ? "bg-violet-600 text-white"
              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
          }`}
        >
          {selected ? "กำลังดู chart" : "ดู chart →"}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onAsk(coin); }}
          className="flex-1 py-2 rounded-xl text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
        >
          ถาม AI
        </button>
      </div>
    </div>
  );
}

export function CoinCardSkeleton() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-12 bg-zinc-700 rounded animate-pulse" />
          <div className="h-8 w-32 bg-zinc-700 rounded animate-pulse" />
        </div>
        <div className="h-6 w-16 bg-zinc-700 rounded animate-pulse" />
      </div>
      <div className="h-12 bg-zinc-800 rounded animate-pulse" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-8 bg-zinc-700 rounded animate-pulse" />
        <div className="h-8 bg-zinc-700 rounded animate-pulse" />
        <div className="h-8 bg-zinc-700 rounded animate-pulse" />
        <div className="h-8 bg-zinc-700 rounded animate-pulse" />
      </div>
      <div className="border-t border-zinc-800 pt-3 flex flex-col gap-2">
        <div className="h-4 bg-zinc-700 rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-zinc-700 rounded animate-pulse" />
      </div>
      <div className="flex gap-2 mt-auto">
        <div className="h-9 flex-1 bg-zinc-800 rounded-xl animate-pulse" />
        <div className="h-9 flex-1 bg-zinc-800 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
