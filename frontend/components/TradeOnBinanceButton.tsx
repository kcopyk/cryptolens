"use client";

import { binanceTradeUrl } from "@/lib/api";

interface Props {
  symbol: string;
  /** "sm" for inline use inside cards/digest, "md" for standalone CTA. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Deep-links to the Binance spot page for {symbol}/USDT in a new tab.
 * CryptoLens places no orders itself (spec §3.3) — this is the "act fast on
 * insight" exit, with the trust/liability staying on Binance.
 */
export default function TradeOnBinanceButton({ symbol, size = "sm", className = "" }: Props) {
  const pad = size === "md" ? "px-4 py-2 text-sm" : "px-2.5 py-1.5 text-xs";
  return (
    <a
      href={binanceTradeUrl(symbol)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg bg-[#F0B90B] hover:bg-[#f8d12f] text-zinc-950 transition-colors ${pad} ${className}`}
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 3.5l3.1 3.1-3.1 3.1-3.1-3.1L12 3.5zM6.6 8.9L9.7 12l-3.1 3.1L3.5 12l3.1-3.1zm10.8 0L20.5 12l-3.1 3.1L14.3 12l3.1-3.1zM12 14.3l3.1 3.1-3.1 3.1-3.1-3.1 3.1-3.1z" />
      </svg>
      เทรดบน Binance
    </a>
  );
}
