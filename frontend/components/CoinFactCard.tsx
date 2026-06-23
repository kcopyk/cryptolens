"use client";

import { Coin, CoinHeat, formatPrice, formatVolume, macdTrend, INDICATOR_INTERVAL } from "@/lib/api";
import Sparkline from "./Sparkline";
import HeatBar from "./HeatBar";
import DeviationBadge from "./DeviationBadge";
import TradeOnBinanceButton from "./TradeOnBinanceButton";
import CoinIcon from "./CoinIcon";
import { NewsList } from "./IndicatorNews";

interface Props {
  coin: Coin;
  heat?: CoinHeat;
  stale?: boolean;
  /** Held amount + share of portfolio (when this coin is in the user's holdings). */
  amount?: number;
  weightPct?: number;
  selected?: boolean;
  onSelect: (coin: Coin) => void;
  onAsk: (coin: Coin) => void;
}

const RSI_LABEL: Record<string, string> = {
  overbought: "Overbought",
  strong: "Strong",
  neutral: "Neutral",
  weak: "Weak",
  oversold: "Oversold",
};

function rsiLabel(rsi: number): { label: string; color: string } {
  if (rsi >= 70) return { label: RSI_LABEL.overbought, color: "text-coral" };
  if (rsi >= 55) return { label: RSI_LABEL.strong, color: "text-mint" };
  if (rsi >= 45) return { label: RSI_LABEL.neutral, color: "text-muted" };
  if (rsi >= 30) return { label: RSI_LABEL.weak, color: "text-coral/70" };
  return { label: RSI_LABEL.oversold, color: "text-mint" };
}

/**
 * Per-coin card — layout inspired by cryptolens CoinCard, extended with pivot
 * features (deviation wedge, Heat, portfolio weight, Binance CTA).
 */
