/** Curated high-impact macro events for crypto holders — update quarterly. */

export type MacroEventCategory = "fomc" | "cpi" | "nfp" | "fed";

/** Official US release slot from BLS/Fed calendar (America/New_York). */
export interface UsReleaseSchedule {
  /** YYYY-MM-DD on the official announcement calendar */
  date: string;
  hour: number;
  minute: number;
}

export interface MacroEvent {
  id: string;
  category: MacroEventCategory;
  title: string;
  subtitle: string;
  /** Authoritative US calendar date/time — enter from BLS/Fed, then derive `at`. */
  usRelease: UsReleaseSchedule;
  /** UTC ISO — derived from `usRelease` via America/New_York (EDT/EST). */
  at: string;
  impact: "high" | "medium";
  why: string;
  /** Official source — calendar, release, or live page */
  sourceUrl: string;
  sourceLabel: string;
  /** Optional live stream (FOMC press conference) */
  liveUrl?: string;
}

export const SOURCE_HUBS = {
  fomcCalendar: {
    url: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    label: "ตาราง FOMC ทั้งหมด · Fed",
  },
  fomcLive: {
    url: "https://www.federalreserve.gov/live-broadcast.htm",
    label: "ถ่ายทอดสด Fed",
  },
  cpiSchedule: {
    url: "https://www.bls.gov/schedule/news_release/cpi.htm",
    label: "ตาราง CPI · BLS",
  },
  nfpSchedule: {
    url: "https://www.bls.gov/schedule/news_release/empsit.htm",
    label: "ตาราง NFP · BLS",
  },
} as const;

export const CATEGORY_LABEL: Record<MacroEventCategory, string> = {
  fomc: "FOMC",
  cpi: "CPI",
  nfp: "Non-Farm Payrolls",
  fed: "Fed",
};

/** Convert 08:30 or 14:00 America/New_York on `dateYmd` → UTC ISO (handles EDT/EST). */
function easternTimeToUtcIso(dateYmd: string, hour: number, minute: number): string {
  const [y, mo, d] = dateYmd.split("-").map(Number);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const matches = (iso: string): boolean => {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
    return (
      Number(parts.year) === y &&
      Number(parts.month) === mo &&
      Number(parts.day) === d &&
      Number(parts.hour) === hour &&
      Number(parts.minute) === minute
    );
  };

  for (let utcH = 10; utcH <= 21; utcH++) {
    const candidate = `${dateYmd}T${String(utcH).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`;
    if (matches(candidate)) return candidate;
  }
  throw new Error(`Cannot resolve America/New_York ${dateYmd} ${hour}:${String(minute).padStart(2, "0")}`);
}

/** BLS standard release — 08:30 AM Eastern */
const BLS_RELEASE_TIME = { hour: 8, minute: 30 } as const;

/** FOMC statement — 02:00 PM Eastern (day 2 of meeting) */
const FOMC_RELEASE_TIME = { hour: 14, minute: 0 } as const;

function usReleaseAt(date: string, time: { hour: number; minute: number }): string {
  return easternTimeToUtcIso(date, time.hour, time.minute);
}

function macroEvent(
  base: Omit<MacroEvent, "at"> & { usRelease: UsReleaseSchedule }
): MacroEvent {
  return {
    ...base,
    at: usReleaseAt(base.usRelease.date, base.usRelease),
  };
}

/**
 * `usRelease.date` = official BLS/Fed calendar date (verify quarterly):
 * - NFP: https://www.bls.gov/schedule/news_release/empsit.htm
 * - CPI: https://www.bls.gov/schedule/news_release/cpi.htm
 * - FOMC: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
 *
 * `at` is always derived from `usRelease` — never the other way around.
 */
