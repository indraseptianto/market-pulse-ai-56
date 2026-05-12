import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { getEquities } from "@/lib/datasectors.functions";
import { mockEquities } from "@/lib/mock-data";
import { PageTransition } from "@/components/layout/PageTransition";
import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { GainersLosers } from "@/components/dashboard/GainersLosers";
import { SectorStrip } from "@/components/dashboard/SectorStrip";
import { TickerTape } from "@/components/dashboard/TickerTape";
import { TrendingStocks } from "@/components/dashboard/TrendingStocks";
import { AISummaryCard } from "@/components/dashboard/AISummaryCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowRight,
  Sparkles,
  Globe,
} from "lucide-react";
import { fmtPct, fmtCompact, changeClass } from "@/lib/formatters";
import { useLivePrices } from "@/hooks/use-live-price";

// Top IDX stocks to fetch live prices for on dashboard
const DASHBOARD_SYMBOLS = [
  "BBCA","BBRI","BMRI","TLKM","ASII","BREN","GOTO","AMMN","TPIA","DCII",
  "UNVR","KLBF","ADRO","ANTM","MDKA","PGAS","PTBA","SMGR","ICBP","INDF",
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Stratum Stock Intelligence" },
      {
        name: "description",
        content:
          "Real-time market overview, top gainers and losers, sector heatmap, and AI-powered briefing.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const fn = useServerFn(getEquities);
  const { data, isLoading } = useQuery({
    queryKey: ["equities", "dashboard"],
    queryFn: () => fn({ data: { limit: 100 } }),
    staleTime: 60_000,
  });

  const equities = data?.data ?? mockEquities;

  // ── Live prices overlay ───────────────────────────────────────────────────
  const livePricesQ = useLivePrices(DASHBOARD_SYMBOLS);
  const liveMap = livePricesQ.data?.data ?? {};

  // Merge live prices into equities
  const equitiesWithLive = useMemo(() =>
    equities.map(e => {
      const lp = liveMap[e.symbol];
      if (!lp) return e;
      return {
        ...e,
        price:      lp.close,
        change:     lp.change,
        change_pct: lp.change_pct,
        volume:     lp.volume,
        market_cap: lp.market_cap || e.market_cap,
        day_high:   lp.high,
        day_low:    lp.low,
      };
    }),
    [equities, liveMap]
  );

  // Hero stats derived from equitiesWithLive
  const heroStats = useMemo(() => {
    if (!equitiesWithLive.length) return null;
    const gainers = equitiesWithLive.filter((e) => e.change_pct > 0).length;
    const losers  = equitiesWithLive.filter((e) => e.change_pct < 0).length;
    const avgChange = equitiesWithLive.reduce((s, e) => s + e.change_pct, 0) / equitiesWithLive.length;
    const totalMcap = equitiesWithLive.reduce((s, e) => s + (e.market_cap ?? 0), 0);
    const topGainer = [...equitiesWithLive].sort((a, b) => b.change_pct - a.change_pct)[0];
    const topLoser  = [...equitiesWithLive].sort((a, b) => a.change_pct - b.change_pct)[0];
    return { gainers, losers, avgChange, totalMcap, topGainer, topLoser };
  }, [equitiesWithLive]);

  return (
    <PageTransition>
      <div className="space-y-5">

        {/* ── HERO SECTION ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-2xl border border-border/50 bg-card px-5 py-6 md:px-8 md:py-8">
          {/* Background accent */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: headline */}
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="gap-1.5 border-success/40 bg-success/8 text-success text-[11px]"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                  </span>
                  Market Open
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  IDX · NYSE · NASDAQ
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Market Dashboard
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Institutional-grade view of Indonesian and global equities.
                Real-time data, AI insights, and smart-money analytics.
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild size="sm" className="gap-1.5 h-8">
                  <Link to="/screener">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Open Screener
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-1.5 h-8">
                  <Link to="/chart">
                    Advanced Chart
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right: hero stat cards */}
            {isLoading ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 w-full lg:w-auto">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl lg:w-36" />
                ))}
              </div>
            ) : heroStats ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                <HeroStat
                  icon={<TrendingUp className="h-4 w-4 text-success" />}
                  label="Gainers"
                  value={String(heroStats.gainers)}
                  sub={`of ${equitiesWithLive.length}`}
                  tone="gain"
                />
                <HeroStat
                  icon={<TrendingDown className="h-4 w-4 text-destructive" />}
                  label="Losers"
                  value={String(heroStats.losers)}
                  sub={`of ${equitiesWithLive.length}`}
                  tone="loss"
                />
                <HeroStat
                  icon={<BarChart3 className="h-4 w-4 text-primary" />}
                  label="Avg Change"
                  value={`${heroStats.avgChange >= 0 ? "+" : ""}${heroStats.avgChange.toFixed(2)}%`}
                  sub="today"
                  tone={heroStats.avgChange >= 0 ? "gain" : "loss"}
                />
                <HeroStat
                  icon={<Globe className="h-4 w-4 text-muted-foreground" />}
                  label="Total Mkt Cap"
                  value={fmtCompact(heroStats.totalMcap)}
                  sub="IDX universe"
                />
              </div>
            ) : null}
          </div>

          {/* Top mover strip */}
          {heroStats && (
            <div className="relative mt-5 flex flex-wrap items-center gap-3 border-t border-border/40 pt-4 text-xs">
              <span className="text-muted-foreground font-medium">Top movers:</span>
              {heroStats.topGainer && (
                <Link
                  to="/stocks/$symbol"
                  params={{ symbol: heroStats.topGainer.symbol }}
                  className="flex items-center gap-1.5 rounded-lg border border-success/20 bg-success/8 px-2.5 py-1 transition hover:bg-success/15"
                >
                  <TrendingUp className="h-3 w-3 text-success" />
                  <span className="font-mono font-semibold">{heroStats.topGainer.symbol}</span>
                  <span className="text-success num">+{heroStats.topGainer.change_pct.toFixed(2)}%</span>
                </Link>
              )}
              {heroStats.topLoser && (
                <Link
                  to="/stocks/$symbol"
                  params={{ symbol: heroStats.topLoser.symbol }}
                  className="flex items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/8 px-2.5 py-1 transition hover:bg-destructive/15"
                >
                  <TrendingDown className="h-3 w-3 text-destructive" />
                  <span className="font-mono font-semibold">{heroStats.topLoser.symbol}</span>
                  <span className="text-destructive num">{heroStats.topLoser.change_pct.toFixed(2)}%</span>
                </Link>
              )}
              <div className="ml-auto flex items-center gap-1 text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                <span>AI-powered insights below</span>
              </div>
            </div>
          )}
        </section>

        {/* ── TICKER TAPE ──────────────────────────────────────────────── */}
        <TickerTape equities={equitiesWithLive} />

        {/* ── MARKET OVERVIEW STATS ────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <MarketOverview equities={equitiesWithLive} />
        )}

        {/* ── MAIN CONTENT GRID ────────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left 2/3 */}
          <div className="lg:col-span-2 space-y-4">
            <SectorStrip equities={equitiesWithLive} />
            <GainersLosers equities={equitiesWithLive} />
          </div>

          {/* Right 1/3 */}
          <div className="space-y-4">
            <AISummaryCard equities={equitiesWithLive} />
            <TrendingStocks equities={equitiesWithLive} />
          </div>
        </div>

      </div>
    </PageTransition>
  );
}

// ── Hero stat card ────────────────────────────────────────────────────────────
function HeroStat({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "gain" | "loss";
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border/50 bg-background/60 px-3 py-3 min-w-[120px]">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`text-xl font-bold num tracking-tight ${
        tone === "gain" ? "text-success" : tone === "loss" ? "text-destructive" : "text-foreground"
      }`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground/70">{sub}</div>}
    </div>
  );
}
