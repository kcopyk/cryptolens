"use client";

import { useState } from "react";
import { COIN_META } from "@/lib/portfolio";

interface Props {
  asset: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
};

export default function CoinIcon({ asset, size = "md" }: Props) {
  const [imgError, setImgError] = useState(false);

  // Normalize symbol (e.g. BTC/USDT -> BTC, or BTCUSDT -> BTC)
  const cleanAsset = asset.split("/")[0].trim().toUpperCase();
  const meta = COIN_META[cleanAsset];
  const color = meta?.color ?? "#8b5cf6";
  const label = cleanAsset.slice(0, 2);

  const iconUrl = `https://assets.coincap.io/assets/icons/${cleanAsset.toLowerCase()}@2x.png`;

  if (!imgError && cleanAsset) {
    return (
      <div className={`${SIZES[size]} rounded-full overflow-hidden shrink-0 shadow-sm bg-zinc-800 flex items-center justify-center`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconUrl}
          alt={cleanAsset}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${SIZES[size]} rounded-full flex items-center justify-center font-bold text-white shrink-0 shadow-sm`}
      style={{ backgroundColor: color }}
    >
      {label}
    </div>
  );
}
