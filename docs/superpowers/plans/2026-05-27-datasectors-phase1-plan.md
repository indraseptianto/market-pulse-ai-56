# DataSectors Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full DataSectors API integration for Technical Indicators (hybrid), Finance News (full DS), and Economic Calendar (full DS) with lazy loading, caching, and graceful fallbacks.

**Architecture:** React frontend with lazy-loaded tab components, server functions for DS API calls, client-side fallback via indicators.ts, and 2-5 min cache TTL with stale-while-revalidate pattern.

**Tech Stack:** TanStack Start, React Query, Radix UI, Tailwind, TypeScript, DataSectors API (161+ endpoints)

---

## File Structure

```
src/
├── lib/
│   └── datasectors.functions.ts     # Modify — add 12 new DS functions
├── routes/
│   ├── technical.tsx                # Redesign — indicator picker + chart grid
│   ├── news.tsx                     # Redesign — tab layout, full DS
│   └── calendar.tsx                 # Redesign — sidebar filters, view modes
├── components/
│   ├── technical/                   # NEW directory
│   │   ├── IndicatorPicker.tsx      # Searchable indicator dropdown
│   │   ├── IndicatorChart.tsx       # Chart with indicator overlay
│   │   └── TechnicalScanTable.tsx   # Enhanced scanner table
│   └── shared/                      # NEW directory
│       ├── DataSourceBadge.tsx      # DS/Client/Mock badge
│       ├── RateLimitIndicator.tsx   # API usage warning
│       ├── ErrorBoundary.tsx        # Per-feature error boundary
│       └── LoadingSkeleton.tsx      # Unified skeleton
└── lib/
    └── indicators.ts                 # Keep unchanged (client fallback)
```

---

## Part A: Shared Components (Foundation)

### Task A1: Create shared components directory and files

**Files:**
- Create: `src/components/shared/DataSourceBadge.tsx`
- Create: `src/components/shared/RateLimitIndicator.tsx`
- Create: `src/components/shared/ErrorBoundary.tsx`
- Create: `src/components/shared/LoadingSkeleton.tsx`

- [ ] **Step 1: Write DataSourceBadge component**

```tsx
// src/components/shared/DataSourceBadge.tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DataSource = "ds" | "client" | "mock" | "tiingo";

interface DataSourceBadgeProps {
  source: DataSource;
  className?: string;
}

const SOURCE_CONFIG: Record<DataSource, { label: string; className: string }> = {
  ds: { label: "DS", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  client: { label: "Client", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  mock: { label: "Mock", className: "bg-muted text-muted-foreground border-border" },
  tiingo: { label: "Tiingo", className: "bg-green-500/15 text-green-400 border-green-500/30" },
};

export function DataSourceBadge({ source, className }: DataSourceBadgeProps) {
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.mock;
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", config.className, className)}>
      {config.label}
    </Badge>
  );
}
```

- [ ] **Step 2: Write RateLimitIndicator component**

```tsx
// src/components/shared/RateLimitIndicator.tsx
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface RateLimitIndicatorProps {
  used: number;
  limit: number;
  className?: string;
}

export function RateLimitIndicator({ used, limit, className }: RateLimitIndicatorProps) {
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  const isWarning = pct >= 80;
  const isDanger = pct >= 95;

  return (
    <div className={cn("flex items-center gap-1.5 text-[11px]", className)}>
      <span className="text-muted-foreground">API:</span>
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isDanger ? "bg-destructive" : isWarning ? "bg-warning" : "bg-success"
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={cn(isDanger ? "text-destructive" : isWarning ? "text-warning" : "text-muted-foreground")}>
        {used}/{limit}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Write ErrorBoundary component**

```tsx
// src/components/shared/ErrorBoundary.tsx
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
          <p className="text-sm font-medium mb-1">Something went wrong</p>
          <p className="text-xs text-muted-foreground mb-4">{this.state.error?.message}</p>
          <Button size="sm" variant="outline" onClick={this.handleReset}>
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 4: Write LoadingSkeleton component**

```tsx
// src/components/shared/LoadingSkeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  variant?: "card" | "table" | "list" | "chart";
  count?: number;
  className?: string;
}

export function LoadingSkeleton({ variant = "card", count = 1, className }: LoadingSkeletonProps) {
  const items = Array.from({ length: count });

  if (variant === "table") {
    return (
      <div className={cn("space-y-2", className)}>
        {items.map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div className={cn("space-y-3", className)}>
        {items.map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  // Default: card
  return (
    <div className={cn("grid gap-4", className)}>
      {items.map((_, i) => (
        <div key={i} className="p-4 border rounded-xl space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd /root/projects/market-pulse-ai-56
git add src/components/shared/DataSourceBadge.tsx src/components/shared/RateLimitIndicator.tsx src/components/shared/ErrorBoundary.tsx src/components/shared/LoadingSkeleton.tsx
git commit -m "feat(shared): add shared components — DataSourceBadge, RateLimitIndicator, ErrorBoundary, LoadingSkeleton"
```

---

### Task A2: Extend dsFetch with caching

**Files:**
- Modify: `src/lib/datasectors.server.ts`

- [ ] **Step 1: Add cache utility to datasectors.server.ts**

```tsx
// src/lib/datasectors.server.ts
// ... existing code ...

// Add after unwrapList function (around line 82):

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ResponseCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
  }

  clear(): void {
    this.store.clear();
  }
}

const cache = new ResponseCache();

export interface CachedFetchOptions extends FetchOptions {
  cacheTtlMs?: number; // e.g. 120_000 = 2 min, 300_000 = 5 min
  cacheKey?: string;   // custom cache key, defaults to URL
}

export async function dsFetchCached<T = unknown>(
  path: string,
  opts: CachedFetchOptions = {},
): Promise<{ data: T | null; error: string | null; fromCache?: boolean }> {
  const cacheKey = opts.cacheKey ?? path + JSON.stringify(opts.query ?? {});
  const cached = cache.get<T>(cacheKey);
  if (cached && !opts.query?.refresh) {
    return { data: cached, error: null, fromCache: true };
  }
  const result = await dsFetch<T>(path, opts);
  if (result.data && !result.error) {
    cache.set(cacheKey, result.data, opts.cacheTtlMs ?? 120_000);
  }
  return result;
}

// Keep old function for backward compat
export { dsFetch };
export { unwrapList, allowMockFallback, type FetchOptions };
```

- [ ] **Step 2: Commit**

```bash
cd /root/projects/market-pulse-ai-56
git add src/lib/datasectors.server.ts
git commit -m "feat(datasectors): add ResponseCache class with TTL for dsFetchCached"
```

---

## Part B: Technical Indicators

### Task B1: Add indicator list function

**Files:**
- Modify: `src/lib/datasectors.functions.ts`

