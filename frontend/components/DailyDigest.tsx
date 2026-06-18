"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CoinHeat,
  DeviationStatus,
  DigestResponse,
  MarketDirection,
  VerdictLevel,
  deviationLabel,
  fetchDigest,
  inferVerdictFromCoins,
} from "@/lib/api";
import CoinIcon from "./CoinIcon";
import TradeOnBinanceButton from "./TradeOnBinanceButton";

interface Props {
  refreshKey: string;
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

function devChipClass(status: DeviationStatus): string {
  if (status === "abnormal") return "text-coral border-coral/40 bg-coral/10";
  if (status === "mild") return "text-warn border-warn/40 bg-warn/10";
  return "text-muted border-line bg-panel2/80";
}

function verdictClass(level: VerdictLevel, direction: MarketDirection): string {
  if (level === "abnormal") return "text-coral";
  if (level === "mild") return "text-warn";
  if (direction === "down") return "text-coral/90";
  if (direction === "up") return "text-mint";
  return "text-ink";
}

function VerdictIcon({ level, direction }: { level: VerdictLevel; direction: MarketDirection }) {
  if (level === "abnormal" || level === "mild") {
    return (
      <svg
        className={`w-6 h-6 shrink-0 ${level === "abnormal" ? "text-coral" : "text-warn"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>
    );
  }
  if (direction === "down") {
    return (
      <svg className="w-6 h-6 shrink-0 text-coral/90" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    );
  }
  if (direction === "up") {
    return (
      <svg className="w-6 h-6 shrink-0 text-mint" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    );
  }
  return (
    <svg className="w-6 h-6 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function DailyDigest({ refreshKey, heat }: Props) {
  const [data, setData] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchDigest(force));
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดสรุปไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    const tick = () => load();
    const msToNextHour =
      (60 - new Date().getUTCMinutes()) * 60_000 -
      new Date().getUTCSeconds() * 1_000 -
      new Date().getUTCMilliseconds();
    const first = window.setTimeout(tick, Math.max(msToNextHour, 60_000));
    const hourly = window.setInterval(tick, 60 * 60 * 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(hourly);
    };
  }, [load, refreshKey]);

  const digest = data?.digest;
  const coinMeta = new Map((data?.coins ?? []).map((c) => [c.symbol, c]));

  const fallback = data?.coins?.length
    ? inferVerdictFromCoins(data.coins, data.weighted)
    : null;

  const direction: MarketDirection =
    digest?.market_direction || fallback?.direction || "flat";
  const verdictLevel: VerdictLevel =
    digest?.verdict_level || fallback?.level || "normal";

  let verdict = digest?.verdict || fallback?.verdict || "";
  if (
    verdictLevel === "normal" &&
    direction === "down" &&
    verdict.includes("ปกติ") &&
    !verdict.includes("ลง") &&
    fallback?.verdict
  ) {
    verdict = fallback.verdict;
  }

  let narrative =
    digest?.narrative || (!digest?.verdict ? digest?.overview : "") || "";
  if (
    verdictLevel === "normal" &&
    direction === "down" &&
    fallback?.narrative &&
    !narrative.includes("24h")
  ) {
    narrative = fallback.narrative;
  }

  const mood = digest?.mood;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-panel/80 px-5 py-5 sm:px-6 sm:py-6">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-linear-to-b from-mint/80 via-mint/30 to-transparent"
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-mint/10 border border-mint/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-mint" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l-.813-5.096L3 15l5.096-.813L9 9l.813 5.096L15 15l-5.187.904zM18 5.25L17.25 7.5L15 8.25l2.25.75L18 11.25l.75-2.25L21 8.25l-2.25-.75L18 5.25z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink tracking-tight">วันนี้ต้องสนใจอะไรไหม</h2>
            <p className="text-[13px] text-muted mt-0.5">
              {data?.weighted
                ? "สรุปถ่วงน้ำหนักตามพอร์ตของคุณ"
                : "สรุปจากเหรียญยอดนิยม · เพิ่มพอร์ตเพื่อให้ตรงกับคุณ"}
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
            onClick={() => load(true)}
            disabled={loading || data?.force_remaining === 0}
            title={
              data?.force_remaining === 0
                ? "ใช้โควต้ารีเฟรชบังคับครบแล้วสำหรับชั่วโมงนี้"
                : "สร้างสรุปใหม่ทันที"
            }
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
        <div className="space-y-3">
          <div className="h-8 bg-line rounded animate-pulse w-4/5" />
          <div className="h-4 bg-line rounded animate-pulse w-3/5" />
          <div className="h-4 bg-line rounded animate-pulse w-2/5" />
        </div>
      )}

      {error && !data && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-coral">{error}</span>
          <button onClick={() => load(true)} className="text-xs border border-line px-3 py-1 rounded-lg hover:border-mint/40 text-muted">
            ลองใหม่
          </button>
        </div>
      )}

      {digest && verdict && (
        <div className={`relative ${loading ? "opacity-60" : ""}`}>
          <div className="flex items-start gap-3 mb-3">
            <VerdictIcon level={verdictLevel} direction={direction} />
            <p className={`text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight ${verdictClass(verdictLevel, direction)}`}>
              {verdict}
            </p>
          </div>

          {narrative && narrative !== verdict && (
            <p className="text-[15px] sm:text-[16px] text-muted leading-relaxed mb-3 pl-9 max-w-[65ch]">
              {narrative}
            </p>
          )}

          {mood && (
            <p className="text-[13px] text-muted mb-5 pl-9 flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan/80 shrink-0" aria-hidden />
              ตลาดโดยรวม: {mood}
            </p>
          )}

          {!mood && <div className="mb-4" />}

          <ul className="flex flex-col divide-y divide-line border-t border-line">
            {Object.entries(digest.per_coin).map(([symbol, text]) => {
              const meta = coinMeta.get(symbol);
              const change = meta?.change_24h_pct;
              const weight = meta?.weight_pct;
              const dev = meta?.deviation ?? heat?.[symbol]?.deviation;
              return (
                <li key={symbol} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5">
                        <CoinIcon asset={symbol} size="sm" />
                        <span className="text-xs font-bold text-ink">{symbol}</span>
                      </span>
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
                    </div>
                    <p className="text-[13px] text-muted leading-relaxed mt-1 pl-7">{text}</p>
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
