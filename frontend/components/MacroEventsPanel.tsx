"use client";

import { useEffect, useState } from "react";
import {
  CATEGORY_LABEL,
  MacroEvent,
  MacroEventCategory,
  SOURCE_HUBS,
  formatEventWhenThai,
  formatUsOfficialSchedule,
  getCountdown,
  getEventLinks,
  getEventPhase,
  getNextMacroEvent,
  getUpcomingMacroEvents,
} from "@/lib/macroEvents";

function ExternalIcon() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function EventLinks({ event }: { event: MacroEvent }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const links = getEventLinks(event, now);

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {links.map((link) => (
        <a
          key={link.url + link.label}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-mint border border-mint/25 bg-mint/8 hover:bg-mint/15 px-3 py-1.5 rounded-lg transition-colors"
        >
          {link.label}
          <ExternalIcon />
        </a>
      ))}
    </div>
  );
}

function categoryBadgeClass(cat: MacroEventCategory): string {
  if (cat === "fomc") return "text-mint border-mint/30 bg-mint/10";
  if (cat === "cpi") return "text-warn border-warn/30 bg-warn/10";
  if (cat === "nfp") return "text-ink border-line bg-panel/80";
  return "text-muted border-line bg-panel/60";
}

function EventSchedule({ event, hero }: { event: MacroEvent; hero?: boolean }) {
  const us = formatUsOfficialSchedule(event.usRelease);
  const thai = formatEventWhenThai(event.at);

  return (
    <div className={`flex flex-col gap-2 ${hero ? "" : "gap-1.5"}`}>
      <div
        className={`rounded-xl border border-line bg-base/40 ${
          hero ? "px-4 py-3" : "px-3 py-2"
        }`}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
          วันประกาศตามตาราง BLS/Fed
        </p>
        <p className={`font-semibold text-ink leading-snug ${hero ? "text-base" : "text-sm"}`}>
          {us.dateLine}
        </p>
        <p className={`font-bold text-ink font-mono tabular-nums ${hero ? "text-xl mt-1" : "text-base mt-0.5"}`}>
          {us.timeLine}
        </p>
      </div>

      <div
        className={`rounded-xl border border-mint/25 bg-mint/5 ${
          hero ? "px-4 py-3" : "px-3 py-2"
        }`}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-mint mb-1">
          แปลเป็นเวลาไทย (GMT+7)
        </p>
        <p className={`font-semibold text-ink leading-snug ${hero ? "text-base" : "text-sm"}`}>
          {thai.dateLine}
        </p>
        <p className={`font-bold text-mint font-mono tabular-nums ${hero ? "text-2xl mt-1" : "text-lg mt-0.5"}`}>
          {thai.timeLine}
        </p>
      </div>
    </div>
  );
}

function CountdownDigits({ at, large }: { at: string; large?: boolean }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const phase = getEventPhase(at, now);
  const { days, hours, minutes, seconds } = getCountdown(at, now);

  if (phase === "live") {
    return (
      <span className="inline-flex items-center gap-2 text-warn font-bold">
        <span className="live-dot w-2! h-2!" aria-hidden />
        กำลังจะประกาศ / ประกาศแล้ว
      </span>
    );
  }

  const box = large ? "min-w-[4.5rem] px-3 py-2" : "min-w-[3rem] px-2 py-1.5";
  const num = large ? "text-2xl sm:text-3xl" : "text-lg";
  const lbl = large ? "text-[10px]" : "text-[9px]";

  const units = [
    { v: days, l: "วัน" },
    { v: hours, l: "ชม." },
    { v: minutes, l: "น." },
    { v: seconds, l: "วิ." },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <p className={`text-muted ${large ? "text-xs" : "text-[10px]"}`}>
        นับถอยหลังจนถึงเวลาไทยด้านบน
      </p>
      <div className="flex items-center gap-1.5 sm:gap-2 font-mono tabular-nums">
        {units.map(({ v, l }, i) => (
          <span key={l} className="flex items-center gap-1.5 sm:gap-2">
            {i > 0 && <span className={`text-muted ${large ? "text-lg" : "text-sm"}`}>:</span>}
            <span className={`flex flex-col items-center rounded-xl border border-line bg-base/50 ${box}`}>
              <span className={`font-bold text-ink leading-none ${num}`}>{String(v).padStart(2, "0")}</span>
              <span className={`text-muted uppercase tracking-wider mt-0.5 ${lbl}`}>{l}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function EventRow({ event, hero }: { event: MacroEvent; hero?: boolean }) {
  const phase = getEventPhase(event.at);

  return (
    <article
      className={`rounded-2xl border flex flex-col gap-3 ${
        hero
          ? "border-mint/25 bg-linear-to-br from-mint/10 via-panel/70 to-panel/50 p-5 sm:p-6"
          : "border-line bg-panel/40 p-4"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5 border ${categoryBadgeClass(event.category)}`}
          >
            {CATEGORY_LABEL[event.category]}
          </span>
          {event.impact === "high" && (
            <span className="text-[10px] text-coral/90 font-semibold">ผลกระทบสูง</span>
          )}
          {phase === "live" && (
            <span className="text-[10px] text-warn font-bold uppercase tracking-wide">Live</span>
          )}
        </div>
      </div>

      <div>
        <h3 className={`font-bold text-ink ${hero ? "text-xl sm:text-2xl" : "text-[15px]"}`}>
          {event.title}
        </h3>
        <p className="text-[13px] text-muted mt-0.5">{event.subtitle}</p>
      </div>

      <EventSchedule event={event} hero={hero} />

      <CountdownDigits at={event.at} large={hero} />

      <p className={`text-muted leading-relaxed ${hero ? "text-[14px]" : "text-[13px]"}`}>
        {event.why}
      </p>

      <EventLinks event={event} />
    </article>
  );
}

export default function MacroEventsPanel() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="h-48 rounded-2xl bg-line animate-pulse" />
        <div className="h-28 rounded-2xl bg-line animate-pulse" />
      </div>
    );
  }

  const now = new Date();
  const next = getNextMacroEvent(now);
  const upcoming = getUpcomingMacroEvents(now);
  const rest = upcoming.slice(1);

  if (!next) {
    return (
      <div className="rounded-2xl border border-line bg-panel/40 p-8 text-center text-muted">
        <p className="text-sm">ยังไม่มีข่าวใหญ่ที่กำหนดไว้ — จะอัปเดตเร็ว ๆ นี้</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold text-ink">นับถอยหลังข่าวใหญ่</h1>
        <p className="text-[13px] text-muted mt-1 max-w-xl">
          วันที่จากตาราง BLS/Fed ก่อน แล้วแปลเป็น<strong className="text-ink font-medium"> เวลาไทย (GMT+7)</strong> · ไม่ใช่คำแนะนำซื้อ/ขาย
        </p>
      </div>

      <EventRow event={next} hero />

      {rest.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-ink mb-3">ถัดไป</h2>
          <ul className="flex flex-col gap-3">
            {rest.map((event) => (
              <li key={event.id}>
                <EventRow event={event} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-panel/30 p-4">
        <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
          แหล่งข้อมูลอย่างเป็นทางการ
        </h2>
        <div className="flex flex-wrap gap-2">
          {Object.values(SOURCE_HUBS).map((hub) => (
            <a
              key={hub.url}
              href={hub.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-mint transition-colors"
            >
              {hub.label}
              <ExternalIcon />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
