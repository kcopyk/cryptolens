"use client";

import AppHeader from "@/components/AppHeader";
import AppNav from "@/components/AppNav";
import MacroEventsPanel from "@/components/MacroEventsPanel";
import PriceScrollTicker from "@/components/PriceScrollTicker";

export default function EventsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <AppNav />
      <PriceScrollTicker />

      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <MacroEventsPanel />
      </main>

      <footer className="px-6 py-3 border-t border-line text-xs text-muted text-center">
        เวลาประกาศอ้างอิงตาราง Fed / BLS · แสดงเป็นเวลาไทย (GMT+7) · อาจเลื่อนได้ — ไม่ใช่คำแนะนำการลงทุน
      </footer>
    </div>
  );
}
