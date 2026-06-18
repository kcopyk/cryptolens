"use client";

import { useState, useRef, useEffect } from "react";
import { Coin, askCoin, formatPrice } from "@/lib/api";
import SearchableDropdown from "./SearchableDropdown";
import CoinIcon from "./CoinIcon";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface Props {
  coin: Coin | null;
  allCoins: Coin[];
  onSelectCoin: (coin: Coin) => void;
  onClose: () => void;
}

export default function ChatPanel({ coin, allCoins, onSelectCoin, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, [coin?.symbol]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!coin || !input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", text: question }]);
    setLoading(true);
    try {
      const res = await askCoin(coin.symbol, question);
      setMessages((m) => [...m, { role: "assistant", text: res.answer }]);
    } catch {
      setError("ไม่สามารถรับคำตอบได้ในขณะนี้ — ลองอีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  const visible = !!coin;

  return (
    <>
      {/* Overlay */}
      {visible && (
        <div
          className="fixed inset-0 bg-black/40 z-60"
          onClick={onClose}
        />
      )}

      {/* Panel — above sticky header (z-50) */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-panel border-l border-line z-70 flex flex-col transition-transform duration-300 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-line flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted mb-1.5">ถาม AI เรื่อง</p>
              <div className="flex items-center gap-2.5">
                {coin && <CoinIcon asset={coin.symbol} size="sm" />}
                {coin && allCoins.length > 0 ? (
                  <SearchableDropdown
                    currentSymbol={coin.symbol}
                    allCoins={allCoins}
                    onSelectCoin={onSelectCoin}
                    align="left"
                    className="w-full"
                  />
                ) : (
                  <span className="text-sm font-bold text-ink">—</span>
                )}
              </div>
              {coin && (
                <p className="text-xs text-muted mt-1.5 tabular-nums font-mono">
                  ${formatPrice(coin.price)}
                  <span className={coin.change_24h_pct >= 0 ? " text-mint" : " text-coral"}>
                    {" "}
                    · {coin.change_24h_pct >= 0 ? "+" : ""}
                    {coin.change_24h_pct.toFixed(2)}% 24h
                  </span>
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-ink text-xl leading-none px-2 shrink-0"
              aria-label="ปิด"
            >
              ×
            </button>
          </div>
          <p className="text-[11px] text-muted leading-relaxed">
            ตอบจากข้อมูล ณ เวลาที่โหลด · เปลี่ยนเหรียญได้จาก dropdown ด้านบน
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {messages.length === 0 && coin && (
            <p className="text-xs text-muted text-center mt-8 leading-relaxed px-2">
              ถามเกี่ยวกับ <span className="text-ink font-semibold">{coin.symbol}</span> ได้เรื่อง RSI,
              MACD, EMA, Bollinger Bands และข่าวล่าสุด
              <br />
              เช่น &quot;MACD บอกอะไร?&quot; หรือ &quot;ข่าวอะไรทำให้ราคาขยับ?&quot;
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-[11px] leading-relaxed font-sans rounded-xl px-4 py-3 max-w-[90%] ${
                m.role === "user"
                  ? "bg-ink/6 text-ink self-end"
                  : "bg-panel border border-line text-ink self-start"
              }`}
            >
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="bg-panel border border-line text-muted text-sm rounded-xl px-4 py-3 self-start">
              <span className="animate-pulse">กำลังคิด…</span>
            </div>
          )}
          {error && (
            <div className="text-xs text-coral text-center py-1">{error}</div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t border-line flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="พิมพ์คำถาม…"
            className="flex-1 bg-ink/6 text-ink placeholder-muted rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-mint/30"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-mint hover:bg-mint/90 disabled:opacity-40 text-base rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
          >
            ส่ง
          </button>
        </div>
      </div>
    </>
  );
}