export default function CoinFactCard({
  coin,
  heat,
  stale,
  amount,
  weightPct,
  selected,
  onSelect,
  onAsk,
}: Props) {
  const positive = coin.change_24h_pct >= 0;
  const { label: rsiLbl, color: rsiColor } = rsiLabel(coin.rsi);
  const news = coin.news ?? [];
  const indicators = coin.indicators;
  const macd = indicators ? macdTrend(indicators.macd_histogram) : null;
  const facts = heat?.facts;

  const factChips: string[] = [];
  if (facts) {
    if (facts.drop_from_high_7d_pct != null && facts.drop_from_high_7d_pct <= -1) {
      factChips.push(`Down ${Math.abs(facts.drop_from_high_7d_pct)}% from 7-day high`);
    } else if (facts.gain_from_low_7d_pct != null && facts.gain_from_low_7d_pct >= 1) {
      factChips.push(`Up ${facts.gain_from_low_7d_pct}% from 7-day low`);
    }
  }

  const value = amount != null ? amount * coin.price : null;

  return (
    <div
      className={`glow-card bg-panel/60 border rounded-3xl p-4 sm:p-5 flex flex-col gap-3 cursor-pointer transition-colors ${
        selected ? "border-mint ring-1 ring-mint/30" : "border-line hover:border-mint/30"
      }`}
      onClick={() => onSelect(coin)}
    >
      {/* Header — symbol + big price | 24h change */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <CoinIcon asset={coin.symbol} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-lg font-bold text-ink">{coin.symbol}</span>
              {weightPct != null && (
                <span className="text-[10px] font-semibold text-mint bg-mint/10 border border-mint/20 rounded px-1.5 py-0.5">
                  {weightPct}% พอร์ต
                </span>
              )}
              {stale && (
                <span className="text-[10px] text-warn border border-warn/30 px-1.5 py-0.5 rounded">
                  stale
                </span>
              )}
            </div>
            <span className="text-2xl font-semibold text-ink font-mono tabular-nums">
              ${formatPrice(coin.price)}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end">
          <span
            className={`text-base font-semibold font-mono tabular-nums ${
              positive ? "text-mint" : "text-coral"
            }`}
          >
            {positive ? "+" : ""}
            {coin.change_24h_pct.toFixed(2)}%
          </span>
          <span className="text-[10px] text-muted font-medium">24 ชม.</span>
        </div>
      </div>

      {/* Centered sparkline — reference card signature */}
      <div className="flex justify-center py-1">
        <Sparkline data={coin.sparkline} positive={positive} width={200} height={48} />
      </div>

      {/* Portfolio holding */}
      {value != null && (
        <div className="flex items-center justify-between text-xs bg-base/40 border border-line rounded-lg px-2.5 py-1.5">
          <span className="text-muted">คุณถือ</span>
          <span className="text-ink font-medium tabular-nums">
            {amount} {coin.symbol} · ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Deviation wedge — pivot hero signal */}
      {heat?.deviation ? (
        <DeviationBadge dev={heat.deviation} />
      ) : (
        <div className="h-12 rounded-xl bg-base/40 animate-pulse" />
      )}

      {/* Indicator grid — daily (1D), aligned with deviation/heat */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-muted uppercase tracking-wider text-[10px]">
            RSI 14 · {INDICATOR_INTERVAL.toUpperCase()}
          </span>
          <span className={`font-semibold tabular-nums ${rsiColor}`}>
            {coin.rsi} · {rsiLbl}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted uppercase tracking-wider text-[10px]">Volume 24h</span>
          <span className="font-semibold text-ink tabular-nums">{formatVolume(coin.volume_24h)}</span>
        </div>
        {indicators && macd && (
          <>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted uppercase tracking-wider text-[10px]">MACD</span>
              <span className={`font-semibold ${macd.color}`}>{macd.label}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted uppercase tracking-wider text-[10px]">EMA 9/21</span>
              <span
                className={`font-semibold ${
                  indicators.ema_9 > indicators.ema_21 ? "text-mint" : "text-coral"
                }`}
              >
                {indicators.ema_9 > indicators.ema_21 ? "Bullish" : "Bearish"}
              </span>
            </div>
          </>
        )}
      </div>

      {/* 7-day context facts */}
      {factChips.length > 0 && (
        <ul className="flex flex-col gap-1">
          {factChips.map((f, i) => (
            <li key={i} className="text-[11px] text-muted flex items-start gap-1.5">
              <span className="text-mint mt-1.5 w-1 h-1 rounded-full bg-mint shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      )}

      {/* Heat — new feature, compact */}
      {heat && (
        <div onClick={(e) => e.stopPropagation()}>
          <HeatBar heat={heat} size="sm" />
        </div>
      )}

      {/* News */}
      {news.length > 0 && (
        <div className="border-t border-line pt-2" onClick={(e) => e.stopPropagation()}>
          <NewsList news={news.slice(0, 2)} compact />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto pt-1 border-t border-line">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAsk(coin);
          }}
          className="flex-1 py-2 rounded-xl text-sm font-medium bg-ink/6 hover:bg-ink/10 text-ink transition-colors"
        >
          ถาม AI
        </button>
        <TradeOnBinanceButton symbol={coin.symbol} size="md" className="flex-1 justify-center" />
      </div>
    </div>
  );
}

export function CoinFactCardSkeleton() {
  return (
    <div className="bg-panel/40 border border-line rounded-3xl p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-full bg-line animate-pulse" />
          <div className="flex flex-col gap-2">
            <div className="h-5 w-12 bg-line rounded animate-pulse" />
            <div className="h-8 w-32 bg-line rounded animate-pulse" />
          </div>
        </div>
        <div className="h-6 w-16 bg-line rounded animate-pulse" />
      </div>
      <div className="h-12 bg-line/60 rounded animate-pulse mx-auto w-[200px]" />
      <div className="h-12 bg-line rounded-xl animate-pulse" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-8 bg-line rounded animate-pulse" />
        <div className="h-8 bg-line rounded animate-pulse" />
        <div className="h-8 bg-line rounded animate-pulse" />
        <div className="h-8 bg-line rounded animate-pulse" />
      </div>
      <div className="h-6 bg-line rounded animate-pulse" />
      <div className="flex gap-2 border-t border-line pt-3">
        <div className="h-9 flex-1 bg-line rounded-xl animate-pulse" />
        <div className="h-9 flex-1 bg-line rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
