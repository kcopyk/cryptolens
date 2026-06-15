"use client";

import { useEffect, useState, useCallback } from "react";
import {
  saveBinanceKeys,
  deleteBinanceKeys,
  getBinanceKeysStatus,
  getBackendConfig,
} from "@/lib/api";
import { NetworkEnvBadge } from "@/components/AppHeader";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleUser: { name: string; email: string; avatar: string } | null;
  setGoogleUser: (user: { name: string; email: string; avatar: string } | null) => void;
  onKeysChanged: () => void;
}

function KeyLinkForm({ onSuccess }: { onSuccess: (masked: string) => void }) {
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !secretKey.trim()) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await saveBinanceKeys(apiKey.trim(), secretKey.trim());
      setSuccess("เชื่อมต่อสำเร็จ!");

      const key = apiKey.trim();
      const masked = key.length > 8 ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : "****";

      setTimeout(() => {
        onSuccess(masked);
      }, 1000);
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อคีย์");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
      {error && (
        <div className="p-3 bg-red-950/40 border border-red-900/30 text-red-400 rounded-xl leading-relaxed">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 rounded-xl leading-relaxed">
          {success}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Binance API Key</label>
        <input
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="วาง API Key ที่นี่"
          required
          disabled={loading}
          className="w-full bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 focus:border-zinc-600 rounded-xl px-4 py-2.5 text-xs text-zinc-100 outline-none transition-all font-mono"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Binance Secret Key</label>
        <input
          type="password"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder="วาง Secret Key ที่นี่"
          required
          disabled={loading}
          className="w-full bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 focus:border-zinc-600 rounded-xl px-4 py-2.5 text-xs text-zinc-100 outline-none transition-all font-mono"
        />
      </div>

      <div className="p-3 bg-zinc-900/20 border border-zinc-900 rounded-xl space-y-1">
        <p className="text-[10px] text-zinc-500 leading-relaxed font-semibold">
          💡 ข้อแนะนำการตั้งค่าสิทธิ์บน Binance:
        </p>
        <ul className="text-[10px] text-zinc-500 list-disc list-inside space-y-0.5 leading-relaxed pl-1">
          <li>เลือกสิทธิ์ <span className="text-zinc-400 font-medium">Enable Spot & Margin Trading</span></li>
          <li><span className="text-red-400/90 font-medium">ห้ามเปิดสิทธิ์</span> <span className="text-zinc-400 font-medium">Enable Withdrawals</span> (ระบบจะบล็อก)</li>
          <li>แนะนำเชื่อมต่อบน Binance Spot Testnet</li>
        </ul>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>กำลังตรวจสอบสิทธิ์คีย์...</span>
          </>
        ) : (
          <span>เชื่อมต่อและตรวจสอบคีย์ (Link & Verify Keys)</span>
        )}
      </button>
    </form>
  );
}

