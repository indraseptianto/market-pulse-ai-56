import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useCallback, useEffect } from "react";
import {
  getEquityDetail,
  getCandles,
  getKeyRatios,
  getStockInsights,
  getStockEarnings,
  getStockEquitiesV2,
  getInvestorActivity,
  getDSNews,
  type NewsArticle,
} from "@/lib/datasectors.functions";
import { getNewsSentiment } from "@/lib/ai.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { PriceChart } from "@/components/stock/PriceChart";
import { KeyRatiosGrid } from "@/components/stock/KeyRatiosGrid";
import { FairValueCard } from "@/components/stock/FairValueCard";
import { QuarterlyFinancials } from "@/components/stock/QuarterlyFinancials";
import { PeerInsightsCard } from "@/components/stock/PeerInsightsCard";
import { StockIntelligenceTerminal } from "@/components/stock/StockIntelligenceTerminal";
import { OwnershipCard } from "@/components/stock/OwnershipCard";
import { DividendTab } from "@/components/stock/DividendTab";
import { OwnershipIntelligencePanel } from "@/components/ownership/OwnershipIntelligencePanel";
import { LivePriceBadge } from "@/components/common/LivePriceBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Building2, LineChart, Activity, TrendingUp, TrendingDown, FileText, ExternalLink, Calendar } from "lucide-react";
import { fmtPrice, fmtPct, fmtCompact, changeClass } from "@/lib/formatters";
import { scoreSentiment } from "@/routes/news";
import { Star, StarOff } from "lucide-react";
import { findMockEquity } from "@/lib/mock-data";
import { evaluateValuation } from "@/lib/valuation";
import { technicalSummary } from "@/lib/indicators";
import { useLivePriceTicker } from "@/hooks/use-live-price";

