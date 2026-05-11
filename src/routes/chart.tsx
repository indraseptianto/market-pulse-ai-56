import { createFileRoute } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  getChartSaham,
  getChartPrice,
  getIndicator,
  type ChartTimeframe,
} from "@/lib/datasectors.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { AdvancedChart, type ChartType } from "@/components/charts/AdvancedChart";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fmtPrice, changeClass } from "@/lib/formatters";
import {
  CandlestickChart,
  Maximize2,
  Search,
  RefreshCw,
  ChevronDown,
  Activity,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/chart")({
  head: () => ({
    meta: [
      { title: "Advanced Chart — Stratum" },
      {
        name: "description",
        content:
          "TradingView-style charts with 50+ technical indicators powered by DataSectors.",
      },
    ],
  }),
  component: ChartPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────
export type IndicatorKey =
  | "volume" | "sma20" | "sma50" | "sma200" | "ema20" | "ema50"
  | "bollinger" | "rsi" | "macd" | "stochastic" | "cci" | "atr"
  | "supertrend" | "adx" | "obv" | "vwap" | "mfi" | "ichimoku";

export type IndicatorToggles = Record<IndicatorKey, boolean>;

// ── Static config (defined outside component — never changes) ─────────────────
const IDX_TIMEFRAMES: { id: ChartTimeframe; label: string; days: number }[] = [
  { id: "1m",    label: "1m",  days: 1   },
  { id: "5m",    label: "5m",  days: 5   },
  { id: "15m",   label: "15m", days: 10  },
  { id: "30m",   label: "30m", days: 20  },
  { id: "1h",    label: "1h",  days: 30  },
  { id: "4h",    label: "4h",  days: 60  },
  { id: "daily", label: "1D",  days: 365 },
];

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: "candles", label: "Candles" },
  { id: "heikin",  label: "Heikin Ashi" },
  { id: "line",    label: "Line" },
  { id: "area",    label: "Area" },
];

// ALL indicator definitions — fixed array, never changes length
// This is critical: useQueries needs a stable-length array
const ALL_IND_DEFS: {
  key: IndicatorKey;
  label: string;
  dsName: string | null;
  params?: Record<string, unknown>;
  group: string;
  isOverlay: boolean;
}[] = [
  // Overlay (no sub-pane)
  { key: "volume",    label: "Volume",          dsName: null,         group: "Overlay",            isOverlay: true  },
  { key: "sma20",     label: "SMA 20",          dsName: "sma",        group: "Overlay",            isOverlay: true,  params: { period: 20  } },
  { key: "sma50",     label: "SMA 50",          dsName: "sma",        group: "Overlay",            isOverlay: true,  params: { period: 50  } },
  { key: "sma200",    label: "SMA 200",         dsName: "sma",        group: "Overlay",            isOverlay: true,  params: { period: 200 } },
  { key: "ema20",     label: "EMA 20",          dsName: "ema",        group: "Overlay",            isOverlay: true,  params: { period: 20  } },
  { key: "ema50",     label: "EMA 50",          dsName: "ema",        group: "Overlay",            isOverlay: true,  params: { period: 50  } },
  { key: "bollinger", label: "Bollinger Bands", dsName: "bollinger",  group: "Overlay",            isOverlay: true  },
  { key: "ichimoku",  label: "Ichimoku Cloud",  dsName: "ichimoku",   group: "Overlay",            isOverlay: true  },
  { key: "vwap",      label: "VWAP",            dsName: "vwap",       group: "Overlay",            isOverlay: true  },
  { key: "supertrend",label: "Super Trend",     dsName: "supertrend", group: "Overlay",            isOverlay: true  },
  { key: "atr",       label: "ATR (14)",        dsName: "atr",        group: "Trend / Volatility", isOverlay: true  },
  // Sub-pane
  { key: "rsi",        label: "RSI (14)",   dsName: "rsi",        group: "Momentum",         isOverlay: false },
  { key: "macd",       label: "MACD",       dsName: "macd",       group: "Momentum",         isOverlay: false },
  { key: "stochastic", label: "Stochastic", dsName: "stochastic", group: "Momentum",         isOverlay: false },
  { key: "cci",        label: "CCI (20)",   dsName: "cci",        group: "Momentum",         isOverlay: false },
  { key: "mfi",        label: "MFI (14)",   dsName: "mfi",        group: "Momentum",         isOverlay: false },
  { key: "adx",        label: "ADX (14)",   dsName: "adx",        group: "Trend / Volatility",isOverlay: false },
  { key: "obv",        label: "OBV",        dsName: "obv",        group: "Volume",           isOverlay: false },
];

const INDICATOR_GROUPS = [
  "Overlay",
  "Momentum",
  "Trend / Volatility",
  "Volume",
] as const;

