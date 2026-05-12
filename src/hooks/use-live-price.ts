// ── useLivePrice / useLivePrices ──────────────────────────────────────────────
// React Query hooks that fetch real-time IDX prices from DataSectors chart-saham.
// Refreshes every 60 seconds during market hours (WIB 09:00–16:00).

import { useQuery, useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLivePrice, getLivePrices, type LivePrice } from "@/lib/datasectors.functions";
import { useMounted } from "./use-mounted";

/** Is the IDX market currently open? (WIB = UTC+7, Mon–Fri 09:00–16:30) */
function isMarketOpen(): boolean {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600000);
  const day = wib.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const h = wib.getUTCHours();
  const m = wib.getUTCMinutes();
  const mins = h * 60 + m;
  return mins >= 9 * 60 && mins <= 16 * 60 + 30;
}

const REFRESH_MS = isMarketOpen() ? 60_000 : 300_000; // 1min open, 5min closed

/** Single symbol live price */
export function useLivePrice(symbol: string | undefined) {
  const mounted = useMounted();
  const fn = useServerFn(getLivePrice);
  return useQuery({
    queryKey: ["live-price", symbol?.toUpperCase()],
    queryFn: () => fn({ data: { symbol: symbol! } }),
    enabled: mounted && !!symbol,
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
    retry: false,
  });
}

/** Multiple symbols — returns a map of symbol → LivePrice */
export function useLivePrices(symbols: string[]) {
  const mounted = useMounted();
  const fn = useServerFn(getLivePrices);
  const deduped = [...new Set(symbols.map(s => s.toUpperCase()))].filter(Boolean);
  return useQuery({
    queryKey: ["live-prices", deduped.sort().join(",")],
    queryFn: () => fn({ data: { symbols: deduped } }),
    enabled: mounted && deduped.length > 0,
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
    retry: false,
  });
}

export type { LivePrice };
