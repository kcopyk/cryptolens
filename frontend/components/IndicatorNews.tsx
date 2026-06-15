"use client";

import { Candle, NewsItem, formatNewsDateTime, formatNumber, formatPrice, formatSignedNumber } from "@/lib/api";
import { snapshotFromCandles } from "@/lib/indicators";

interface IndicatorProps {
  candles: Candle[];
}

const signalStyle: Record<string, string> = {
  bullish: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  bearish: "text-red-400 bg-red-400/10 border-red-400/20",
  neutral: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
};

function rsiSignal(rsi: number): { tag: string; tone: keyof typeof signalStyle; hint: string } {
  if (rsi >= 70) return { tag: "HOT", tone: "bearish", hint: "Overbought · RSI ≥ 70" };
  if (rsi <= 30) return { tag: "COLD", tone: "bullish", hint: "Oversold · RSI ≤ 30" };
  if (rsi >= 55) return { tag: "UP", tone: "bullish", hint: "Bullish momentum" };
  if (rsi <= 45) return { tag: "DOWN", tone: "bearish", hint: "Bearish momentum" };
  return { tag: "MID", tone: "neutral", hint: "Neutral zone" };
}

function emaSignal(ema9: number, ema21: number): { tag: string; tone: keyof typeof signalStyle; hint: string } {
  if (ema9 > ema21) return { tag: "UP", tone: "bullish", hint: "EMA9 > EMA21 · short-term bullish" };
  if (ema9 < ema21) return { tag: "DOWN", tone: "bearish", hint: "EMA9 < EMA21 · short-term bearish" };
  return { tag: "FLAT", tone: "neutral", hint: "EMA9 ≈ EMA21" };
}

function macdLineSignal(macd: number, signal: number): { tag: string; tone: keyof typeof signalStyle; hint: string } {
  if (macd > signal) return { tag: "UP", tone: "bullish", hint: "MACD > Signal" };
  if (macd < signal) return { tag: "DOWN", tone: "bearish", hint: "MACD < Signal" };
  return { tag: "MID", tone: "neutral", hint: "MACD ≈ Signal" };
}

function histSignal(hist: number): { tag: string; tone: keyof typeof signalStyle; hint: string } {
  if (hist > 0) return { tag: "UP", tone: "bullish", hint: "Histogram positive · momentum up" };
  if (hist < 0) return { tag: "DOWN", tone: "bearish", hint: "Histogram negative · momentum down" };
  return { tag: "MID", tone: "neutral", hint: "Histogram at zero" };
}

function IndicatorRow({
  tag,
  tone,
  title,
  value,
  hint,
}: {
  tag: string;
  tone: keyof typeof signalStyle;
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <li className="flex gap-3 items-start rounded-lg p-2 -mx-2 hover:bg-zinc-800/40 transition-colors">
      <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded border shrink-0 mt-0.5 font-medium ${signalStyle[tone]}`}>
        {tag}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-200 leading-snug">
          <span className="text-zinc-500">{title}</span>
          {" · "}
          <span className="font-semibold tabular-nums">{value}</span>
        </p>
        <p className="text-[10px] text-zinc-500 mt-1">{hint}</p>
      </div>
    </li>
  );
}

export function IndicatorBar({ candles }: IndicatorProps) {
  const snap = snapshotFromCandles(candles);
  if (!snap) return null;

  const ema = emaSignal(snap.ema_9, snap.ema_21);
  const macdLine = macdLineSignal(snap.macd, snap.macd_signal);
  const macdHist = histSignal(snap.macd_histogram);
  const rsi = rsiSignal(snap.rsi);

  return (
    <ul className="flex flex-col gap-1">
      <IndicatorRow
        tag={ema.tag}
        tone={ema.tone}
        title="EMA 9 / 21"
        value={`$${formatPrice(snap.ema_9)} / $${formatPrice(snap.ema_21)}`}
        hint={ema.hint}
      />
      <IndicatorRow
        tag={macdLine.tag}
        tone={macdLine.tone}
        title="MACD / Signal"
        value={`${formatNumber(snap.macd, 4)} / ${formatNumber(snap.macd_signal, 4)}`}
        hint={macdLine.hint}
      />
      <IndicatorRow
        tag={macdHist.tag}
        tone={macdHist.tone}
        title="MACD Histogram"
        value={formatSignedNumber(snap.macd_histogram, 4)}
        hint={macdHist.hint}
      />
      <IndicatorRow
        tag={rsi.tag}
        tone={rsi.tone}
        title="RSI (14)"
        value={formatNumber(snap.rsi, 1)}
        hint={rsi.hint}
      />
    </ul>
  );
}

interface NewsProps {
  news: NewsItem[];
  compact?: boolean;
}

const sentimentStyle: Record<string, string> = {
  bullish: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  bearish: "text-red-400 bg-red-400/10 border-red-400/20",
  neutral: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
};

export function NewsList({ news, compact = false }: NewsProps) {
  if (news.length === 0) {
    return (
      <div className="text-sm text-zinc-500 italic py-4 text-center">
        ไม่มีข่าวในขณะนี้ — ลองรีเฟรชอีกครั้ง
      </div>
    );
  }

  return (
    <ul className={`flex flex-col ${compact ? "gap-2" : "gap-1"}`}>
      {news.map((item, i) => (
        <li key={i} className="group">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 items-start hover:bg-zinc-800/50 rounded-lg p-2 -mx-2 transition-colors"
          >
            <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${sentimentStyle[item.sentiment] ?? sentimentStyle.neutral}`}>
              {item.sentiment}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-zinc-200 group-hover:text-white leading-snug font-sans">
                {item.title}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1">
                {item.source}
                {item.published_at && ` · ${formatNewsDateTime(item.published_at)}`}
              </p>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
