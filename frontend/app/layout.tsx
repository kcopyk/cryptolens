import type { Metadata } from "next";
import { Sora, JetBrains_Mono, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-jb",
  display: "swap",
});

const thai = IBM_Plex_Sans_Thai({
  subsets: ["thai"],
  variable: "--font-thai",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CryptoLens Lite",
  description: "AI-native crypto insight dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="h-full">
      <body
        className={`${sora.variable} ${mono.variable} ${thai.variable} min-h-full bg-base text-ink flex flex-col`}
      >
        {children}
      </body>
    </html>
  );
}
