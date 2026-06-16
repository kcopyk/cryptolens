interface Props {
  className?: string;
}

/** Aperture-lens brand mark — the "lens" of CryptoLens. */
export default function Logo({ className = "w-8 h-8" }: Props) {
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
