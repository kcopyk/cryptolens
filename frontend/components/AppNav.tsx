"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "หน้าหลัก" },
  { href: "/events", label: "ข่าวใหญ่" },
] as const;

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b border-line bg-base/60 px-4 sm:px-6">
      {TABS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`relative px-3 py-2.5 text-xs font-semibold transition-colors ${
              active ? "text-mint" : "text-muted hover:text-ink"
            }`}
          >
            {label}
            {active && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-mint" aria-hidden />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