export const Route = createFileRoute("/stocks/$symbol")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.symbol.toUpperCase()} — Stock Detail · Stratum` },
      {
        name: "description",
        content: `In-depth analysis, charts, financial ratios and AI insights for ${params.symbol.toUpperCase()}.`,
      },
    ],
  }),
  component: StockDetailPage,
});

function StockDetailPage() {
  const { symbol } = Route.useParams();
  const sym = symbol.toUpperCase();

  const detailFn    = useServerFn(getEquityDetail);
  const candleFn    = useServerFn(getCandles);
  const ratiosFn    = useServerFn(getKeyRatios);
  const insightsFn  = useServerFn(getStockInsights);
  const earningsFn  = useServerFn(getStockEarnings);
  const equitiesV2Fn = useServerFn(getStockEquitiesV2);
  const tradesFn    = useServerFn(getInvestorActivity);
  const newsFn      = useServerFn(getDSNews);

  const officialData = useQuery<OfficialData | null>({
    queryKey: ["idx-official-data", sym],
    queryFn: async () => {
      const paths = [
        `/data/idx-official/json/${sym}/${sym}_official_data.json`,
        `/data/idx-official/json/${sym}/${sym}_official_data_partial.json`,
      ];

      for (const path of paths) {
        const res = await fetch(path);
        if (res.ok) return (await res.json()) as OfficialData;
      }

      return null;
    },
    staleTime: 600_000,
    retry: false,
  });

  // ── Existing queries ──────────────────────────────────────────────────────
  const detail = useQuery({
    queryKey: ["equity", sym],
    queryFn: () => detailFn({ data: { symbol: sym } }),
    staleTime: 30_000,
  });
  const candles = useQuery({
    queryKey: ["candles", sym],
    queryFn: () => candleFn({ data: { symbol: sym } }),
    staleTime: 60_000,
  });
  const ratios = useQuery({
    queryKey: ["ratios", sym],
    queryFn: () => ratiosFn({ data: { symbol: sym } }),
    staleTime: 600_000,
  });

  const insights = useQuery({
    queryKey: ["stock-insights", sym],
    queryFn: () => insightsFn({ data: { symbol: sym } }),
    staleTime: 300_000,
    retry: false,
  });

  // ── New queries ───────────────────────────────────────────────────────────
  const earnings = useQuery({
    queryKey: ["earnings", sym],
    queryFn: () => earningsFn({ data: { symbol: sym } }),
    staleTime: 600_000,
  });

  const equitiesV2 = useQuery({
    queryKey: ["equities-v2", sym],
    queryFn: () => equitiesV2Fn({ data: { symbol: sym } }),
    staleTime: 600_000,
  });

  const news = useQuery({
    queryKey: ["stock-news", sym],
    queryFn: () => newsFn({ data: { ticker: sym, query: sym, limit: 8 } }),
    staleTime: 300_000,
    retry: false,
  });

  // ── Watchlist ──────────────────────────────────────────────────────────────
  const [isWatched, setIsWatched] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !sym) return;
    try {
      const list = JSON.parse(localStorage.getItem("stratum_watchlist") ?? "[]") as string[];
      setIsWatched(list.includes(sym));
    } catch { /* noop */ }
  }, [sym]);
  const toggleWatchlist = useCallback(() => {
    if (typeof window === "undefined" || !sym) return;
    try {
      const list = JSON.parse(localStorage.getItem("stratum_watchlist") ?? "[]") as string[];
      const next = isWatched ? list.filter(s => s !== sym) : [...list, sym];
      localStorage.setItem("stratum_watchlist", JSON.stringify(next));
      setIsWatched(!isWatched);
    } catch { /* noop */ }
  }, [sym, isWatched]);

  // Investor activity — filter by ticker if possible, else show all recent
  const trades = useQuery({
    queryKey: ["investor-trades", sym],
    queryFn: () => tradesFn({ data: { limit: 30 } }),
    staleTime: 300_000,
  });

  // ── Live price — polls every 30s during market hours ─────────────────────
  const { price: live, isFetching: priceFetching, lastUpdated, isLive } =
    useLivePriceTicker(sym);

  // Filter trades to this symbol
  const symbolTrades = useMemo(() => {
    const all = trades.data?.data ?? [];
    const filtered = all.filter(
      (t) => t.ticker?.toUpperCase() === sym || t.companyName?.toUpperCase().includes(sym),
    );
    return filtered.length > 0 ? filtered : all.slice(0, 12);
  }, [trades.data, sym]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const baseEquity = detail.data?.data ?? (import.meta.env.PROD ? undefined : findMockEquity(sym));
  const rawCandles = candles.data?.data ?? [];
  const latestDaily = rawCandles[rawCandles.length - 1] ?? null;
  const previousDaily = rawCandles[rawCandles.length - 2] ?? null;
  const dailyChange =
    latestDaily && previousDaily
      ? +(latestDaily.close - previousDaily.close).toFixed(2)
      : null;
  const dailyChangePct =
    dailyChange != null && previousDaily && previousDaily.close > 0
      ? +((dailyChange / previousDaily.close) * 100).toFixed(4)
      : null;

  // Daily candle is canonical; intraday is used only when daily is unavailable.
  const equity = baseEquity ? {
    ...baseEquity,
    price:       latestDaily?.close ?? live?.price ?? baseEquity.price,
    change:      dailyChange ?? live?.change ?? baseEquity.change,
    change_pct:  dailyChangePct ?? live?.change_pct ?? baseEquity.change_pct,
    volume:      live?.volume      ?? baseEquity.volume,
    market_cap:  live?.marketCap   ?? baseEquity.market_cap,
    prev_close:  previousDaily?.close ?? live?.prevClose ?? baseEquity.prev_close,
    day_high:    latestDaily?.high ?? live?.high ?? baseEquity.day_high,
    day_low:     latestDaily?.low ?? live?.low ?? baseEquity.day_low,
    shares_outstanding: live?.shareOutstanding ?? baseEquity.shares_outstanding,
  } : null;
  const ratiosData = (ratios.data?.data ?? {}) as Record<string, number | null | undefined>;

  const chartCandles = useMemo(() => {
    const source = rawCandles;
    if (!live || source.length === 0) return source;

    const next = [...source];
    const last = next[next.length - 1];
    if (!last) return source;

    const liveDate = live.date || last.time;
    const liveCandle = {
      time: liveDate,
      open: live.open,
      high: live.high,
      low: live.low,
      close: live.price,
      volume: live.volume,
    };

    if (liveDate > last.time) next.push(liveCandle);
    return next;
  }, [rawCandles, live]);

  const techCandles = chartCandles;
  const tech = useMemo(() => {
    if (techCandles.length < 30) return null;
    return technicalSummary(
      techCandles.map((c) => c.close),
      techCandles.map((c) => c.high),
      techCandles.map((c) => c.low),
    );
  }, [techCandles]);

  const valuationInput = equity
    ? {
        price: equity.price,
        eps: (ratiosData.eps as number | null | undefined) ?? equity.eps ?? null,
        book_value: (ratiosData.book_value as number | null | undefined) ?? equity.book_value ?? null,
        pe_ratio: equity.pe_ratio ?? null,
        roe: equity.roe ?? null,
        dividend_yield: equity.dividend_yield ?? null,
        earnings_growth: (ratiosData.earnings_growth as number | null | undefined) ?? null,
      }
    : null;
  const fair = valuationInput ? evaluateValuation(valuationInput) : null;

  const divData = equity
    ? {
        symbol: equity.symbol,
        name: equity.name,
        sector: equity.sector ?? "",
        price: equity.price,
        dividend_yield: equity.dividend_yield ?? null,
        dividend_per_share: (ratiosData.dividend_per_share as number | null | undefined) ?? null,
        payout_ratio: (ratiosData.payout_ratio as number | null | undefined) ?? null,
        frequency: (ratiosData.dividend_frequency as string | null | undefined) ?? "Annual",
        last_dividend_date: (ratiosData.last_dividend_date as string | null | undefined) ?? null,
      }
    : null;

  const earningsPayload = ((earnings.data as { data?: unknown } | undefined)?.data ?? null) as Record<string, unknown> | null;
  const equitiesV2Payload = ((equitiesV2.data as { data?: unknown } | undefined)?.data ?? null) as Record<string, unknown> | null;

  return (
    <PageTransition>
      <div className="space-y-4">
        <Link
          to="/screener"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to screener
        </Link>

        {/* ── Company header ── */}
        {!equity && detail.isLoading ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : !equity ? (
          <OfficialOnlyHeader data={officialData.data ?? null} symbol={sym} />
        ) : (
          <GlassCard>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h1 className="font-mono text-2xl font-semibold tracking-tight">{equity.symbol}</h1>
                  <span className="text-sm text-muted-foreground">{equity.name}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-accent/40 px-2 py-0.5">{equity.sector}</span>
                  {equity.industry && (
                    <span className="rounded-full bg-accent/40 px-2 py-0.5">{equity.industry}</span>
                  )}
                  {fair && (
                    <span className={`rounded-full px-2 py-0.5 ${
                      fair.verdict === "Undervalued" ? "bg-success/15 text-gain"
                      : fair.verdict === "Overvalued" ? "bg-destructive/15 text-loss"
                      : "bg-warning/15 text-warning"
                    }`}>
                      {fair.verdict}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-2 mb-1">
                  <LivePriceBadge
                    lastUpdated={lastUpdated}
                    isFetching={priceFetching}
                    compact
                  />
                </div>
                <div className="text-3xl font-semibold num">{fmtPrice(equity.price)}</div>
                <div className={`text-sm num ${changeClass(equity.change_pct)}`}>
                  {equity.change > 0 ? "+" : ""}{fmtPrice(equity.change)} ({fmtPct(equity.change_pct)})
                </div>
                {live && live.foreignFlow !== 0 && (
                  <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${live.foreignFlow > 0 ? "text-gain" : "text-loss"}`}>
                    {live.foreignFlow > 0
                      ? <TrendingUp className="h-3 w-3" />
                      : <TrendingDown className="h-3 w-3" />}
                    <span>
                      Foreign {live.foreignFlow > 0 ? "Net Buy" : "Net Sell"}{" "}
                      {fmtCompact(Math.abs(live.foreignFlow))}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quote strip */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Prev Close",  value: equity.prev_close != null ? fmtPrice(equity.prev_close) : "—" },
                { label: "Day Range",   value: equity.day_low != null && equity.day_high != null ? `${fmtPrice(equity.day_low)} – ${fmtPrice(equity.day_high)}` : "—" },
                { label: "52W Range",   value: equity.low_52w != null && equity.high_52w != null ? `${fmtPrice(equity.low_52w)} – ${fmtPrice(equity.high_52w)}` : "—" },
                { label: "Volume",      value: fmtCompact(equity.volume) },
                { label: "Market Cap",  value: fmtCompact(equity.market_cap) },
                { label: "Beta",        value: equity.beta != null ? equity.beta.toFixed(2) : "—" },
              ].map((it) => (
                <div key={it.label} className="rounded-lg bg-background/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.label}</div>
                  <div className="mt-0.5 text-sm font-semibold num">{it.value}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        )}

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="news" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              News
            </TabsTrigger>
            <TabsTrigger value="dividends" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Dividends
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {equity && (
              <StockIntelligenceTerminal
                equity={equity}
                technical={tech}
                fair={fair}
                newsPayload={(news.data as { data?: unknown } | undefined)?.data ?? null}
                earningsPayload={earningsPayload}
                peerPayload={(insights.data as { data?: unknown } | undefined)?.data ?? null}
                trades={symbolTrades}
              />
            )}

            <OfficialDataCard
              data={officialData.data ?? null}
              isLoading={officialData.isLoading}
              symbol={sym}
            />

            {/* ── Price chart + Fair Value ── */}
            <div className="grid gap-3 lg:grid-cols-3">
              <GlassCard className="lg:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium">Price History</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">90 days</div>
                </div>
                {candles.isLoading ? (
                  <Skeleton className="h-[320px] rounded-xl" />
                ) : (
                  <PriceChart candles={chartCandles} fairPrice={fair?.fairPrice ?? null} />
                )}
              </GlassCard>
              <div className="space-y-3">
                {valuationInput && <FairValueCard {...valuationInput} />}
              </div>
            </div>

            {/* ── Technical Snapshot ── */}
            {tech && (
              <GlassCard>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Activity className="h-4 w-4 text-primary" /> Technical Snapshot
                  </div>
                  <Link to="/chart" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <LineChart className="h-3 w-3" /> Open advanced chart
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <TechStat label="Trend" value={tech.trend} />
                  <TechStat
                    label="RSI(14)"
                    value={tech.rsi != null ? `${tech.rsi.toFixed(1)} · ${tech.rsiState}` : "—"}
                    tone={tech.rsi != null && tech.rsi > 70 ? "loss" : tech.rsi != null && tech.rsi < 30 ? "gain" : "neutral"}
                  />
                  <TechStat
                    label="MACD"
                    value={`${tech.macdCross}${tech.histTurning ? ` · ${tech.histTurning}` : ""}`}
                    tone={tech.macdCross === "Bullish" ? "gain" : "loss"}
                  />
                  <TechStat
                    label="AI Stance"
                    value={`${tech.stance} · ${tech.score}/100`}
                    tone={tech.score >= 55 ? "gain" : tech.score >= 45 ? "neutral" : "loss"}
                  />
                  <TechStat label="SMA 20 / 50 / 200" value={`${num(tech.sma20)} / ${num(tech.sma50)} / ${num(tech.sma200)}`} />
                  <TechStat label="Bollinger" value={`${num(tech.bbLower)} – ${num(tech.bbUpper)}`} />
                  <TechStat label="ATR(14)" value={num(tech.atr)} />
                  <TechStat label="Support / Resistance" value={`${fmtPrice(tech.support)} – ${fmtPrice(tech.resistance)}`} />
                </div>
              </GlassCard>
            )}

            <PeerInsightsCard
              payload={(insights.data as { data?: unknown } | undefined)?.data ?? null}
              isLoading={insights.isLoading}
            />

            {/* ── Key Ratios ── */}
            {ratios.data?.data && <KeyRatiosGrid ratios={ratios.data.data as never} />}

            {/* ── Quarterly Financials ── */}
            <QuarterlyFinancials
              earningsPayload={earningsPayload as Record<string, unknown> | null}
              isLoading={earnings.isLoading}
            />

            {/* ── Ownership Intelligence (IDNFinancials dataset) ── */}
            <OwnershipIntelligencePanel symbol={sym} />

            {/* ── Ownership & Filings (DataSectors API) ── */}
            <OwnershipCard
              equitiesPayload={equitiesV2Payload as Record<string, unknown> | null}
              trades={symbolTrades}
              tradesLoading={trades.isLoading}
              equitiesLoading={equitiesV2.isLoading}
              symbol={sym}
            />
          </TabsContent>

          <TabsContent value="news">
            <StockNewsTab symbol={sym} name={equity?.name ?? sym} />
          </TabsContent>

          <TabsContent value="dividends">
            {divData && <DividendTab data={divData} />}
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}