export const MACRO_EVENTS: MacroEvent[] = [
  macroEvent({
    id: "fomc-2026-06",
    category: "fomc",
    title: "FOMC ประกาศอัตราดอกเบี้ย",
    subtitle: "Fed · การประชุม 16–17 มิ.ย. 2026",
    usRelease: { date: "2026-06-17", ...FOMC_RELEASE_TIME },
    impact: "high",
    why: "คำชี้แจง Fed มักขยับ BTC/ETH รุนแรง — volatility สูง 1–2 ชม.หลังประกาศ",
    sourceUrl: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260617a.htm",
    sourceLabel: "ประกาศ FOMC · Fed",
    liveUrl: "https://www.federalreserve.gov/live-broadcast.htm",
  }),
  macroEvent({
    id: "nfp-2026-07",
    category: "nfp",
    title: "Non-Farm Payrolls (NFP)",
    subtitle: "BLS · ข้อมูลเดือน มิ.ย. 2026",
    usRelease: { date: "2026-07-02", ...BLS_RELEASE_TIME },
    impact: "high",
    why: "ตัวเลขจ้างงานแรง → ตลาดคาด Fed เร่ง/ชะลอ — กระทบ risk assets รวมคริปโต",
    sourceUrl: "https://www.bls.gov/schedule/news_release/empsit.htm",
    sourceLabel: "ตาราง NFP · BLS",
  }),
  macroEvent({
    id: "cpi-2026-07",
    category: "cpi",
    title: "CPI สหรัฐ",
    subtitle: "BLS · ข้อมูลเดือน มิ.ย. 2026",
    usRelease: { date: "2026-07-14", ...BLS_RELEASE_TIME },
    impact: "high",
    why: "เงินเฟ้อสูงกว่าคาด → ดอลลาร์แข็ง risk-off — BTC มักสั่นช่วง 30 นาทีแรก",
    sourceUrl: "https://www.bls.gov/schedule/news_release/cpi.htm",
    sourceLabel: "ตาราง CPI · BLS",
  }),
  macroEvent({
    id: "fomc-2026-07",
    category: "fomc",
    title: "FOMC ประกาศอัตราดอกเบี้ย",
    subtitle: "Fed · การประชุม 28–29 ก.ค. 2026",
    usRelease: { date: "2026-07-29", ...FOMC_RELEASE_TIME },
    impact: "high",
    why: "จุดจับตาหลักของไตรมาส — dot plot / ถ้อยคำ Powell ขยับ sentiment ทั้งตลาด",
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    sourceLabel: "ตาราง FOMC · Fed",
    liveUrl: "https://www.federalreserve.gov/live-broadcast.htm",
  }),
  macroEvent({
    id: "nfp-2026-08",
    category: "nfp",
    title: "Non-Farm Payrolls (NFP)",
    subtitle: "BLS · ข้อมูลเดือน ก.ค. 2026",
    usRelease: { date: "2026-08-07", ...BLS_RELEASE_TIME },
    impact: "high",
    why: "ข้อมูลจ้างงานรอบแรกหลัง FOMC — ตลาดใช้ re-price ทิศ Fed",
    sourceUrl: "https://www.bls.gov/schedule/news_release/empsit.htm",
    sourceLabel: "ตาราง NFP · BLS",
  }),
  macroEvent({
    id: "cpi-2026-08",
    category: "cpi",
    title: "CPI สหรัฐ",
    subtitle: "BLS · ข้อมูลเดือน ก.ค. 2026",
    usRelease: { date: "2026-08-12", ...BLS_RELEASE_TIME },
    impact: "high",
    why: "CPI ร้อน/เย็นกว่าคาด → ขยับ yield และดัชนีดอลลาร์ กระทบคริปโตทันที",
    sourceUrl: "https://www.bls.gov/schedule/news_release/cpi.htm",
    sourceLabel: "ตาราง CPI · BLS",
  }),
  macroEvent({
    id: "nfp-2026-09",
    category: "nfp",
    title: "Non-Farm Payrolls (NFP)",
    subtitle: "BLS · ข้อมูลเดือน ส.ค. 2026",
    usRelease: { date: "2026-09-04", ...BLS_RELEASE_TIME },
    impact: "high",
    why: "NFP หลัง Labor Day มักขยับตลาดแรง — จับตา risk-on/off หลังตัวเลข",
    sourceUrl: "https://www.bls.gov/schedule/news_release/empsit.htm",
    sourceLabel: "ตาราง NFP · BLS",
  }),
  macroEvent({
    id: "fomc-2026-09",
    category: "fomc",
    title: "FOMC ประกาศอัตราดอกเบี้ย",
    subtitle: "Fed · การประชุม 15–16 ก.ย. 2026",
    usRelease: { date: "2026-09-16", ...FOMC_RELEASE_TIME },
    impact: "high",
    why: "ช่วงกลางปีมักมี volume สูง — ประกาศ Fed ขยับ correlation BTC–Nasdaq",
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    sourceLabel: "ตาราง FOMC · Fed",
    liveUrl: "https://www.federalreserve.gov/live-broadcast.htm",
  }),
  macroEvent({
    id: "cpi-2026-09",
    category: "cpi",
    title: "CPI สหรัฐ",
    subtitle: "BLS · ข้อมูลเดือน ส.ค. 2026",
    usRelease: { date: "2026-09-11", ...BLS_RELEASE_TIME },
    impact: "high",
    why: "ก่อน FOMC ก.ย. — ตลาดใช้ CPI ปรับคาดการณ์ดอกเบี้ย",
    sourceUrl: "https://www.bls.gov/schedule/news_release/cpi.htm",
    sourceLabel: "ตาราง CPI · BLS",
  }),
  macroEvent({
    id: "nfp-2026-10",
    category: "nfp",
    title: "Non-Farm Payrolls (NFP)",
    subtitle: "BLS · ข้อมูลเดือน ก.ย. 2026",
    usRelease: { date: "2026-10-02", ...BLS_RELEASE_TIME },
    impact: "high",
    why: "NFP ต้นเดือน — มัก re-price ทิศ Fed ก่อน FOMC ปลายเดือน",
    sourceUrl: "https://www.bls.gov/schedule/news_release/empsit.htm",
    sourceLabel: "ตาราง NFP · BLS",
  }),
  macroEvent({
    id: "fomc-2026-10",
    category: "fomc",
    title: "FOMC ประกาศอัตราดอกเบี้ย",
    subtitle: "Fed · การประชุม 27–28 ต.ค. 2026",
    usRelease: { date: "2026-10-28", ...FOMC_RELEASE_TIME },
    impact: "high",
    why: "FOMC ปลายปี — มักมี guidance สำหรับปีถัดไป กระทบ risk appetite",
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    sourceLabel: "ตาราง FOMC · Fed",
    liveUrl: "https://www.federalreserve.gov/live-broadcast.htm",
  }),
  macroEvent({
    id: "cpi-2026-10",
    category: "cpi",
    title: "CPI สหรัฐ",
    subtitle: "BLS · ข้อมูลเดือน ก.ย. 2026",
    usRelease: { date: "2026-10-14", ...BLS_RELEASE_TIME },
    impact: "high",
    why: "CPI ก.ย. มักขยับ yield ก่อนช่วง end-of-year positioning",
    sourceUrl: "https://www.bls.gov/schedule/news_release/cpi.htm",
    sourceLabel: "ตาราง CPI · BLS",
  }),
  macroEvent({
    id: "nfp-2026-11",
    category: "nfp",
    title: "Non-Farm Payrolls (NFP)",
    subtitle: "BLS · ข้อมูลเดือน ต.ค. 2026",
    usRelease: { date: "2026-11-06", ...BLS_RELEASE_TIME },
    impact: "high",
    why: "NFP ก่อน FOMC ธ.ค. — ตลาดใช้ประเมิน soft/hard landing",
    sourceUrl: "https://www.bls.gov/schedule/news_release/empsit.htm",
    sourceLabel: "ตาราง NFP · BLS",
  }),
  macroEvent({
    id: "cpi-2026-11",
    category: "cpi",
    title: "CPI สหรัฐ",
    subtitle: "BLS · ข้อมูลเดือน ต.ค. 2026",
    usRelease: { date: "2026-11-10", ...BLS_RELEASE_TIME },
    impact: "high",
    why: "CPI ปลายปี — มักขยับ dollar และ crypto risk appetite",
    sourceUrl: "https://www.bls.gov/schedule/news_release/cpi.htm",
    sourceLabel: "ตาราง CPI · BLS",
  }),
  macroEvent({
    id: "fomc-2026-12",
    category: "fomc",
    title: "FOMC ประกาศอัตราดอกเบี้ย",
    subtitle: "Fed · การประชุม 8–9 ธ.ค. 2026",
    usRelease: { date: "2026-12-09", ...FOMC_RELEASE_TIME },
    impact: "high",
    why: "ประชุมสุดท้ายของปี — summary of economic projections ขยับตลาดรอบปีใหม่",
    sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
    sourceLabel: "ตาราง FOMC · Fed",
    liveUrl: "https://www.federalreserve.gov/live-broadcast.htm",
  }),
  macroEvent({
    id: "nfp-2026-12",
    category: "nfp",
    title: "Non-Farm Payrolls (NFP)",
    subtitle: "BLS · ข้อมูลเดือน พ.ย. 2026",
    usRelease: { date: "2026-12-04", ...BLS_RELEASE_TIME },
    impact: "high",
    why: "NFP สุดท้ายของปี — มักกำหนดทิศ risk assets ช่วง holiday",
    sourceUrl: "https://www.bls.gov/schedule/news_release/empsit.htm",
    sourceLabel: "ตาราง NFP · BLS",
  }),
  macroEvent({
    id: "cpi-2026-12",
    category: "cpi",
    title: "CPI สหรัฐ",
    subtitle: "BLS · ข้อมูลเดือน พ.ย. 2026",
    usRelease: { date: "2026-12-10", ...BLS_RELEASE_TIME },
    impact: "high",
    why: "CPI พ.ย. — ข้อมูลสุดท้ายก่อนปิดปี กระทบ Fed narrative",
    sourceUrl: "https://www.bls.gov/schedule/news_release/cpi.htm",
    sourceLabel: "ตาราง CPI · BLS",
  }),
];

