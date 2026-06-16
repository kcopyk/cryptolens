"use client";

import { Coin, formatPrice, formatNumber } from "@/lib/api";
import SearchableDropdown from "./SearchableDropdown";
import CoinIcon from "./CoinIcon";

interface Props {
  coin: Coin;
  allCoins: Coin[];
  onSelectCoin: (coin: Coin) => void;
}

function Stat({ label, value, valueClass = "text-ink" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
      <span className={`text-xs font-medium font-mono tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

export default function MarketTicker({ coin, allCoins, onSelectCoin }: Props) {
  const positive = coin.change_24h_pct >= 0;
  const high = coin.high_24h;
  const low = coin.low_24h;

  return (
    <div className="rounded-2xl border border-line bg-panel/50 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
      {/* Pair selector + live last price */}
      <div className="flex items-center gap-3 pr-5 border-r border-line">
        <CoinIcon asset={coin.symbol} />
        <div>
          <SearchableDropdown
            currentSymbol={coin.symbol}
            allCoins={allCoins}
            onSelectCoin={onSelectCoin}
            align="left"
          />
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className={`text-xl font-bold font-mono tabular-nums leading-none ${positive ? "text-mint" : "text-coral"}`}>
          ${formatPrice(coin.price)}
        </span>
        <span className="text-[10px] text-muted">ราคาล่าสุด</span>
      </div>

      <Stat
        label="เปลี่ยนแปลง 24h"
        value={`${positive ? "+" : ""}${coin.change_24h_pct.toFixed(2)}%`}
        valueClass={positive ? "text-mint" : "text-coral"}
      />
      <Stat label="สูงสุด 24h" value={high ? `$${formatPrice(high)}` : "—"} />
      <Stat label="ต่ำสุด 24h" value={low ? `$${formatPrice(low)}` : "—"} />
      <Stat label="วอลุ่ม 24h (USDT)" value={`$${formatNumber(coin.volume_24h, 0)}`} />
    </div>
  );
}
