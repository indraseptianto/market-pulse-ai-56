import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import {
  getEquityDetail,
  getCandles,
  getKeyRatios,
  getStockEarnings,
  getStockEquitiesV2,
  getInvestorActivity,
} from "@/lib/datasectors.functions";
import { getTiingoPrices } from "@/lib/tiingo.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { PriceChart } from "@/components/stock/PriceChart";
import { KeyRatiosGrid } from "@/components/stock/KeyRatiosGrid";
import { AIAnalysis } from "@/components/stock/AIAnalysis";
import { FairValueCard } from "@/components/stock/FairValueCard";
import { QuarterlyFinancials } from "@/components/stock/QuarterlyFinancials";
import { OwnershipCard } from "@/components/stock/OwnershipCard";
import { OwnershipIntelligencePanel } from "@/components/ownership/OwnershipIntelligencePanel";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Building2, LineChart, Activity } from "lucide-react";
import { fmtPrice, fmtPct, fmtCompact, changeClass } from "@/lib/formatters";
import { findMockEquity } from "@/lib/mock-data";
import { evaluateValuation } from "@/lib/valuation";
import { technicalSummary } from "@/lib/indicators";

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
  const tiingoFn    = useServerFn(getTiingoPrices);
  const earningsFn  = useServerFn(getStockEarnings);
  const equitiesV2Fn = useServerFn(getStockEquitiesV2);
  const tradesFn    = useServerFn(getInvestorActivity);

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
  const tiingo = useQuery({
    queryKey: ["tiingo-prices-detail", sym],
    queryFn: () => tiingoFn({ data: { symbol: sym, days: 365 } }),
    staleTime: 60_000,
  });
  const ratios = useQuery({
    queryKey: ["ratios", sym],
    queryFn: () => ratiosFn({ data: { symbol: sym } }),
    staleTime: 600_000,
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

  // Investor activity — filter by ticker if possible, else show all recent
  const trades = useQuery({
    queryKey: ["investor-trades", sym],
    queryFn: () => tradesFn({ data: { limit: 30 } }),
    staleTime: 300_000,
  });

  // Filter trades to this symbol
  const symbolTrades = useMemo(() => {
    const all = trades.data?.data ?? [];
    const filtered = all.filter(
      (t) => t.ticker?.toUpperCase() === sym || t.companyName?.toUpperCase().includes(sym),
    );
    return filtered.length > 0 ? filtered : all.slice(0, 12);
  }, [trades.data, sym]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const equity = detail.data?.data ?? findMockEquity(sym);
  const ratiosData = (ratios.data?.data ?? {}) as Record<string, number | null | undefined>;

  const techCandles =
    (tiingo.data?.source === "tiingo" ? tiingo.data.data : null) ?? candles.data?.data ?? [];
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

  const earningsPayload = earnings.data?.data ?? null;
  const equitiesV2Payload = equitiesV2.data?.data ?? null;

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
        {!equity ? (
          <Skeleton className="h-32 rounded-2xl" />
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
                <div className="text-3xl font-semibold num">{fmtPrice(equity.price)}</div>
                <div className={`text-sm num ${changeClass(equity.change_pct)}`}>
                  {fmtPct(equity.change_pct)}
                </div>
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

        {/* ── Price chart + Fair Value + AI ── */}
        <div className="grid gap-3 lg:grid-cols-3">
          <GlassCard className="lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">Price History</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">90 days</div>
            </div>
            {candles.isLoading ? (
              <Skeleton className="h-[320px] rounded-xl" />
            ) : (
              <PriceChart candles={candles.data?.data ?? []} fairPrice={fair?.fairPrice ?? null} />
            )}
          </GlassCard>
          <div className="space-y-3">
            {valuationInput && <FairValueCard {...valuationInput} />}
            {equity && <AIAnalysis equity={equity} />}
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
      </div>
    </PageTransition>
  );
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
