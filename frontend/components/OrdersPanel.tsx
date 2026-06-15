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
  <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-4 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/20">
    <svg className="w-9 h-9 text-zinc-700" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    <div className="text-center">
      <p className="text-sm font-semibold text-zinc-300">{title}</p>
      <p className="text-sm text-zinc-500 mt-1">{hint}</p>
    </div>
  </div>
);

const th = "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500";
const sideText = (buy: boolean) => (buy ? "text-emerald-400" : "text-red-400");

/** "BTCUSDT" → base "BTC". */
const baseOf = (symbol: string) => symbol.replace(/USDT$/, "");

function PairCell({ symbol }: { symbol: string }) {
  const base = baseOf(symbol);
  return (
    <div className="flex items-center gap-2">
      <CoinIcon asset={base} size="sm" />
      <span className="text-sm font-bold text-zinc-100">
        {base}
        <span className="text-zinc-500 font-medium">/USDT</span>
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
        subTab === id ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-violet-600 text-white text-[10px] font-bold h-4 min-w-4 px-1 flex items-center justify-center rounded-full">
          {badge}
        </span>
      )}
      {subTab === id && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-violet-500 rounded-full" />}
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
    <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
      {!compact && (
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Spot</span>
            <span>/</span>
            <span className="text-zinc-300 font-medium">คำสั่งซื้อขายของฉัน</span>
          </div>
          <h2 className="text-xl font-bold text-zinc-100 mt-1">คำสั่งซื้อขาย</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            ดึงสดจากบัญชี Binance ตามเวลาจริง · ไม่หายเมื่อรีเฟรชหน้าเว็บ
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-5 border-b border-zinc-800">
        {tab("open", "คำสั่งที่เปิดอยู่", filteredOpenOrders.length)}
        {tab("history", "ประวัติออเดอร์")}
        {tab("trades", "ประวัติการเทรด")}
        {tab("funds", "สินทรัพย์")}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider">เหรียญ</span>
          <select
            value={filterSymbol}
            onChange={(e) => setFilterSymbol(e.target.value)}
            className="bg-transparent border-none text-sm font-semibold text-zinc-100 focus:outline-none cursor-pointer"
          >
            {FILTERS.map((f) => (
              <option key={f} value={f} className="bg-zinc-950 text-zinc-200">
                {f === "All" ? "ทั้งหมด" : f}
              </option>
            ))}
          </select>
        </div>

        {subTab !== "funds" && (
          <div className="flex bg-zinc-950 rounded-lg p-0.5 border border-zinc-800">
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
                      ? "bg-emerald-600/90 text-white"
                      : val === "SELL"
                        ? "bg-red-600/90 text-white"
                        : "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
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
            className="ml-auto text-xs font-semibold text-red-400 hover:text-red-300 border border-red-950 bg-red-950/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelingAll ? "กำลังยกเลิก..." : "ยกเลิกทั้งหมด"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-zinc-400 text-sm animate-pulse">
          กำลังดึงข้อมูลออเดอร์จาก Binance...
        </div>
      ) : subTab === "open" ? (
        filteredOpenOrders.length === 0 ? (
          <EmptyState title="ไม่มีออเดอร์ค้างส่ง" hint="ตั้งซื้อแบบ Limit Price เพื่อจำลองออเดอร์ที่ยังไม่ปิดที่นี่" />
        ) : (
          <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-950/40">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/40">
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
              <tbody className="divide-y divide-zinc-800/60">
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
                    <tr key={o.orderId} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                        {fmtDateTime(o.time)}
                      </td>
                      <td className="px-4 py-3">
                        <PairCell symbol={o.symbol} />
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300">{o.type === "LIMIT" ? "Limit" : "Market"}</td>
                      <td className={`px-4 py-3 text-sm font-bold ${sideText(o.side === "BUY")}`}>
                        {o.side === "BUY" ? "ซื้อ" : "ขาย"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-zinc-100">
                        ${displayPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-zinc-200">
                        {qty.toFixed(6)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs tabular-nums text-zinc-400">{fill.toFixed(1)}%</span>
                          <span className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <span className="block h-full bg-violet-500 rounded-full" style={{ width: `${fill}%` }} />
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-zinc-100">
                        ${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleCancel(o)}
                          className="text-sm font-medium text-red-400 hover:text-red-300 border border-red-950 bg-red-950/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
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
          <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-950/40">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/40">
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
              <tbody className="divide-y divide-zinc-800/60">
                {displayOrderHistory.map((o) => {
                  const price = parseFloat(o.price);
                  const qty = parseFloat(o.origQty);
                  const execQty = parseFloat(o.executedQty);
                  const cumQuote = parseFloat(o.cummulativeQuoteQty);
                  const isMarket = o.type === "MARKET";
                  const displayPrice = isMarket || price === 0 ? (execQty > 0 ? cumQuote / execQty : 0) : price;
                  const totalCost = isMarket || price === 0 ? cumQuote : price * qty;
                  return (
                    <tr key={`${o.symbol}-${o.orderId}`} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                        {fmtDateTime(o.time)}
                      </td>
                      <td className="px-4 py-3">
                        <PairCell symbol={o.symbol} />
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300">{o.type === "LIMIT" ? "Limit" : "Market"}</td>
                      <td className={`px-4 py-3 text-sm font-bold ${sideText(o.side === "BUY")}`}>
                        {o.side === "BUY" ? "ซื้อ" : "ขาย"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-zinc-100">
                        ${displayPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-zinc-200">
                        {qty.toFixed(6)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-zinc-100">
                        ${totalCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs border font-semibold ${
                            o.status === "FILLED"
                              ? "bg-emerald-950/80 text-emerald-400 border-emerald-900/30"
                              : o.status === "CANCELED"
                                ? "bg-zinc-900 text-zinc-500 border-zinc-800"
                                : "bg-red-950/80 text-red-400 border-red-900/30"
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
          <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-950/40">
            <table className="w-full text-left border-collapse min-w-[840px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/40">
                  <th className={th}>วันที่</th>
                  <th className={th}>คู่เหรียญ</th>
                  <th className={th}>ฝั่ง</th>
                  <th className={`${th} text-right`}>ราคาที่แมตช์</th>
                  <th className={`${th} text-right`}>จำนวน</th>
                  <th className={`${th} text-right`}>ยอดรวม</th>
                  <th className={`${th} text-right`}>ค่าธรรมเนียม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {displayTradeHistory.map((t) => {
                  const price = parseFloat(t.price);
                  const qty = parseFloat(t.qty);
                  const quoteQty = parseFloat(t.quoteQty);
                  const commission = parseFloat(t.commission);
                  return (
                    <tr key={`${t.symbol}-${t.id}`} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                        {fmtDateTime(t.time)}
                      </td>
                      <td className="px-4 py-3">
                        <PairCell symbol={t.symbol} />
                      </td>
                      <td className={`px-4 py-3 text-sm font-bold ${sideText(t.isBuyer)}`}>
                        {t.isBuyer ? "ซื้อ" : "ขาย"}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-zinc-100">
                        ${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-zinc-200">
                        {qty.toFixed(6)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-zinc-100">
                        ${quoteQty.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-zinc-400 tabular-nums">
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
        <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-950/40">
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/40">
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
            <tbody className="divide-y divide-zinc-800/60">
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
                    <tr key={b.asset} className="hover:bg-zinc-900/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <CoinIcon asset={b.asset} size="sm" />
                          <span className="text-sm font-bold text-zinc-100">{b.asset}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-zinc-200">
                        {b.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-zinc-400">
                        {b.free.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-zinc-500">
                        {b.locked.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-zinc-100">
                        {b.asset === "USDT"
                          ? "$1.00"
                          : `$${currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-zinc-100">
                        ${currentVal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-zinc-300">
                        {b.asset === "USDT"
                          ? "$1.00"
                          : costBasis > 0
                            ? `$${costBasis.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                            : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right text-sm font-medium tabular-nums ${
                          !hasPnL ? "text-zinc-500" : pnlVal > 0 ? "text-emerald-400" : pnlVal < 0 ? "text-red-400" : "text-zinc-400"
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