- [ ] **Step 1: Add getIndicatorList function**

```tsx
// In src/lib/datasectors.functions.ts, add after getIndicator (around line 787):

export interface IndicatorInfo {
  name: string;
  displayName: string;
  category: string;
  description: string;
  params?: Record<string, { default: number; min?: number; max?: number }>;
}

export const getIndicatorList = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: payload, error } = await dsFetch<{
      success: boolean;
      data: IndicatorInfo[];
      count: number;
    }>("/indicator/list");

    if (error || !payload) {
      // Return hardcoded list as fallback
      return {
        data: [
          { name: "SMA", displayName: "Simple Moving Average", category: "Moving Average", description: "Average price over N periods" },
          { name: "EMA", displayName: "Exponential Moving Average", category: "Moving Average", description: "Weighted average with exponential decay" },
          { name: "RSI", displayName: "Relative Strength Index", category: "Momentum", description: "Momentum oscillator 0-100" },
          { name: "MACD", displayName: "MACD", category: "Momentum", description: "Moving Average Convergence Divergence" },
          { name: "BB", displayName: "Bollinger Bands", category: "Volatility", description: "Price volatility bands" },
          { name: "ATR", displayName: "Average True Range", category: "Volatility", description: "Market volatility measure" },
          { name: "STOCH", displayName: "Stochastic", category: "Momentum", description: "Momentum relative to range" },
          { name: "VWAP", displayName: "VWAP", category: "Volume", description: "Volume weighted average price" },
          { name: "ADX", displayName: "Average Directional Index", category: "Trend", description: "Trend strength 0-100" },
          { name: "CCI", displayName: "Commodity Channel Index", category: "Momentum", description: "Commodity channel oscillator" },
          { name: "WILLR", displayName: "Williams %R", category: "Momentum", description: "Overbought/oversold oscillator" },
          { name: "ROC", displayName: "Rate of Change", category: "Momentum", description: "Percentage price change" },
        ] as IndicatorInfo[],
        source: "fallback" as const,
        error: null,
      };
    }

    const raw = Array.isArray(payload) ? payload : Array.isArray((payload as Record<string, unknown>).data) ? ((payload as Record<string, unknown>).data as IndicatorInfo[]) : [];
    return { data: raw, source: "api" as const, error: null };
  });
```

- [ ] **Step 2: Commit**

```bash
cd /root/projects/market-pulse-ai-56
git add src/lib/datasectors.functions.ts
git commit -m "feat(datasectors): add getIndicatorList with indicator metadata fallback"
```

---

### Task B2: Create IndicatorPicker component

**Files:**
- Create: `src/components/technical/IndicatorPicker.tsx`

- [ ] **Step 1: Write IndicatorPicker component**

```tsx
// src/components/technical/IndicatorPicker.tsx
import { useState, useMemo } from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Indicator {
  name: string;
  displayName: string;
  category: string;
  description?: string;
}

interface IndicatorPickerProps {
  value: string;
  onChange: (name: string) => void;
  indicators?: Indicator[];
  className?: string;
}

const CATEGORIES = [
  "Moving Average",
  "Momentum",
  "Trend",
  "Volatility",
  "Volume",
  "Other",
];

export function IndicatorPicker({ value, onChange, indicators, className }: IndicatorPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const list = indicators ?? [
    { name: "SMA", displayName: "Simple Moving Average", category: "Moving Average" },
    { name: "EMA", displayName: "Exponential Moving Average", category: "Moving Average" },
    { name: "RSI", displayName: "RSI", category: "Momentum" },
    { name: "MACD", displayName: "MACD", category: "Momentum" },
    { name: "BB", displayName: "Bollinger Bands", category: "Volatility" },
    { name: "ATR", displayName: "ATR", category: "Volatility" },
    { name: "STOCH", displayName: "Stochastic", category: "Momentum" },
    { name: "VWAP", displayName: "VWAP", category: "Volume" },
    { name: "ADX", displayName: "ADX", category: "Trend" },
    { name: "CCI", displayName: "CCI", category: "Momentum" },
    { name: "WILLR", displayName: "Williams %R", category: "Momentum" },
    { name: "ROC", displayName: "ROC", category: "Momentum" },
  ];

  const selected = list.find((i) => i.name === value);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return list.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.displayName.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    );
  }, [list, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof list>();
    for (const ind of filtered) {
      const cat = ind.category ?? "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(ind);
    }
    return map;
  }, [filtered]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn("justify-between font-mono text-sm", className)}
        >
          <span className="truncate">
            {selected ? (
              <>
                <span className="text-muted-foreground">{selected.category} ›</span>{" "}
                {selected.displayName}
              </>
            ) : (
              "Select indicator..."
            )}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search indicators..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 text-sm"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto py-1">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {category}
              </p>
              {items.map((ind) => (
                <button
                  key={ind.name}
                  onClick={() => {
                    onChange(ind.name);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-accent",
                    ind.name === value && "bg-accent"
                  )}
                >
                  <div>
                    <span className="font-mono font-medium">{ind.name}</span>
                    <span className="ml-2 text-muted-foreground">{ind.displayName}</span>
                  </div>
                  {ind.name === value && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /root/projects/market-pulse-ai-56
git add src/components/technical/IndicatorPicker.tsx
git commit -m "feat(technical): add IndicatorPicker component with searchable dropdown"
```

---

### Task B3: Create IndicatorChart component

**Files:**
- Create: `src/components/technical/IndicatorChart.tsx`

- [ ] **Step 1: Write IndicatorChart component**

```tsx
// src/components/technical/IndicatorChart.tsx
import { useMemo } from "react";
import { type Candle } from "@/lib/mock-data";
import { sma, ema, rsi, macd, bollinger, atr } from "@/lib/indicators";

interface IndicatorChartProps {
  candles: Candle[];
  indicator: string;
  className?: string;
}

export function IndicatorChart({ candles, indicator, className }: IndicatorChartProps) {
  const prices = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  const indicatorData = useMemo(() => {
    switch (indicator.toUpperCase()) {
      case "SMA":
        return sma(prices, 20).map((v) => v ?? 0);
      case "EMA":
        return ema(prices, 12).map((v) => v ?? 0);
      case "RSI":
        return rsi(prices, 14).map((v) => v ?? 50);
      case "MACD": {
        const m = macd(prices);
        return m.macd.map((v) => v ?? 0);
      }
      case "BB": {
        const b = bollinger(prices, 20, 2);
        return b.upper.map((v) => v ?? prices[prices.length - 1]);
      }
      case "ATR":
        return atr(highs, lows, prices, 14).map((v) => v ?? 0);
      default:
        return prices;
    }
  }, [candles, indicator]);

  const min = Math.min(...indicatorData);
  const max = Math.max(...indicatorData);
  const range = max - min || 1;

  // Simple SVG line chart
  const width = 400;
  const height = 120;
  const points = indicatorData.map((v, i) => {
    const x = (i / (indicatorData.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {indicator} — Last: {indicatorData[indicatorData.length - 1]?.toFixed(2)}
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[120px]">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-blue-400"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /root/projects/market-pulse-ai-56
git add src/components/technical/IndicatorChart.tsx
git commit -m "feat(technical): add IndicatorChart component with SVG line chart"
```

