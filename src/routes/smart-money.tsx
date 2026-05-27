import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { getInstitutionalInvestors, getCandles } from "@/lib/datasectors.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fmtCompact, changeClass } from "@/lib/formatters";
import { RefreshCw, Zap } from "lucide-react";
import { DataSourceBadge } from "@/components/shared/DataSourceBadge";

export const Route = createFileRoute("/smart-money")({
  head: () => ({
    meta: [
      { title: "Smart Money Tracker — Stratum" },
      { name: "description", content: "Pantau akumulasi dan distribusi institusi besar di pasar IDX." },
    ],
  }),
  component: SmartMoneyPage,
});

type Timeframe = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y";
type Signal = "ALL" | "BULLISH" | "BEARISH" | "NEUTRAL";

const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "3M", "6M", "1Y"];
const SIGNAL_LABELS: Record<Signal, string> = {
  ALL: "All", BULLISH: "🟢 Akumulasi", BEARISH: "🔴 Distribution", NEUTRAL: "⚪ Neutral"
};
const SIGNAL_COLORS: Record<string, string> = {
  BULLISH: "text-green-400 bg-green-500/15 border-green-500/30",
  BEARISH: "text-red-400 bg-red-500/15 border-red-500/30",
  NEUTRAL: "text-muted-foreground bg-muted/40 border-border/50",
};

function calcSignal(netFlow: number): "BULLISH" | "BEARISH" | "NEUTRAL" {
  if (netFlow > 0) return "BULLISH";
  if (netFlow < 0) return "BEARISH";
  return "NEUTRAL";
}

function MiniSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <div className="w-16 h-6" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 64; const h = 24;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  const color = data[data.length - 1] >= data[0] ? "#10b981" : "#ef4444";
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

interface InstRecord {
  symbol: string;
  name: string;
  net_flow: number;
  volume: number;
  ownership_pct: number;
  ownership_change: number;
  last_price: number;
  change_pct: number;
}

export function SmartMoneyPage() {
  const instFn = useServerFn(getInstitutionalInvestors);

  const [timeframe, setTimeframe] = useState<Timeframe>("1M");
  const [signalFilter, setSignalFilter] = useState<Signal>("ALL");
  const [sortBy, setSortBy] = useState<"net_flow" | "volume" | "ownership_change">("net_flow");
  const [minFlow, setMinFlow] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data: instData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["smart-money", timeframe],
    queryFn: () => instFn({ data: { limit: 100 } }),
    staleTime: 5 * 60_000,
  });

  const rawList = (instData?.data as InstRecord[] | null) ?? [];

  const filtered = useMemo(() => {
    return rawList
      .map((r) => ({ ...r, signal: calcSignal(r.net_flow) }))
      .filter((r) => signalFilter === "ALL" || r.signal === signalFilter)
      .filter((r) => Math.abs(r.net_flow) >= minFlow)
      .sort((a, b) => {
        if (sortBy === "net_flow") return b.net_flow - a.net_flow;
        if (sortBy === "volume") return b.volume - a.volume;
        return b.ownership_change - a.ownership_change;
      });
  }, [rawList, signalFilter, minFlow, sortBy]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const sparklineQueries = useQueries({
    queries: paginated.slice(0, 5).map((r) => ({
      queryKey: ["candles-sm", r.symbol],
      queryFn: () => getCandles({ data: { symbol: r.symbol } }),
      staleTime: 10 * 60_000,
    })),
  });

  return (
    <PageTransition>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Smart Money Tracker</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Pantau akumulasi dan distribusi institusi besar.{" "}
            <DataSourceBadge source="ds" />
          </p>
        </div>

        <GlassCard className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {TIMEFRAMES.map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                  timeframe === t ? "border-primary/60 bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <Select value={signalFilter} onValueChange={(v) => setSignalFilter(v as Signal)}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SIGNAL_LABELS) as Signal[]).map((s) => (
                <SelectItem key={s} value={s}>{SIGNAL_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="net_flow">Net Flow</SelectItem>
              <SelectItem value="volume">Volume</SelectItem>
              <SelectItem value="ownership_change">Own Δ</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">Min IDR:</span>
            <input
              type="number"
              value={minFlow}
              onChange={(e) => setMinFlow(Number(e.target.value))}
              className="h-8 w-28 rounded-md border border-input bg-background px-2 text-xs"
            />
            <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </GlassCard>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total", value: filtered.length.toString() },
            { label: "🟢 Akumulasi", value: filtered.filter((r) => r.signal === "BULLISH").length.toString(), color: "text-green-400" },
            { label: "🔴 Distribution", value: filtered.filter((r) => r.signal === "BEARISH").length.toString(), color: "text-red-400" },
            { label: "⚪ Neutral", value: filtered.filter((r) => r.signal === "NEUTRAL").length.toString() },
          ].map((s) => (
            <GlassCard key={s.label} className="p-3 text-center">
              <p className={`text-xl font-bold ${(s as { label: string; value: string; color?: string }).color ?? ""}`}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
            </GlassCard>
          ))}
        </div>

        {isLoading ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : filtered.length === 0 ? (
          <GlassCard className="py-12 text-center">
            <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No stocks match current filters</p>
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => { setSignalFilter("ALL"); setMinFlow(0); }}>
              Clear filters
            </Button>
          </GlassCard>
        ) : (
          <GlassCard className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-background/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5">Symbol</th>
                  <th className="px-4 py-2.5 text-right">Last</th>
                  <th className="px-4 py-2.5 text-right">Chg%</th>
                  <th className="px-4 py-2.5 text-right">Net Flow</th>
                  <th className="px-4 py-2.5 text-right">Volume</th>
                  <th className="px-4 py-2.5 text-right">Inst Own%</th>
                  <th className="px-4 py-2.5 text-right">Own Δ</th>
                  <th className="px-4 py-2.5">Signal</th>
                  <th className="px-4 py-2.5">1M</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r, i) => {
                  const candleResult = sparklineQueries[i]?.data;
                  const closes = ((candleResult?.data ?? []) as Array<{ close: number }>).map((c) => c.close);
                  return (
                    <tr key={r.symbol} className="border-b border-border/30 hover:bg-accent/20">
                      <td className="px-4 py-2.5">
                        <Link to="/stocks/$symbol" params={{ symbol: r.symbol }}>
                          <div className="font-mono text-sm font-semibold">{r.symbol}</div>
                          <div className="truncate text-xs text-muted-foreground max-w-[180px]">{r.name}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{r.last_price.toLocaleString("id-ID")}</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${changeClass(r.change_pct)}`}>
                        {r.change_pct > 0 ? "+" : ""}{r.change_pct.toFixed(2)}%
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono ${r.net_flow > 0 ? "text-green-400" : r.net_flow < 0 ? "text-red-400" : ""}`}>
                        {r.net_flow >= 0 ? "+" : ""}{fmtCompact(Math.abs(r.net_flow))}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmtCompact(r.volume)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{r.ownership_pct.toFixed(1)}%</td>
                      <td className={`px-4 py-2.5 text-right font-mono ${r.ownership_change > 0 ? "text-green-400" : r.ownership_change < 0 ? "text-red-400" : ""}`}>
                        {r.ownership_change > 0 ? "+" : ""}{r.ownership_change.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${SIGNAL_COLORS[r.signal]}`}>
                          {SIGNAL_LABELS[r.signal]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {closes.length > 0 ? <MiniSparkline data={closes} /> : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </GlassCard>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(0)}>«</Button>
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>‹</Button>
            <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
            <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>›</Button>
            <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</Button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
