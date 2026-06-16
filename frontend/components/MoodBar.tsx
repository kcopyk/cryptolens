"use client";

import { MoodResponse } from "@/lib/api";

interface Props {
  mood: MoodResponse | null;
  loading: boolean;
}

export default function MoodBar({ mood, loading }: Props) {
  if (loading) {
    return (
      <div className="w-full px-6 py-4 bg-panel border-b border-line">
        <div className="h-5 bg-line rounded animate-pulse w-2/3" />
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-4 bg-panel border-b border-line flex items-center gap-3">
      <span className="flex items-center gap-2 shrink-0">
        <span className="live-dot" aria-hidden />
        <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-muted">
          Market Mood
        </span>
      </span>
      <span className="text-sm text-ink font-medium leading-snug">
        {mood?.mood ?? "—"}
      </span>
      {mood?.stale && (
        <span className="ml-auto text-xs text-muted border border-line px-2 py-0.5 rounded">
          stale
        </span>
      )}
    </div>
  );
}
