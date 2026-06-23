interface Props {
  className?: string;
}

export default function DemoModeBadge({ className = "" }: Props) {
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border border-line bg-panel2/80 text-muted ${className}`}
      title="โหมด Demo — กรอกพอร์ตเองได้ · ไม่ซิงก์ Binance"
    >
      Demo
    </span>
  );
}
