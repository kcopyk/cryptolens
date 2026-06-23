interface Props {
  className?: string;
}

/** Visible only when user has Testnet mode enabled for Binance sync. */
export default function BinanceNetworkBadge({ className = "" }: Props) {
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border border-warn/40 bg-warn/10 text-warn ${className}`}
      title="ยอดพอร์ตจาก Binance Testnet · ราคา/Heat ยังเป็น mainnet"
    >
      Testnet
    </span>
  );
}