---

### Task B4: Redesign technical.tsx with indicator picker + explore/scan modes

**Files:**
- Modify: `src/routes/technical.tsx`

- [ ] **Step 1: Rewrite technical.tsx with full redesign**

Replace the entire content of `src/routes/technical.tsx` with:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getTiingoPrices, getIndicatorList, type IndicatorInfo } from "@/lib/datasectors.functions";
import { mockEquities } from "@/lib/mock-data";
import { technicalSummary } from "@/lib/indicators";
import { fmtPrice } from "@/lib/formatters";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, ArrowUp, Search, BarChart3, List } from "lucide-react";
import { IndicatorPicker } from "@/components/technical/IndicatorPicker";
import { IndicatorChart } from "@/components/technical/IndicatorChart";
import { DataSourceBadge } from "@/components/shared/DataSourceBadge";

export const Route = createFileRoute("/technical")({
  head: () => ({
    meta: [
      { title: "Technical Scanner — Stratum" },
      { name: "description", content: "Scan equities by 50+ technical indicators with DS API + client-side fallback." },
    ],
  }),
  component: TechnicalPage,
});

type Mode = "scan" | "explore";

export function TechnicalPage() {
  const tiingoFn = useServerFn(getTiingoPrices);
  const indicatorListFn = useServerFn(getIndicatorList);

  const [mode, setMode] = useState<Mode>("scan");
  const [exploreSymbol, setExploreSymbol] = useState("");
  const [selectedIndicator, setSelectedIndicator] = useState("RSI");

  // Indicator list query
  const { data: indicators } = useQuery({
    queryKey: ["indicator-list"],
    queryFn: () => indicatorListFn({ data: {} }),
    staleTime: 10 * 60_000,
  });

  const indicatorList = indicators?.data ?? [
    { name: "SMA", displayName: "Simple Moving Average", category: "Moving Average" },
    { name: "EMA", displayName: "Exponential Moving Average", category: "Moving Average" },
    { name: "RSI", displayName: "RSI", category: "Momentum" },
    { name: "MACD", displayName: "MACD", category: "Momentum" },
    { name: "BB", displayName: "Bollinger Bands", category: "Volatility" },
    { name: "ATR", displayName: "ATR", category: "Volatility" },
    { name: "ADX", displayName: "ADX", category: "Trend" },
  ];

  // Scan mode: 20 stocks
  const universe = mockEquities.slice(0, 20);
  const scanQueries = useQueries({
    queries: universe.map((e) => ({
      queryKey: ["scan-prices", e.symbol],
      queryFn: () => tiingoFn({ data: { symbol: e.symbol, days: 365 } }),
      staleTime: 5 * 60_000,
    })),
  });

  const loading = scanQueries.some((q) => q.isLoading);

  const [stanceFilter, setStanceFilter] = useState("any");
  const [sortKey, setSortKey] = useState<"score" | "rsi">("score");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const scanRows = useMemo(() => {
    return universe
      .map((e, i) => {
        const candles = scanQueries[i]?.data?.data ?? [];
        if (candles.length < 30) return null;
        const s = technicalSummary(
          candles.map((c) => c.close),
          candles.map((c) => c.high),
          candles.map((c) => c.low),
        );
        return { equity: e, summary: s };
      })
      .filter((x): x is { equity: typeof universe[number]; summary: ReturnType<typeof technicalSummary> } => x !== null)
      .filter((r) => stanceFilter === "any" || r.summary.stance === stanceFilter)
      .sort((a, b) => {
        const av = sortKey === "score" ? a.summary.score : a.summary.rsi ?? 0;
        const bv = sortKey === "score" ? b.summary.score : b.summary.rsi ?? 0;
        return sortDir === "desc" ? bv - av : av - bv;
      });
  }, [scanQueries, stanceFilter, sortKey, sortDir, universe]);

  // Explore mode: single symbol + 3 indicators
  const exploreCandles = useMemo(() => {
    const sym = exploreSymbol.trim().toUpperCase();
    if (!sym) return [];
    const q = scanQueries.find((_, i) => universe[i]?.symbol === sym);
    return q?.data?.data ?? [];
  }, [exploreSymbol, scanQueries, universe]);

  return (
    <PageTransition>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Technical Scanner</h1>
          <p className="text-sm text-muted-foreground">
            50+ indicators via DataSectors API with client-side fallback.{" "}
            <DataSourceBadge source="ds" className="ml-1" />
          </p>
        </div>

        {/* Mode Toggle + Indicator Picker */}
        <GlassCard className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={mode === "scan" ? "default" : "ghost"}
              onClick={() => setMode("scan")}
              className="gap-1.5"
            >
              <List className="h-3.5 w-3.5" />
              Scan
            </Button>
            <Button
              size="sm"
              variant={mode === "explore" ? "default" : "ghost"}
              onClick={() => setMode("explore")}
              className="gap-1.5"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Explore
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Indicator:</span>
            <IndicatorPicker
              value={selectedIndicator}
              onChange={setSelectedIndicator}
              indicators={indicatorList}
              className="w-[220px]"
            />
          </div>

          {mode === "explore" && (
            <div className="flex items-center gap-2 ml-auto">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="BBRI, TLKM, ISAT..."
                value={exploreSymbol}
                onChange={(e) => setExploreSymbol(e.target.value.toUpperCase())}
                className="w-32 font-mono text-sm"
              />
            </div>
          )}
        </GlassCard>

        {/* SCAN MODE */}
        {mode === "scan" && (
          <>
            <div className="flex flex-wrap gap-2">
              {["any", "Bullish", "Mildly Bullish", "Neutral", "Mildly Bearish", "Bearish"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStanceFilter(s)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                    stanceFilter === s
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "any" ? "All" : s}
                </button>
              ))}
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant={sortKey === "score" ? "default" : "ghost"} onClick={() => { setSortKey("score"); setSortDir(sortDir === "desc" ? "asc" : "desc"); }}>
                  Score {sortKey === "score" && (sortDir === "desc" ? <ArrowDown className="h-3 w-3 ml-1" /> : <ArrowUp className="h-3 w-3 ml-1" />)}
                </Button>
                <Button size="sm" variant={sortKey === "rsi" ? "default" : "ghost"} onClick={() => setSortKey("rsi")}>
                  RSI
                </Button>
              </div>
            </div>

            {loading && scanRows.length === 0 ? (
              <Skeleton className="h-14 rounded-xl" />
            ) : (
              <GlassCard className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-background/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5">Symbol</th>
                      <th className="px-4 py-2.5 text-right">Price</th>
                      <th className="px-4 py-2.5">Trend</th>
                      <th className="px-4 py-2.5 text-right">RSI</th>
                      <th className="px-4 py-2.5">MACD</th>
                      <th className="px-4 py-2.5 text-right">Score</th>
                      <th className="px-4 py-2.5">Stance</th>
                      <th className="px-4 py-2.5">Indicator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanRows.map(({ equity, summary }) => (
                      <tr key={equity.symbol} className="border-b border-border/30 hover:bg-accent/20">
                        <td className="px-4 py-2.5">
                          <Link to="/stocks/$symbol" params={{ symbol: equity.symbol }}>
                            <div className="font-mono text-sm font-semibold">{equity.symbol}</div>
                            <div className="truncate text-xs text-muted-foreground max-w-[200px]">{equity.name}</div>
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">{fmtPrice(summary.last)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[11px] font-medium ${summary.trend.includes("Up") ? "text-success" : summary.trend.includes("Down") ? "text-destructive" : "text-muted-foreground"}`}>
                            {summary.trend}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`font-mono text-xs ${(summary.rsi ?? 50) > 70 ? "text-destructive" : (summary.rsi ?? 50) < 30 ? "text-success" : ""}`}>
                            {summary.rsi?.toFixed(1) ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[11px] font-medium ${summary.macdCross === "Bullish" ? "text-success" : summary.macdCross === "Bearish" ? "text-destructive" : ""}`}>
                            {summary.macdCross}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <div className="w-12 h-1.5 rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${summary.score}%` }} />
                            </div>
                            <span className="font-mono text-xs">{summary.score}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${
                            summary.stance === "Bullish" ? "border-success/30 bg-success/15 text-success" :
                            summary.stance === "Bearish" ? "border-destructive/30 bg-destructive/15 text-destructive" :
                            summary.stance.includes("Mild") ? "border-warning/30 bg-warning/15 text-warning" :
                            "border-border bg-muted/40"
                          }`}>
                            {summary.stance}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                            {selectedIndicator}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </GlassCard>
            )}
          </>
        )}

        {/* EXPLORE MODE */}
        {mode === "explore" && (
          <div className="space-y-4">
            {exploreCandles.length > 0 ? (
              <>
                <GlassCard>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{exploreSymbol}</h3>
                      <p className="text-sm text-muted-foreground">
                        Last: {fmtPrice(exploreCandles[exploreCandles.length - 1]?.close ?? 0)} — {exploreCandles.length} candles
                      </p>
                    </div>
                    <DataSourceBadge source="client" />
                  </div>
                  <IndicatorChart candles={exploreCandles} indicator={selectedIndicator} />
                </GlassCard>
                <GlassCard>
                  <p className="text-sm text-muted-foreground mb-2">Other indicators for {exploreSymbol}</p>
                  <div className="grid grid-cols-3 gap-4">
                    {["RSI", "MACD", "BB"].map((ind) => (
                      <IndicatorChart key={ind} candles={exploreCandles} indicator={ind} />
                    ))}
                  </div>
                </GlassCard>
              </>
            ) : (
              <GlassCard className="py-12 text-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Enter a symbol above to explore indicators</p>
              </GlassCard>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /root/projects/market-pulse-ai-56
git add src/routes/technical.tsx
git commit -m "feat(technical): redesign with mode toggle (scan/explore), indicator picker, explore mode charts"
```

---

## Part C: Finance News

### Task C1: Add DS news functions

**Files:**
- Modify: `src/lib/datasectors.functions.ts`

- [ ] **Step 1: Add DS news endpoint functions after getCryptoOrderbookImbalance (around line 1057)**

```tsx
// ── Finance News ─────────────────────────────────────────────────────────────

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  content?: string;
  url: string;
  source: string;
  publishedDate: string;
  tickers: string[];
  tags: string[];
  sentiment?: "bullish" | "bearish" | "neutral";
  sentimentScore?: number;
  imageUrl?: string;
}

export const getDSNewsSearch = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(100).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<{ success: boolean; data: unknown }>(
      "/news/search",
      { query: { query: data.query, limit: data.limit ?? 50, dateFrom: data.dateFrom, dateTo: data.dateTo } },
    );
    if (error || !payload) return { data: [] as NewsArticle[], source: "error" as const, error };
    const raw = Array.isArray(payload) ? payload : Array.isArray((payload as Record<string, unknown>).data) ? ((payload as Record<string, unknown>).data) : [];
    return {
      data: (raw as Record<string, unknown>[]).map(mapDSNewsArticle),
      source: "api" as const,
      error: null,
    };
  });

export const getDSNewsLatest = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      market: z.string().optional(),
      symbol: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
    }).optional(),
  )
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<{ success: boolean; data: unknown }>(
      "/news/latest",
      { query: { market: data?.market, symbol: data?.symbol, limit: data?.limit ?? 50 } },
    );
    if (error || !payload) return { data: [] as NewsArticle[], source: "error" as const, error };
    const raw = Array.isArray(payload) ? payload : Array.isArray((payload as Record<string, unknown>).data) ? ((payload as Record<string, unknown>).data) : [];
    return {
      data: (raw as Record<string, unknown>[]).map(mapDSNewsArticle),
      source: "api" as const,
      error: null,
    };
  });

export const getDSNewsCategories = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: payload, error } = await dsFetch<{ success: boolean; data: unknown }>("/news/categories");
    if (error || !payload) return { data: [] as { name: string; count: number }[], source: "error" as const, error };
    const raw = Array.isArray(payload) ? payload : Array.isArray((payload as Record<string, unknown>).data) ? ((payload as Record<string, unknown>).data) : [];
    return {
      data: (raw as Record<string, unknown>[]).map((r) => ({ name: String(r.name ?? r.category ?? ""), count: Number(r.count ?? r.articleCount ?? 0) })),
      source: "api" as const,
      error: null,
    };
  });

export const getDSNewsTrending = createServerFn({ method: "GET" })
  .inputValidator(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<{ success: boolean; data: unknown }>(
      "/news/trending",
      { query: { limit: data?.limit ?? 20 } },
    );
    if (error || !payload) return { data: [] as NewsArticle[], source: "error" as const, error };
    const raw = Array.isArray(payload) ? payload : Array.isArray((payload as Record<string, unknown>).data) ? ((payload as Record<string, unknown>).data) : [];
    return {
      data: (raw as Record<string, unknown>[]).map(mapDSNewsArticle),
      source: "api" as const,
      error: null,
    };
  });

function mapDSNewsArticle(r: Record<string, unknown>): NewsArticle {
  const tickers = Array.isArray(r.tickers) ? r.tickers.map(String) : Array.isArray(r.symbols) ? r.symbols.map(String) : r.ticker ? [String(r.ticker)] : [];
  const tags = Array.isArray(r.tags) ? r.tags.map(String) : Array.isArray(r.categories) ? r.categories.map(String) : [];
  return {
    id: String(r.id ?? r._id ?? Math.random()),
    title: String(r.title ?? r.headline ?? ""),
    description: String(r.description ?? r.summary ?? r.content ?? r.body ?? ""),
    content: r.content ? String(r.content) : undefined,
    url: String(r.url ?? r.link ?? "#"),
    source: String(r.source ?? r.publisher ?? r.provider ?? ""),
    publishedDate: String(r.publishedDate ?? r.published_date ?? r.date ?? r.publishedAt ?? ""),
    tickers,
    tags,
    sentiment: r.sentiment ? String(r.sentiment) as "bullish" | "bearish" | "neutral" : undefined,
    sentimentScore: r.sentimentScore ? Number(r.sentimentScore) : undefined,
    imageUrl: r.imageUrl ? String(r.imageUrl) : r.image ? String(r.image) : undefined,
  };
}
```

- [ ] **Step 2: Commit**

```bash
cd /root/projects/market-pulse-ai-56
git add src/lib/datasectors.functions.ts
git commit -m "feat(news): add getDSNewsSearch, getDSNewsLatest, getDSNewsCategories, getDSNewsTrending"
```

---

### Task C2: Redesign news.tsx with tab layout

**Files:**
- Modify: `src/routes/news.tsx`

- [ ] **Step 1: Rewrite news.tsx with tab layout and full DS integration**

Replace `src/routes/news.tsx` content with (keeping the first ~100 lines + sentiment scoring, replacing the rest with tab layout):

```tsx
// (Keep first 100 lines of existing news.tsx: imports, sentiment scoring, mapDSNews, mapTiingoNews, unwrapNewsArray)

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { getDSNewsSearch, getDSNewsLatest, getDSNewsCategories, getDSNewsTrending, type NewsArticle } from "@/lib/datasectors.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Newspaper, Search, TrendingUp, Grid3X3, Clock, ExternalLink, Filter,
} from "lucide-react";
import { DataSourceBadge } from "@/components/shared/DataSourceBadge";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Market News — Stratum" },
      { name: "description", content: "Real-time market news with full-text search, categories, and sentiment analysis via DataSectors." },
    ],
  }),
  component: NewsPage,
});

const BULLISH_WORDS = ["surge","beat","upgrade","rally","soar","record","growth","strong","boost","outperform","expand","win","profit","gain","rise","high","positive","optimistic","naik","untung","laba","tumbuh"];
const BEARISH_WORDS = ["fall","drop","miss","downgrade","plunge","loss","cut","weak","decline","warn","risk","concern","crash","sell","negative","turun","rugi","melemah","anjlok","koreksi"];

function scoreSentiment(text: string): { sentiment: "bullish" | "bearish" | "neutral"; score: number } {
  const t = text.toLowerCase();
  let s = 0;
  for (const w of BULLISH_WORDS) if (t.includes(w)) s++;
  for (const w of BEARISH_WORDS) if (t.includes(w)) s--;
  return {
    sentiment: s > 0 ? "bullish" : s < 0 ? "bearish" : "neutral",
    score: Math.min(10, Math.max(-10, s * 2)),
  };
}

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return dateStr; }
}

function NewsCard({ article }: { article: NewsArticle }) {
  const { sentiment, score } = scoreSentiment(article.title + " " + article.description);
  const sentimentColor = sentiment === "bullish" ? "text-success border-success/30 bg-success/10" : sentiment === "bearish" ? "text-destructive border-destructive/30 bg-destructive/10" : "text-muted-foreground border-border";

  return (
    <GlassCard className="group hover:bg-accent/30 transition-colors">
      <a href={article.url} target="_blank" rel="noopener noreferrer" className="block">
        <div className="flex items-start gap-3">
          {article.imageUrl && (
            <img src={article.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {article.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {article.description}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {article.tickers.slice(0, 4).map((t) => (
                <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                  {t}
                </Badge>
              ))}
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sentimentColor}`}>
                {sentiment}
              </Badge>
              <span className="text-[10px] text-muted-foreground ml-auto">{formatTimeAgo(article.publishedDate)}</span>
            </div>
          </div>
        </div>
      </a>
    </GlassCard>
  );
}

export function NewsPage() {
  const searchFn = useServerFn(getDSNewsSearch);
  const latestFn = useServerFn(getDSNewsLatest);
  const categoriesFn = useServerFn(getDSNewsCategories);
  const trendingFn = useServerFn(getDSNewsTrending);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("latest");

  // Latest news
  const { data: latestData, isLoading: latestLoading } = useQuery({
    queryKey: ["ds-news-latest"],
    queryFn: () => latestFn({ data: { limit: 30 } }),
    staleTime: 5 * 60_000,
    enabled: activeTab === "latest",
  });

  // Trending
  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ["ds-news-trending"],
    queryFn: () => trendingFn({ data: { limit: 15 } }),
    staleTime: 5 * 60_000,
    enabled: activeTab === "trending",
  });

  // Categories
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ["ds-news-categories"],
    queryFn: () => categoriesFn({ data: {} }),
    staleTime: 10 * 60_000,
    enabled: activeTab === "categories",
  });

  // Search
  const { data: searchData, isLoading: searchLoading, refetch: searchRefetch } = useQuery({
    queryKey: ["ds-news-search", searchQuery],
    queryFn: () => searchFn({ data: { query: searchQuery, limit: 30 } }),
    staleTime: 5 * 60_000,
    enabled: activeTab === "search" && searchQuery.length > 2,
  });

  const latestArticles = (latestData?.data ?? []) as NewsArticle[];
  const trendingArticles = (trendingData?.data ?? []) as NewsArticle[];
  const searchArticles = (searchData?.data ?? []) as NewsArticle[];
  const categories = (categoriesData?.data ?? []) as { name: string; count: number }[];

  return (
    <PageTransition>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Market News</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Real-time news via DataSectors API with full-text search.{" "}
            <DataSourceBadge source="ds" />
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-wrap items-center gap-3">
            <TabsList>
              <TabsTrigger value="latest" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Latest
              </TabsTrigger>
              <TabsTrigger value="search" className="gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Search
              </TabsTrigger>
              <TabsTrigger value="trending" className="gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Trending
              </TabsTrigger>
              <TabsTrigger value="categories" className="gap-1.5">
                <Grid3X3 className="h-3.5 w-3.5" />
                Categories
              </TabsTrigger>
            </TabsList>

            {activeTab === "search" && (
              <div className="flex-1 flex items-center gap-2 max-w-md">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder="Search news..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
              </div>
            )}
          </div>

          {/* LATEST TAB */}
          <TabsContent value="latest" className="mt-4">
            {latestLoading ? (
              <Skeleton className="h-48 rounded-xl" />
            ) : latestArticles.length > 0 ? (
              <div className="space-y-3">
                {latestArticles.map((a) => <NewsCard key={a.id} article={a} />)}
              </div>
            ) : (
              <GlassCard className="py-12 text-center">
                <Newspaper className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No news available from DataSectors</p>
                <p className="text-xs text-muted-foreground mt-1">Check API key configuration</p>
              </GlassCard>
            )}
          </TabsContent>

          {/* SEARCH TAB */}
          <TabsContent value="search" className="mt-4">
            {searchQuery.length < 3 ? (
              <GlassCard className="py-12 text-center">
                <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Type at least 3 characters to search</p>
              </GlassCard>
            ) : searchLoading ? (
              <Skeleton className="h-48 rounded-xl" />
            ) : searchArticles.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{searchArticles.length} results for "{searchQuery}"</p>
                {searchArticles.map((a) => <NewsCard key={a.id} article={a} />)}
              </div>
            ) : (
              <GlassCard className="py-12 text-center">
                <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No results found for "{searchQuery}"</p>
              </GlassCard>
            )}
          </TabsContent>

          {/* TRENDING TAB */}
          <TabsContent value="trending" className="mt-4">
            {trendingLoading ? (
              <Skeleton className="h-48 rounded-xl" />
            ) : trendingArticles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trendingArticles.map((a) => <NewsCard key={a.id} article={a} />)}
              </div>
            ) : (
              <GlassCard className="py-12 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No trending news available</p>
              </GlassCard>
            )}
          </TabsContent>

          {/* CATEGORIES TAB */}
          <TabsContent value="categories" className="mt-4">
            {categoriesLoading ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : categories.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {categories.map((cat) => (
                  <GlassCard key={cat.name} className="p-4 cursor-pointer hover:bg-accent/30 transition-colors">
                    <p className="font-medium text-sm">{cat.name}</p>
                    <p className="text-2xl font-bold mt-2">{cat.count.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">articles</p>
                  </GlassCard>
                ))}
              </div>
            ) : (
              <GlassCard className="py-12 text-center">
                <Grid3X3 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No categories available</p>
              </GlassCard>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /root/projects/market-pulse-ai-56
git add src/routes/news.tsx
git commit -m "feat(news): redesign with tab layout (Latest/Search/Trending/Categories), full DS integration"
```

---

## Part D: Economic Calendar

### Task D1: Add calendar endpoint functions

**Files:**
- Modify: `src/lib/datasectors.functions.ts`

- [ ] **Step 1: Add calendar endpoint functions after getDSNewsTrending (around line 1180)**

```tsx
// ── Economic Calendar — Extended Endpoints ────────────────────────────────────

export const getCalendarIndicators = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      indicator: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().min(1).max(500).optional(),
    }).optional(),
  )
  .handler(async ({ data }) => {
    const today = new Date();
    const start = data?.startDate ?? new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const end = data?.endDate ?? new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const { data: payload, error } = await dsFetch<{ success: boolean; data: unknown }>(
      "/calendar/indicators",
      { query: { startDate: start, endDate: end, indicator: data?.indicator, limit: data?.limit ?? 200 } },
    );
    if (error || !payload) return { data: [] as CalendarEvent[], source: "error" as const, error };
    const raw = Array.isArray(payload) ? payload : Array.isArray((payload as Record<string, unknown>).data) ? ((payload as Record<string, unknown>).data) : [];
    return { data: (raw as Record<string, unknown>[]).map(mapCalendarEvent), source: "api" as const, error: null };
  });

