import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { getEconomicCalendar, type CalendarEvent } from "@/lib/datasectors.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Search, RefreshCw, TrendingUp, Globe } from "lucide-react";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Economic Calendar — Stratum" },
      {
        name: "description",
        content:
          "Global economic events calendar with impact levels, forecasts, and actual data powered by DataSectors.",
      },
    ],
  }),
  component: CalendarPage,
});

type Volatility = "ALL" | "NONE" | "LOW" | "MEDIUM" | "HIGH";

const VOLATILITY_COLORS: Record<string, string> = {
  HIGH: "bg-destructive/15 text-destructive border-destructive/30",
  MEDIUM: "bg-warning/15 text-warning border-warning/30",
  LOW: "bg-success/15 text-success border-success/30",
  NONE: "bg-muted/40 text-muted-foreground border-border/40",
};

const VOLATILITY_DOTS: Record<string, string> = {
  HIGH: "bg-destructive",
  MEDIUM: "bg-warning",
  LOW: "bg-success",
  NONE: "bg-muted-foreground",
};

const POPULAR_COUNTRIES = [
  { code: "US", label: "🇺🇸 US" },
  { code: "ID", label: "🇮🇩 ID" },
  { code: "EU", label: "🇪🇺 EU" },
  { code: "GB", label: "🇬🇧 UK" },
  { code: "JP", label: "🇯🇵 JP" },
  { code: "CN", label: "🇨🇳 CN" },
  { code: "AU", label: "🇦🇺 AU" },
  { code: "CA", label: "🇨🇦 CA" },
];

function formatEventDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatEventTime(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "—";
  }
}

function groupByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = formatEventDate(ev.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return map;
}

export function CalendarPage() {
  const calFn = useServerFn(getEconomicCalendar);
  const [volatilityFilter, setVolatilityFilter] = useState<Volatility>("ALL");
  const [countryFilter, setCountryFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["economic-calendar", volatilityFilter, countryFilter],
    queryFn: () =>
      calFn({
        data: {
          volatility: volatilityFilter === "ALL" ? undefined : volatilityFilter,
          countryCode: countryFilter === "ALL" ? undefined : countryFilter,
          limit: 300,
          timezone: "GMT+7",
        },
      }),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const events = data?.data ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return events;
    const q = search.trim().toLowerCase();
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q) ||
        e.countryCode.toLowerCase().includes(q),
    );
  }, [events, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const stats = useMemo(() => {
    const high = events.filter((e) => e.volatility === "HIGH").length;
    const medium = events.filter((e) => e.volatility === "MEDIUM").length;
    const withActual = events.filter((e) => e.actual != null).length;
    return { high, medium, withActual, total: events.length };
  }, [events]);

  return (
    <PageTransition>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Economic Calendar</h1>
            <p className="text-sm text-muted-foreground">
              Global macro events with impact levels, forecasts and actuals. Timezone: WIB (GMT+7)
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats strip */}
        {!isLoading && events.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="Total Events" value={stats.total} icon={<Calendar className="h-3.5 w-3.5" />} />
            <StatCard label="High Impact" value={stats.high} color="text-destructive" icon={<TrendingUp className="h-3.5 w-3.5 text-destructive" />} />
            <StatCard label="Medium Impact" value={stats.medium} color="text-warning" />
            <StatCard label="Released" value={stats.withActual} color="text-success" icon={<Globe className="h-3.5 w-3.5 text-success" />} />
          </div>
        )}

        {/* Filters */}
        <GlassCard className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events…"
              className="pl-8 h-8 text-sm"
            />
          </div>

          <Select value={volatilityFilter} onValueChange={(v) => setVolatilityFilter(v as Volatility)}>
            <SelectTrigger className="h-8 w-[130px] text-sm">
              <SelectValue placeholder="Impact" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Impact</SelectItem>
              <SelectItem value="HIGH">🔴 High</SelectItem>
              <SelectItem value="MEDIUM">🟡 Medium</SelectItem>
              <SelectItem value="LOW">🟢 Low</SelectItem>
              <SelectItem value="NONE">⚪ None</SelectItem>
            </SelectContent>
          </Select>

          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="h-8 w-[120px] text-sm">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Countries</SelectItem>
              {POPULAR_COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {filtered.length !== events.length && (
            <span className="text-xs text-muted-foreground">
              {filtered.length} of {events.length}
            </span>
          )}
        </GlassCard>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : isError || (data?.source === "error") ? (
          <GlassCard className="py-16 text-center">
            <p className="text-sm text-muted-foreground">Failed to load calendar data.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              Try again
            </Button>
          </GlassCard>
        ) : filtered.length === 0 ? (
          <GlassCard className="py-16 text-center">
            <Calendar className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No events match the current filters.</p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([dateLabel, dayEvents]) => (
              <div key={dateLabel}>
                <div className="mb-2 flex items-center gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {dateLabel}
                  </div>
                  <div className="h-px flex-1 bg-border/40" />
                  <div className="text-[10px] text-muted-foreground/60">{dayEvents.length} events</div>
                </div>
                <GlassCard className="p-0 overflow-hidden">
                  <div className="divide-y divide-border/30">
                    {dayEvents.map((ev) => (
                      <EventRow key={ev.id} event={ev} />
                    ))}
                  </div>
                </GlassCard>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const timeStr = formatEventTime(event.date);
  const volatilityClass = VOLATILITY_COLORS[event.volatility] ?? VOLATILITY_COLORS.NONE;
  const dotClass = VOLATILITY_DOTS[event.volatility] ?? VOLATILITY_DOTS.NONE;

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/20">
      {/* Time */}
      <div className="w-12 shrink-0 text-right font-mono text-xs text-muted-foreground">
        {timeStr}
      </div>

      {/* Impact dot */}
      <div className="flex shrink-0 items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      </div>

      {/* Country */}
      <div className="w-8 shrink-0 text-center text-xs font-semibold uppercase text-muted-foreground">
        {event.countryCode || event.country}
      </div>

      {/* Title */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{event.title}</div>
        {event.description && (
          <div className="truncate text-[11px] text-muted-foreground">{event.description}</div>
        )}
      </div>

      {/* Impact badge */}
      <Badge
        variant="outline"
        className={`shrink-0 text-[10px] uppercase tracking-wider ${volatilityClass}`}
      >
        {event.volatility}
      </Badge>

      {/* Actual / Forecast / Previous */}
      <div className="flex shrink-0 items-center gap-3 text-right text-xs">
        <DataCell label="Actual" value={event.actual} highlight />
        <DataCell label="Forecast" value={event.forecast} />
        <DataCell label="Previous" value={event.previous} />
      </div>
    </div>
  );
}

function DataCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | null;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-[52px]">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60">{label}</div>
      <div className={`num font-semibold ${highlight && value ? "text-primary" : "text-foreground"}`}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  color?: string;
}) {
  return (
    <GlassCard className="py-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold num ${color ?? ""}`}>{value}</div>
    </GlassCard>
  );
}
