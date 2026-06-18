interface Props {
  className?: string;
  /** Icon + "Crypto" (ink) + "Lens" (mint) — matches brand wordmark. */
  wordmark?: boolean;
  iconClassName?: string;
  textClassName?: string;
}

function LogoMark({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <circle
        cx="24"
        cy="24"
        r="21"
        stroke="var(--color-mint)"
        strokeWidth="2"
        strokeDasharray="98 30"
        strokeLinecap="round"
      />
      <g stroke="var(--color-mint)" strokeWidth="1.6" opacity="0.85">
        <path d="M24 9 L33 16" />
        <path d="M37.5 21 L31 30" />
        <path d="M30 38 L19 35" />
        <path d="M12.5 33 L17 22" />
        <path d="M9 19 L20 16" />
      </g>
      <rect x="22.4" y="16" width="3.2" height="16" rx="1.4" fill="var(--color-mint)" />
      <rect
        x="20.6"
        y="20"
        width="6.8"
        height="8"
        rx="1.6"
        fill="var(--color-base)"
        stroke="var(--color-mint)"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/** CryptoLens brand mark — aperture lens icon (+ optional wordmark). */
export default function Logo({
  className,
  wordmark = false,
  iconClassName = "w-6 h-6",
  textClassName = "text-base font-bold tracking-tight",
}: Props) {
  if (!wordmark) {
    return <LogoMark className={iconClassName} />;
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark className={iconClassName} />
      <span className={textClassName}>
        <span className="text-ink">Crypto</span>
        <span className="text-mint">Lens</span>
      </span>
    </span>
  );
}
