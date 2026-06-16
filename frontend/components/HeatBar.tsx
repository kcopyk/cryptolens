"use client";

import { useState } from "react";
import { CoinHeat, HeatZone, heatZoneLabel } from "@/lib/api";

interface Props {
  heat: CoinHeat;
  /** "sm" inline (digest/list), "md" full card. */
  size?: "sm" | "md";
}

function zoneColor(zone: HeatZone): string {
  if (zone === "hot") return "var(--color-heat-hot)";
  if (zone === "mid") return "var(--color-heat-mid)";
  return "var(--color-heat-cold)";
}

function zoneTextClass(zone: HeatZone): string {
  if (zone === "hot") return "text-heat-hot";
  if (zone === "mid") return "text-heat-mid";
  return "text-heat-cold";
}

/**
 * Deterministic Heat bar (0-100). Measures how *extreme/hot* a coin is, in
 * either direction — NOT how good it is to buy (PLAN iron rules §2/§3). Click to
 * reveal exactly how the score was built (transparency = the shield).
 */
export default function HeatBar({ heat, size = "md" }: Props) {
  const [open, setOpen] = useState(false);
  const { score, zone, components } = heat;
  const color = zoneColor(zone);
  const c = components;

  const rows = [
    {
      label: "RSI",
      detail: `${c.rsi.value} (ระยะห่างจากกลาง 50)`,
      heat: c.rsi.heat,
      weight: c.rsi.weight,
    },
    {
      label: "ความผันผวน",
      detail: `เปอร์เซ็นไทล์ ${c.volatility.percentile} · วันนี้แกว่ง ${c.volatility.today_range_pct}%`,
      heat: c.volatility.heat,
      weight: c.volatility.weight,
    },
    {
      label: "ข่าว",
      detail: `บวก ${c.news.bullish} · ลบ ${c.news.bearish}`,
      heat: c.news.heat,
      weight: c.news.weight,
    },
  ];

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="w-full text-left group cursor-pointer"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted flex items-center gap-1">
            Heat
            <span className="text-muted/60 group-hover:text-muted transition-colors">
              · ทำไม?
            </span>
          </span>
          <span className={`text-xs font-bold tabular-nums ${zoneTextClass(zone)}`}>
            {score}
            <span className="text-muted font-normal"> / 100 · {heatZoneLabel(zone)}</span>
          </span>
        </div>

        {/* Track: cold→mid→hot gradient with a marker at the score. */}
        <div className="relative h-2 rounded-full overflow-visible">
          <div
            className="absolute inset-0 rounded-full opacity-30"
            style={{
              background:
                "linear-gradient(90deg, var(--color-heat-cold), var(--color-heat-mid), var(--color-heat-hot))",
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-base shadow"
            style={{ left: `${score}%`, backgroundColor: color }}
          />
        </div>
      </button>

      {open && (
        <div className="mt-2.5 space-y-2 rounded-lg bg-base/40 border border-line p-2.5 animate-fade-in-down">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ink font-medium">
                  {r.label}
                  <span className="text-muted font-normal"> · น้ำหนัก {Math.round(r.weight * 100)}%</span>
                </span>
                <span className="text-muted tabular-nums">{r.heat}/100</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-line overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${r.heat}%`, backgroundColor: color }}
                />
              </div>
              <p className="text-[10px] text-muted mt-1">{r.detail}</p>
            </div>
          ))}
          <p className="text-[10px] text-muted/80 border-t border-line pt-2 leading-relaxed">
            Heat วัด &quot;ความสุดโต่ง&quot; ของราคา/ข่าว ไม่ใช่ว่าน่าซื้อหรือน่าขาย
          </p>
        </div>
      )}
    </div>
  );
}
