"use client";

import { useState, useEffect } from "react";
import { Coin, formatPrice, MockOrder, fetchAccountBalances, placeRealOrder } from "@/lib/api";
import SearchableDropdown from "./SearchableDropdown";

interface OrderPanelProps {
  coin: Coin;
  allCoins?: Coin[];
  onSelectCoin?: (coin: Coin) => void;
  onPlaceOrder?: (order: MockOrder) => void;
  /** Price picked from the order book / trade tape. */
  prefillPrice?: number;
  /** Bumped on each pick so identical prices still retrigger. */
  prefillTick?: number;
  /** Hide the pair header (the terminal already shows a ticker strip). */
  hidePairHeader?: boolean;
  /** Whether a Binance (testnet) key is linked — trading is disabled without one. */
  linked?: boolean;
  /** Open the settings modal so the user can link a key. */
  onLinkClick?: () => void;
}

export default function OrderPanel({
  coin,
  allCoins = [],
  onSelectCoin,
  onPlaceOrder,
  prefillPrice,
  prefillTick,
  hidePairHeader = false,
  linked = false,
  onLinkClick,
}: OrderPanelProps) {
  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [total, setTotal] = useState<string>("");
  const [percent, setPercent] = useState<number>(0);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  
  // Track last edited field to determine dynamic calculation direction on price ticks
  const [lastEdited, setLastEdited] = useState<"amount" | "total" | null>(null);
  // Track previous symbol to reset form on coin changes
  const [prevSymbol, setPrevSymbol] = useState<string>(coin.symbol);

  // Real Spot (testnet) balances — no mock fallback; 0 until a key is linked.
  const [usdtBalance, setUsdtBalance] = useState<number>(0);
  const [currentCoinBalance, setCurrentCoinBalance] = useState<number>(0);

  // Order Safety States
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastOrderTime, setLastOrderTime] = useState<number>(0);

  const MAX_ORDER_CAP_USDT = 5000.0;

  const loadBalances = async () => {
    if (!linked) {
      setUsdtBalance(0);
      setCurrentCoinBalance(0);
      return;
    }
    try {
      const res = await fetchAccountBalances();
      const usdt = res.balances.find((b) => b.asset === "USDT")?.free ?? 0;
      const asset = res.balances.find((b) => b.asset === coin.symbol)?.free ?? 0;
      setUsdtBalance(usdt);
      setCurrentCoinBalance(asset);
    } catch (err) {
      console.warn("Failed to fetch testnet balances:", err);
      setUsdtBalance(0);
      setCurrentCoinBalance(0);
    }
  };

  useEffect(() => {
    loadBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coin.symbol, linked]);

  // Initialize and Reset values ONLY when switching coins or order types (not on every price tick)
  useEffect(() => {
    if (coin.symbol !== prevSymbol) {
      setAmount("");
      setTotal("");
      setPercent(0);
      setLastEdited(null);
      setPrevSymbol(coin.symbol);
    }
    
    if (orderType === "limit") {
      setPrice(coin.price.toString());
    } else {
      setPrice(`Market Price (~$${formatPrice(coin.price)})`);
    }
  }, [coin.symbol, orderType]);

  // Dynamically update the disabled price input display on price ticks in Market mode
  useEffect(() => {
    if (orderType === "market") {
      setPrice(`Market Price (~$${formatPrice(coin.price)})`);
    }
  }, [coin.price, orderType]);

  // Recalculate values when coin price ticks (Market Order only)
  useEffect(() => {
    if (orderType !== "market") return;

    if (lastEdited === "amount" && amount !== "") {
      const numAmount = parseFloat(amount);
      if (!isNaN(numAmount)) {
        setTotal((numAmount * coin.price).toFixed(2));
      }
    } else if (lastEdited === "total" && total !== "") {
      const numTotal = parseFloat(total);
      if (!isNaN(numTotal) && coin.price > 0) {
        setAmount((numTotal / coin.price).toFixed(6));
      }
    }
  }, [coin.price, orderType, lastEdited, amount, total]);

  // Price picked from the order book / trade tape → switch to Limit and fill it.
  useEffect(() => {
    if (prefillTick === undefined || prefillPrice === undefined || prefillPrice <= 0) return;
    setOrderType("limit");
    const priceStr = prefillPrice.toString();
    setPrice(priceStr);
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount)) setTotal((prefillPrice * numAmount).toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillTick]);

  // Recalculate values on manual input changes
  const handlePriceChange = (val: string) => {
    setPrice(val);
    const numPrice = parseFloat(val);
    const numAmount = parseFloat(amount);
    if (!isNaN(numPrice) && !isNaN(numAmount)) {
      setTotal((numPrice * numAmount).toFixed(2));
    } else {
      setTotal("");
    }
  };

  const handleAmountChange = (val: string) => {
    setAmount(val);
    setLastEdited("amount");
    const numAmount = parseFloat(val);
    const numPrice = orderType === "limit" ? parseFloat(price) : coin.price;
    if (!isNaN(numAmount) && !isNaN(numPrice)) {
      setTotal((numAmount * numPrice).toFixed(2));
    } else {
      setTotal("");
    }
    setPercent(0);
  };

  const handleTotalChange = (val: string) => {
    setTotal(val);
    setLastEdited("total");
    const numTotal = parseFloat(val);
    const numPrice = orderType === "limit" ? parseFloat(price) : coin.price;
    if (!isNaN(numTotal) && !isNaN(numPrice) && numPrice > 0) {
      setAmount((numTotal / numPrice).toFixed(6));
    } else {
      setAmount("");
    }
    setPercent(0);
  };

  const handlePercentClick = (pct: number) => {
    setPercent(pct);
    const numPrice = orderType === "limit" ? parseFloat(price) : coin.price;
    if (isNaN(numPrice) || numPrice <= 0) return;

    if (activeTab === "buy") {
      const targetTotal = (usdtBalance * pct) / 100;
      setTotal(targetTotal.toFixed(2));
      setAmount((targetTotal / numPrice).toFixed(6));
      setLastEdited("total");
    } else {
      const targetAmount = (currentCoinBalance * pct) / 100;
      setAmount(targetAmount.toFixed(6));
      setTotal((targetAmount * numPrice).toFixed(2));
      setLastEdited("amount");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!linked) {
      showToast("กรุณาเชื่อม Testnet API key ก่อนส่งคำสั่งเทรด", "error");
      onLinkClick?.();
      return;
    }

    const finalAmount = parseFloat(amount);
    const finalTotal = parseFloat(total);

    if (isNaN(finalAmount) || finalAmount <= 0) {
      showToast("กรุณาระบุจำนวนเหรียญ", "error");
      return;
    }

    if (activeTab === "buy" && finalTotal > usdtBalance) {
      showToast("ยอด USDT ของคุณไม่เพียงพอ", "error");
      return;
    }

    if (activeTab === "sell" && finalAmount > currentCoinBalance) {
      showToast(`ยอด ${coin.symbol} ของคุณไม่เพียงพอ`, "error");
      return;
    }

    // Max Order Size Cap Check
    if (finalTotal > MAX_ORDER_CAP_USDT) {
      showToast(`ยอดคำสั่งซื้อขายเกินขีดจำกัดสูงสุด (${MAX_ORDER_CAP_USDT.toLocaleString()} USDT) เพื่อความปลอดภัย`, "error");
      return;
    }

    // Trigger confirmation modal
    setIsConfirmOpen(true);
  };

  const handleConfirmOrder = async () => {
    setIsConfirmOpen(false);
    
    // Rate Limiting Check (3 seconds)
    const now = Date.now();
    if (now - lastOrderTime < 3000) {
      showToast("กรุณารอสักครู่ ก่อนส่งคำสั่งซื้อขายถัดไป (Rate Limited)", "error");
      return;
    }
    
    setLastOrderTime(now);
    setIsSubmitting(true);

    const finalPrice = orderType === "limit" ? parseFloat(price) : coin.price;
    const finalAmount = parseFloat(amount);

    try {
      showToast("กำลังส่งคำสั่งซื้อขาย...", "success");
      const res = await placeRealOrder({
        symbol: coin.symbol,
        side: activeTab === "buy" ? "BUY" : "SELL",
        type: orderType === "limit" ? "LIMIT" : "MARKET",
        quantity: finalAmount,
        price: orderType === "limit" ? finalPrice : undefined,
      });

      const typeLabel = orderType === "limit" ? "Limit Order" : "Market Order";
      const sideLabel = activeTab === "buy" ? "ซื้อ" : "ขาย";
      const orderId = res.orderId || "SUCCESS";
      showToast(`ส่งคำสั่ง ${typeLabel} (${sideLabel}) สำเร็จ! ID: ${orderId}`, "success");

      if (onPlaceOrder) {
        // Parse execution details from Binance response
        const filledPrice = parseFloat(res.price) || finalPrice;
        const filledQty = parseFloat(res.executedQty) || finalAmount;
        
        onPlaceOrder({
          id: String(orderId),
          timestamp: new Date().toISOString(),
          symbol: coin.symbol,
          type: orderType === "limit" ? "Limit" : "Market",
          side: activeTab === "buy" ? "Buy" : "Sell",
          price: filledPrice > 0 ? filledPrice : coin.price,
          amount: filledQty,
          total: (filledPrice > 0 ? filledPrice : coin.price) * filledQty,
          status: "Completed",
        });
      }

      setAmount("");
      setTotal("");
      setPercent(0);
      setLastEdited(null);

      // Re-fetch balances to show updated values
      await loadBalances();
    } catch (err: any) {
      console.error(err);
      showToast(`ส่งคำสั่งซื้อขายล้มเหลว: ${err.message || "เกิดข้อผิดพลาด"}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
  };

  // Auto close toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="bg-panel/80 border border-line rounded-xl p-4 flex flex-col justify-between h-full min-h-[420px] relative">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`absolute top-2 left-2 right-2 p-3 rounded-lg text-xs z-50 flex items-center justify-between shadow-lg border animate-fade-in-down ${
            toast.type === "success"
              ? "bg-mint/10 text-mint border-mint/20"
              : "bg-coral/10 text-coral border-coral/20"
          }`}
        >
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 font-bold opacity-75 hover:opacity-100">
            ×
          </button>
        </div>
      )}

      <div>
        {/* Coin Pair Header */}
        {!hidePairHeader && (
          <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-line">
            <span className="text-xs font-bold text-ink">Spot Trading</span>
            {onSelectCoin && allCoins.length > 0 ? (
              <SearchableDropdown
                currentSymbol={coin.symbol}
                allCoins={allCoins}
                onSelectCoin={onSelectCoin}
                align="right"
              />
            ) : (
              <span className="text-xs font-mono font-bold text-ink bg-panel px-2.5 py-0.5 rounded border border-line">
                {coin.symbol} / USDT
              </span>
            )}
          </div>
        )}

        {/* Buy/Sell Tabs */}
        <div className="flex bg-panel rounded-lg p-0.5 mb-4">
          <button
            onClick={() => {
              setActiveTab("buy");
              setPercent(0);
              setAmount("");
              setTotal("");
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
              activeTab === "buy"
                ? "bg-mint text-base shadow"
                : "text-muted hover:text-ink"
            }`}
          >
            ซื้อ (Buy)
          </button>
          <button
            onClick={() => {
              setActiveTab("sell");
              setPercent(0);
              setAmount("");
              setTotal("");
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
              activeTab === "sell"
                ? "bg-coral text-base shadow"
                : "text-muted hover:text-ink"
            }`}
          >
            ขาย (Sell)
          </button>
        </div>

        {/* Limit / Market Selector */}
        <div className="flex gap-4 border-b border-line pb-2 mb-4">
          <button
            onClick={() => setOrderType("limit")}
            className={`text-xs font-medium pb-1 border-b-2 transition-all ${
              orderType === "limit"
                ? "border-mint text-mint"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Limit
          </button>
          <button
            onClick={() => setOrderType("market")}
            className={`text-xs font-medium pb-1 border-b-2 transition-all ${
              orderType === "market"
                ? "border-mint text-mint"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            Market
          </button>
        </div>

        {/* Available Balance */}
        <div className="flex justify-between text-[11px] text-muted mb-3 font-mono">
          <span>มีให้ใช้งาน:</span>
          {activeTab === "buy" ? (
            <span>{usdtBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDT</span>
          ) : (
            <span>
              {currentCoinBalance.toLocaleString("en-US", { minimumFractionDigits: 4 })} {coin.symbol}
            </span>
          )}
        </div>

        {/* Input Fields */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Price Field */}
          <div>
            <div className="relative flex items-center bg-panel border border-line rounded-lg focus-within:border-mint/30">
              <span className="pl-3 text-xs text-muted w-16">ราคา</span>
              <input
                type="text"
                disabled={orderType === "market"}
                value={price}
                onChange={(e) => handlePriceChange(e.target.value)}
                className="w-full bg-transparent border-0 py-2.5 pr-12 text-right text-xs text-ink focus:ring-0 focus:outline-none disabled:text-muted font-mono"
              />
              <span className="absolute right-3 text-[10px] text-muted font-bold">USDT</span>
            </div>
            {orderType === "market" && (
              <p className="text-[10px] text-muted mt-1 pl-1">
                * ซื้อขายที่ราคาตลาดปัจจุบันทันที (ไม่ต้องระบุราคาเอง)
              </p>
            )}
          </div>

          {/* Amount Field */}
          <div>
            <div className="relative flex items-center bg-panel border border-line rounded-lg focus-within:border-mint/30">
              <span className="pl-3 text-xs text-muted w-16">จำนวน</span>
              <input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full bg-transparent border-0 py-2.5 pr-14 text-right text-xs text-ink focus:ring-0 focus:outline-none font-mono"
              />
              <span className="absolute right-3 text-[10px] text-muted font-bold">{coin.symbol}</span>
            </div>
          </div>

          {/* Percentage buttons */}
          <div className="grid grid-cols-4 gap-1.5 py-1">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handlePercentClick(pct)}
                className={`py-1 text-[10px] font-semibold rounded transition-all border ${
                  percent === pct
                    ? "bg-ink/10 border-line text-ink"
                    : "bg-panel/40 border-line text-muted hover:text-ink hover:border-mint/30"
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Total Field */}
          <div>
            <div className="relative flex items-center bg-panel border border-line rounded-lg focus-within:border-mint/30">
              <span className="pl-3 text-xs text-muted w-16">ยอดรวม</span>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={total}
                onChange={(e) => handleTotalChange(e.target.value)}
                className="w-full bg-transparent border-0 py-2.5 pr-12 text-right text-xs text-ink focus:ring-0 focus:outline-none font-mono"
              />
              <span className="absolute right-3 text-[10px] text-muted font-bold">USDT</span>
            </div>
          </div>
        </form>
      </div>

      {/* Buy/Sell Button */}
      <div className="mt-4">
        {!linked ? (
          <button
            onClick={() => onLinkClick?.()}
            type="button"
            className="w-full py-3 text-xs font-bold rounded-lg text-base bg-mint hover:bg-mint/90 transition-all shadow-md active:scale-[0.98] cursor-pointer"
          >
            เชื่อม Testnet API key เพื่อเทรดจริง
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`w-full py-3 text-xs font-bold rounded-lg text-base transition-all shadow-md active:scale-[0.98] disabled:opacity-50 cursor-pointer ${
              activeTab === "buy"
                ? "bg-mint hover:bg-mint/90"
                : "bg-coral hover:bg-coral/90"
            }`}
          >
            {isSubmitting
              ? "กำลังส่งคำสั่ง..."
              : activeTab === "buy"
                ? `ซื้อ (Buy) ${coin.symbol}`
                : `ขาย (Sell) ${coin.symbol}`}
          </button>
        )}
        <p className="text-[10px] text-muted text-center mt-2">
          {linked
            ? "ส่งคำสั่งจริงไปยัง Binance Spot Testnet · ตัดยอดจากพอร์ต testnet"
            : "ยังไม่ได้เชื่อม key — ยอดที่แสดงเป็น 0 จนกว่าจะผูกบัญชี testnet"}
        </p>
      </div>

      {/* Confirmation Dialog Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-panel border border-line rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in-down">
            <div className="px-5 py-4 border-b border-line">
              <h3 className="text-xs uppercase tracking-wider text-muted font-semibold font-sans">
                ยืนยันคำสั่งเทรด (Confirm Order)
              </h3>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="text-center py-1">
                <span className={`inline-block font-bold text-xs px-3 py-1 rounded-full ${
                  activeTab === "buy" 
                    ? "bg-mint/10 text-mint border border-mint/20" 
                    : "bg-coral/10 text-coral border border-coral/20"
                }`}>
                  {activeTab === "buy" ? "ซื้อ (BUY)" : "ขาย (SELL)"} {coin.symbol} / USDT
                </span>
              </div>
              
              <div className="border border-line rounded-xl overflow-hidden bg-panel/20 font-sans">
                <div className="grid grid-cols-2 text-xs border-b border-line p-2.5">
                  <span className="text-muted">ประเภทคำสั่ง:</span>
                  <span className="text-right text-ink font-semibold">{orderType === "limit" ? "Limit Order" : "Market Order"}</span>
                </div>
                <div className="grid grid-cols-2 text-xs border-b border-line p-2.5">
                  <span className="text-muted">ราคา:</span>
                  <span className="text-right text-ink font-mono font-semibold">
                    {orderType === "limit" ? `$${parseFloat(price).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "ราคาตลาด (Market Price)"}
                  </span>
                </div>
                <div className="grid grid-cols-2 text-xs border-b border-line p-2.5">
                  <span className="text-muted">จำนวนเหรียญ:</span>
                  <span className="text-right text-ink font-mono font-semibold">
                    {parseFloat(amount).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 })} {coin.symbol}
                  </span>
                </div>
                <div className="grid grid-cols-2 text-xs p-2.5 bg-panel/40">
                  <span className="text-muted font-bold">ยอดรวมทั้งหมด:</span>
                  <span className="text-right text-ink font-mono font-bold text-sm">
                    ${parseFloat(total).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                  </span>
                </div>
              </div>

              <div className="p-3 bg-panel/10 border border-line rounded-xl flex items-start gap-2.5">
                <span className="text-warn text-xs mt-0.5">⚠️</span>
                <p className="text-[10px] text-muted font-sans leading-relaxed">
                  **คำเตือนความเสี่ยง:** คำสั่งนี้จะส่งตรงไปยังบัญชีกระดานเทรดจริง การทำธุรกรรมในตลาดคริปโตเคอร์เรนซีไม่สามารถกู้คืนหรือยกเลิกรายการหลังจากจับคู่สำเร็จแล้วได้ โปรดตรวจสอบความถูกต้อง
                </p>
              </div>
            </div>
            
            <div className="px-5 py-4 border-t border-line bg-panel/60 flex gap-2">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 py-2.5 text-xs font-semibold bg-ink/6 hover:bg-ink/10 text-muted border border-line rounded-xl transition-all cursor-pointer text-center"
              >
                ยกเลิก (Cancel)
              </button>
              <button
                onClick={handleConfirmOrder}
                className={`flex-1 py-2.5 text-xs font-bold text-base rounded-xl transition-all shadow-md cursor-pointer text-center ${
                  activeTab === "buy"
                    ? "bg-mint hover:bg-mint/90"
                    : "bg-coral hover:bg-coral/90"
                }`}
              >
                ยืนยันส่งคำสั่ง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
