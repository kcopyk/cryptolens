"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { Candle, ChartInterval, formatNumber, formatPrice, formatSignedNumber } from "@/lib/api";
import { emaSeries, macdSeries, rsiSeries } from "@/lib/indicators";

const priceChartOptions = {
  localization: { priceFormatter: (p: number) => formatPrice(p) },
};

const macdChartOptions = {
  localization: { priceFormatter: (p: number) => formatNumber(p, 4) },
};

function isShortInterval(interval: ChartInterval): boolean {
  return interval === "1m" || interval === "5m" || interval === "15m" || interval === "30m";
}

interface Props {
  candles: Candle[];
  interval: ChartInterval;
  height?: number;
}

type LineSeriesRef = ISeriesApi<"Line"> | null;

function pushLineData(
  series: LineSeriesRef,
  candles: Candle[],
  values: number[],
  full: boolean
) {
  if (!series || !candles.length) return;
  if (full) {
    series.setData(candles.map((c, i) => ({ time: c.time as UTCTimestamp, value: values[i] })));
    return;
  }
  const last = candles[candles.length - 1];
  series.update({ time: last.time as UTCTimestamp, value: values[values.length - 1] });
}

export default function CandlestickChart({ candles, interval, height = 420 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ema9Ref = useRef<LineSeriesRef>(null);
  const ema21Ref = useRef<LineSeriesRef>(null);
  const seededRef = useRef(false);
  const barCountRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    seededRef.current = false;
    barCountRef.current = 0;

    const chart = createChart(containerRef.current, {
      ...priceChartOptions,
      layout: {
        background: { type: ColorType.Solid, color: "#18181b" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "#27272a" },
        horzLines: { color: "#27272a" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#3f3f46" },
      timeScale: {
        borderColor: "#3f3f46",
        timeVisible: true,
        secondsVisible: isShortInterval(interval),
      },
      width: containerRef.current.clientWidth,
      height,
    });

    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    ema9Ref.current = chart.addSeries(LineSeries, { color: "#38bdf8", lineWidth: 2, title: "EMA9" });
    ema21Ref.current = chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 2, title: "EMA21" });

    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      ema9Ref.current = null;
      ema21Ref.current = null;
    };
  }, [height, interval]);

  useEffect(() => {
    if (!candles.length || !candleRef.current) return;

    const closes = candles.map((c) => c.close);
    const ema9 = emaSeries(closes, 9);
    const ema21 = emaSeries(closes, 21);
    const full = !seededRef.current || candles.length !== barCountRef.current;

    const toCandle = (c: Candle) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    });

    if (full) {
      candleRef.current.setData(candles.map(toCandle));
      chartRef.current?.timeScale().fitContent();
      seededRef.current = true;
      barCountRef.current = candles.length;
    } else {
      candleRef.current.update(toCandle(candles[candles.length - 1]));
    }

    pushLineData(ema9Ref.current, candles, ema9, full);
    pushLineData(ema21Ref.current, candles, ema21, full);
  }, [candles]);

  return <div ref={containerRef} className="w-full rounded-xl overflow-hidden" />;
}

export function MacdMiniChart({ candles, interval, height = 100 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const histRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const macdRef = useRef<LineSeriesRef>(null);
  const signalRef = useRef<LineSeriesRef>(null);
  const seededRef = useRef(false);
  const barCountRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;
    seededRef.current = false;
    barCountRef.current = 0;

    const chart = createChart(containerRef.current, {
      ...macdChartOptions,
      layout: {
        background: { type: ColorType.Solid, color: "#18181b" },
        textColor: "#71717a",
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "#27272a" } },
      rightPriceScale: { borderColor: "#3f3f46", scaleMargins: { top: 0.15, bottom: 0.15 } },
      timeScale: { visible: false, borderColor: "#3f3f46" },
      width: containerRef.current.clientWidth,
      height,
    });

    histRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "custom",
        formatter: (p: number) => formatSignedNumber(p, 4),
      },
    });
    macdRef.current = chart.addSeries(LineSeries, { color: "#38bdf8", lineWidth: 2, title: "MACD" });
    signalRef.current = chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 2, title: "Signal" });

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      histRef.current = null;
      macdRef.current = null;
      signalRef.current = null;
    };
  }, [height, interval]);

  useEffect(() => {
    if (!candles.length || !histRef.current || !macdRef.current || !signalRef.current) return;

    const { line, signal, histogram } = macdSeries(candles.map((c) => c.close));
    const full = !seededRef.current || candles.length !== barCountRef.current;
    const last = candles[candles.length - 1];
    const t = last.time as UTCTimestamp;

    if (full) {
      histRef.current.setData(
        candles.map((c, i) => ({
          time: c.time as UTCTimestamp,
          value: histogram[i],
          color: histogram[i] >= 0 ? "#22c55e80" : "#ef444480",
        }))
      );
      macdRef.current.setData(candles.map((c, i) => ({ time: c.time as UTCTimestamp, value: line[i] })));
      signalRef.current.setData(candles.map((c, i) => ({ time: c.time as UTCTimestamp, value: signal[i] })));
      seededRef.current = true;
      barCountRef.current = candles.length;
    } else {
      const v = histogram[histogram.length - 1];
      histRef.current.update({ time: t, value: v, color: v >= 0 ? "#22c55e80" : "#ef444480" });
      macdRef.current.update({ time: t, value: line[line.length - 1] });
      signalRef.current.update({ time: t, value: signal[signal.length - 1] });
    }
  }, [candles]);

  return <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />;
}

export function RsiMiniChart({ candles, interval, height = 80 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<LineSeriesRef>(null);
  const seededRef = useRef(false);
  const barCountRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;
    seededRef.current = false;
    barCountRef.current = 0;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#18181b" },
        textColor: "#71717a",
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "#27272a" } },
      rightPriceScale: {
        borderColor: "#3f3f46",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: { visible: false, borderColor: "#3f3f46" },
      width: containerRef.current.clientWidth,
      height,
    });

    rsiRef.current = chart.addSeries(LineSeries, {
      color: "#a78bfa",
      lineWidth: 2,
      priceFormat: { type: "price", precision: 1, minMove: 0.1 },
    });

    rsiRef.current.createPriceLine({
      price: 70,
      color: "#ef444466",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "70",
    });
    rsiRef.current.createPriceLine({
      price: 30,
      color: "#22c55e66",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "30",
    });

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      rsiRef.current = null;
    };
  }, [height, interval]);

  useEffect(() => {
    if (!candles.length || !rsiRef.current) return;
    const values = rsiSeries(candles.map((c) => c.close));
    const full = !seededRef.current || candles.length !== barCountRef.current;

    if (full) {
      rsiRef.current.setData(
        candles.map((c, i) => ({
          time: c.time as UTCTimestamp,
          value: values[i],
        }))
      );
      seededRef.current = true;
      barCountRef.current = candles.length;
      return;
    }

    const last = candles[candles.length - 1];
    rsiRef.current.update({
      time: last.time as UTCTimestamp,
      value: values[values.length - 1],
    });
  }, [candles]);

  return <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />;
}
