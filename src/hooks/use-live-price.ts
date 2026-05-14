// ── Live price hook ───────────────────────────────────────────────────────────
// Uses chart-saham/1m endpoint — most granular data available on DataSectors.
// Polls every 30s during IDX trading hours (09:00–16:15 WIB, Mon–Fri).
// Outside trading hours: polls every 5 minutes (for pre/post market data).

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { getStockPrice } from "@/lib/datasectors.functions";
import type { StockPrice } from "@/lib/datasectors.functions";

// ── IDX trading hours check (WIB = UTC+7) ────────────────────────────────────
export function isIDXTradingHours(): boolean {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = wib.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false; // weekend

  const h = wib.getUTCHours();
  const m = wib.getUTCMinutes();
  const totalMin = h * 60 + m;

  // Session 1: 09:00–12:00, Session 2: 13:30–16:15
  const s1Start = 9 * 60;
  const s1End   = 12 * 60;
  const s2Start = 13 * 60 + 30;
  const s2End   = 16 * 60 + 15;

  return (totalMin >= s1Start && totalMin < s1End) ||
         (totalMin >= s2Start && totalMin < s2End);
}

export function getRefreshInterval(): number {
  if (isIDXTradingHours()) return 30_000;  // 30s during market hours
  return 5 * 60_000;                        // 5min outside hours
}

// ── Single symbol live price ──────────────────────────────────────────────────
export function useLivePrice(symbol: string) {
  const fn = useServerFn(getStockPrice);

  return useQuery({
    queryKey: ["live-price", symbol.toUpperCase()],
    queryFn: () => fn({ data: { symbol: symbol.toUpperCase() } }),
    staleTime: 25_000,
    refetchInterval: getRefreshInterval,  // dynamic interval
    refetchIntervalInBackground: false,   // pause when tab hidden
    enabled: !!symbol,
  });
}

// ── Multi-symbol live prices (for dashboard / watchlist) ──────────────────────
export function useLivePrices(symbols: string[]) {
  const fn = useServerFn(getStockPrice);
  const qc = useQueryClient();

  // Fetch each symbol individually so they can be cached separately
  const queries = symbols.map(sym => ({
    queryKey: ["live-price", sym.toUpperCase()],
    queryFn: () => fn({ data: { symbol: sym.toUpperCase() } }),
    staleTime: 25_000,
    refetchInterval: getRefreshInterval,
    refetchIntervalInBackground: false,
    enabled: !!sym,
  }));

  // Build a map of symbol → StockPrice
  const priceMap: Record<string, StockPrice> = {};
  for (const sym of symbols) {
    const cached = qc.getQueryData<{ data: StockPrice | null }>(["live-price", sym.toUpperCase()]);
    if (cached?.data) priceMap[sym.toUpperCase()] = cached.data;
  }

  return { priceMap, queries };
}

// ── Live price ticker (auto-refresh with countdown) ───────────────────────────
export function useLivePriceTicker(
  symbol: string,
  onUpdate?: (price: StockPrice) => void,
) {
  const { data, isFetching, dataUpdatedAt } = useLivePrice(symbol);
  const prevRef = useRef<number>(0);

  useEffect(() => {
    if (data?.data && dataUpdatedAt !== prevRef.current) {
      prevRef.current = dataUpdatedAt;
      onUpdate?.(data.data);
    }
  }, [data, dataUpdatedAt, onUpdate]);

  return {
    price: data?.data ?? null,
    isFetching,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    isLive: isIDXTradingHours(),
  };
}
