"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CoinHeat,
  DeviationStatus,
  DigestResponse,
  HeatZone,
  deviationLabel,
  fetchDigest,
} from "@/lib/api";
import TradeOnBinanceButton from "./TradeOnBinanceButton";

interface Props {
  /** Changes when the focused symbols change — refetches the digest. */
  refreshKey: string;
  /** Optional live Heat map (fallback if the cached digest lacks heat). */
  heat?: Record<string, CoinHeat>;
}

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Deviation = the hero chip: "ปกติ/ผิดปกติ vs own baseline" (PLAN รอบ 2). */
function devChipClass(status: DeviationStatus): string {
  if (status === "abnormal") return "text-heat-hot border-heat-hot/40 bg-heat-hot/15";
  if (status === "mild") return "text-heat-mid border-heat-mid/40 bg-heat-mid/15";
  return "text-heat-cold border-heat-cold/30 bg-heat-cold/10";
}

export default function DailyDigest({ refreshKey, heat }: Props) {
  const [data, setData] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchDigest());
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดสรุปไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const digest = data?.digest;
  const coinMeta = new Map((data?.coins ?? []).map((c) => [c.symbol, c]));

  return (
    <section className="bg-linear-to-br from-mint/12 via-panel/60 to-panel/40 border border-mint/20 rounded-2xl px-5 py-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-mint/15 border border-mint/25 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-mint" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.096L15 15l-5.187.904zM18 5.25L17.25 7.5L15 8.25l2.25.75L18 11.25l.75-2.25L21 8.25l-2.25-.75L18 5.25z" />
            </svg>
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-ink">วันนี้ต้องสนใจอะไรไหม</h2>
            <p className="text-[11px] text-muted mt-0.5">
              {data?.weighted
                ? "สรุปถ่วงน้ำหนักตามพอร์ตของคุณ"
                : "สรุปจากเหรียญยอดนิยม — เพิ่มพอร์ตเพื่อให้ตรงกับคุณ"}
              {data?.cached && " · cached"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {data && (
            <span className="text-[10px] text-muted hidden sm:inline">
              อัปเดต {formatUpdated(data.as_of)}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="text-xs text-muted hover:text-ink transition-colors disabled:opacity-40 flex items-center gap-1"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            รีเฟรช
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="space-y-2">
          <div className="h-4 bg-line rounded animate-pulse w-3/4" />
          <div className="h-4 bg-line rounded animate-pulse w-2/3" />
          <div className="h-4 bg-line rounded animate-pulse w-1/2" />
        </div>
      )}

      {error && !data && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-coral">{error}</span>
          <button onClick={load} className="text-xs border border-line px-3 py-1 rounded-lg hover:border-mint/40 text-muted">
            ลองใหม่
          </button>
        </div>
      )}

      {digest && (
        <div className={loading ? "opacity-60" : ""}>
          {digest.overview && (
            <p className="text-[15px] text-ink leading-relaxed font-medium mb-3">{digest.overview}</p>
          )}

          <ul className="flex flex-col divide-y divide-line">
            {Object.entries(digest.per_coin).map(([symbol, text]) => {
              const meta = coinMeta.get(symbol);
              const change = meta?.change_24h_pct;
              const weight = meta?.weight_pct;
              const zone = (meta?.heat_zone ?? heat?.[symbol]?.zone) as HeatZone | undefined;
              const score = meta?.heat ?? heat?.[symbol]?.score;
              const dev = meta?.deviation ?? heat?.[symbol]?.deviation;
              return (
                <li key={symbol} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-mint">{symbol}</span>
                      {/* HERO chip — ปกติ/ผิดปกติ เทียบ baseline ตัวเอง (the wedge) */}
                      {dev?.enough_data && (
                        <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 border ${devChipClass(dev.status)}`}>
                          {deviationLabel(dev.status)}
                        </span>
                      )}
                      {weight != null && (
                        <span className="text-[10px] font-semibold text-mint/90 bg-mint/10 border border-mint/20 rounded px-1.5 py-0.5">
                          {weight}% พอร์ต
                        </span>
                      )}
                      {change !== undefined && (
                        <span className={`text-[11px] font-semibold font-mono tabular-nums ${change >= 0 ? "text-mint" : "text-coral"}`}>
                          {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                        </span>
                      )}
                      {/* Heat demoted to a muted trailing detail (PLAN รอบ 2) */}
                      {zone && score != null && (
                        <span className={`text-[9px] font-medium rounded px-1.5 py-0.5 border border-line text-muted/70`}>
                          Heat {score}
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-muted leading-relaxed mt-1">{text}</p>
                  </div>
                  <TradeOnBinanceButton symbol={symbol} />
                </li>
              );
            })}
          </ul>

          {digest.disclaimer && (
            <p className="text-[10px] text-muted mt-3 border-t border-line pt-2">⚠ {digest.disclaimer}</p>
          )}
        </div>
      )}
    </section>
  );
}