// ── StockNewsTab ─────────────────────────────────────────────────────────────────

function StockNewsTab({ symbol }: { symbol: string; name: string }) {
  const newsFn = useServerFn(getDSNews);
  const sentimentFn = useServerFn(getNewsSentiment);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["stock-news", symbol],
    queryFn: () => newsFn({ data: { ticker: symbol, query: symbol, limit: 20 } }),
    staleTime: 10 * 60_000,
  });

  const articles = (data?.data ?? []) as NewsArticle[];
  const sentiments = articles.map(a => scoreSentiment(a.title + " " + a.description));
  const bullish = sentiments.filter(s => s.sentiment === "bullish").length;
  const bearish = sentiments.filter(s => s.sentiment === "bearish").length;
  const neutral = sentiments.filter(s => s.sentiment === "neutral").length;
  const total = articles.length || 1;
  const dominant = bullish > bearish + 2
    ? { label: "Bullish", color: "text-green-400", bg: "bg-green-500/15" }
    : bearish > bullish + 2
    ? { label: "Bearish", color: "text-red-400", bg: "bg-red-500/15" }
    : { label: "Neutral", color: "text-muted-foreground", bg: "bg-muted/30" };

  const toggleExpanded = (id: string) =>
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const expandedArticles = articles.filter(a => expandedIds.has(a.id));
  const sentimentQueries = useQueries({
    queries: expandedArticles.map(a => ({
      queryKey: ["news-sentiment", a.id],
      queryFn: () => sentimentFn({ data: { title: a.title, description: a.description, tickers: a.tickers } }),
      staleTime: 60 * 60_000,
    })),
  });
  const sentimentMap: Record<string, typeof sentiments[0]> = {};
  articles.forEach((a, i) => { sentimentMap[a.id] = sentiments[i]; });

  const sMap: Record<string, ReturnType<typeof scoreSentiment>> = {};
  articles.forEach((a, i) => { sMap[a.id] = sentiments[i]; });

  return (
    <div className="space-y-4">
      {/* Sentiment header */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">{symbol} News Sentiment</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{articles.length} recent articles</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <div className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${dominant.color} ${dominant.bg}`}>{dominant.label}</div>
          <div className="flex-1">
            <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
              <div className="bg-green-500" style={{ width: `${(bullish / total) * 100}%` }} />
              <div className="bg-muted" style={{ width: `${(neutral / total) * 100}%` }} />
              <div className="bg-red-500" style={{ width: `${(bearish / total) * 100}%` }} />
            </div>
          </div>
          <div className="flex gap-2 text-[10px]">
            <span className="text-green-400">🟢 {bullish}</span>
            <span className="text-muted-foreground">⚪ {neutral}</span>
            <span className="text-red-400">🔴 {bearish}</span>
          </div>
        </div>
        {articles.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground">7d</span>
            <div className="flex-1 flex gap-px">
              {articles.slice(0, 7).map((a, i) => {
                const s = sentiments[i];
                return (
                  <div key={i}
                    className={`flex-1 h-6 rounded-sm ${s.sentiment === "bullish" ? "bg-green-500" : s.sentiment === "bearish" ? "bg-red-500" : "bg-muted"}`}
                    title={a.title.slice(0, 60)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </GlassCard>

      {/* Article list */}
      {isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : articles.length === 0 ? (
        <GlassCard className="py-12 text-center">
          <p className="text-muted-foreground">No recent news for {symbol}</p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {articles.map((article) => {
            const basicSent = sMap[article.id] ?? { sentiment: "neutral" as const };
            const sentiment = basicSent.sentiment;
            const expanded = expandedIds.has(article.id);
            const aiResult = expanded ? sentimentQueries[expandedArticles.findIndex(a => a.id === article.id)]?.data : null;
            const conf = aiResult?.confidence ?? Math.min(90, 40 + Math.abs(basicSent.score) * 5);

            const sc = (["bullish", "bearish", "neutral"] as const).includes(sentiment as "bullish" | "bearish" | "neutral")
              ? ({
              bullish: { color: "text-green-400", bg: "bg-green-500/15", icon: "🟢" },
              bearish: { color: "text-red-400", bg: "bg-red-500/15", icon: "🔴" },
              neutral: { color: "text-muted-foreground", bg: "bg-muted/30", icon: "⚪" },
            } as const)[sentiment as "bullish" | "bearish" | "neutral"]
              : { color: "text-muted-foreground", bg: "bg-muted/30", icon: "⚪" };

            return (
              <GlassCard key={article.id} className="p-3">
                <div className="cursor-pointer" onClick={() => toggleExpanded(article.id)}>
                  <div className="flex items-start gap-2">
                    {article.imageUrl && (
                      <img src={article.imageUrl} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug line-clamp-2">{article.title}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${sc.color} ${sc.bg}`}>
                          {sc.icon} {sentiment}{expanded && ` · ${Math.round(conf)}%`}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{formatTimeAgo(article.publishedDate)}</span>
                        {article.source && <Badge variant="outline" className="text-[9px] px-1 py-0">{article.source}</Badge>}
                      </div>
                      {expanded && (
                        <div className="mt-2 pt-2 border-t border-border/30">
                          {aiResult?.summary && <p className="text-xs text-muted-foreground italic">💡 {aiResult.summary}</p>}
                          {aiResult?.keyFactors && aiResult.keyFactors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {aiResult.keyFactors.slice(0, 3).map((f: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-[9px] px-1 py-0 bg-muted/50">{f}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {article.url && (
                  <a href={article.url} target="_blank" rel="noopener noreferrer"
                    className="block mt-2 pt-1.5 border-t border-border/20 text-[10px] text-muted-foreground hover:text-primary transition-colors">
                    Baca lengkap →
                  </a>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return dateStr; }
}


type OfficialData = {
  code?: string;
  company_name?: string;
  status?: string;
  scraped_at?: string;
  source?: string;
  search_candidates?: Array<{ title?: string; url?: string; content?: string }>;
  documents?: Array<{ title?: string; url?: string; pdf_path?: string; text_path?: string }>;
  financial_income_revenue?: unknown[];
  dividends?: unknown[];
  latest_shareholders_freefloat_ownership?: unknown;
  management?: unknown;
  llm_extraction?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
};

type OfficialMetric = {
  label: string;
  value: string;
  evidence?: string;
};

function OfficialOnlyHeader({ data, symbol }: { data: OfficialData | null; symbol: string }) {
  return (
    <GlassCard>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{data?.code ?? symbol}</h1>
            <span className="text-sm text-muted-foreground">{data?.company_name ?? "Official IDX data available"}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">Official JSON</span>
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">Harga pasar belum tersedia</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            DataSectors tidak mengembalikan harga/chart untuk kode ini, jadi halaman tetap dibuka dengan data official IDX dari pipeline JSON.
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function OfficialDataCard({ data, isLoading, symbol }: { data: OfficialData | null; isLoading: boolean; symbol: string }) {
  const [tab, setTab] = useState<"overview" | "evidence" | "documents">("overview");
  if (isLoading) return <Skeleton className="h-36 rounded-2xl" />;
  if (!data) return null;

  const metrics = buildOfficialMetrics(data);
  const documents = data.documents ?? [];
  const candidates = data.search_candidates ?? [];
  const primarySource = documents[0]?.url ?? candidates.find((candidate) => candidate.url)?.url;
  const evidenceMetrics = metrics.filter((metric) => metric.label === "Source Evidence");
  const overviewMetrics = metrics.filter((metric) => metric.label !== "Source Evidence");
  const tabs = [
    { id: "overview", label: "Overview", count: overviewMetrics.length },
    { id: "evidence", label: "Evidence", count: evidenceMetrics.length + candidates.length },
    { id: "documents", label: "Documents", count: documents.length },
  ] as const;

  return (
    <GlassCard>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-primary" /> Official IDX Data
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Data hasil pipeline official untuk {data.code ?? symbol} langsung dari JSON, tanpa perlu buka Excel.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-accent/50 px-2 py-1 uppercase tracking-wide text-muted-foreground">
            {data.status ?? "official"}
          </span>
          {primarySource && (
            <a
              href={primarySource}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-primary hover:bg-primary/10"
            >
              Source <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-border/50 pb-3">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              tab === item.id ? "bg-primary text-primary-foreground" : "bg-background/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label} <span className="num opacity-70">{item.count}</span>
          </button>
        ))}
      </div>

      {tab === "overview" && (overviewMetrics.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {overviewMetrics.map((metric) => (
            <div key={metric.label} className="rounded-xl bg-background/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{metric.label}</div>
              <div className="mt-1 line-clamp-4 text-sm font-semibold leading-5">{metric.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-background/40 p-3 text-sm text-muted-foreground">
          Official JSON tersedia, tetapi field ringkasan belum cukup terstruktur untuk ditampilkan.
        </div>
      ))}

      {tab === "evidence" && (
        <div className="space-y-3">
          {evidenceMetrics.map((metric) => (
            <div key={metric.label} className="rounded-xl bg-background/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{metric.label}</div>
              <div className="mt-1 text-sm leading-6 text-foreground">{metric.value}</div>
            </div>
          ))}
          {candidates.slice(0, 6).map((candidate, index) => (
            <a
              key={`${candidate.url ?? candidate.title ?? index}`}
              href={candidate.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl bg-background/40 p-3 text-sm hover:bg-background/60"
            >
              <div className="line-clamp-1 font-medium">{candidate.title ?? `Candidate ${index + 1}`}</div>
              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{candidate.content ?? candidate.url}</div>
            </a>
          ))}
        </div>
      )}

      {tab === "documents" && (
        <div className="space-y-2">
          {documents.length > 0 ? documents.slice(0, 8).map((doc, index) => (
            <a
              key={`${doc.url ?? doc.pdf_path ?? index}`}
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg bg-background/30 px-3 py-2 text-xs hover:bg-background/60"
            >
              <span className="line-clamp-1">{doc.title ?? doc.url ?? doc.pdf_path ?? `Dokumen ${index + 1}`}</span>
              {doc.url && <ExternalLink className="h-3 w-3 shrink-0 text-primary" />}
            </a>
          )) : (
            <div className="rounded-xl bg-background/40 p-3 text-sm text-muted-foreground">Belum ada dokumen sumber tersimpan.</div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
function buildOfficialMetrics(data: OfficialData): OfficialMetric[] {
  const llm = data.llm_extraction ?? {};
  const metrics: OfficialMetric[] = [];
  const revenue = firstValue(llm, ["revenue", "financial_income_revenue"]) ?? summarizeUnknown(data.financial_income_revenue?.[0]);
  const netIncome = firstValue(llm, ["net_income", "netIncome"]);
  const dividend = firstValue(llm, ["dividend", "deviden", "dividends"]) ?? summarizeUnknown(data.dividends?.[0]);
  const shareholders = firstValue(llm, ["shareholders"])
    ?? summarizeUnknown(data.latest_shareholders_freefloat_ownership);
  const freefloat = firstValue(llm, ["freefloat", "free_float"]);
  const directors = firstValue(llm, ["directors", "director"])
    ?? summarizeUnknown(data.management);

  addMetric(metrics, "Revenue", revenue);
  addMetric(metrics, "Net Income", netIncome);
  addMetric(metrics, "Dividend", dividend);
  addMetric(metrics, "Shareholders", shareholders);
  addMetric(metrics, "Free Float", freefloat);
  addMetric(metrics, "Director", directors);

  const evidence = firstValue(llm, ["source_evidence", "evidence"]) ?? summarizeUnknown(data.evidence);
  addMetric(metrics, "Source Evidence", evidence);

  return metrics;
}

function addMetric(metrics: OfficialMetric[], label: string, value: string | null) {
  if (!value) return;
  metrics.push({ label, value: clipText(value, 320) });
}

function firstValue(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    const summary = summarizeUnknown(value);
    if (summary) return summary;
  }
  return null;
}

function summarizeUnknown(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const items = value.map(summarizeUnknown).filter(Boolean).slice(0, 3);
    return items.length ? items.join("; ") : null;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item != null && summarizeUnknown(item))
      .slice(0, 4)
      .map(([key, item]) => `${humanizeKey(key)}: ${summarizeUnknown(item)}`);
    return entries.length ? entries.join("; ") : null;
  }
  return null;
}

function clipText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function humanizeKey(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function num(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function TechStat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "gain" | "loss" | "neutral" }) {
  const toneClass = tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-foreground";
  return (
    <div className="rounded-lg bg-background/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold num ${toneClass}`}>{value}</div>
    </div>
  );
}
