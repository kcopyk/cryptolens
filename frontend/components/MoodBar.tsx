"use client";

import { MoodResponse } from "@/lib/api";

interface Props {
  mood: MoodResponse | null;
  loading: boolean;
}

export default function MoodBar({ mood, loading }: Props) {
  if (loading) {
    return (
      <div className="w-full px-6 py-4 bg-zinc-900 border-b border-zinc-800">
        <div className="h-5 bg-zinc-700 rounded animate-pulse w-2/3" />
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Market</span>
      <span className="text-sm text-zinc-100 font-medium leading-snug">
        {mood?.mood ?? "—"}
      </span>
      {mood?.stale && (
        <span className="ml-auto text-xs text-amber-400 border border-amber-400/30 px-2 py-0.5 rounded">
          stale
        </span>
      )}
    </div>
  );
}
