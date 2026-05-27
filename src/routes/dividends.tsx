import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { getEquities } from "@/lib/datasectors.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtPrice, changeClass } from "@/lib/formatters";
import { fmtCompact } from "@/lib/formatters";
import { Calendar, RefreshCw, Search, Clock } from "lucide-react";
import { DataSourceBadge } from "@/components/shared/DataSourceBadge";

export const Route = createFileRoute("/dividends")({
  head: () => ({
    meta: [
      { title: "Dividend Tracker — Stratum" },
      { name: "description", content: "Pendapatan passive dari dividen berkualitas. Scan & ranking saham berdasarkan dividend yield." },
    ],
  }),
  component: DividendScannerPage,
});

type SortKey = "yield" | "dps" | "payout" | "ex_date";
type FreqFilter = "ALL" | "Annual" | "Semi-Annual" | "Quarterly";

const FREQ_COLORS: Record<string, string> = {
  "Annual": "bg-green-500/15 text-green-400 border-green-500/30",
  "Semi-Annual": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Quarterly": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

interface DividendStock {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  dividend_yield: number | null;
  dividend_per_share: number | null;
  payout_ratio: number | null;
  frequency: string;
  next_ex_date: string | null;
  sector: string;
}

function yieldColor(y: number): string {
  if (y >= 5) return "text-green-400";
  if (y >= 2) return "text-yellow-400";
  return "text-muted-foreground";
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export function DividendScannerPage() {
  const equitiesFn = useServerFn(getEquities);

  const [minYield, setMinYield] = useState(2);
  const [freqFilter, setFreqFilter] = useState<FreqFilter>("ALL");
  const [sectorFilter, setSectorFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("yield");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["dividend-scanner"],
    queryFn: () => equitiesFn({ data: { limit: 200 } }),
    staleTime: 10 * 60_000,
  });

  const rawStocks = (data?.data ?? []) as unknown as DividendStock[];

  const sectors = useMemo(() => {
    const set = new Set(rawStocks.map((s) => s.sector).filter(Boolean));
    return ["ALL", ...Array.from(set).sort()];
  }, [rawStocks]);

  const filtered = useMemo(() => {
    return rawStocks
      .filter((s) => (s.dividend_yield ?? 0) >= minYield)
      .filter((s) => freqFilter === "ALL" || s.frequency === freqFilter)
      .filter((s) => sectorFilter === "ALL" || s.sector === sectorFilter)
      .filter((s) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sortBy === "yield") return (b.dividend_yield ?? 0) - (a.dividend_yield ?? 0);
        if (sortBy === "dps") return (b.dividend_per_share ?? 0) - (a.dividend_per_share ?? 0);
        if (sortBy === "payout") return (a.payout_ratio ?? 0) - (b.payout_ratio ?? 0);
        const aDays = daysUntil(a.next_ex_date) ?? 999;
        const bDays = daysUntil(b.next_ex_date) ?? 999;
        return aDays - bDays;
      });
  }, [rawStocks, minYield, freqFilter, sectorFilter, search, sortBy]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const upcomingExDates = filtered.filter((s) => s.next_ex_date).slice(0, 10);

  return (
    <PageTransition>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dividend Tracker</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Pendapatan passive dari dividen berkualitas.{" "}
            <DataSourceBadge source="ds" />
          </p>
        </div>

        <GlassCard className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Min Yield:</span>
            <span className="text-xs font-mono font-medium">{minYield}%</span>
            <input
              type="range" min="0" max="15" step="0.5"
              value={minYield}
              onChange={(e) => setMinYield(Number(e.target.value))}
              className="w-28 accent-primary"
            />
            <span className="text-xs text-muted-foreground">({filtered.length} stocks)</span>
          </div>

          <Select value={freqFilter} onValueChange={(v) => setFreqFilter(v as FreqFilter)}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="Annual">Annual</SelectItem>
              <SelectItem value="Semi-Annual">Semi-Annual</SelectItem>
              <SelectItem value="Quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sectorFilter} onValueChange={setSectorFilter}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sectors.map((s) => (
                <SelectItem key={s} value={s}>{s === "ALL" ? "All Sectors" : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yield">Yield%</SelectItem>
              <SelectItem value="dps">DPS</SelectItem>
              <SelectItem value="payout">Payout</SelectItem>
              <SelectItem value="ex_date">Ex-Date</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-auto">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="BBRI, TLKM..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-28 text-xs" />
            <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </GlassCard>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Qualified", value: filtered.length.toString() },
            { label: "Avg Yield", value: filtered.length > 0 ? `${(filtered.reduce((s, r) => s + (r.dividend_yield ?? 0), 0) / filtered.length).toFixed(1)}%` : "—" },
            { label: "Annual Only", value: filtered.filter((r) => r.frequency === "Annual").length.toString() },
          ].map((s) => (
            <GlassCard key={s.label} className="p-3 text-center">
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
            </GlassCard>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            {isLoading ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : filtered.length === 0 ? (
              <GlassCard className="py-12 text-center">
                <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No stocks with dividend yield ≥ {minYield}%</p>
                <Button size="sm" variant="ghost" className="mt-3" onClick={() => setMinYield(0)}>
                  Clear yield filter
                </Button>
              </GlassCard>
            ) : (
              <GlassCard className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-background/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5">Symbol</th>
                      <th className="px-4 py-2.5 text-right">Price</th>
                      <th className="px-4 py-2.5 text-right">Yield%</th>
                      <th className="px-4 py-2.5 text-right">DPS</th>
                      <th className="px-4 py-2.5 text-right">Payout%</th>
                      <th className="px-4 py-2.5">Freq</th>
                      <th className="px-4 py-2.5 text-right">Ex-Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((s) => {
                      const days = daysUntil(s.next_ex_date);
                      return (
                        <tr key={s.symbol} className="border-b border-border/30 hover:bg-accent/20">
                          <td className="px-4 py-2.5">
                            <Link to="/stocks/$symbol" params={{ symbol: s.symbol }} search={{ tab: "dividends" }}>
                              <div className="font-mono text-sm font-semibold">{s.symbol}</div>
                              <div className="truncate text-xs text-muted-foreground max-w-[150px]">{s.name}</div>
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">{fmtPrice(s.price)}</td>
                          <td className={`px-4 py-2.5 text-right font-mono font-semibold ${yieldColor(s.dividend_yield ?? 0)}`}>
                            {s.dividend_yield != null ? `${s.dividend_yield.toFixed(2)}%` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            {s.dividend_per_share != null ? `IDR ${s.dividend_per_share.toLocaleString("id-ID")}` : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {s.payout_ratio != null ? (
                              <span className={`text-xs ${s.payout_ratio > 100 ? "text-red-400" : s.payout_ratio > 80 ? "text-yellow-400" : "text-green-400"}`}>
                                {s.payout_ratio.toFixed(0)}%
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${FREQ_COLORS[s.frequency] ?? "border-border"}`}>
                              {s.frequency}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {days != null ? (
                              <span className={`text-xs font-mono ${days <= 7 ? "text-red-400 font-semibold" : days <= 14 ? "text-yellow-400" : "text-muted-foreground"}`}>
                                {days}d
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </GlassCard>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-3">
                <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(0)}>«</Button>
                <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>‹</Button>
                <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
                <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>›</Button>
                <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</Button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <GlassCard className="p-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4" />
                Upcoming Ex-Dates
              </h3>
              {upcomingExDates.length > 0 ? (
                <div className="space-y-2">
                  {upcomingExDates.map((s) => {
                    const days = daysUntil(s.next_ex_date);
                    return (
                      <Link key={s.symbol} to="/stocks/$symbol" params={{ symbol: s.symbol }} search={{ tab: "dividends" }}>
                        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors">
                          <div>
                            <p className="font-mono text-sm font-semibold">{s.symbol}</p>
                            <p className="text-[10px] text-muted-foreground truncate max-w-[100px]">{s.name}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-mono font-semibold ${days != null && days <= 7 ? "text-red-400" : ""}`}>
                              {days != null ? `${days}d` : "—"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {s.dividend_yield != null ? `${s.dividend_yield.toFixed(1)}%` : "—"}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No upcoming ex-dates</p>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
