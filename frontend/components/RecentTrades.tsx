"use client";

import { useRecentTrades } from "@/hooks/useOrderBook";

function priceDecimals(price: number): number {
  if (price >= 1000) return 2;
  if (price >= 1) return 2;
  return 4;
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

interface Props {
  symbol: string;
  onSelectPrice?: (price: number) => void;
}

export default function RecentTrades({ symbol, onSelectPrice }: Props) {
  const { trades, ready } = useRecentTrades(symbol);
  const dec = priceDecimals(trades[0]?.price ?? 1);

  return (
    <div className="flex flex-col h-full text-xs select-none">
      <div className="px-3 pt-3 pb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
          รายการซื้อขายล่าสุด
        </span>
      </div>

      <div className="grid grid-cols-3 px-3 pb-1 text-right text-[10px] uppercase tracking-wide text-zinc-600">
        <span className="text-left">ราคา (USDT)</span>
        <span>จำนวน</span>
        <span>เวลา</span>
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll min-h-0">
        {!ready ? (
          <div className="flex items-center justify-center py-10 text-[11px] text-zinc-600 animate-pulse">
            กำลังเชื่อมต่อ stream…
          </div>
        ) : trades.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-[11px] text-zinc-600">
            ยังไม่มีรายการ
          </div>
        ) : (
          trades.map((t) => {
            const isBuy = !t.isBuyerMaker;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectPrice?.(t.price)}
                className="grid grid-cols-3 w-full px-3 py-[3px] text-right font-mono text-[11px] leading-tight hover:bg-zinc-800/40 transition-colors"
              >
                <span className={`text-left ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
                  {t.price.toLocaleString("en-US", {
                    minimumFractionDigits: dec,
                    maximumFractionDigits: dec,
                  })}
                </span>
                <span className="text-zinc-300">{t.qty.toFixed(t.qty >= 1000 ? 1 : 4)}</span>
                <span className="text-zinc-500">{fmtTime(t.time)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