export default function SettingsModal({
  isOpen,
  onClose,
  googleUser,
  setGoogleUser,
  onKeysChanged,
}: SettingsModalProps) {
  const [keyStatus, setKeyStatus] = useState<{
    linked: boolean;
    api_key_masked?: string;
    is_mainnet?: boolean;
  } | null>(null);
  const [backendConfig, setBackendConfig] = useState<{
    is_mainnet: boolean;
    base_url: string;
  } | null>(null);

  const loadSettingsData = useCallback(async () => {
    try {
      const [statusRes, configRes] = await Promise.allSettled([
        getBinanceKeysStatus(),
        getBackendConfig(),
      ]);
      if (statusRes.status === "fulfilled") setKeyStatus(statusRes.value);
      if (configRes.status === "fulfilled") setBackendConfig(configRes.value);
    } catch (err) {
      console.error("Failed to load key/config status in modal", err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSettingsData();
    }
  }, [isOpen, loadSettingsData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-down flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-900 flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-zinc-100 font-sans">การตั้งค่าการเชื่อมต่อ (Settings)</h2>
            <p className="text-[11px] text-zinc-500 font-sans mt-0.5">เชื่อมต่อบัญชี Google และ API Key ของ Binance</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 text-xl font-bold p-1 cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Section 1: Google Authentication */}
          <div className="space-y-3">
            <h3 className="text-[14px] font-bold text-zinc-300 font-sans">1. บัญชีผู้ใช้งาน (User Account)</h3>
            {!googleUser ? (
              <div className="border border-dashed border-zinc-800 rounded-xl p-5 text-center space-y-3 bg-zinc-900/20">
                <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                  ลงชื่อเข้าใช้งานด้วย Google เพื่อบันทึกการตั้งค่า API Key แบบเข้ารหัสของคุณบนเซิร์ฟเวอร์
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
                  className="inline-flex items-center gap-2 bg-white hover:bg-zinc-100 text-zinc-950 text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-md"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              </div>
            ) : (
              <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/40 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-sm font-bold text-white shadow-inner">
                    {googleUser.avatar}
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-zinc-100 font-sans">{googleUser.name}</p>
                    <p className="text-[11px] text-zinc-500 font-sans">{googleUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setGoogleUser(null);
                    localStorage.removeItem("cryptolens_google_user");
                    window.dispatchEvent(new Event("cryptolens_auth_changed"));
                  }}
                  className="text-xs text-red-400 hover:text-red-300 font-medium px-3 py-1.5 rounded-lg border border-red-950/60 bg-red-950/20 hover:bg-red-950/40 transition-all cursor-pointer"
                >
                  ออกจากระบบ (Sign Out)
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Binance Key Vault */}
          <div className="space-y-3 pt-3 border-t border-zinc-900">
            <h3 className="text-[14px] font-bold text-zinc-300 font-sans">2. การเชื่อมต่อกุญแจ Binance API</h3>

            {!googleUser ? (
              <div className="border border-zinc-900 rounded-xl p-5 text-center bg-zinc-950 text-zinc-600 text-[11px] font-sans">
                🔒 กรุณาลงชื่อเข้าใช้งานเพื่อเริ่มผูกบัญชี API Keys
              </div>
            ) : keyStatus?.linked ? (
              <div className="border border-emerald-950/40 bg-emerald-950/5 rounded-xl p-4 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-emerald-400">เชื่อมต่อ API Key สำเร็จ</p>
                      <NetworkEnvBadge isMainnet={!!keyStatus.is_mainnet} />
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono">
                      API Key: <span className="text-zinc-200 font-semibold">{keyStatus.api_key_masked}</span>
                    </p>
                    <p className="text-[10px] text-zinc-500 font-sans leading-relaxed">
                      * ระบบได้ตั้งค่าตรวจสอบสิทธิ์แบบ <span className="text-emerald-500 font-medium">Trade Only (Spot)</span> และจำกัด <span className="text-red-500 font-medium">ปิดสิทธิ์การถอนเงิน (Withdrawal Disabled)</span> เพื่อป้องกันความเสี่ยงอย่างเป็นระบบเรียบร้อยแล้ว
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await deleteBinanceKeys();
                        setKeyStatus({ linked: false });
                        onKeysChanged();
                      } catch (e: any) {
                        alert(e.message || "Failed to delete keys");
                      }
                    }}
                    className="w-full text-xs font-semibold text-red-400 hover:text-red-300 border border-red-950/60 bg-red-950/20 hover:bg-red-950/40 py-2.5 rounded-xl transition-all cursor-pointer text-center"
                  >
                    ยกเลิกการผูก API Key (Disconnect)
                  </button>
                </div>
              </div>
            ) : (
              <KeyLinkForm
                onSuccess={(maskedKey) => {
                  setKeyStatus({
                    linked: true,
                    api_key_masked: maskedKey,
                    is_mainnet: backendConfig?.is_mainnet ?? false
                  });
                  onKeysChanged();
                }}
              />
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-900 bg-zinc-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs font-bold bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
