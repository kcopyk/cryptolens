"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteBinanceKeys,
  fetchBinanceNetwork,
  getBinanceKeysStatus,
  saveBinanceKeys,
  setPortfolioMode,
  type PortfolioMode,
} from "@/lib/api";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleUser: { name: string; email: string; avatar: string } | null;
  setGoogleUser: (user: { name: string; email: string; avatar: string } | null) => void;
  /** Called after portfolio mode or Binance keys change. */
  onBinanceKeysChanged?: (holdings?: import("@/lib/api").Holding[]) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  googleUser,
  setGoogleUser,
  onBinanceKeysChanged,
}: SettingsModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [linked, setLinked] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [portfolioMode, setPortfolioModeState] = useState<PortfolioMode>("demo");
  const [keyBusy, setKeyBusy] = useState(false);
  const [networkBusy, setNetworkBusy] = useState(false);
  const [keyMsg, setKeyMsg] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  const loadKeyStatus = useCallback(async () => {
    try {
      const [status, network] = await Promise.all([
        getBinanceKeysStatus(),
        fetchBinanceNetwork(),
      ]);
      setLinked(status.linked);
      setMaskedKey(status.api_key_masked ?? null);
      setPortfolioModeState(
        network.portfolio_mode ?? status.portfolio_mode ?? (network.use_testnet ? "testnet" : "demo")
      );
    } catch {
      setLinked(false);
      setMaskedKey(null);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadKeyStatus();
      setKeyMsg(null);
      setKeyError(null);
    }
  }, [isOpen, loadKeyStatus]);

  const handleModeChange = async (mode: PortfolioMode) => {
    if (mode === portfolioMode) return;
    setNetworkBusy(true);
    setKeyError(null);
    setKeyMsg(null);
    try {
      const res = await setPortfolioMode(mode);
      setPortfolioModeState(mode);
      setKeyMsg(
        mode === "demo"
          ? "โหมด Demo — เพิ่ม/ลบเหรียญได้ · ไม่ซิงก์ Binance"
          : "โหมด Testnet — เชื่อม API แล้วกดซิงก์พอร์ตได้"
      );
      onBinanceKeysChanged?.(res.holdings);
      window.dispatchEvent(new Event("cryptolens_network_changed"));
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : "เปลี่ยนโหมดไม่สำเร็จ");
    } finally {
      setNetworkBusy(false);
    }
  };

  const handleSaveKeys = async () => {
    if (!apiKey.trim() || !secretKey.trim()) {
      setKeyError("ใส่ API Key และ Secret Key");
      return;
    }
    setKeyBusy(true);
    setKeyError(null);
    setKeyMsg(null);
    try {
      const res = await saveBinanceKeys(apiKey.trim(), secretKey.trim());
      setKeyMsg(res.message ?? "เชื่อมต่อสำเร็จ");
      setApiKey("");
      setSecretKey("");
      await loadKeyStatus();
      onBinanceKeysChanged?.();
      window.dispatchEvent(new Event("cryptolens_binance_keys_changed"));
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : "เชื่อมต่อไม่สำเร็จ");
    } finally {
      setKeyBusy(false);
    }
  };

  const handleUnlink = async () => {
    setKeyBusy(true);
    setKeyError(null);
    setKeyMsg(null);
    try {
      await deleteBinanceKeys();
      setKeyMsg("ยกเลิกการเชื่อมแล้ว");
      await loadKeyStatus();
      onBinanceKeysChanged?.();
      window.dispatchEvent(new Event("cryptolens_binance_keys_changed"));
    } catch (e) {
      setKeyError(e instanceof Error ? e.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setKeyBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-panel border border-line rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-down flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-ink font-sans">การตั้งค่า</h2>
            <p className="text-[11px] text-muted font-sans mt-0.5">
              บัญชี + เชื่อม Binance อ่านยอด Spot
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-xl font-bold p-1 cursor-pointer"
          >
            ×
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="space-y-3">
            {!googleUser ? (
              <div className="border border-dashed border-line rounded-xl p-5 text-center space-y-3 bg-panel/20">
                <p className="text-[11px] text-muted font-sans leading-relaxed">
                  ลงชื่อเข้าใช้งานด้วย Google เพื่อบันทึกพอร์ตของคุณบนเซิร์ฟเวอร์
                  และซิงก์สรุปรายวันข้ามอุปกรณ์
                </p>
                <button
                  onClick={() => {
                    const mockUser = {
                      name: "Nutchapuk Dev",
                      email: "nutchapuk.dev@gmail.com",
                      avatar: "ND",
                    };
                    setGoogleUser(mockUser);
                    localStorage.setItem("cryptolens_google_user", JSON.stringify(mockUser));
                    window.dispatchEvent(new Event("cryptolens_auth_changed"));
                  }}
                  className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-base text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-md"
                >
                  <span>Sign in with Google</span>
                </button>
              </div>
            ) : (
              <div className="border border-line rounded-xl p-4 bg-panel/40 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-sm font-bold text-base shadow-inner">
                    {googleUser.avatar}
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-ink font-sans">{googleUser.name}</p>
                    <p className="text-[11px] text-muted font-sans">{googleUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setGoogleUser(null);
                    localStorage.removeItem("cryptolens_google_user");
                    window.dispatchEvent(new Event("cryptolens_auth_changed"));
                  }}
                  className="text-xs text-coral hover:text-coral/80 font-medium px-3 py-1.5 rounded-lg border border-coral/30 bg-coral/10 hover:bg-coral/20 transition-all cursor-pointer"
                >
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>

          <div className="border border-line rounded-xl p-4 bg-panel/20 space-y-3">
            <div>
              <p className="text-[11px] font-semibold text-ink">โหมดพอร์ต</p>
              <p className="text-[10px] text-muted mt-0.5">
                Demo = กรอกพอร์ตเองสำหรับนำเสนอ · Testnet = ซิงก์จาก Binance Testnet ได้ด้วย
              </p>
            </div>
            <div className="flex rounded-lg border border-line overflow-hidden">
              {(["demo", "testnet"] as const).map((mode) => {
                const active = portfolioMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={networkBusy}
                    onClick={() => handleModeChange(mode)}
                    className={`flex-1 px-3 py-2 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                      active
                        ? mode === "testnet"
                          ? "bg-warn/15 text-warn"
                          : "bg-mint/15 text-mint"
                        : "bg-base text-muted hover:text-ink"
                    }`}
                  >
                    {mode === "demo" ? "Demo (default)" : "Testnet"}
                  </button>
                );
              })}
            </div>

            {portfolioMode === "testnet" && (
              <>
            <div>
              <p className="text-[12px] font-bold text-ink">ซิงก์พอร์ตจาก Binance</p>
              <p className="text-[10px] text-muted leading-relaxed mt-1">
                Read-only API key (Enable Reading · ปิด Withdrawal) — testnet.binance.vision
              </p>
            </div>

            {linked && maskedKey ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-mint/20 bg-mint/5 px-3 py-2.5">
                <div>
                  <p className="text-[11px] text-mint font-semibold">เชื่อมแล้ว</p>
                  <p className="text-[10px] text-muted font-mono">{maskedKey}</p>
                </div>
                <button
                  type="button"
                  onClick={handleUnlink}
                  disabled={keyBusy}
                  className="text-[10px] text-coral border border-coral/30 px-2.5 py-1.5 rounded-lg hover:bg-coral/10 disabled:opacity-50"
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="API Key"
                  autoComplete="off"
                  className="w-full bg-base border border-line rounded-lg px-3 py-2 text-xs text-ink placeholder:text-muted outline-none focus:border-mint/40 font-mono"
                />
                <input
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="Secret Key"
                  type="password"
                  autoComplete="off"
                  className="w-full bg-base border border-line rounded-lg px-3 py-2 text-xs text-ink placeholder:text-muted outline-none focus:border-mint/40 font-mono"
                />
                <button
                  type="button"
                  onClick={handleSaveKeys}
                  disabled={keyBusy}
                  className="w-full py-2.5 rounded-lg text-xs font-bold bg-mint text-base hover:bg-mint/90 disabled:opacity-50"
                >
                  {keyBusy ? "กำลังเชื่อม…" : "เชื่อม Binance"}
                </button>
              </div>
            )}

              </>
            )}

            {keyMsg && <p className="text-[10px] text-mint">{keyMsg}</p>}
            {keyError && <p className="text-[10px] text-coral">{keyError}</p>}
          </div>

          <div className="border border-line rounded-xl p-4 bg-panel/20 space-y-1.5">
            <p className="text-[11px] text-ink font-semibold">CryptoLens ไม่แตะเงินของคุณ</p>
            <p className="text-[10px] text-muted leading-relaxed">
              เราไม่ยิงออเดอร์ — เมื่ออยากลงมือ ปุ่ม &quot;เทรดบน Binance&quot; จะพาไปทำเองบนบัญชีของคุณ
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-line bg-panel/60 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs font-bold bg-ink/6 hover:bg-ink/10 text-ink border border-line hover:border-mint/30 px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