/**
 * Cross-check table — verified against live BLS/Fed pages on 2026-06-18.
 * FOMC release = day 2 of meeting, 2:00 PM Eastern.
 * BLS release = 08:30 AM Eastern.
 */
const OFFICIAL_RELEASE_DATES: Record<string, string> = {
  "fomc-2026-06": "2026-06-17",
  "nfp-2026-07": "2026-07-02",
  "cpi-2026-07": "2026-07-14",
  "fomc-2026-07": "2026-07-29",
  "nfp-2026-08": "2026-08-07",
  "cpi-2026-08": "2026-08-12",
  "nfp-2026-09": "2026-09-04",
  "fomc-2026-09": "2026-09-16",
  "cpi-2026-09": "2026-09-11",
  "nfp-2026-10": "2026-10-02",
  "fomc-2026-10": "2026-10-28",
  "cpi-2026-10": "2026-10-14",
  "nfp-2026-11": "2026-11-06",
  "cpi-2026-11": "2026-11-10",
  "fomc-2026-12": "2026-12-09",
  "nfp-2026-12": "2026-12-04",
  "cpi-2026-12": "2026-12-10",
};

/** Dev/CI guard — throws if hardcoded dates drift from verified table. */
export function assertMacroEventsVerified(): void {
  for (const event of MACRO_EVENTS) {
    const expected = OFFICIAL_RELEASE_DATES[event.id];
    if (!expected) throw new Error(`Missing official date for ${event.id}`);
    if (event.usRelease.date !== expected) {
      throw new Error(`${event.id}: expected ${expected}, got ${event.usRelease.date}`);
    }
  }
}

