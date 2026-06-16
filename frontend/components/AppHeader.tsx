"use client";

import Link from "next/link";
import Logo from "./Logo";

interface AppHeaderProps {
  marketReady?: boolean;
  lastTick?: number | null;
  googleUser?: { name: string; email: string; avatar: string } | null;
  onSettingsClick?: () => void;
  onRefresh?: () => void;
}

export default function AppHeader({
  marketReady,
  lastTick,
  googleUser,
  onSettingsClick,
  onRefresh,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 px-6 py-3 border-b border-line flex items-center justify-between bg-base/80 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-ink hover:text-mint transition-colors">
          <Logo className="w-6 h-6" />
          <span className="text-base">CryptoLens</span>
        </Link>
        {marketReady && (
          <span className="flex items-center gap-1.5 text-[10px] text-mint ml-1">
            <span className="live-dot w-1.5! h-1.5!" aria-hidden />
            Live
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {lastTick && (
          <span className="text-xs text-muted font-mono tabular-nums hidden sm:inline">
            {new Date(lastTick).toLocaleTimeString()}
          </span>
        )}
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="text-xs text-muted hover:text-ink border border-line hover:border-mint/30 bg-panel/30 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-2"
          >
            {googleUser ? (
              <span className="w-5 h-5 rounded-full bg-mint flex items-center justify-center text-[10px] font-bold text-base">
                {googleUser.avatar}
              </span>
            ) : (
              <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            )}
            <span className="hidden sm:inline">{googleUser ? googleUser.name : "เข้าสู่ระบบ"}</span>
          </button>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-xs text-muted hover:text-ink border border-line hover:border-mint/30 bg-panel/40 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            รีเฟรช
          </button>
        )}
      </div>
    </header>
  );
}