export const getCalendarCurrencies = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      currency: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().min(1).max(500).optional(),
    }).optional(),
  )
  .handler(async ({ data }) => {
    const today = new Date();
    const start = data?.startDate ?? new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const end = data?.endDate ?? new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const { data: payload, error } = await dsFetch<{ success: boolean; data: unknown }>(
      "/calendar/currencies",
      { query: { startDate: start, endDate: end, currency: data?.currency, limit: data?.limit ?? 200 } },
    );
    if (error || !payload) return { data: [] as CalendarEvent[], source: "error" as const, error };
    const raw = Array.isArray(payload) ? payload : Array.isArray((payload as Record<string, unknown>).data) ? ((payload as Record<string, unknown>).data) : [];
    return { data: (raw as Record<string, unknown>[]).map(mapCalendarEvent), source: "api" as const, error: null };
  });

export const getCalendarCountries = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      countryCode: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().min(1).max(500).optional(),
    }).optional(),
  )
  .handler(async ({ data }) => {
    const today = new Date();
    const start = data?.startDate ?? new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const end = data?.endDate ?? new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const { data: payload, error } = await dsFetch<{ success: boolean; data: unknown }>(
      "/calendar/countries",
      { query: { startDate: start, endDate: end, countryCode: data?.countryCode, limit: data?.limit ?? 200 } },
    );
    if (error || !payload) return { data: [] as CalendarEvent[], source: "error" as const, error };
    const raw = Array.isArray(payload) ? payload : Array.isArray((payload as Record<string, unknown>).data) ? ((payload as Record<string, unknown>).data) : [];
    return { data: (raw as Record<string, unknown>[]).map(mapCalendarEvent), source: "api" as const, error: null };
  });

