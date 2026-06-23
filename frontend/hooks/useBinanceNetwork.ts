"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBinanceNetwork, getBinanceKeysStatus } from "@/lib/api";

export type PortfolioMode = "demo" | "testnet";

export function useBinanceNetwork() {
  const [portfolioMode, setPortfolioMode] = useState<PortfolioMode>("demo");
  const [linked, setLinked] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [net, keys] = await Promise.all([
        fetchBinanceNetwork(),
        getBinanceKeysStatus().catch(() => ({ linked: false as const })),
      ]);
      setPortfolioMode(net.portfolio_mode ?? (net.use_testnet ? "testnet" : "demo"));
      setLinked(keys.linked);
      setMaskedKey(keys.api_key_masked ?? null);
    } catch {
      /* keep previous values */
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("cryptolens_network_changed", onChange);
    window.addEventListener("cryptolens_binance_keys_changed", onChange);
    return () => {
      window.removeEventListener("cryptolens_network_changed", onChange);
      window.removeEventListener("cryptolens_binance_keys_changed", onChange);
    };
  }, [refresh]);

  return {
    portfolioMode,
    isDemo: portfolioMode === "demo",
    useTestnet: portfolioMode === "testnet",
    linked,
    maskedKey,
    ready,
    refresh,
  };
}
