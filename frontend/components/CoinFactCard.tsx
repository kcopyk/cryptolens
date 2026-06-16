"use client";

import { Coin, CoinHeat, formatPrice } from "@/lib/api";
import Sparkline from "./Sparkline";
import HeatBar from "./HeatBar";
import DeviationBadge from "./DeviationBadge";
import TradeOnBinanceButton from "./TradeOnBinanceButton";
import CoinIcon from "./CoinIcon";

interface Props {
  coin: Coin;
  heat?: CoinHeat;
  /** Held amount + share of portfolio (when this coin is in the user's holdings). */
  amount?: number;
  weightPct?: number;
  selected?: boolean;
  onSelect: (coin: Coin) => void;
  onAsk: (coin: Coin) => void;
}

const RSI_LABEL_TH: Record<string, string> = {
  overbought: "ซื้อมากเกิน",
  strong: "แข็งแรง",
  neutral: "เป็นกลาง",
  weak: "อ่อนแรง",
  oversold: "ขายมากเกิน",
};

/**
 * "สถานะ + ทำไม" card (PLAN milestone 3). Shows Heat + plain facts only — the
 * user draws their own buy/sell conclusion; we never print a verdict.
 */
export default function CoinFactCard({
  coin,
  heat,
  amount,
  weightPct,
  selected,
  onSelect,
  onAsk,
}: Props) {
  const positive = coin.change_24h_pct >= 0;
  const facts = heat?.facts;

  const factChips: string[] = [];
  if (facts) {
    factChips.push(`RSI ${facts.rsi} · ${RSI_LABEL_TH[facts.rsi_label] ?? facts.rsi_label}`);
    if (facts.drop_from_high_7d_pct != null && facts.drop_from_high_7d_pct <= -1) {
      factChips.push(`ลง ${Math.abs(facts.drop_from_high_7d_pct)}% จากจุดสูง 7 วัน`);
    } else if (facts.gain_from_low_7d_pct != null && facts.gain_from_low_7d_pct >= 1) {
      factChips.push(`ขึ้น ${facts.gain_from_low_7d_pct}% จากจุดต่ำ 7 วัน`);
    }
    if (facts.news_bullish || facts.news_bearish) {
      factChips.push(`ข่าวบวก ${facts.news_bullish} · ลบ ${facts.news_bearish} วันนี้`);
    }
  }

  const value = amount != null ? amount * coin.price : null;

  return (
    <div
      className={`glow-card bg-panel/50 border rounded-2xl p-4 flex flex-col gap-3 cursor-pointer ${
        selected ? "border-mint ring-1 ring-mint/30" : "border-line hover:border-mint/30"
      }`}
      onClick={() => onSelect(coin)}
    >
      {/* Header: identity + price */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <CoinIcon asset={coin.symbol} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-bold text-ink">{coin.symbol}</span>
              {weightPct != null && (
                <span className="text-[10px] font-semibold text-mint bg-mint/10 border border-mint/20 rounded px-1.5 py-0.5">
                  {weightPct}% พอร์ต
                </span>
              )}
            </div>
            <span className="text-sm font-semibold text-ink font-mono tabular-nums">
              ${formatPrice(coin.price)}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span
            className={`text-sm font-semibold font-mono tabular-nums ${
              positive ? "text-mint" : "text-coral"
            }`}
          >
            {positive ? "+" : ""}
            {coin.change_24h_pct.toFixed(2)}%
          </span>
          <div className="mt-0.5 flex justify-end">
            <Sparkline data={coin.sparkline} positive={positive} width={72} height={22} />
          </div>
        </div>
      </div>

      {/* Holding value (only when held) */}
      {value != null && (
        <div className="flex items-center justify-between text-xs bg-base/40 border border-line rounded-lg px-2.5 py-1.5">
          <span className="text-muted">คุณถือ</span>
          <span className="text-ink font-medium tabular-nums">
            {amount} {coin.symbol} · ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* HERO signal — "ปกติ/ผิดปกติ เทียบ baseline ตัวเอง" (PLAN รอบ 2: the wedge) */}
      {heat?.deviation ? (
        <DeviationBadge dev={heat.deviation} />
      ) : (
        <div className="h-12 rounded-xl bg-base/40 animate-pulse" />
      )}

      {/* Plain facts — "ทำไม" */}
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

      {/* Heat — demoted to a secondary "how extreme" detail (PLAN รอบ 2) */}
      {heat && (
        <details className="group/heat">
          <summary
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] uppercase tracking-wider text-muted/70 cursor-pointer list-none flex items-center gap-1 hover:text-muted"
          >
            <svg className="w-3 h-3 transition-transform group-open/heat:rotate-90" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            ดูระดับความสุดโต่ง (Heat)
          </summary>
          <div className="mt-2">
            <HeatBar heat={heat} size="sm" />
          </div>
        </details>
      )}

      {/* Act-on-it row */}
      <div className="flex gap-2 mt-auto pt-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAsk(coin);
          }}
          className="flex-1 py-2 rounded-xl text-xs font-medium bg-ink/6 hover:bg-ink/10 text-ink transition-colors"
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
    <div className="bg-panel/40 border border-line rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-line animate-pulse" />
          <div className="flex flex-col gap-1.5">
            <div className="h-4 w-12 bg-line rounded animate-pulse" />
            <div className="h-4 w-20 bg-line rounded animate-pulse" />
          </div>
        </div>
        <div className="h-5 w-16 bg-line rounded animate-pulse" />
      </div>
      <div className="h-9 bg-line rounded animate-pulse" />
      <div className="h-4 w-3/4 bg-line rounded animate-pulse" />
      <div className="flex gap-2">
        <div className="h-9 flex-1 bg-line rounded-xl animate-pulse" />
        <div className="h-9 flex-1 bg-line rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