assertMacroEventsVerified();

const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000;
const PAST_GRACE_MS = 60 * 60 * 1000;

export function getUpcomingMacroEvents(now = new Date()): MacroEvent[] {
  const t = now.getTime();
  return MACRO_EVENTS.filter((e) => new Date(e.at).getTime() + PAST_GRACE_MS > t).sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );
}

export function getNextMacroEvent(now = new Date()): MacroEvent | null {
  return getUpcomingMacroEvents(now)[0] ?? null;
}

export type EventPhase = "upcoming" | "live" | "past";

export function getEventPhase(at: string, now = new Date()): EventPhase {
  const target = new Date(at).getTime();
  const t = now.getTime();
  if (t > target + PAST_GRACE_MS) return "past";
  if (t >= target - LIVE_WINDOW_MS) return "live";
  return "upcoming";
}

export interface CountdownParts {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function getCountdown(at: string, now = new Date()): CountdownParts {
  const totalMs = Math.max(0, new Date(at).getTime() - now.getTime());
  const days = Math.floor(totalMs / 86_400_000);
  const hours = Math.floor((totalMs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  return { totalMs, days, hours, minutes, seconds };
}

const THAI_TZ = "Asia/Bangkok";

export interface ThaiEventTime {
  dateLine: string;
  timeLine: string;
  full: string;
}

/** Official US schedule — from `usRelease` (BLS/Fed calendar), not reverse-calculated. */
export function formatUsOfficialSchedule(usRelease: UsReleaseSchedule): {
  dateLine: string;
  timeLine: string;
  full: string;
} {
  const at = usReleaseAt(usRelease.date, usRelease);
  const d = new Date(at);
  const dateLine = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
  const timeLine = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "America/New_York",
  });
  return { dateLine, timeLine, full: `${dateLine} · ${timeLine}` };
}

/** Display time converted to Thailand (ICT / GMT+7) — derived from official US schedule. */
export function formatEventWhenThai(at: string): ThaiEventTime {
  const d = new Date(at);
  const dateLine = d.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: THAI_TZ,
  });
  const timeLine =
    d.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: THAI_TZ,
    }) + " น.";
  return {
    dateLine,
    timeLine,
    full: `${dateLine} · ${timeLine} (เวลาไทย)`,
  };
}

