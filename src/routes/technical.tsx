import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getTiingoPrices } from "@/lib/tiingo.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { mockEquities } from "@/lib/mock-data";
import { technicalSummary } from "@/lib/indicators";
import { fmtPrice, changeClass } from "@/lib/formatters";
import { ArrowDown, ArrowUp, Activity, Filter } from "lucide-react";

export const Route = createFileRoute("/technical")({
  head: () => ({
    meta: [
      { title: "Technical Scanner — Stratum" },
      {
        name: "description",
        content:
          "Scan equities by RSI, MACD crossovers, trend strength and momentum to surface real trading setups.",
      },
    ],
  }),
  component: TechnicalPage,
});

type StanceFilter = "any" | "Bullish" | "Mildly Bullish" | "Neutral" | "Mildly Bearish" | "Bearish";

function TechnicalPage() {
  const tiingoFn = useServerFn(getTiingoPrices);
  const universe = mockEquities.slice(0, 20);

  const queries = useQueries({
    queries: universe.map((e) => ({
      queryKey: ["scan-prices", e.symbol],
      queryFn: () => tiingoFn({ data: { symbol: e.symbol, days: 365 } }),
      staleTime: 5 * 60_000,
    })),
  });

  const loading = queries.some((q) => q.isLoading);

  const [stance, setStance] = useState<StanceFilter>("any");
  const [sortKey, setSortKey] = useState<"score" | "rsi">("score");
  const [dir, setDir] = useState<"desc" | "asc">("desc");

  const rows = useMemo(() => {
    return universe
      .map((e, i) => {
        const candles = queries[i]?.data?.data ?? [];
        if (candles.length < 30) return null;
        const s = technicalSummary(
          candles.map((c) => c.close),
          candles.map((c) => c.high),
          candles.map((c) => c.low),
        );
        return { equity: e, summary: s };
      })
      .filter((x): x is { equity: typeof universe[number]; summary: ReturnType<typeof technicalSummary> } => x !== null)
      .filter((r) => stance === "any" || r.summary.stance === stance)
      .sort((a, b) => {
        const av = sortKey === "score" ? a.summary.score : a.summary.rsi ?? 0;
        const bv = sortKey === "score" ? b.summary.score : b.summary.rsi ?? 0;
        return dir === "desc" ? bv - av : av - bv;
      });
  }, [queries, stance, sortKey, dir, universe]);

  return (
    <PageTransition>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Technical Scanner</h1>
          <p className="text-sm text-muted-foreground">
            Live signals computed from RSI, MACD, moving averages and volatility across the universe.
          </p>
        </div>

        <GlassCard className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Stance
          </div>
          {(["any", "Bullish", "Mildly Bullish", "Neutral", "Mildly Bearish", "Bearish"] as StanceFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStance(s)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                stance === s
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "any" ? "All" : s}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant={sortKey === "score" ? "default" : "ghost"}
              onClick={() => {
                setSortKey("score");
                setDir(sortKey === "score" && dir === "desc" ? "asc" : "desc");
              }}
            >
              Score {sortKey === "score" && (dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
            </Button>
            <Button
              size="sm"
              variant={sortKey === "rsi" ? "default" : "ghost"}
              onClick={() => {
                setSortKey("rsi");
                setDir(sortKey === "rsi" && dir === "desc" ? "asc" : "desc");
              }}
            >
              RSI {sortKey === "rsi" && (dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
            </Button>
          </div>
        </GlassCard>

        {loading && rows.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : (
          <GlassCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
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
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ equity, summary }) => (
                    <tr key={equity.symbol} className="border-b border-border/30 hover:bg-accent/20">
                      <td className="px-4 py-2.5">
                        <Link to="/stocks/$symbol" params={{ symbol: equity.symbol }}>
                          <div className="font-mono text-sm font-semibold">{equity.symbol}</div>
                          <div className="truncate text-xs text-muted-foreground max-w-[200px]">{equity.name}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right num">{fmtPrice(summary.last)}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Activity className="h-3 w-3" />
                          {summary.trend}
                        </span>
                      </td>
                      <td className={`px-4 py-2.5 text-right num ${
                        summary.rsi != null && summary.rsi > 70 ? "text-loss" : summary.rsi != null && summary.rsi < 30 ? "text-gain" : ""
                      }`}>
                        {summary.rsi?.toFixed(1) ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs ${summary.macdCross === "Bullish" ? "text-gain" : "text-loss"}`}>
                          {summary.macdCross}
                          {summary.histTurning && ` · ${summary.histTurning}`}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-background/50">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${summary.score}%`,
                                background:
                                  summary.score >= 60
                                    ? "linear-gradient(90deg, #10b981, #34d399)"
                                    : summary.score >= 45
                                      ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                                      : "linear-gradient(90deg, #ef4444, #f87171)",
                              }}
                            />
                          </div>
                          <span className="num text-xs">{summary.score}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-2.5 text-xs ${changeClass(summary.score - 50)}`}>{summary.stance}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        No matches for current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}
      </div>
    </PageTransition>
  );
}