const DEFAULT_INDICATORS: IndicatorToggles = {
  volume: true, sma20: true, sma50: true, sma200: false,
  ema20: false, ema50: false, bollinger: false, ichimoku: false,
  vwap: false, supertrend: false, atr: false,
  rsi: true, macd: true, stochastic: false, cci: false, mfi: false,
  adx: false, obv: false,
};

const QUICK_TOGGLES: IndicatorKey[] = [
  "volume", "sma20", "sma50", "ema20", "bollinger",
  "rsi", "macd", "supertrend", "adx",
];

const POPULAR = ["BBCA", "BBRI", "TLKM", "ASII", "GOTO", "BREN", "MDKA", "UNVR"];

const TF_MAP: Record<ChartTimeframe, string> = {
  "1m": "1", "5m": "5", "15m": "15", "30m": "30",
  "1h": "60", "4h": "240", "daily": "D",
};

// ── Page ─────────────────────────────────────────────────────────────────────
function ChartPage() {
  const [symbol,     setSymbol]     = useState("BBCA");
  const [draft,      setDraft]      = useState("BBCA");
  const [timeframe,  setTimeframe]  = useState<ChartTimeframe>("daily");
  const [chartType,  setChartType]  = useState<ChartType>("candles");
  const [indicators, setIndicators] = useState<IndicatorToggles>(DEFAULT_INDICATORS);
  const [fullscreen, setFullscreen] = useState(false);

  const dsSymbol = `IDX:${symbol}`;
  const dsTf     = TF_MAP[timeframe] ?? "D";
  const tfConfig = IDX_TIMEFRAMES.find((t) => t.id === timeframe)!;

  const today    = useMemo(() => new Date(), []);
  const fromDate = useMemo(
    () => new Date(today.getTime() - tfConfig.days * 86400000).toISOString().slice(0, 10),
    [today, tfConfig.days],
  );
  const toDate = useMemo(() => today.toISOString().slice(0, 10), [today]);

  // ── Server functions ──────────────────────────────────────────────────────
  const chartSahamFn = useServerFn(getChartSaham);
  const chartPriceFn = useServerFn(getChartPrice);
  const indicatorFn  = useServerFn(getIndicator);

  // ── OHLCV queries ─────────────────────────────────────────────────────────
  const [sahamResult, priceResult] = useQueries({
    queries: [
      {
        queryKey: ["chart-saham", symbol, timeframe, fromDate, toDate],
        queryFn: () => chartSahamFn({ data: { symbol, timeframe, from: fromDate, to: toDate } }),
        staleTime: 60_000,
      },
      {
        queryKey: ["chart-price", dsSymbol, dsTf],
        queryFn: () => chartPriceFn({ data: { symbol: dsSymbol, timeframe: dsTf, range: 500 } }),
        staleTime: 60_000,
        enabled: false, // only used as fallback, triggered manually below
      },
    ],
  });

  const candles = useMemo(() => {
    if (sahamResult.data?.source === "api" && sahamResult.data.data.length > 0)
      return sahamResult.data.data;
    if (priceResult.data?.source === "api" && priceResult.data.data.length > 0)
      return priceResult.data.data;
    return sahamResult.data?.data ?? [];
  }, [sahamResult.data, priceResult.data]);

  // Trigger price fallback if saham returns mock
  useEffect(() => {
    if (sahamResult.data?.source === "mock" && !priceResult.data) {
      priceResult.refetch();
    }
  }, [sahamResult.data?.source]);

  const isLoading  = sahamResult.isLoading;
  const isFetching = sahamResult.isFetching || priceResult.isFetching;
  const dataSource = sahamResult.data?.source === "api" ? "IDX"
    : priceResult.data?.source === "api" ? "Chart API"
    : "Demo";

  // ── Indicator queries — useQueries with FIXED-LENGTH array ───────────────
  // CRITICAL: useQueries must always receive the same number of queries.
  // We always query ALL indicators but set enabled=false for inactive ones.
  const indQueryResults = useQueries({
    queries: ALL_IND_DEFS.map((def) => ({
      queryKey: ["indicator", dsSymbol, dsTf, def.dsName, JSON.stringify(def.params ?? {})],
      queryFn: () =>
        indicatorFn({
          data: {
            symbol: dsSymbol,
            indicator: def.dsName!,
            timeframe: dsTf,
            range: 500,
            params: def.params,
          },
        }),
      staleTime: 120_000,
      // Only fetch when: indicator is active, has a dsName, and candles are loaded
      enabled: !!def.dsName && indicators[def.key] && candles.length > 0,
    })),
  });

  // Build stable map: key → data array
  const indicatorData = useMemo(() => {
    const map: Record<string, { time: number; [k: string]: number | string | null }[]> = {};
    ALL_IND_DEFS.forEach((def, i) => {
      map[def.key] = indQueryResults[i]?.data?.data ?? [];
    });
    return map;
  }, [indQueryResults]);

  // ── Derived values ────────────────────────────────────────────────────────
  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];
  const changePct  = lastCandle && prevCandle
    ? ((lastCandle.close - prevCandle.close) / prevCandle.close) * 100
    : null;

  useEffect(() => {
    document.body.style.overflow = fullscreen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [fullscreen]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.trim()) setSymbol(draft.trim().toUpperCase());
  };

  const toggleIndicator = useCallback((key: IndicatorKey) => {
    setIndicators((s) => ({ ...s, [key]: !s[key] }));
  }, []);

  // Count active non-volume indicators for badge
  const activeIndCount = ALL_IND_DEFS.filter(
    (d) => d.key !== "volume" && indicators[d.key],
  ).length;

  return (
    <PageTransition>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Advanced Chart</h1>
            <p className="text-sm text-muted-foreground">
              IDX stocks · DataSectors Chart Saham + 50+ technical indicators
            </p>
          </div>
          <form onSubmit={submit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value.toUpperCase())}
                placeholder="Symbol (e.g. BBCA)"
                className="w-[160px] pl-8 font-mono uppercase"
              />
            </div>
            <Button type="submit" size="sm">Load</Button>
          </form>
        </div>

        {/* Popular symbols */}
        <div className="flex flex-wrap gap-1.5">
          {POPULAR.map((p) => (
            <button
              key={p}
              onClick={() => { setSymbol(p); setDraft(p); }}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-mono transition ${
                symbol === p
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Chart card */}
        <GlassCard className={fullscreen ? "fixed inset-2 z-50 overflow-auto" : ""}>
          {/* Toolbar row 1: symbol info + timeframe + chart type */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <CandlestickChart className="h-4 w-4 text-primary" />
              <span className="font-mono text-lg font-semibold">{symbol}</span>
              {lastCandle && (
                <>
                  <span className="num text-base font-medium">{fmtPrice(lastCandle.close)}</span>
                  {changePct != null && (
                    <span className={`text-xs num ${changeClass(changePct)}`}>
                      {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                    </span>
                  )}
                </>
              )}
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {dataSource}
              </Badge>
              {isFetching && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup>
                {IDX_TIMEFRAMES.map((tf) => (
                  <ToggleBtn key={tf.id} active={timeframe === tf.id} onClick={() => setTimeframe(tf.id)}>
                    {tf.label}
                  </ToggleBtn>
                ))}
              </ToggleGroup>
              <ToggleGroup>
                {CHART_TYPES.map((t) => (
                  <ToggleBtn key={t.id} active={chartType === t.id} onClick={() => setChartType(t.id)}>
                    {t.label}
                  </ToggleBtn>
                ))}
              </ToggleGroup>
              <Button variant="ghost" size="icon" onClick={() => setFullscreen((f) => !f)}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Toolbar row 2: indicator toggles */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {QUICK_TOGGLES.map((key) => {
              const def = ALL_IND_DEFS.find((d) => d.key === key)!;
              const loading = !!def.dsName && indicators[key] && indQueryResults[ALL_IND_DEFS.indexOf(def)]?.isFetching;
              return (
                <button
                  key={key}
                  onClick={() => toggleIndicator(key)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
                    indicators[key]
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {def.label.replace(" (14)", "").replace(" Bands", "").replace(" Trend", "T")}
                  {loading && <RefreshCw className="h-2.5 w-2.5 animate-spin" />}
                </button>
              );
            })}

            {/* More dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 rounded-full border border-border/50 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground">
                  More <ChevronDown className="h-3 w-3" />
                  {activeIndCount > 0 && (
                    <span className="rounded-full bg-primary/20 px-1.5 text-[10px] text-primary">
                      {activeIndCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {INDICATOR_GROUPS.map((group) => {
                  const items = ALL_IND_DEFS.filter((d) => d.group === group);
                  return (
                    <div key={group}>
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {group}
                      </DropdownMenuLabel>
                      {items.map((def) => (
                        <DropdownMenuItem
                          key={def.key}
                          onClick={() => toggleIndicator(def.key)}
                          className="flex cursor-pointer items-center justify-between"
                        >
                          <span>{def.label}</span>
                          {indicators[def.key] && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                    </div>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Chart */}
          {isLoading ? (
            <Skeleton className="h-[480px] rounded-xl" />
          ) : candles.length === 0 ? (
            <div className="grid h-[480px] place-items-center text-sm text-muted-foreground">
              No price data for {symbol}. Try a different symbol.
            </div>
          ) : (
            <AdvancedChart
              candles={candles}
              type={chartType}
              indicators={indicators}
              indicatorData={indicatorData}
              height={fullscreen ? Math.max(window.innerHeight - 280, 500) : 480}
            />
          )}
        </GlassCard>

        {/* Indicator summary strip */}
        {candles.length > 0 && (
          <IndicatorSummary
            indicatorData={indicatorData}
            indicators={indicators}
            lastClose={lastCandle?.close ?? 0}
          />
        )}
      </div>
    </PageTransition>
  );
}

// ── Indicator summary ─────────────────────────────────────────────────────────
function IndicatorSummary({
  indicatorData,
  indicators,
  lastClose,
}: {
  indicatorData: Record<string, { time: number; [k: string]: number | string | null }[]>;
  indicators: IndicatorToggles;
  lastClose: number;
}) {
  const cards: { label: string; value: string; tone?: "gain" | "loss" | "neutral" }[] = [];

  const last = (key: string) => {
    const arr = indicatorData[key];
    return arr?.length ? arr[arr.length - 1] : null;
  };
  const num = (pt: Record<string, unknown> | null, ...keys: string[]) => {
    if (!pt) return null;
    for (const k of keys) {
      const v = pt[k];
      if (typeof v === "number" && isFinite(v)) return v;
      if (typeof v === "string") { const n = Number(v); if (isFinite(n)) return n; }
    }
    return null;
  };

  if (indicators.rsi) {
    const v = num(last("rsi"), "rsi", "value");
    if (v) cards.push({ label: "RSI (14)", value: `${v.toFixed(1)} · ${v > 70 ? "Overbought" : v < 30 ? "Oversold" : "Neutral"}`, tone: v > 70 ? "loss" : v < 30 ? "gain" : "neutral" });
  }
  if (indicators.macd) {
    const v = num(last("macd"), "histogram", "hist");
    if (v != null) cards.push({ label: "MACD Hist", value: v.toFixed(2), tone: v > 0 ? "gain" : "loss" });
  }
  if (indicators.adx) {
    const v = num(last("adx"), "adx", "value");
    if (v) cards.push({ label: "ADX (14)", value: `${v.toFixed(1)} · ${v > 25 ? "Trending" : "Ranging"}`, tone: v > 25 ? "gain" : "neutral" });
  }
  if (indicators.supertrend) {
    const pt = last("supertrend");
    const v = num(pt, "supertrend", "value");
    const dir = num(pt, "direction", "trend");
    if (v) cards.push({ label: "SuperTrend", value: `${v.toFixed(0)} · ${dir === 1 ? "Bullish" : "Bearish"}`, tone: dir === 1 ? "gain" : "loss" });
  }
  if (indicators.bollinger) {
    const pt = last("bollinger");
    const upper = num(pt, "upper"); const lower = num(pt, "lower");
    if (upper && lower) {
      const pos = ((lastClose - lower) / (upper - lower)) * 100;
      cards.push({ label: "BB %", value: `${pos.toFixed(0)}% · ${pos > 80 ? "Near Upper" : pos < 20 ? "Near Lower" : "Mid"}`, tone: pos > 80 ? "loss" : pos < 20 ? "gain" : "neutral" });
    }
  }
  if (indicators.obv) {
    const arr = indicatorData.obv;
    if (arr?.length >= 2) {
      const l = num(arr[arr.length - 1] as Record<string, unknown>, "obv", "value");
      const p = num(arr[arr.length - 2] as Record<string, unknown>, "obv", "value");
      if (l != null && p != null) cards.push({ label: "OBV", value: l > p ? "Rising" : "Falling", tone: l > p ? "gain" : "loss" });
    }
  }
  if (indicators.cci) {
    const v = num(last("cci"), "cci", "value");
    if (v != null) cards.push({ label: "CCI (20)", value: `${v.toFixed(1)} · ${v > 100 ? "Overbought" : v < -100 ? "Oversold" : "Neutral"}`, tone: v > 100 ? "loss" : v < -100 ? "gain" : "neutral" });
  }
  if (indicators.mfi) {
    const v = num(last("mfi"), "mfi", "value");
    if (v) cards.push({ label: "MFI (14)", value: `${v.toFixed(1)} · ${v > 80 ? "Overbought" : v < 20 ? "Oversold" : "Neutral"}`, tone: v > 80 ? "loss" : v < 20 ? "gain" : "neutral" });
  }

  if (cards.length === 0) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      {cards.map((c) => (
        <GlassCard key={c.label} className="py-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3 w-3" />
            {c.label}
          </div>
          <div className={`mt-1 text-sm font-semibold num ${
            c.tone === "gain" ? "text-gain" : c.tone === "loss" ? "text-loss" : ""
          }`}>
            {c.value}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function ToggleGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex overflow-hidden rounded-lg border border-border/50">{children}</div>;
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-[11px] transition ${
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
