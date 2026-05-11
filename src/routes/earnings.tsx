import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { getEarningsCalendar, getStockEarnings } from "@/lib/datasectors.functions";
import { mockEquities } from "@/lib/mock-data";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { fmtCompact } from "@/lib/formatters";
import {
  CalendarDays, TrendingUp, TrendingDown, AlertTriangle,
  ChevronLeft, ChevronRight, Search, RefreshCw, Zap, BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMounted } from "@/hooks/use-mounted";

export const Route = createFileRoute("/earnings")({
  head: () => ({
    meta: [
      { title: "Earnings Calendar — Stratum" },
      { name: "description", content: "Jadwal rilis laporan keuangan emiten IDX per minggu. Antisipasi volatilitas sebelum earnings." },
    ],
  }),
  component: EarningsPage,
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeNum(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); if (isFinite(n)) return n; }
  return null;
}

function unwrapArray(payload: unknown): Record<string, unknown>[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const o = payload as Record<string, unknown>;
  for (const k of ["data", "earnings", "results", "items", "calendar"]) {
    if (Array.isArray(o[k])) return o[k] as Record<string, unknown>[];
  }
  return [];
}

interface EarningsEvent {
  id: string;
  symbol: string;
  companyName: string;
  reportDate: string;       // YYYY-MM-DD
  period: string;           // e.g. "Q1 2025"
  eps: number | null;
  epsEst: number | null;
  revenue: number | null;
  revenueEst: number | null;
  surprise: number | null;  // % vs estimate
  status: "upcoming" | "reported";
  sector: string;
}

function mapEarningsEvent(r: Record<string, unknown>): EarningsEvent {
  const reportDate = String(r.report_date ?? r.reportDate ?? r.date ?? r.earnings_date ?? "");
  const isUpcoming = reportDate ? new Date(reportDate) >= new Date() : true;
  return {
    id: String(r.id ?? r._id ?? `${r.symbol}-${reportDate}`),
    symbol: String(r.symbol ?? r.ticker ?? ""),
    companyName: String(r.company_name ?? r.companyName ?? r.name ?? ""),
    reportDate,
    period: String(r.period ?? r.fiscal_period ?? r.quarter ?? ""),
    eps: safeNum(r.eps ?? r.eps_actual),
    epsEst: safeNum(r.eps_estimate ?? r.epsEstimate ?? r.eps_est),
    revenue: safeNum(r.revenue ?? r.revenue_actual),
    revenueEst: safeNum(r.revenue_estimate ?? r.revenueEstimate ?? r.revenue_est),
    surprise: safeNum(r.surprise ?? r.eps_surprise_pct ?? r.surprisePct),
    status: isUpcoming ? "upcoming" : "reported",
    sector: String(r.sector ?? ""),
  };
}

// Generate mock earnings from mockEquities for fallback
function generateMockEarnings(): EarningsEvent[] {
  const today = new Date();
  return mockEquities.slice(0, 20).map((e, i) => {
    const daysOffset = (i % 14) - 7; // spread across -7 to +7 days
    const date = new Date(today.getTime() + daysOffset * 86400000);
    const dateStr = date.toISOString().slice(0, 10);
    const quarter = Math.ceil((date.getMonth() + 1) / 3);
    const year = date.getFullYear();
    const isUpcoming = daysOffset >= 0;
    return {
      id: `mock-${e.symbol}`,
      symbol: e.symbol,
      companyName: e.name,
      reportDate: dateStr,
      period: `Q${quarter} ${year}`,
      eps: isUpcoming ? null : e.eps ?? null,
      epsEst: e.eps ? e.eps * (0.9 + Math.random() * 0.2) : null,
      revenue: isUpcoming ? null : e.revenue_ttm ? e.revenue_ttm / 4 : null,
      revenueEst: e.revenue_ttm ? e.revenue_ttm / 4 * (0.95 + Math.random() * 0.1) : null,
      surprise: isUpcoming ? null : (Math.random() - 0.4) * 20,
      status: isUpcoming ? "upcoming" : "reported",
      sector: e.sector,
    };
  });
}

// ── Week navigation ───────────────────────────────────────────────────────────
function getWeekRange(offset: number): { start: Date; end: Date; label: string } {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1 + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 6);
  friday.setHours(23, 59, 59, 999);

  const fmt = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  const label = offset === 0 ? `Minggu Ini (${fmt(monday)} – ${fmt(friday)})`
    : offset === 1 ? `Minggu Depan (${fmt(monday)} – ${fmt(friday)})`
    : offset === -1 ? `Minggu Lalu (${fmt(monday)} – ${fmt(friday)})`
    : `${fmt(monday)} – ${fmt(friday)}`;

  return { start: monday, end: friday, label };
}

