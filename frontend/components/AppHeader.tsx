"use client";

import Link from "next/link";

export function NetworkEnvBadge({ isMainnet }: { isMainnet: boolean }) {
  const label = isMainnet ? "Mainnet" : "Testnet";
  const dotColor = isMainnet ? "bg-red-400" : "bg-amber-400";
  const textColor = isMainnet ? "text-red-400" : "text-amber-400";

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-md border ${textColor} ${
        isMainnet ? "bg-red-950/50 border-red-900/40" : "bg-amber-950/50 border-amber-900/40"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      {label}
    </span>
  );
}

interface AppHeaderProps {
  activeNav?: "trading" | "orders" | "portfolio";
  marketReady?: boolean;
  lastTick?: number | null;
  showNetworkBadge?: boolean;
  isMainnet?: boolean;
  openOrdersCount?: number;
  onSettingsClick?: () => void;
  onRefresh?: () => void;
}

export default function AppHeader({
  activeNav = "trading",
  marketReady,
  lastTick,
  showNetworkBadge,
  isMainnet,
  openOrdersCount = 0,
  onSettingsClick,
  onRefresh,
}: AppHeaderProps) {
  const isTrading = activeNav === "trading";
  const isOrders = activeNav === "orders";
  const isPortfolio = activeNav === "portfolio";

  const navLinkClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
      active ? "bg-zinc-800 text-zinc-100 shadow" : "text-zinc-400 hover:text-zinc-200"
    }`;

  return (
    <header className="sticky top-0 z-50 px-6 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Link href="/" className="text-base font-bold tracking-tight text-zinc-100 hover:text-white transition-colors">
          CryptoLens
        </Link>
        {marketReady && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        )}
        {showNetworkBadge && (
          <span className="ml-1">
            <NetworkEnvBadge isMainnet={!!isMainnet} />
          </span>
        )}
      </div>

      <nav className="flex gap-1 bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
        <Link href="/" className={navLinkClass(isTrading)}>
          หน้าเทรด (Trading)
        </Link>
        <Link href="/?tab=orders" className={`${navLinkClass(isOrders)} relative flex items-center gap-1.5`}>
          <span>ประวัติออเดอร์</span>
          {openOrdersCount > 0 && (
            <span className="bg-amber-600 text-white text-[9px] font-bold h-4 min-w-4 px-1.5 flex items-center justify-center rounded-full animate-pulse">
              {openOrdersCount}
            </span>
          )}
        </Link>
        <Link href="/portfolio" className={navLinkClass(isPortfolio)}>
          Portfolio
        </Link>
      </nav>

      <div className="flex items-center gap-3">
        {lastTick && (
          <span className="text-xs text-zinc-600 tabular-nums hidden sm:inline">
            {new Date(lastTick).toLocaleTimeString()}
          </span>
        )}
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="text-xs text-zinc-300 hover:text-zinc-100 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/30 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden sm:inline">ตั้งค่า API / Login</span>
          </button>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            รีเฟรช
          </button>
        )}
      </div>
    </header>
  );
}