/** @deprecated use formatUsOfficialSchedule() */
export function formatUsSourceTime(at: string): string {
  const d = new Date(at);
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "America/New_York",
  });
  return `${date} · ${time}`;
}

/** @deprecated use formatEventWhenThai().full */
export function formatEventWhen(at: string): string {
  return formatEventWhenThai(at).full;
}

export interface EventLink {
  url: string;
  label: string;
}

/** Primary + contextual links (live release pages when applicable). */
export function getEventLinks(event: MacroEvent, now = new Date()): EventLink[] {
  const phase = getEventPhase(event.at, now);
  const links: EventLink[] = [];

  if (phase === "live" || phase === "past") {
    if (event.category === "cpi") {
      links.push({
        url: "https://www.bls.gov/news.release/cpi.nr0.htm",
        label: "ดูตัวเลข CPI ล่าสุด",
      });
    } else if (event.category === "nfp") {
      links.push({
        url: "https://www.bls.gov/news.release/empsit.nr0.htm",
        label: "ดูตัวเลข NFP ล่าสุด",
      });
    }
  }

  links.push({ url: event.sourceUrl, label: event.sourceLabel });

  if (event.liveUrl && event.category === "fomc") {
    links.push({ url: event.liveUrl, label: "ถ่ายทอดสด Fed" });
  }

  return links;
}
