import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CryptoLens Lite",
  description: "AI-native crypto insight dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="h-full">
      <body className="min-h-full bg-zinc-950 text-zinc-100 flex flex-col">{children}</body>
    </html>
  );
}
