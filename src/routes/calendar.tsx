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
  HIGH: "bg-red-500/15 text-red-400 border-red-500/30",
  MEDIUM: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  LOW: "bg-green-500/15 text-green-400 border-green-500/30",
  NONE: "bg-muted/40 text-muted-foreground border-border/40",
};

const POPULAR_COUNTRIES = [
  { code: "ALL", label: "All" },
  { code: "US", label: "US" },
  { code: "ID", label: "ID" },
  { code: "EU", label: "EU" },
  { code: "GB", label: "UK" },
  { code: "JP", label: "JP" },
  { code: "CN", label: "CN" },
  { code: "AU", label: "AU" },
  { code: "CA", label: "CA" },
];

const POPULAR_CURRENCIES = [
  { code: "ALL", label: "All" },
  { code: "USD", label: "USD" },
  { code: "EUR", label: "EUR" },
  { code: "GBP", label: "GBP" },
  { code: "JPY", label: "JPY" },
  { code: "IDR", label: "IDR" },
  { code: "CNY", label: "CNY" },
  { code: "AUD", label: "AUD" },
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
          event.volatility === "HIGH" ? "bg-red-500" :
          event.volatility === "MEDIUM" ? "bg-yellow-500" :
          event.volatility === "LOW" ? "bg-green-500" : "bg-muted"
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

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["economic-calendar", volatilityFilter, countryFilter],
    queryFn: () => calFn({ data: { volatility: volatilityFilter === "ALL" ? undefined : volatilityFilter, countryCode: countryFilter === "ALL" ? undefined : countryFilter } }),
    staleTime: 5 * 60_000,
  });

  const { data: upcomingData } = useQuery({
    queryKey: ["calendar-upcoming"],
    queryFn: () => upcomingFn({ data: { limit: 10 } }),
    staleTime: 5 * 60_000,
    enabled: activeTab === "upcoming",
  });

  const { data: historicalData } = useQuery({
    queryKey: ["calendar-historical"],
    queryFn: () => historicalFn({ data: { limit: 50 } }),
    staleTime: 10 * 60_000,
    enabled: activeTab === "historical",
  });

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
            Currency
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

          <TabsContent value="upcoming" className="mt-4">
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-yellow-400" />
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