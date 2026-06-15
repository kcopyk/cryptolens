"use client";

import type { PortfolioRow } from "@/lib/portfolio";

interface Props {
  rows: PortfolioRow[];
  size?: number;
}

export default function AllocationChart({ rows, size = 140 }: Props) {
  const active = rows.filter((r) => r.usdValue > 0);
  if (active.length === 0) {
    return (
      <div
        className="rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center text-xs text-zinc-600"
        style={{ width: size, height: size }}
      >
        —
      </div>
    );
  }

  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#27272a" strokeWidth={14} />
      {active.map((row) => {
        const dash = (row.allocationPct / 100) * circumference;
        const el = (
          <circle
            key={row.asset}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={row.color}
            strokeWidth={14}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}
