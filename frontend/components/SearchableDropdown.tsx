"use client";

import { useState, useRef, useEffect } from "react";
import { Coin } from "@/lib/api";

interface SearchableDropdownProps {
  currentSymbol: string;
  allCoins: Coin[];
  onSelectCoin: (coin: Coin) => void;
  className?: string;
  align?: "left" | "right";
}

export default function SearchableDropdown({
  currentSymbol,
  allCoins,
  onSelectCoin,
  className = "",
  align = "left",
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset search query when dropdown state changes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  const filteredCoins = allCoins.filter((c) =>
    c.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-100 font-bold text-xs px-3.5 py-2 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors focus:outline-none cursor-pointer min-w-[125px]"
      >
        <span>{currentSymbol} / USDT</span>
        <svg
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Popover Panel */}
      {isOpen && (
        <div
          className={`absolute mt-2 w-56 rounded-xl bg-zinc-950/95 backdrop-blur-md border border-zinc-800 shadow-2xl z-50 p-2 animate-fade-in-down ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Search Input */}
          <div className="relative flex items-center mb-1.5">
            <svg
              className="absolute left-2.5 w-3.5 h-3.5 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              autoFocus
              placeholder="ค้นหาเหรียญ... (e.g. BTC)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-xs pl-8 pr-3 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
            />
          </div>

          {/* List items */}
          <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar">
            {filteredCoins.length > 0 ? (
              filteredCoins.map((c) => (
                <button
                  type="button"
                  key={c.symbol}
                  onClick={() => {
                    onSelectCoin(c);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg text-left transition-colors ${
                    c.symbol === currentSymbol
                      ? "bg-violet-600 text-white"
                      : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                  }`}
                >
                  <span>{c.symbol} / USDT</span>
                  {c.symbol === currentSymbol && (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))
            ) : (
              <div className="text-[11px] text-zinc-600 text-center py-4 italic">ไม่พบเหรียญที่ค้นหา</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