function groupByDate(events: EarningsEvent[]): Map<string, EarningsEvent[]> {
  const map = new Map<string, EarningsEvent[]>();
  for (const e of events) {
    const key = e.reportDate.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return new Map([...map.entries()].sort());
}

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

// ── Surprise badge ────────────────────────────────────────────────────────────
function SurpriseBadge({ surprise }: { surprise: number | null }) {
  if (surprise == null) return null;
  const color = surprise > 5 ? "text-gain bg-success/15" : surprise < -5 ? "text-loss bg-destructive/15" : "text-warning bg-warning/15";
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${color}`}>
      {surprise > 0 ? "+" : ""}{surprise.toFixed(1)}%
    </span>
  );
}

// ── Earnings row ──────────────────────────────────────────────────────────────
function EarningsRow({ event }: { event: EarningsEvent }) {
  const isUpcoming = event.status === "upcoming";
  const hasBeat = event.surprise != null && event.surprise > 0;
  const hasMiss = event.surprise != null && event.surprise < 0;

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-accent/20 ${
      isUpcoming ? "border-border/40 bg-background/40" : hasBeat ? "border-success/20 bg-success/5" : hasMiss ? "border-destructive/20 bg-destructive/5" : "border-border/30 bg-background/30"
    }`}>
      {/* Status indicator */}
      <div className={`h-2 w-2 shrink-0 rounded-full ${isUpcoming ? "bg-primary animate-pulse" : hasBeat ? "bg-gain" : hasMiss ? "bg-loss" : "bg-muted-foreground"}`} />

      {/* Symbol + company */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link to="/stocks/$symbol" params={{ symbol: event.symbol }} className="font-mono text-sm font-bold text-primary hover:underline">
            {event.symbol}
          </Link>
          {event.period && <span className="text-[10px] text-muted-foreground">{event.period}</span>}
          {!isUpcoming && <SurpriseBadge surprise={event.surprise} />}
        </div>
        <div className="truncate text-xs text-muted-foreground">{event.companyName || event.symbol}</div>
      </div>

      {/* EPS */}
      <div className="hidden sm:block text-right min-w-[80px]">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">EPS</div>
        <div className="text-xs font-semibold num">
          {event.eps != null ? (
            <span className={event.epsEst != null ? (event.eps >= event.epsEst ? "text-gain" : "text-loss") : ""}>
              {event.eps.toFixed(2)}
            </span>
          ) : event.epsEst != null ? (
            <span className="text-muted-foreground">Est. {event.epsEst.toFixed(2)}</span>
          ) : "—"}
        </div>
      </div>

      {/* Revenue */}
      <div className="hidden md:block text-right min-w-[90px]">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenue</div>
        <div className="text-xs font-semibold num">
          {event.revenue != null ? (
            <span className={event.revenueEst != null ? (event.revenue >= event.revenueEst ? "text-gain" : "text-loss") : ""}>
              {fmtCompact(event.revenue)}
            </span>
          ) : event.revenueEst != null ? (
            <span className="text-muted-foreground">Est. {fmtCompact(event.revenueEst)}</span>
          ) : "—"}
        </div>
      </div>

      {/* Status */}
      <div className="shrink-0">
        {isUpcoming ? (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
            Upcoming
          </span>
        ) : (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${hasBeat ? "bg-success/15 text-gain" : hasMiss ? "bg-destructive/15 text-loss" : "bg-accent/40 text-muted-foreground"}`}>
            {hasBeat ? "Beat" : hasMiss ? "Miss" : "Reported"}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function EarningsPage() {
  const mounted = useMounted();
  const fn = useServerFn(getEarningsCalendar);
  const [weekOffset, setWeekOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"week" | "list">("week");

  const week = getWeekRange(weekOffset);

  const query = useQuery({
    queryKey: ["earnings-calendar", week.start.toISOString().slice(0, 10), week.end.toISOString().slice(0, 10)],
    queryFn: () => fn({ data: {
      startDate: week.start.toISOString().slice(0, 10),
      endDate: week.end.toISOString().slice(0, 10),
      limit: 200,
    }}),
    staleTime: 300_000,
    retry: false,
    enabled: mounted,
  });

  const events: EarningsEvent[] = useMemo(() => {
    const raw = unwrapArray(query.data?.data);
    const mapped = raw.map(mapEarningsEvent).filter(e => e.symbol);
    if (mapped.length > 0) return mapped;
    // Fallback to mock data
    return generateMockEarnings().filter(e => {
      const d = new Date(e.reportDate);
      return d >= week.start && d <= week.end;
    });
  }, [query.data, week]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return events.filter(e => !q || e.symbol.includes(q) || e.companyName.toUpperCase().includes(q));
  }, [events, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const upcomingCount = filtered.filter(e => e.status === "upcoming").length;
  const reportedCount = filtered.filter(e => e.status === "reported").length;
  const beatCount = filtered.filter(e => (e.surprise ?? 0) > 0).length;
  const missCount = filtered.filter(e => (e.surprise ?? 0) < 0).length;

  const isMock = !query.data?.data || unwrapArray(query.data?.data).length === 0;

  return (
    <PageTransition>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-semibold tracking-tight">Earnings Calendar</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Jadwal rilis laporan keuangan emiten IDX. Antisipasi volatilitas sebelum earnings.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <GlassCard className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Upcoming</div>
            <div className="text-2xl font-bold text-primary num mt-1">{upcomingCount}</div>
          </GlassCard>
          <GlassCard className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Reported</div>
            <div className="text-2xl font-bold num mt-1">{reportedCount}</div>
          </GlassCard>
          <GlassCard className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Beat Estimate</div>
            <div className="text-2xl font-bold text-gain num mt-1">{beatCount}</div>
          </GlassCard>
          <GlassCard className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Miss Estimate</div>
            <div className="text-2xl font-bold text-loss num mt-1">{missCount}</div>
          </GlassCard>
        </div>

        {/* Week navigation + search */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 text-center text-sm font-medium">{week.label}</div>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setWeekOffset(w => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Minggu Ini</Button>
          )}
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari saham..." className="pl-9 h-9" />
          </div>
          <div className="flex gap-1">
            {(["week", "list"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded-lg border px-2.5 py-1 text-xs capitalize transition ${view === v ? "border-primary/60 bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:text-foreground"}`}>
                {v === "week" ? "Kalender" : "List"}
              </button>
            ))}
          </div>
        </div>

        {isMock && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Menampilkan data demo — DataSectors earnings endpoint mungkin memerlukan plan berbayar.
          </div>
        )}

        {query.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-accent/30" />)}
          </div>
        ) : filtered.length === 0 ? (
          <GlassCard>
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <CalendarDays className="h-8 w-8 opacity-40" />
              <div className="text-sm">Tidak ada earnings minggu ini.</div>
            </div>
          </GlassCard>
        ) : view === "week" ? (
          /* Calendar week view */
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([dateStr, dayEvents]) => {
              const date = new Date(dateStr);
              const dayName = DAY_NAMES[date.getDay()];
              const isToday = dateStr === new Date().toISOString().slice(0, 10);
              return (
                <div key={dateStr}>
                  <div className={`flex items-center gap-2 mb-2 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${isToday ? "bg-primary text-primary-foreground" : "bg-accent/40"}`}>
                      {date.getDate()}
                    </div>
                    <span className="text-sm font-medium">{dayName}, {date.toLocaleDateString("id-ID", { day: "numeric", month: "long" })}</span>
                    <span className="text-xs">· {dayEvents.length} emiten</span>
                    {isToday && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary font-medium">Hari Ini</span>}
                  </div>
                  <div className="space-y-1.5 pl-9">
                    {dayEvents.map(e => <EarningsRow key={e.id} event={e} />)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List view */
          <GlassCard className="p-0 overflow-hidden">
            <div className="border-b border-border/40 px-4 py-3 text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{filtered.length}</span> earnings events
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-background/30 text-left">
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground">Saham</th>
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground">Tanggal</th>
                    <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground">Periode</th>
                    <th className="hidden px-4 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground sm:table-cell">EPS</th>
                    <th className="hidden px-4 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground md:table-cell">Revenue</th>
                    <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Surprise</th>
                    <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => (
                    <tr key={e.id} className="border-b border-border/20 hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link to="/stocks/$symbol" params={{ symbol: e.symbol }} className="font-mono text-sm font-bold text-primary hover:underline">
                          {e.symbol}
                        </Link>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">{e.companyName}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {e.reportDate ? new Date(e.reportDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs">{e.period || "—"}</td>
                      <td className="hidden px-4 py-2.5 text-right num text-xs sm:table-cell">
                        {e.eps != null ? <span className={e.epsEst != null ? (e.eps >= e.epsEst ? "text-gain" : "text-loss") : ""}>{e.eps.toFixed(2)}</span>
                          : e.epsEst != null ? <span className="text-muted-foreground">Est. {e.epsEst.toFixed(2)}</span> : "—"}
                      </td>
                      <td className="hidden px-4 py-2.5 text-right num text-xs md:table-cell">
                        {e.revenue != null ? <span className={e.revenueEst != null ? (e.revenue >= e.revenueEst ? "text-gain" : "text-loss") : ""}>{fmtCompact(e.revenue)}</span>
                          : e.revenueEst != null ? <span className="text-muted-foreground">Est. {fmtCompact(e.revenueEst)}</span> : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right"><SurpriseBadge surprise={e.surprise} /></td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          e.status === "upcoming" ? "bg-primary/15 text-primary"
                          : (e.surprise ?? 0) > 0 ? "bg-success/15 text-gain"
                          : (e.surprise ?? 0) < 0 ? "bg-destructive/15 text-loss"
                          : "bg-accent/40 text-muted-foreground"
                        }`}>
                          {e.status === "upcoming" ? "Upcoming" : (e.surprise ?? 0) > 0 ? "Beat" : (e.surprise ?? 0) < 0 ? "Miss" : "Reported"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}
      </div>
    </PageTransition>
  );
}