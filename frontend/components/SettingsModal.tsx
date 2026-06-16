"use client";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  googleUser: { name: string; email: string; avatar: string } | null;
  setGoogleUser: (user: { name: string; email: string; avatar: string } | null) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  googleUser,
  setGoogleUser,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-panel border border-line rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-down flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-ink font-sans">บัญชีผู้ใช้ (Account)</h2>
            <p className="text-[11px] text-muted font-sans mt-0.5">
              ลงชื่อเข้าใช้เพื่อบันทึกพอร์ตและรับสรุปรายวัน
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-ink text-xl font-bold p-1 cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Modal Content */}
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
                  ออกจากระบบ (Sign Out)
                </button>
              </div>
            )}
          </div>

          <div className="border border-line rounded-xl p-4 bg-panel/20 space-y-1.5">
            <p className="text-[11px] text-ink font-semibold">CryptoLens ไม่แตะเงินของคุณ</p>
            <p className="text-[10px] text-muted leading-relaxed">
              เราไม่ยิงออเดอร์และไม่ถือ API key เทรดของคุณ — เมื่ออยากลงมือ ปุ่ม
              &quot;เทรดบน Binance&quot; จะพาไปทำเองบนบัญชี Binance ของคุณ
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-line bg-panel/60 flex justify-end">
          <button
            onClick={onClose}
            className="text-xs font-bold bg-ink/6 hover:bg-ink/10 text-ink border border-line hover:border-mint/30 px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
