import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getTiingoPrices } from "@/lib/tiingo.functions";
import { getIndicatorList, type IndicatorInfo } from "@/lib/datasectors.functions";
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

const DEFAULT_INDICATORS = [
  { name: "SMA", displayName: "Simple Moving Average", category: "Moving Average" },
  { name: "EMA", displayName: "Exponential Moving Average", category: "Moving Average" },
  { name: "RSI", displayName: "RSI", category: "Momentum" },
  { name: "MACD", displayName: "MACD", category: "Momentum" },
  { name: "BB", displayName: "Bollinger Bands", category: "Volatility" },
  { name: "ATR", displayName: "ATR", category: "Volatility" },
  { name: "ADX", displayName: "ADX", category: "Trend" },
  { name: "CCI", displayName: "CCI", category: "Momentum" },
  { name: "WILLR", displayName: "Williams %R", category: "Momentum" },
  { name: "ROC", displayName: "ROC", category: "Momentum" },
  { name: "STOCH", displayName: "Stochastic", category: "Momentum" },
  { name: "VWAP", displayName: "VWAP", category: "Volume" },
];

export function TechnicalPage() {
  const tiingoFn = useServerFn(getTiingoPrices);
  const indicatorListFn = useServerFn(getIndicatorList);

  const [mode, setMode] = useState<Mode>("scan");
  const [exploreSymbol, setExploreSymbol] = useState("");
  const [selectedIndicator, setSelectedIndicator] = useState("RSI");

  // Indicator list query
  const { data: indicatorData } = useQuery({
    queryKey: ["indicator-list"],
    queryFn: () => indicatorListFn(),
    staleTime: 10 * 60_000,
  });

  const indicatorList = indicatorData?.data ?? DEFAULT_INDICATORS;

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
        const prices = candles.map((c: { close: number }) => c.close);
        const highs = candles.map((c: { high: number }) => c.high);
        const lows = candles.map((c: { low: number }) => c.low);
        const s = technicalSummary(prices, highs, lows);
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

  // Explore mode: find explore symbol in universe
  const exploreCandles = useMemo(() => {
    const sym = exploreSymbol.trim().toUpperCase();
    if (!sym) return [];
    const idx = universe.findIndex((e) => e.symbol === sym);
    if (idx < 0) return [];
    return scanQueries[idx]?.data?.data ?? [];
  }, [exploreSymbol, scanQueries, universe]);

  return (
    <PageTransition>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Technical Scanner</h1>
          <p className="text-sm text-muted-foreground">
            50+ indicators via DataSectors API with client-side fallback.{" "}
            <DataSourceBadge source="client" className="ml-1" />
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
                          <span className={`text-[11px] font-medium ${summary.trend.includes("Up") ? "text-green-400" : summary.trend.includes("Down") ? "text-red-400" : "text-muted-foreground"}`}>
                            {summary.trend}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`font-mono text-xs ${(summary.rsi ?? 50) > 70 ? "text-red-400" : (summary.rsi ?? 50) < 30 ? "text-green-400" : ""}`}>
                            {summary.rsi?.toFixed(1) ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[11px] font-medium ${summary.macdCross === "Bullish" ? "text-green-400" : summary.macdCross === "Bearish" ? "text-red-400" : ""}`}>
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
                            summary.stance === "Bullish" ? "border-green-500/30 bg-green-500/15 text-green-400" :
                            summary.stance === "Bearish" ? "border-red-500/30 bg-red-500/15 text-red-400" :
                            summary.stance.includes("Mild") ? "border-yellow-500/30 bg-yellow-500/15 text-yellow-400" :
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
                  <IndicatorChart candles={exploreCandles as unknown as { date: string; open: number; high: number; low: number; close: number; volume: number }[]} indicator={selectedIndicator} />
                </GlassCard>
                <GlassCard>
                  <p className="text-sm text-muted-foreground mb-2">Other indicators for {exploreSymbol}</p>
                  <div className="grid grid-cols-3 gap-4">
                    {["RSI", "MACD", "BB"].map((ind) => (
                      <IndicatorChart key={ind} candles={exploreCandles as unknown as { date: string; open: number; high: number; low: number; close: number; volume: number }[]} indicator={ind} />
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