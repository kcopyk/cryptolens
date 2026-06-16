"use client";

import { useState } from "react";
import { BinanceOrder, BinanceTrade, Balance, Coin } from "@/lib/api";
import CoinIcon from "./CoinIcon";

type SubTab = "open" | "history" | "trades" | "funds";
type SideFilter = "all" | "BUY" | "SELL";

interface OrdersPanelProps {
  openOrders: BinanceOrder[];
  orderHistoryMap: Record<string, BinanceOrder[]>;
  tradesMap: Record<string, BinanceTrade[]>;
  balances: Balance[];
  liveCoins: Coin[];
  loading: boolean;
  onCancel: (symbol: string, orderId: number) => Promise<void>;
  /** Cancel every order in the list, then refresh once. Hidden when absent. */
  onCancelAll?: (orders: BinanceOrder[]) => Promise<void>;
  /** Compact = embedded under the trading terminal (no big title block). */
  compact?: boolean;
}

const FILTERS = ["All", "BTC", "ETH", "BNB", "SOL"] as const;
const TRACKED = ["BTC", "ETH", "BNB", "SOL"];

function fmtDateTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

const EmptyState = ({ title, hint }: { title: string; hint: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-muted gap-4 border border-dashed border-line rounded-xl bg-base/20">
    <svg className="w-9 h-9 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    <div className="text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="text-sm text-muted mt-1">{hint}</p>
    </div>
  </div>
);

const th = "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted";
const sideText = (buy: boolean) => (buy ? "text-mint" : "text-coral");

/** "BTCUSDT" → base "BTC". */
const baseOf = (symbol: string) => symbol.replace(/USDT$/, "");

function PairCell({ symbol }: { symbol: string }) {
  const base = baseOf(symbol);
  return (
    <div className="flex items-center gap-2">
      <CoinIcon asset={base} size="sm" />
      <span className="text-sm font-bold text-ink">
        {base}
        <span className="text-muted font-medium">/USDT</span>
      </span>
    </div>
  );
}

export default function OrdersPanel({
  openOrders,
  orderHistoryMap,
  tradesMap,
  balances,
  liveCoins,
  loading,
  onCancel,
  onCancelAll,
  compact = false,
}: OrdersPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>("open");
  const [filterSymbol, setFilterSymbol] = useState<string>("All");
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");
  const [cancelingAll, setCancelingAll] = useState(false);

  const bySymbol = (s: string) => filterSymbol === "All" || s.startsWith(filterSymbol);
  const bySideOrder = (o: BinanceOrder) => sideFilter === "all" || o.side === sideFilter;
  const bySideTrade = (t: BinanceTrade) =>
    sideFilter === "all" || (sideFilter === "BUY" ? t.isBuyer : !t.isBuyer);

  const filteredOpenOrders = openOrders.filter((o) => bySymbol(o.symbol) && bySideOrder(o));

  const displayOrderHistory = (
    filterSymbol === "All" ? Object.values(orderHistoryMap).flat() : orderHistoryMap[filterSymbol] ?? []
  )
    .filter(bySideOrder)
    .slice()
    .sort((a, b) => b.time - a.time);

  const displayTradeHistory = (
    filterSymbol === "All" ? Object.values(tradesMap).flat() : tradesMap[filterSymbol] ?? []
  )
    .filter(bySideTrade)
    .slice()
    .sort((a, b) => b.time - a.time);

  const tab = (id: SubTab, label: string, badge?: number) => (
    <button
      onClick={() => setSubTab(id)}
      className={`relative px-1 pb-2.5 text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
        subTab === id ? "text-ink" : "text-muted hover:text-ink"
      }`}
    >
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-mint text-base text-[10px] font-bold h-4 min-w-4 px-1 flex items-center justify-center rounded-full">
          {badge}
        </span>
      )}
      {subTab === id && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-mint rounded-full" />}
    </button>
  );

  const handleCancel = async (o: BinanceOrder) => {
    if (!confirm(`คุณต้องการยกเลิกคำสั่งเทรด #${o.orderId} หรือไม่?`)) return;
    try {
      await onCancel(o.symbol, o.orderId);
    } catch (e) {
      alert(`ยกเลิกออเดอร์ล้มเหลว: ${(e as Error).message}`);
    }
  };

  const handleCancelAll = async () => {
    if (!onCancelAll || filteredOpenOrders.length === 0) return;
    if (!confirm(`ยกเลิกคำสั่งที่เปิดอยู่ทั้งหมด ${filteredOpenOrders.length} รายการ?`)) return;
    setCancelingAll(true);
    try {
      await onCancelAll(filteredOpenOrders);
    } catch (e) {
      alert(`ยกเลิกออเดอร์ล้มเหลว: ${(e as Error).message}`);
    } finally {
      setCancelingAll(false);
    }
  };

  const filledPct = (o: BinanceOrder) => {
    const orig = parseFloat(o.origQty);
    const exec = parseFloat(o.executedQty);
    return orig > 0 ? (exec / orig) * 100 : 0;
  };

  return (
    <section className="bg-panel/50 border border-line rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
      {!compact && (
        <div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>Spot</span>
            <span>/</span>
            <span className="text-ink font-medium">คำสั่งซื้อขายของฉัน</span>
          </div>
          <h2 className="text-xl font-bold text-ink mt-1">คำสั่งซื้อขาย</h2>
          <p className="text-sm text-muted mt-0.5">
            ดึงสดจากบัญชี Binance ตามเวลาจริง · ไม่หายเมื่อรีเฟรชหน้าเว็บ
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-5 border-b border-line">
        {tab("open", "คำสั่งที่เปิดอยู่", filteredOpenOrders.length)}
        {tab("history", "ประวัติออเดอร์")}
        {tab("trades", "ประวัติการเทรด")}
        {tab("funds", "สินทรัพย์")}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2 bg-base border border-line rounded-lg px-3 py-1.5">
          <span className="text-[11px] text-muted uppercase tracking-wider">เหรียญ</span>
          <select
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="bg-transparent border-none text-sm font-semibold text-ink focus:outline-none cursor-pointer"
          >
            {FILTERS.map((f) => (
              <option key={f} value={f} className="bg-base text-ink">
                {f === "All" ? "ทั้งหมด" : f}
              </option>
            ))}
          </select>
        </div>

        {subTab !== "funds" && (
          <div className="flex bg-base rounded-lg p-0.5 border border-line">
            {([
              ["all", "ทั้งหมด"],
              ["BUY", "ซื้อ"],
              ["SELL", "ขาย"],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setSideFilter(val)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  sideFilter === val
                    ? val === "BUY"
                      ? "bg-mint/90 text-base"
                      : val === "SELL"
                        ? "bg-coral/90 text-base"
                        : "bg-ink/10 text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {subTab === "open" && onCancelAll && filteredOpenOrders.length > 0 && (
          <button
            onClick={handleCancelAll}
            disabled={cancelingAll}
            className="ml-auto text-xs font-semibold text-coral hover:text-coral/80 border border-coral/20 bg-coral/10 px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelingAll ? "กำลังยกเลิก..." : "ยกเลิกทั้งหมด"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted text-sm animate-pulse">
          กำลังดึงข้อมูลออเดอร์จาก Binance...
        </div>
      ) : subTab === "open" ? (
        filteredOpenOrders.length === 0 ? (
          <EmptyState title="ไม่มีออเดอร์ค้างส่ง" hint="ตั้งซื้อแบบ Limit Price เพื่อจำลองออเดอร์ที่ยังไม่ปิดที่นี่" />
        ) : (
          <div className="overflow-x-auto border border-line rounded-xl bg-base/40">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-line bg-panel/40">
                  <th className={th}>วันที่</th>
                  <th className={th}>คู่เหรียญ</th>
                  <th className={th}>ประเภท</th>
                  <th className={th}>ฝั่ง</th>
                  <th className={`${th} text-right`}>ราคา</th>
                  <th className={`${th} text-right`}>จำนวน</th>
                  <th className={`${th} text-right`}>จับคู่แล้ว</th>
                  <th className={`${th} text-right`}>ยอดรวม</th>
                  <th className={`${th} text-center`}>จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredOpenOrders.map((o) => {
                  const price = parseFloat(o.price);
                  const qty = parseFloat(o.origQty);
                  const execQty = parseFloat(o.executedQty);
                  const cumQuote = parseFloat(o.cummulativeQuoteQty);
                  const isMarket = o.type === "MARKET";
                  const displayPrice = isMarket || price === 0 ? (execQty > 0 ? cumQuote / execQty : 0) : price;
                  const totalCost = isMarket || price === 0 ? cumQuote : price * qty;
                  const fill = filledPct(o);
                  return (
                    <tr key={o.orderId} className="hover:bg-panel/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted tabular-nums whitespace-nowrap">
                        {fmtDateTime(o.time)}
                      </td>
                      <td className="px-4 py-3">
                        <PairCell symbol={o.symbol} />
                      </td>
                      <td className="px-4 py-3 text-sm text-ink">{o.type === "LIMIT" ? "Limit" : "Market"}</td>
                      <td className={`px-4 py-3 text-sm font-bold ${sideText(o.side === "BUY")}`}>
                        {o.side === "BUY" ? "ซื้อ" : "ขาย"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums font-mono text-ink">
                        ${displayPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums font-mono text-ink">
                        {qty.toFixed(6)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs tabular-nums font-mono text-muted">{fill.toFixed(1)}%</span>
                          <span className="w-16 h-1 bg-ink/6 rounded-full overflow-hidden">
                            <span className="block h-full bg-mint rounded-full" style={{ width: `${fill}%` }} />
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums font-mono text-ink">
                        ${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleCancel(o)}
                          className="text-sm font-medium text-coral hover:text-coral/80 border border-coral/20 bg-coral/10 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          ยกเลิก
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : subTab === "history" ? (
        displayOrderHistory.length === 0 ? (
          <EmptyState
            title={`ยังไม่มีประวัติออเดอร์${filterSymbol === "All" ? "ทั้งหมด" : `ของเหรียญ ${filterSymbol}`}`}
            hint="ประวัติการสั่งซื้อจะขึ้นเมื่อมีการเทรดจับคู่สำเร็จหรือมีการยกเลิกสำเร็จ"
          />
        ) : (
          <div className="overflow-x-auto border border-line rounded-xl bg-base/40">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-line bg-panel/40">
                  <th className={th}>วันที่</th>
                  <th className={th}>คู่เหรียญ</th>
                  <th className={th}>ประเภท</th>
                  <th className={th}>ฝั่ง</th>
                  <th className={`${th} text-right`}>ราคา</th>
                  <th className={`${th} text-right`}>จำนวน</th>
                  <th className={`${th} text-right`}>ยอดรวม</th>
                  <th className={`${th} text-center`}>สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {displayOrderHistory.map((o) => {
                  const price = parseFloat(o.price);
                  const qty = parseFloat(o.origQty);
                  const execQty = parseFloat(o.executedQty);
                  const cumQuote = parseFloat(o.cummulativeQuoteQty);
                  const isMarket = o.type === "MARKET";
                  const displayPrice = isMarket || price === 0 ? (execQty > 0 ? cumQuote / execQty : 0) : price;
                  const totalCost = isMarket || price === 0 ? cumQuote : price * qty;
                  return (
                    <tr key={`${o.symbol}-${o.orderId}`} className="hover:bg-panel/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted tabular-nums whitespace-nowrap">
                        {fmtDateTime(o.time)}
                      </td>
                      <td className="px-4 py-3">
                        <PairCell symbol={o.symbol} />
                      </td>
                      <td className="px-4 py-3 text-sm text-ink">{o.type === "LIMIT" ? "Limit" : "Market"}</td>
                      <td className={`px-4 py-3 text-sm font-bold ${sideText(o.side === "BUY")}`}>
                        {o.side === "BUY" ? "ซื้อ" : "ขาย"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums font-mono text-ink">
                        ${displayPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums font-mono text-ink">
                        {qty.toFixed(6)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums font-mono text-ink">
                        ${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs border font-semibold ${
                            o.status === "FILLED"
                              ? "bg-mint/10 text-mint border-mint/20"
                              : o.status === "CANCELED"
                                ? "bg-panel text-muted border-line"
                                : "bg-coral/10 text-coral border-coral/20"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : subTab === "trades" ? (
        displayTradeHistory.length === 0 ? (
          <EmptyState
            title={`ยังไม่มีประวัติการเทรด${filterSymbol === "All" ? "ทั้งหมด" : `ของเหรียญ ${filterSymbol}`}`}
            hint="ประวัติการเทรดจะขึ้นเมื่อมีการซื้อขายเสร็จสิ้นสำเร็จ"
          />
        ) : (
          <div className="overflow-x-auto border border-line rounded-xl bg-base/40">
            <table className="w-full text-left border-collapse min-w-[840px]">
              <thead>
                <tr className="border-b border-line bg-panel/40">
                  <th className={th}>วันที่</th>
                  <th className={th}>คู่เหรียญ</th>
                  <th className={th}>ฝั่ง</th>
                  <th className={`${th} text-right`}>ราคาที่แมตช์</th>
                  <th className={`${th} text-right`}>จำนวน</th>
                  <th className={`${th} text-right`}>ยอดรวม</th>
                  <th className={`${th} text-right`}>ค่าธรรมเนียม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {displayTradeHistory.map((t) => {
                  const price = parseFloat(t.price);
                  const qty = parseFloat(t.qty);
                  const quoteQty = parseFloat(t.quoteQty);
                  const commission = parseFloat(t.commission);
                  return (
                    <tr key={`${t.symbol}-${t.id}`} className="hover:bg-panel/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted tabular-nums whitespace-nowrap">
                        {fmtDateTime(t.time)}
                      </td>
                      <td className="px-4 py-3">
                        <PairCell symbol={t.symbol} />
                      </td>
                      <td className={`px-4 py-3 text-sm font-bold ${sideText(t.isBuyer)}`}>
                        {t.isBuyer ? "ซื้อ" : "ขาย"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums font-mono text-ink">
                        ${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums font-mono text-ink">
                        {qty.toFixed(6)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums font-mono text-ink">
                        ${quoteQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted tabular-nums font-mono">
                        {commission > 0 ? `${commission.toFixed(6)} ${t.commissionAsset}` : "0"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : balances.length === 0 ? (
        <EmptyState title="ไม่พบข้อมูลสินทรัพย์" hint="ยอดเงินคงเหลือจะแสดงเมื่อกุญแจ API ทำงานปกติ" />
      ) : (
        <div className="overflow-x-auto border border-line rounded-xl bg-base/40">
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr className="border-b border-line bg-panel/40">
                <th className={th}>สินทรัพย์</th>
                <th className={`${th} text-right`}>ยอดทั้งหมด</th>
                <th className={`${th} text-right`}>ใช้งานได้</th>
                <th className={`${th} text-right`}>ในคำสั่งเทรด</th>
                <th className={`${th} text-right`}>ราคาปัจจุบัน</th>
                <th className={`${th} text-right`}>มูลค่ารวม</th>
                <th className={`${th} text-right`}>ต้นทุนเฉลี่ย</th>
                <th className={`${th} text-right`}>กำไร/ขาดทุน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {balances
                .filter((b) => TRACKED.includes(b.asset))
                .map((b) => {
                  const fallbackPrices: Record<string, number> = { BTC: 62000, ETH: 3300, BNB: 580, SOL: 150 };
                  const currentPrice =
                    liveCoins.find((c) => c.symbol === b.asset)?.price ?? fallbackPrices[b.asset] ?? 0;

                  const trades = [...(tradesMap[b.asset] ?? [])].sort((x, y) => x.time - y.time);
                  let totalQty = 0;
                  let totalCost = 0;
                  let avgBuyPrice = 0;
                  for (const t of trades) {
                    const price = parseFloat(t.price);
                    const qty = parseFloat(t.qty);
                    if (t.isBuyer) {
                      totalCost += price * qty;
                      totalQty += qty;
                      if (totalQty > 0) avgBuyPrice = totalCost / totalQty;
                    } else {
                      totalQty = Math.max(0, totalQty - qty);
                      totalCost = totalQty * avgBuyPrice;
                    }
                  }

                  const costBasis = totalQty > 0 ? avgBuyPrice : 0;
                  const currentVal = b.total * currentPrice;
                  let pnlVal = 0;
                  let pnlPct = 0;
                  let hasPnL = false;
                  if (b.asset !== "USDT" && costBasis > 0 && b.total > 0) {
                    pnlVal = (currentPrice - costBasis) * b.total;
                    pnlPct = ((currentPrice - costBasis) / costBasis) * 100;
                    hasPnL = true;
                  }

                  return (
                    <tr key={b.asset} className="hover:bg-panel/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <CoinIcon asset={b.asset} size="sm" />
                          <span className="text-sm font-bold text-ink">{b.asset}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums font-mono text-ink">
                        {b.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums font-mono text-muted">
                        {b.free.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums font-mono text-muted">
                        {b.locked.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums font-mono text-ink">
                        {b.asset === "USDT"
                          ? "$1.00"
                          : `$${currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums font-mono text-ink">
                        ${currentVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums font-mono text-ink">
                        {b.asset === "USDT"
                          ? "$1.00"
                          : costBasis > 0
                            ? `$${costBasis.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                            : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right text-sm font-medium tabular-nums font-mono ${
                          !hasPnL ? "text-muted" : pnlVal > 0 ? "text-mint" : pnlVal < 0 ? "text-coral" : "text-muted"
                        }`}
                      >
                        {!hasPnL ? (
                          "—"
                        ) : (
                          <div className="flex flex-col items-end gap-0.5">
                            <span>
                              {pnlVal > 0 ? "+" : ""}${pnlVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs opacity-80">
                              ({pnlPct > 0 ? "+" : ""}
                              {pnlPct.toFixed(2)}%)
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
