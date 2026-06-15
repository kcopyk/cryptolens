"use client";

import { useState, useRef, useEffect } from "react";
import { Coin, askCoin } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface Props {
  coin: Coin | null;
  onClose: () => void;
}

export default function ChatPanel({ coin, onClose }: Props) {
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
          className="fixed inset-0 bg-black/40 z-30"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-zinc-950 border-l border-zinc-800 z-40 flex flex-col transition-transform duration-300 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              ถามเกี่ยวกับ {coin?.symbol}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">ตอบจากข้อมูล ณ เวลาที่โหลด</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 text-xl leading-none px-2"
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <p className="text-xs text-zinc-600 text-center mt-8 leading-relaxed px-2">
              ถามได้เรื่อง RSI, MACD, EMA, Bollinger Bands และข่าวล่าสุด
              <br />
              เช่น &quot;MACD บอกอะไร?&quot; หรือ &quot;ข่าวอะไรทำให้ราคาขยับ?&quot;
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-[11px] leading-relaxed font-sans rounded-xl px-4 py-3 max-w-[90%] ${
                m.role === "user"
                  ? "bg-zinc-800 text-zinc-100 self-end"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-200 self-start"
              }`}
            >
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="bg-zinc-900 border border-zinc-800 text-zinc-500 text-sm rounded-xl px-4 py-3 self-start">
              <span className="animate-pulse">กำลังคิด…</span>
            </div>
          )}
          {error && (
            <div className="text-xs text-red-400 text-center py-1">{error}</div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="พิมพ์คำถาม…"
            className="flex-1 bg-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-zinc-600"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-100 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
          >
            ส่ง
          </button>
        </div>
      </div>
    </>
  );
}