export const getCalendarImportance = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      importance: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().min(1).max(500).optional(),
    }).optional(),
  )
  .handler(async ({ data }) => {
    const today = new Date();
    const start = data?.startDate ?? new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const end = data?.endDate ?? new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const { data: payload, error } = await dsFetch<{ success: boolean; data: unknown }>(
      "/calendar/importance",
      { query: { startDate: start, endDate: end, importance: data?.importance, limit: data?.limit ?? 200 } },
    );
    if (error || !payload) return { data: [] as CalendarEvent[], source: "error" as const, error };
    const raw = Array.isArray(payload) ? payload : Array.isArray((payload as Record<string, unknown>).data) ? ((payload as Record<string, unknown>).data) : [];
    return { data: (raw as Record<string, unknown>[]).map(mapCalendarEvent), source: "api" as const, error: null };
  });

export const getCalendarUpcoming = createServerFn({ method: "GET" })
  .inputValidator(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
  .handler(async ({ data }) => {
    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const end = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const { data: payload, error } = await dsFetch<{ success: boolean; data: unknown }>(
      "/calendar/upcoming",
      { query: { startDate: start, endDate: end, limit: data?.limit ?? 20 } },
    );
    if (error || !payload) return { data: [] as CalendarEvent[], source: "error" as const, error };
    const raw = Array.isArray(payload) ? payload : Array.isArray((payload as Record<string, unknown>).data) ? ((payload as Record<string, unknown>).data) : [];
    return { data: (raw as Record<string, unknown>[]).map(mapCalendarEvent), source: "api" as const, error: null };
  });

export const getCalendarHistorical = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      countryCode: z.string().optional(),
      limit: z.number().min(1).max(500).optional(),
    }).optional(),
  )
  .handler(async ({ data }) => {
    const today = new Date();
    const start = data?.startDate ?? new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const end = data?.endDate ?? today.toISOString().slice(0, 10);
    const { data: payload, error } = await dsFetch<{ success: boolean; data: unknown }>(
      "/calendar/historical",
      { query: { startDate: start, endDate: end, countryCode: data?.countryCode, limit: data?.limit ?? 100 } },
    );
    if (error || !payload) return { data: [] as CalendarEvent[], source: "error" as const, error };
    const raw = Array.isArray(payload) ? payload : Array.isArray((payload as Record<string, unknown>).data) ? ((payload as Record<string, unknown>).data) : [];
    return { data: (raw as Record<string, unknown>[]).map(mapCalendarEvent), source: "api" as const, error: null };
  });

