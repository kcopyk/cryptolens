"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Chart, KLineData, OverlayCreate, OverlayEvent } from "klinecharts";
import type { Candle, ChartInterval } from "@/lib/api";
import { fetchChartDrawings, saveChartDrawings } from "@/lib/api";

/**
 * Drawing tools the spec asks for (§3.4 / §8 Q5): trendline, horizontal, fib,
 * + parallel channel (range "measure"). All are KLineChart v9 built-ins, so no
 * exotic custom figures — we keep the common set solid first.
 */
const ICON = "w-[18px] h-[18px]";

const DRAW_TOOLS = [
  {
    key: "segment",
    label: "เทรนด์ไลน์",
    icon: (
      <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="5" y1="18" x2="19" y2="6" strokeLinecap="round" />
        <circle cx="5" cy="18" r="1.7" fill="currentColor" stroke="none" />
        <circle cx="19" cy="6" r="1.7" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    key: "horizontalStraightLine",
    label: "เส้นแนวนอน",
    icon: (
      <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
        <circle cx="9" cy="12" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    key: "fibonacciLine",
    label: "Fibonacci",
    icon: (
      <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <line x1="4" y1="5" x2="20" y2="5" strokeLinecap="round" />
        <line x1="4" y1="9.5" x2="20" y2="9.5" strokeLinecap="round" opacity="0.7" />
        <line x1="4" y1="14.5" x2="20" y2="14.5" strokeLinecap="round" opacity="0.7" />
        <line x1="4" y1="19" x2="20" y2="19" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "priceChannelLine",
    label: "ช่องราคา (Channel)",
    icon: (
      <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="4" y1="14" x2="20" y2="6" strokeLinecap="round" />
        <line x1="4" y1="19" x2="20" y2="11" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "priceLine",
    label: "เส้นราคา",
    icon: (
      <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="3" y1="12" x2="14" y2="12" strokeLinecap="round" />
        <path d="M14 9h5l2 3-2 3h-5z" strokeLinejoin="round" />
      </svg>
    ),
  },
];

// Dark theme tuned to the app's zinc palette.
const STYLES = {
  grid: {
    horizontal: { color: "#27272a" },
    vertical: { color: "#27272a" },
  },
  candle: {
    bar: {
      upColor: "#34d399",
      downColor: "#f87171",
      noChangeColor: "#a1a1aa",
      upBorderColor: "#34d399",
      downBorderColor: "#f87171",
      upWickColor: "#34d399",
      downWickColor: "#f87171",
    },
    priceMark: {
      high: { color: "#a1a1aa" },
      low: { color: "#a1a1aa" },
      last: {
        text: { color: "#fff" },
      },
    },
    tooltip: {
      text: { color: "#d4d4d8" },
    },
  },
  xAxis: { tickText: { color: "#71717a" }, axisLine: { color: "#3f3f46" } },
  yAxis: { tickText: { color: "#71717a" }, axisLine: { color: "#3f3f46" } },
  crosshair: {
    horizontal: { text: { backgroundColor: "#7c3aed" } },
    vertical: { text: { backgroundColor: "#7c3aed" } },
  },
  overlay: {
    line: { color: "#a78bfa" },
    text: { color: "#e4e4e7" },
  },
};

interface Props {
  symbol: string;
  candles: Candle[];
  interval: ChartInterval;
  height?: number;
}

interface SavedOverlay {
  name: string;
  points: unknown[];
}

function toKLineData(candles: Candle[]): KLineData[] {
  return candles.map((c) => ({
    timestamp: c.time * 1000,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));
}

export default function KLineChartPanel({ symbol, candles, interval, height = 420 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [ready, setReady] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Read by overlay onClick (closure) — ref so it always sees the latest value.
  const deleteModeRef = useRef(false);
  // Currently-selected overlay (set when a line is clicked) — the target for the
  // keyboard Delete/Backspace shortcut.
  const selectedOverlayIdRef = useRef<string | null>(null);

  // Live snapshot of every overlay on the chart, keyed by id, for persistence.
  const overlaysRef = useRef<Map<string, SavedOverlay>>(new Map());
  // Guards: which (symbol:interval) the chart data currently reflects, and which
  // symbol's drawings are loaded — so ticks don't reset data or reload overlays.
  const appliedKeyRef = useRef<string>("");
  const loadedSymbolRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Persistence (debounced PUT) ──────────────────────────────────────
  const scheduleSave = useCallback((sym: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const drawings = Array.from(overlaysRef.current.values());
      saveChartDrawings(sym, drawings)
        .then(() => setSavedAt(Date.now()))
        .catch((err) => console.warn("save drawings failed", err));
    }, 800);
  }, []);

  // Callbacks attached to every overlay (new or restored) so any draw/move/
  // delete keeps overlaysRef — and thus the backend — in sync.
  const overlayCallbacks = useCallback(
    (sym: string): Partial<OverlayCreate> => {
      const track = (e: OverlayEvent) => {
        overlaysRef.current.set(e.overlay.id, {
          name: e.overlay.name,
          points: e.overlay.points as unknown[],
        });
        scheduleSave(sym);
        return false;
      };
      return {
        onDrawEnd: (e) => {
          track(e);
          setActiveTool(null); // one-shot: tool deselects after a completed draw
          return false;
        },
        onPressedMoveEnd: track,
        onClick: (e) => {
          // Eraser mode: clicking a line deletes just that one.
          if (deleteModeRef.current) {
            chartRef.current?.removeOverlay({ id: e.overlay.id });
            return true;
          }
          return false;
        },
        onSelected: (e) => {
          selectedOverlayIdRef.current = e.overlay.id; // remember for keyboard Delete
          return false;
        },
        onDeselected: (e) => {
          if (selectedOverlayIdRef.current === e.overlay.id) selectedOverlayIdRef.current = null;
          return false;
        },
        onRemoved: (e) => {
          if (selectedOverlayIdRef.current === e.overlay.id) selectedOverlayIdRef.current = null;
          overlaysRef.current.delete(e.overlay.id);
          scheduleSave(sym);
          return false;
        },
      };
    },
    [scheduleSave]
  );

  const loadDrawings = useCallback(
    async (chart: Chart, sym: string) => {
      overlaysRef.current.clear();
      chart.removeOverlay();
      try {
        const saved = (await fetchChartDrawings(sym)) as SavedOverlay[];
        for (const ov of saved) {
          if (!ov?.name) continue;
          const id = chart.createOverlay({
            name: ov.name,
            points: ov.points as OverlayCreate["points"],
            ...overlayCallbacks(sym),
          });
          if (typeof id === "string") {
            overlaysRef.current.set(id, { name: ov.name, points: ov.points });
          }
        }
      } catch (err) {
        console.warn("load drawings failed", err);
      }
    },
    [overlayCallbacks]
  );

  // ─── Init / dispose chart (client-only) ───────────────────────────────
  useEffect(() => {
    let disposed = false;
    let chart: Chart | null = null;
    (async () => {
      const klinecharts = await import("klinecharts");
      if (disposed || !containerRef.current) return;
      chart = klinecharts.init(containerRef.current, { styles: STYLES });
      if (!chart) return;
      // VOL in its OWN sub-pane — putting it in the candle pane forces volume
      // (~0–100) onto the price axis and collapses the scale to [0, max], which
      // squashes the candles into a thin band.
      chart.createIndicator("VOL");
      chartRef.current = chart;
      setReady(true);
    })();
    return () => {
      disposed = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const c = chartRef.current;
      if (c) import("klinecharts").then((k) => k.dispose(c));
      chartRef.current = null;
      setReady(false);
      appliedKeyRef.current = "";
      loadedSymbolRef.current = "";
    };
  }, []);

  // ─── Keyboard: Delete/Backspace removes the selected line ─────────────
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Delete" && ev.key !== "Backspace") return;
      // Don't hijack the key while the user is typing in a field.
      const t = ev.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || t?.isContentEditable) return;
      const id = selectedOverlayIdRef.current;
      if (!id) return;
      ev.preventDefault();
      chartRef.current?.removeOverlay({ id }); // onRemoved → untrack + save
      selectedOverlayIdRef.current = null;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ─── Feed data: full reset on symbol/interval change, tick-update otherwise ─
  useEffect(() => {
    const chart = chartRef.current;
    if (!ready || !chart || candles.length === 0) return;

    const key = `${symbol}:${interval}`;
    const data = toKLineData(candles);

    if (appliedKeyRef.current !== key) {
      chart.applyNewData(data);
      appliedKeyRef.current = key;
      if (loadedSymbolRef.current !== symbol) {
        loadedSymbolRef.current = symbol;
        loadDrawings(chart, symbol);
      }
    } else {
      chart.updateData(data[data.length - 1]);
    }
  }, [ready, symbol, interval, candles, loadDrawings]);

  // ─── Toolbar actions ──────────────────────────────────────────────────
  const pickTool = (key: string) => {
    const chart = chartRef.current;
    if (!chart) return;
    setDeleteMode(false);
    deleteModeRef.current = false;
    setActiveTool(key);
    chart.createOverlay({ name: key, ...overlayCallbacks(symbol) });
  };

  const toggleDelete = () => {
    setDeleteMode((d) => {
      const next = !d;
      deleteModeRef.current = next;
      if (next) setActiveTool(null); // can't draw and erase at once
      return next;
    });
  };

  const clearAll = () => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.removeOverlay();
    overlaysRef.current.clear();
    scheduleSave(symbol);
    setActiveTool(null);
  };

  return (
    <div className="flex gap-2">
      {/* Left vertical tool tab bar (TradingView-style) */}
      <div className="flex flex-col items-center gap-1 self-start py-1.5 px-1 rounded-xl bg-zinc-900/60 border border-zinc-800">
        {DRAW_TOOLS.map((t) => (
          <button
            key={t.key}
            onClick={() => pickTool(t.key)}
            title={t.label}
            aria-label={t.label}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
              activeTool === t.key
                ? "bg-violet-600 text-white"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            }`}
          >
            {t.icon}
          </button>
        ))}

        {/* Eraser: delete a single line by clicking it */}
        <button
          onClick={toggleDelete}
          title="ลบทีละเส้น (คลิกที่เส้นเพื่อลบ)"
          aria-label="ลบทีละเส้น"
          className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
            deleteMode ? "bg-red-600 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
          }`}
        >
          <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10M5 16l3.5 3.5M16.4 3.6a2 2 0 012.8 0l1.2 1.2a2 2 0 010 2.8L9.5 18.5H6l-1-1L16.4 3.6z" />
          </svg>
        </button>

        <div className="w-6 h-px bg-zinc-800 my-0.5" />

        <button
          onClick={clearAll}
          title="ล้างเส้นทั้งหมด"
          aria-label="ล้างเส้นทั้งหมด"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors"
        >
          <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12" />
          </svg>
        </button>

        <div
          title={savedAt ? "บันทึกเส้นอัตโนมัติแล้ว" : "วาดเส้นได้ · เซฟอัตโนมัติ"}
          className={`w-9 h-9 flex items-center justify-center ${savedAt ? "text-emerald-400" : "text-zinc-600"}`}
        >
          <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            {savedAt ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 21V5a2 2 0 012-2h9l3 3v15l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L5 21z" />
            )}
          </svg>
        </div>
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        style={{ height }}
        className="flex-1 min-w-0 rounded-xl overflow-hidden bg-zinc-900/40"
      />
    </div>
  );
}
