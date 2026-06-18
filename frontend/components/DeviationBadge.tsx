"use client";

import { useState } from "react";
import { Deviation, DeviationStatus, deviationLabel } from "@/lib/api";

interface Props {
  dev: Deviation;
}

/** Deviation palette — not heat-* (reserved for HeatBar only). */
function statusColor(status: DeviationStatus): string {
  if (status === "abnormal") return "var(--color-coral)";
  if (status === "mild") return "var(--color-warn)";
  return "var(--color-muted)";
}
function statusTextClass(status: DeviationStatus): string {
  if (status === "abnormal") return "text-coral";
  if (status === "mild") return "text-warn";
  return "text-muted";
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v > 0 ? "+" : ""}${v}%`;
}

/** One human line under the status word — context that calms or rightly alerts. */
function headline(dev: Deviation): string {
  const move = dev.today_return_pct;
  if (move == null) return "ยังไม่มีข้อมูลการเคลื่อนไหววันนี้";
  const moveTxt = `${move > 0 ? "+" : ""}${move}% วันนี้`;
  if (dev.status === "normal") {
    return `${moveTxt} · ยังอยู่ในกรอบแกว่งปกติ ${dev.window_days} วัน`;
  }
  const dir = dev.direction === "down" ? "ลงแรง" : dev.direction === "up" ? "ขึ้นแรง" : "แกว่ง";
  const how = dev.status === "abnormal" ? "ผิดปกติชัด" : "ผิดปกติเล็กน้อย";
  return `${moveTxt} · ${dir}${how}เทียบกรอบ ${dev.window_days} วัน`;
}

/**
 * The WEDGE hero (PLAN.md §"Decisions รอบ 2"): answers "ปกติหรือผิดปกติ" vs the
 * coin's OWN baseline — the panic-killer. Context, never a verdict: "abnormal
 * down" means "today's drop is big *for this coin*", not "sell". Click to see
 * exactly how it was judged (transparency = the shield).
 */
export default function DeviationBadge({ dev }: Props) {
  const [open, setOpen] = useState(false);

  if (!dev.enough_data) {
    return (
      <div className="rounded-xl bg-base/40 border border-line px-3 py-2.5">
        <span className="text-[11px] text-muted">ข้อมูลยังไม่พอประเมินว่าปกติหรือผิดปกติ</span>
      </div>
    );
  }

  const color = statusColor(dev.status);

  return (
    <div
      className="rounded-xl border px-3 py-2.5"
      style={{ borderColor: `${color}40`, backgroundColor: `${color}10` }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="w-full text-left group cursor-pointer"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className={`text-sm font-bold ${statusTextClass(dev.status)}`}>
              {deviationLabel(dev.status)}
            </span>
          </span>
          <span className="text-[10px] text-muted group-hover:text-ink transition-colors shrink-0">
            ทำไม?
          </span>
        </div>
        <p className="text-[11px] text-muted mt-1 leading-snug">{headline(dev)}</p>
      </button>

      {open && (
        <div className="mt-2.5 space-y-1.5 rounded-lg bg-base/50 border border-line p-2.5 animate-fade-in-down">
          <Row label="วันนี้เคลื่อนไหว" value={fmtPct(dev.today_return_pct)} strong />
          <Row
            label={`กรอบปกติ (${dev.window_days} วัน)`}
            value={`${fmtPct(dev.normal_low_pct)} ถึง ${fmtPct(dev.normal_high_pct)}/วัน`}
          />
          <Row label="ค่าเฉลี่ย/วัน" value={fmtPct(dev.baseline_mean_pct)} />
          <Row label="ห่างจากปกติ" value={dev.z != null ? `${Math.abs(dev.z)} SD` : "—"} />
          <p className="text-[10px] text-muted/80 border-t border-line pt-2 leading-relaxed">
            บอกว่าวันนี้แกว่ง &quot;ผิดจากตัวมันเอง&quot; แค่ไหน — ไม่ใช่ว่าน่าซื้อหรือน่าขาย
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted">{label}</span>
      <span className={`tabular-nums ${strong ? "text-ink font-semibold" : "text-ink/80"}`}>
        {value}
      </span>
    </div>
  );
}