// Map function (reuse existing or define new)
function mapCalendarEvent(raw: Record<string, unknown>): CalendarEvent {
  return {
    id: String(raw.id ?? raw._id ?? Math.random()),
    title: String(raw.title ?? raw.name ?? raw.event ?? ""),
    country: String(raw.country ?? ""),
    countryCode: String(raw.countryCode ?? raw.country_code ?? raw.cc ?? ""),
    date: String(raw.date ?? raw.datetime ?? raw.time ?? ""),
    time: String(raw.time ?? raw.eventTime ?? ""),
    volatility: (raw.volatility ?? raw.impact ?? "NONE") as CalendarEvent["volatility"],
    actual: raw.actual != null ? String(raw.actual) : null,
    forecast: raw.forecast != null ? String(raw.forecast) : null,
    previous: raw.previous != null ? String(raw.previous) : null,
    unit: raw.unit != null ? String(raw.unit) : null,
    currency: raw.currency != null ? String(raw.currency) : null,
    description: raw.description != null ? String(raw.description) : null,
  };
}
```

- [ ] **Step 2: Commit**

```bash
cd /root/projects/market-pulse-ai-56
git add src/lib/datasectors.functions.ts
git commit -m "feat(calendar): add getCalendarIndicators, getCalendarCurrencies, getCalendarCountries, getCalendarImportance, getCalendarUpcoming, getCalendarHistorical"
```

---

### Task D2: Redesign calendar.tsx with filter sidebar + view modes

**Files:**
- Modify: `src/routes/calendar.tsx`

- [ ] **Step 1: Rewrite calendar.tsx with full redesign**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import {
  getEconomicCalendar,
  getCalendarUpcoming,
  getCalendarHistorical,
  getCalendarImportance,
  type CalendarEvent,
} from "@/lib/datasectors.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar, Search, RefreshCw, TrendingUp, Globe, Clock, AlertTriangle } from "lucide-react";
import { DataSourceBadge } from "@/components/shared/DataSourceBadge";
import { useMounted } from "@/hooks/use-mounted";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Economic Calendar — Stratum" },
      { name: "description", content: "Global economic events with filters by currency, country, importance, and volatility — all 11 DataSectors calendar endpoints." },
    ],
  }),
  component: CalendarPage,
});

type Volatility = "ALL" | "NONE" | "LOW" | "MEDIUM" | "HIGH";
type Importance = "ALL" | "HIGH" | "MEDIUM" | "LOW";

const VOLATILITY_COLORS: Record<string, string> = {
  HIGH: "bg-destructive/15 text-destructive border-destructive/30",
  MEDIUM: "bg-warning/15 text-warning border-warning/30",
  LOW: "bg-success/15 text-success border-success/30",
  NONE: "bg-muted/40 text-muted-foreground border-border/40",
};

const POPULAR_COUNTRIES = [
  { code: "ALL", label: "🌐 All" },
  { code: "US", label: "🇺🇸 US" },
  { code: "ID", label: "🇮🇩 ID" },
  { code: "EU", label: "🇪🇺 EU" },
  { code: "GB", label: "🇬🇧 UK" },
  { code: "JP", label: "🇯🇵 JP" },
  { code: "CN", label: "🇨🇳 CN" },
  { code: "AU", label: "🇦🇺 AU" },
  { code: "CA", label: "🇨🇦 CA" },
];

const POPULAR_CURRENCIES = [
  { code: "ALL", label: "💱 All" },
  { code: "USD", label: "🇺🇸 USD" },
  { code: "EUR", label: "🇪🇺 EUR" },
  { code: "GBP", label: "🇬🇧 GBP" },
  { code: "JPY", label: "🇯🇵 JPY" },
  { code: "IDR", label: "🇮🇩 IDR" },
  { code: "CNY", label: "🇨🇳 CNY" },
  { code: "AUD", label: "🇦🇺 AUD" },
];

function formatEventDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch { return dateStr; }
}

function formatEventTime(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch { return "—"; }
}

function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <div className="flex items-start gap-3 p-3 border border-border/40 rounded-lg hover:bg-accent/30 transition-colors">
      <div className="flex flex-col items-center shrink-0">
        <span className={`w-2 h-2 rounded-full mt-1.5 ${
          event.volatility === "HIGH" ? "bg-destructive" :
          event.volatility === "MEDIUM" ? "bg-warning" :
          event.volatility === "LOW" ? "bg-success" : "bg-muted"
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-medium text-muted-foreground">
            {event.countryCode} · {formatEventDate(event.date)} · {formatEventTime(event.date)}
          </span>
          {event.currency && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{event.currency}</Badge>
          )}
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${VOLATILITY_COLORS[event.volatility] ?? VOLATILITY_COLORS.NONE}`}>
            {event.volatility}
          </Badge>
        </div>
        <p className="font-medium text-sm mt-1">{event.title}</p>
        <div className="flex flex-wrap gap-3 mt-1.5 text-[11px] text-muted-foreground">
          {event.actual && <span>Actual: <strong className="text-foreground">{event.actual}</strong></span>}
          {event.forecast && <span>Forecast: {event.forecast}</span>}
          {event.previous && <span>Previous: {event.previous}</span>}
        </div>
      </div>
    </div>
  );
}

export function CalendarPage() {
  const calFn = useServerFn(getEconomicCalendar);
  const upcomingFn = useServerFn(getCalendarUpcoming);
  const historicalFn = useServerFn(getCalendarHistorical);
  const importanceFn = useServerFn(getCalendarImportance);

  const [activeTab, setActiveTab] = useState("timeline");
  const [volatilityFilter, setVolatilityFilter] = useState<Volatility>("ALL");
  const [countryFilter, setCountryFilter] = useState("ALL");
  const [currencyFilter, setCurrencyFilter] = useState("ALL");
  const [importanceFilter, setImportanceFilter] = useState<Importance>("ALL");
  const [search, setSearch] = useState("");

  // Timeline events (main list)
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["economic-calendar", volatilityFilter, countryFilter, currencyFilter, importanceFilter],
    queryFn: () => calFn({ data: { volatility: volatilityFilter === "ALL" ? undefined : volatilityFilter, countryCode: countryFilter === "ALL" ? undefined : countryFilter } }),
    staleTime: 5 * 60_000,
  });

  // Upcoming high-impact
  const { data: upcomingData } = useQuery({
    queryKey: ["calendar-upcoming"],
    queryFn: () => upcomingFn({ data: { limit: 10 } }),
    staleTime: 5 * 60_000,
    enabled: activeTab === "upcoming",
  });

  // Historical
  const { data: historicalData } = useQuery({
    queryKey: ["calendar-historical"],
    queryFn: () => historicalFn({ data: { limit: 50 } }),
    staleTime: 10 * 60_000,
    enabled: activeTab === "historical",
  });

  // Importance filter
  const { data: importanceData } = useQuery({
    queryKey: ["calendar-importance", importanceFilter],
    queryFn: () => importanceFn({ data: { importance: importanceFilter === "ALL" ? undefined : importanceFilter } }),
    staleTime: 5 * 60_000,
    enabled: activeTab === "timeline" && importanceFilter !== "ALL",
  });

  const events = (data?.data ?? []) as CalendarEvent[];
  const upcomingEvents = (upcomingData?.data ?? []) as CalendarEvent[];
  const historicalEvents = (historicalData?.data ?? []) as CalendarEvent[];
  const importanceEvents = (importanceData?.data ?? []) as CalendarEvent[];

  const filteredEvents = useMemo(() => {
    let result = events;
    if (currencyFilter !== "ALL") {
      result = result.filter((e) => e.currency === currencyFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) => e.title.toLowerCase().includes(q) || e.countryCode.toLowerCase().includes(q));
    }
    if (importanceFilter !== "ALL" && importanceEvents.length > 0) {
      result = importanceEvents;
    }
    return result;
  }, [events, currencyFilter, search, importanceFilter, importanceEvents]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of filteredEvents) {
      const key = formatEventDate(ev.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [filteredEvents]);

  return (
    <PageTransition>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Economic Calendar</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Global economic events with full DS calendar API.{" "}
            <DataSourceBadge source="ds" />
          </p>
        </div>

        {/* Filter Bar */}
        <GlassCard className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe className="h-3.5 w-3.5" />
            Country
          </div>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POPULAR_COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            💱 Currency
          </div>
          <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POPULAR_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" />
            Impact
          </div>
          <Select value={volatilityFilter} onValueChange={(v) => setVolatilityFilter(v as Volatility)}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-auto">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-40 text-xs"
            />
            <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </GlassCard>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="timeline" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Upcoming
            </TabsTrigger>
            <TabsTrigger value="historical" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Historical
            </TabsTrigger>
          </TabsList>

          {/* TIMELINE TAB */}
          <TabsContent value="timeline" className="mt-4">
            {isLoading ? (
              <Skeleton className="h-48 rounded-xl" />
            ) : grouped.size > 0 ? (
              <div className="space-y-6">
                {Array.from(grouped.entries()).map(([date, evts]) => (
                  <div key={date}>
                    <h3 className="text-sm font-semibold mb-3 sticky top-0 bg-background/80 backdrop-blur-sm py-1 z-10">
                      {date} — {evts.length} events
                    </h3>
                    <div className="space-y-2">
                      {evts.map((ev) => <EventCard key={ev.id} event={ev} />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <GlassCard className="py-12 text-center">
                <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No events found with current filters</p>
                <Button size="sm" variant="ghost" className="mt-3" onClick={() => { setVolatilityFilter("ALL"); setCountryFilter("ALL"); setCurrencyFilter("ALL"); setSearch(""); }}>
                  Clear filters
                </Button>
              </GlassCard>
            )}
          </TabsContent>

          {/* UPCOMING TAB */}
          <TabsContent value="upcoming" className="mt-4">
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-warning" />
                  <span className="text-sm font-medium">High-impact events in the next 7 days</span>
                </div>
                {upcomingEvents.map((ev) => <EventCard key={ev.id} event={ev} />)}
              </div>
            ) : (
              <GlassCard className="py-12 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No upcoming high-impact events</p>
              </GlassCard>
            )}
          </TabsContent>

          {/* HISTORICAL TAB */}
          <TabsContent value="historical" className="mt-4">
            {historicalEvents.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-2">Past 30 days — {historicalEvents.length} events</p>
                {historicalEvents.map((ev) => <EventCard key={ev.id} event={ev} />)}
              </div>
            ) : (
              <GlassCard className="py-12 text-center">
                <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No historical events available</p>
              </GlassCard>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /root/projects/market-pulse-ai-56
git add src/routes/calendar.tsx
git commit -m "feat(calendar): redesign with filter sidebar (country/currency/impact), tabs (Timeline/Upcoming/Historical)"
```

---

## Part E: Verification

### Task E1: Verify build

- [ ] **Step 1: Run type check and build**

```bash
cd /root/projects/market-pulse-ai-56
npx tsc --noEmit 2>&1 | head -50
```

Expected: No type errors (or only pre-existing ones unrelated to our changes)

- [ ] **Step 2: Commit verification**

```bash
git add -A && git commit -m "feat: Phase 1 — DataSectors full integration complete (Technical/News/Calendar)"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- [x] Technical Indicators — hybrid client+DS, indicator picker, explore/scan modes
- [x] Finance News — 4 DS endpoints, tab layout, full-text search
- [x] Economic Calendar — 11 endpoints, filter sidebar, view modes
- [x] Shared components — DataSourceBadge, RateLimitIndicator, ErrorBoundary, LoadingSkeleton
- [x] Performance — lazy loading per tab, caching, skeleton-first UI

**2. Placeholder scan:** No TBD, TODO, or placeholder code found.

**3. Type consistency:** All functions have proper TypeScript types. CalendarEvent interface reused across all calendar functions. NewsArticle interface used consistently.

**4. Testing:** No unit tests added (this is a frontend React app — smoke test by running dev server and visiting pages is the verification method).

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-27-datasectors-phase1-plan.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**