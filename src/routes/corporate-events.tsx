import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import {
  getStockEarningsEvents,
  getStockDividendsEvents,
  getStockIPOEvents,
} from "@/lib/datasectors.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtCompact } from "@/lib/formatters";
import {
  CalendarDays,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  TrendingUpIcon,
  DollarSign,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/corporate-events")({
  head: () => ({
    meta: [
      { title: "Corporate Events Calendar — Stratum" },
      {
        name: "description",
        content: "Upcoming earnings, IPO, and dividend events across global markets. Filter by date range and event type.",
      },
    ],
  }),
  component: CorporateEventsPage,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeNum(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (isFinite(n)) return n;
  }
  return null;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function daysFromNow(dateStr: string): number | null {
  if (!dateStr) return null;
  try {
    return Math.ceil(
      (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
  } catch {
    return null;
  }
}

function badgeClass(type: string): string {
  switch (type) {
    case "earnings":
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "ipo":
      return "bg-purple-500/15 text-purple-400 border-purple-500/30";
    case "dividend":
      return "bg-green-500/15 text-green-400 border-green-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface EarningsEvent {
  symbol?: string;
  ticker?: string;
  name?: string;
  company_name?: string;
  companyName?: string;
  date?: string;
  report_date?: string;
  reportDate?: string;
  period?: string;
  eps_estimate?: number | string;
  eps_actual?: number | string;
  revenue_estimate?: number | string;
  revenue_actual?: number | string;
  currency?: string;
}

interface IPOEvent {
  symbol?: string;
  ticker?: string;
  company_name?: string;
  companyName?: string;
  exchange?: string;
  date?: string;
  ipo_date?: string;
  price_range?: string;
  priceMin?: number;
  priceMax?: number;
  status?: string;
  shares_offered?: number | string;
}

interface DividendEvent {
  symbol?: string;
  ticker?: string;
  company_name?: string;
  companyName?: string;
  date?: string;
  ex_date?: string;
  record_date?: string;
  dividend_yield?: number | string;
  dividend_amount?: number | string;
  dividendYield?: number | string;
  dividendAmount?: number | string;
  currency?: string;
  frequency?: string;
}

// ── Date range helpers ────────────────────────────────────────────────────────

function thisWeek(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function thisMonth(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function nextMonth(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function CorporateEventsPage() {
  const earningsFn = useServerFn(getStockEarningsEvents);
  const dividendsFn = useServerFn(getStockDividendsEvents);
  const ipoFn = useServerFn(getStockIPOEvents);

  const [activeTab, setActiveTab] = useState<"earnings" | "dividends" | "ipo">("earnings");
  const [dateRange, setDateRange] = useState<"week" | "month" | "next-month">("month");
  const [search, setSearch] = useState("");

  const rangeParams = useMemo(() => {
    switch (dateRange) {
      case "week":
        return thisWeek();
      case "month":
        return thisMonth();
      case "next-month":
        return nextMonth();
    }
  }, [dateRange]);

  // Fetch all 3 event types in parallel
  const [earningsQ, dividendsQ, ipoQ] = useQuery({
    queryKey: ["corporate-events", "earnings", rangeParams],
    queryFn: () =>
      earningsFn({
        data: { start_date: rangeParams.start, end_date: rangeParams.end },
      }),
    enabled: activeTab === "earnings",
    staleTime: 30 * 60_000,
  });

  const dividendsQ_ = useQuery({
    queryKey: ["corporate-events", "dividends", rangeParams],
    queryFn: () =>
      dividendsFn({
        data: { start_date: rangeParams.start, end_date: rangeParams.end },
      }),
    enabled: activeTab === "dividends",
    staleTime: 30 * 60_000,
  });

  const ipoQ_ = useQuery({
    queryKey: ["corporate-events", "ipo", rangeParams],
    queryFn: () =>
      ipoFn({
        data: { start_date: rangeParams.start, end_date: rangeParams.end },
      }),
    enabled: activeTab === "ipo",
    staleTime: 30 * 60_000,
  });

  // Active query based on tab
  const activeQ =
    activeTab === "earnings"
      ? earningsQ
      : activeTab === "dividends"
        ? dividendsQ_
        : ipoQ_;

  const rawData = (activeQ.data?.data ?? []) as Record<string, unknown>[];

  const filtered = useMemo(() => {
    if (!search.trim()) return rawData;
    const q = search.toLowerCase();
    return rawData.filter((item) => {
      const symbol = (item.symbol ?? item.ticker ?? "").toString().toLowerCase();
      const name = (item.company_name ?? item.companyName ?? item.name ?? "").toString().toLowerCase();
      return symbol.includes(q) || name.includes(q);
    });
  }, [rawData, search]);

  const tabs = [
    {
      id: "earnings" as const,
      label: "Earnings",
      icon: BarChart2,
      count: rawData.length,
      query: earningsQ,
    },
    {
      id: "dividends" as const,
      label: "Dividends",
      icon: DollarSign,
      count: 0,
      query: dividendsQ_,
    },
    {
      id: "ipo" as const,
      label: "IPO",
      icon: Briefcase,
      count: 0,
      query: ipoQ_,
    },
  ];

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary" />
              Corporate Events Calendar
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upcoming earnings, IPO, and dividend events — {rangeParams.start} to {rangeParams.end}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => activeTab === "earnings" ? earningsQ.refetch() : activeTab === "dividends" ? dividendsQ_.refetch() : ipoQ_.refetch()}
            disabled={activeQ.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${activeQ.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Tab switcher */}
          <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-background shadow text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Date range */}
          <Select
            value={dateRange}
            onValueChange={(v) => setDateRange(v as typeof dateRange)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="next-month">Next Month</SelectItem>
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ticker or company name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          {activeQ.isLoading ? (
            "Loading..."
          ) : (
            <span>
              {filtered.length} event{filtered.length !== 1 ? "s" : ""} found
            </span>
          )}
        </div>

        {/* Content */}
        <div className="space-y-3">
          {activeQ.isLoading ? (
            <SkeletonGrid />
          ) : filtered.length === 0 ? (
            <EmptyState tab={activeTab} dateRange={dateRange} />
          ) : (
            filtered.map((item, i) => (
              <EventCard
                key={i}
                tab={activeTab}
                item={item}
              />
            ))
          )}
        </div>
      </div>
    </PageTransition>
  );
}

// ── Event Card ─────────────────────────────────────────────────────────────────

function EventCard({
  tab,
  item,
}: {
  tab: "earnings" | "dividends" | "ipo";
  item: Record<string, unknown>;
}) {
  const symbol = (item.symbol ?? item.ticker ?? "—").toString();
  const companyName = (item.company_name ?? item.companyName ?? item.name ?? "—").toString();
  const dateStr = (item.date ?? item.report_date ?? item.reportDate ?? item.ipo_date ?? item.ex_date ?? "").toString();
  const daysLeft = daysFromNow(dateStr);

  const dateBadge = () => {
    if (daysLeft === null) return null;
    if (daysLeft < 0) {
      return (
        <span className="text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
          Past
        </span>
      );
    }
    if (daysLeft === 0) {
      return (
        <span className="text-xs font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full animate-pulse">
          Today
        </span>
      );
    }
    return (
      <span className="text-xs font-medium bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full">
        {daysLeft}d
      </span>
    );
  };

  if (tab === "earnings") {
    const epsEst = safeNum(item.eps_estimate ?? item.epsEstimate);
    const epsAct = safeNum(item.eps_actual ?? item.epsActual);
    const revEst = safeNum(item.revenue_estimate ?? item.revenueEstimate);
    const currency = (item.currency ?? "USD").toString();

    return (
      <GlassCard className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{symbol}</span>
              <span className="text-sm text-muted-foreground truncate">{companyName}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                Earnings
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{formatDate(dateStr)}</p>
            {item.period && <p className="text-xs text-muted-foreground mt-0.5">{String(item.period)}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            {dateBadge()}
            {epsAct !== null ? (
              <div className="flex items-center gap-1 mt-1">
                {epsAct >= epsEst ? (
                  <TrendingUp className="h-3 w-3 text-green-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                )}
                <span className={`text-sm font-semibold ${epsAct >= epsEst ? "text-green-400" : "text-red-400"}`}>
                  EPS {epsAct >= epsEst ? "+" : ""}{epsAct}
                </span>
              </div>
            ) : epsEst !== null ? (
              <div>
                <span className="text-xs text-muted-foreground">Est. </span>
                <span className="text-sm font-semibold">{currency} {epsEst}</span>
              </div>
            ) : null}
            {revEst !== null && (
              <span className="text-xs text-muted-foreground">
                Est. Revenue: {fmtCompact(revEst)}
              </span>
            )}
          </div>
        </div>
      </GlassCard>
    );
  }

  if (tab === "dividends") {
    const divYield = safeNum(item.dividend_yield ?? item.dividendYield);
    const divAmount = safeNum(item.dividend_amount ?? item.dividendAmount ?? item.dividendAmount);
    const currency = (item.currency ?? "IDR").toString();

    return (
      <GlassCard className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{symbol}</span>
              <span className="text-sm text-muted-foreground truncate">{companyName}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
                Dividend
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Ex-date: {formatDate(dateStr)}</p>
            {item.frequency && (
              <p className="text-xs text-muted-foreground">{String(item.frequency)}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {dateBadge()}
            {divYield !== null && (
              <span className="text-sm font-bold text-green-400">{divYield}% yield</span>
            )}
            {divAmount !== null && (
              <span className="text-xs text-muted-foreground">
                {currency} {divAmount}/share
              </span>
            )}
          </div>
        </div>
      </GlassCard>
    );
  }

  // IPO
  const status = (item.status ?? "upcoming").toString();
  const priceRange = (item.price_range ?? item.priceRange ?? "").toString();
  const shares = safeNum(item.shares_offered ?? item.sharesOffered);

  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{symbol}</span>
            <span className="text-sm text-muted-foreground truncate">{companyName}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
              IPO
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatDate(dateStr)}</p>
          {item.exchange && <p className="text-xs text-muted-foreground">{String(item.exchange)}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          {dateBadge()}
          {status && status !== "upcoming" && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${status === "priced" ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"}`}>
              {status}
            </span>
          )}
          {priceRange && <span className="text-sm font-semibold">{priceRange}</span>}
          {shares !== null && (
            <span className="text-xs text-muted-foreground">{fmtCompact(shares)} shares</span>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({
  tab,
  dateRange,
}: {
  tab: "earnings" | "dividends" | "ipo";
  dateRange: string;
}) {
  return (
    <GlassCard className="p-8 text-center">
      <AlertCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
      <p className="text-muted-foreground">
        No {tab} events in this period.
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Try expanding the date range or check back later.
      </p>
    </GlassCard>
  );
}

// ── Loading Skeleton ───────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <GlassCard key={i} className="p-4">
          <div className="flex justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </GlassCard>
      ))}
    </>
  );
}