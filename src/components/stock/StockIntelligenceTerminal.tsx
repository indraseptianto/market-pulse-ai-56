import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  Brain,
  CalendarClock,
  CircleDollarSign,
  Loader2,
  Newspaper,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { GlassCard } from "@/components/common/GlassCard";
import { Button } from "@/components/ui/button";
import { getStockIntelligenceNote } from "@/lib/ai.functions";
import { fmtCompact, fmtPct, fmtPrice } from "@/lib/formatters";
import type { Equity } from "@/lib/mock-data";
import type { ValuationResult } from "@/lib/valuation";
import type { InvestorTrade } from "@/lib/datasectors.functions";
import { cn } from "@/lib/utils";

type TechnicalSnapshot = {
  stance: string;
  trend: string;
  score: number;
  rsi: number | null;
  rsiState: string;
  support: number;
  resistance: number;
};

interface NewsItem {
  title: string;
  source: string;
  sentiment: "positive" | "negative" | "neutral";
  date: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapList(payload: unknown): Record<string, unknown>[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const key of ["data", "items", "results", "news", "articles"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isRecord);
    if (isRecord(value)) {
      const nested = unwrapList(value);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

function parseNews(payload: unknown): NewsItem[] {
  return unwrapList(payload)
    .map((item) => {
      const rawSentiment = String(item.sentiment ?? item.sentiment_score ?? item.score ?? "").toLowerCase();
      const sentiment =
        rawSentiment.includes("pos") || Number(rawSentiment) > 0
          ? "positive"
          : rawSentiment.includes("neg") || Number(rawSentiment) < 0
            ? "negative"
            : "neutral";
      return {
        title: String(item.title ?? item.headline ?? item.name ?? "Market update"),
        source: String(item.source ?? item.publisher ?? item.site ?? "DataSectors"),
        sentiment,
        date: String(item.date ?? item.published_at ?? item.datetime ?? "").slice(0, 10),
      };
    })
    .slice(0, 5);
}

function summarizeNews(news: NewsItem[]) {
  const positive = news.filter((item) => item.sentiment === "positive").length;
  const negative = news.filter((item) => item.sentiment === "negative").length;
  const label = positive > negative ? "Positive" : negative > positive ? "Negative" : news.length ? "Neutral" : "No news";
  return { positive, negative, label };
}

function extractCorporateEvents(payload: unknown): string[] {
  const rows = unwrapList(payload);
  const events = rows
    .map((row) => {
      const period = row.period ?? row.quarter ?? row.fiscal_period ?? row.year;
      const date = row.reportDate ?? row.report_date ?? row.date;
      const eps = row.eps ?? row.actual_eps ?? row.epsActual;
      const revenue = row.revenue ?? row.total_revenue;
      const bits = [
        period ? String(period) : null,
        date ? String(date).slice(0, 10) : null,
        eps != null ? `EPS ${Number(eps).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : null,
        revenue != null ? `Revenue ${fmtCompact(Number(revenue))}` : null,
      ].filter(Boolean);
      return bits.length ? bits.join(" | ") : null;
    })
    .filter((event): event is string => Boolean(event));
  return events.slice(0, 3);
}

function smartMoneySummary(trades: InvestorTrade[]) {
  const buys = trades.filter((trade) => trade.tradeType === "buy");
  const sells = trades.filter((trade) => trade.tradeType === "sell");
  const buyValue = buys.reduce((sum, trade) => sum + (trade.transactionValue ?? 0), 0);
  const sellValue = sells.reduce((sum, trade) => sum + (trade.transactionValue ?? 0), 0);
  const net = buyValue - sellValue;
  const label = net > 0 ? "Accumulation" : net < 0 ? "Distribution" : trades.length ? "Mixed" : "No activity";
  return { buys: buys.length, sells: sells.length, net, label };
}

function buildRiskFlags(
  equity: Equity,
  fair: ValuationResult | null,
  tech: TechnicalSnapshot | null,
  news: ReturnType<typeof summarizeNews>,
  smartMoney: ReturnType<typeof smartMoneySummary>,
): string[] {
  const flags: string[] = [];
  if (fair?.verdict === "Overvalued") flags.push("Overvalued vs fair price");
  if (tech && tech.score < 45) flags.push("Weak technical momentum");
  if (tech?.rsi != null && tech.rsi > 70) flags.push("RSI overbought");
  if (equity.debt_to_equity != null && equity.debt_to_equity > 2) flags.push("High debt-to-equity");
  if (equity.roe != null && equity.roe < 5) flags.push("Low ROE");
  if (equity.volume < 1_000_000) flags.push("Thin liquidity");
  if (news.negative > news.positive) flags.push("Negative news skew");
  if (smartMoney.net < 0) flags.push("Smart-money net sell");
  return flags.slice(0, 6);
}

function toneClass(tone: "good" | "warn" | "bad" | "neutral") {
  if (tone === "good") return "border-success/30 bg-success/10 text-gain";
  if (tone === "warn") return "border-warning/30 bg-warning/10 text-warning";
  if (tone === "bad") return "border-destructive/30 bg-destructive/10 text-loss";
  return "border-border/50 bg-background/45 text-foreground";
}

function IntelligenceTile({
  icon,
  label,
  value,
  sub,
  tone = "neutral",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  return (
    <div className={cn("rounded-xl border px-3 py-3", toneClass(tone))}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold num">{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] opacity-75">{sub}</div>}
    </div>
  );
}

export function StockIntelligenceTerminal({
  equity,
  technical,
  fair,
  newsPayload,
  earningsPayload,
  peerPayload,
  trades,
}: {
  equity: Equity;
  technical: TechnicalSnapshot | null;
  fair: ValuationResult | null;
  newsPayload: unknown;
  earningsPayload: unknown;
  peerPayload: unknown;
  trades: InvestorTrade[];
}) {
  const aiFn = useServerFn(getStockIntelligenceNote);
  const news = useMemo(() => parseNews(newsPayload), [newsPayload]);
  const newsSummary = useMemo(() => summarizeNews(news), [news]);
  const corporateEvents = useMemo(() => extractCorporateEvents(earningsPayload), [earningsPayload]);
  const smartMoney = useMemo(() => smartMoneySummary(trades), [trades]);
  const peerAvailable = useMemo(() => unwrapList(peerPayload).length > 0 || Boolean(peerPayload), [peerPayload]);
  const riskFlags = useMemo(
    () => buildRiskFlags(equity, fair, technical, newsSummary, smartMoney),
    [equity, fair, technical, newsSummary, smartMoney],
  );

  const note = useMutation({
    mutationFn: () =>
      aiFn({
        data: {
          symbol: equity.symbol,
          name: equity.name,
          sector: equity.sector,
          price: equity.price,
          change_pct: equity.change_pct,
          fair_verdict: fair?.verdict ?? "Insufficient Data",
          fair_price: fair?.fairPrice ?? null,
          upside_pct: fair?.upsidePct ?? null,
          technical_stance: technical?.stance ?? "Neutral",
          technical_score: technical?.score ?? null,
          rsi: technical?.rsi ?? null,
          news_sentiment: newsSummary.label,
          news_count: news.length,
          smart_money: `${smartMoney.label}; net ${smartMoney.net}`,
          risk_flags: riskFlags,
        },
      }),
  });

  useEffect(() => {
    note.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equity.symbol]);

  return (
    <GlassCard>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            One Page Intelligence
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Live price, technicals, valuation, sentiment, events, smart money, peers, risk, and AI note.
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => note.mutate()} disabled={note.isPending}>
          {note.isPending ? "Analyzing..." : "Refresh AI"}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <IntelligenceTile
          icon={<CircleDollarSign className="h-3.5 w-3.5" />}
          label="Live Price"
          value={fmtPrice(equity.price)}
          sub={`${fmtPct(equity.change_pct)} | Vol ${fmtCompact(equity.volume)}`}
          tone={equity.change_pct >= 0 ? "good" : "bad"}
        />
        <IntelligenceTile
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Technical"
          value={technical ? `${technical.stance} (${technical.score})` : "Insufficient data"}
          sub={technical ? `${technical.trend} | RSI ${technical.rsi?.toFixed(1) ?? "n/a"}` : "Need more candles"}
          tone={technical ? (technical.score >= 55 ? "good" : technical.score >= 45 ? "warn" : "bad") : "neutral"}
        />
        <IntelligenceTile
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Fair Value"
          value={fair?.fairPrice ? fmtPrice(fair.fairPrice) : "No fair price"}
          sub={fair?.upsidePct != null ? `${fair.verdict} | ${fair.upsidePct.toFixed(1)}% upside` : fair?.verdict}
          tone={fair?.verdict === "Undervalued" ? "good" : fair?.verdict === "Overvalued" ? "bad" : "warn"}
        />
        <IntelligenceTile
          icon={<Newspaper className="h-3.5 w-3.5" />}
          label="News Sentiment"
          value={newsSummary.label}
          sub={`${news.length} articles | +${newsSummary.positive} / -${newsSummary.negative}`}
          tone={newsSummary.label === "Positive" ? "good" : newsSummary.label === "Negative" ? "bad" : "neutral"}
        />
        <IntelligenceTile
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          label="Corporate Action"
          value={corporateEvents[0] ?? "No recent event"}
          sub={corporateEvents[1] ?? "Earnings/dividend feed"}
          tone={corporateEvents.length ? "warn" : "neutral"}
        />
        <IntelligenceTile
          icon={<Users className="h-3.5 w-3.5" />}
          label="Smart Money"
          value={smartMoney.label}
          sub={`${smartMoney.buys} buys / ${smartMoney.sells} sells | Net ${fmtCompact(smartMoney.net)}`}
          tone={smartMoney.net > 0 ? "good" : smartMoney.net < 0 ? "bad" : "neutral"}
        />
        <IntelligenceTile
          icon={<ShieldAlert className="h-3.5 w-3.5" />}
          label="Peer Comparison"
          value={peerAvailable ? "Peer data available" : "Limited peer data"}
          sub={peerAvailable ? "DataSectors insights loaded" : "Waiting for DataSectors insight"}
          tone={peerAvailable ? "good" : "neutral"}
        />
        <IntelligenceTile
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Risk Flags"
          value={riskFlags.length ? `${riskFlags.length} flags` : "No major flags"}
          sub={riskFlags[0] ?? "Current snapshot looks clean"}
          tone={riskFlags.length >= 3 ? "bad" : riskFlags.length ? "warn" : "good"}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border border-border/40 bg-background/35 p-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Risk Flags</div>
          {riskFlags.length ? (
            <div className="flex flex-wrap gap-2">
              {riskFlags.map((flag) => (
                <span key={flag} className="rounded-full border border-warning/30 bg-warning/10 px-2 py-1 text-[11px] text-warning">
                  {flag}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No major risk flags in the current snapshot.</div>
          )}
        </div>

        <div className="rounded-xl border border-border/40 bg-background/35 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Brain className="h-3.5 w-3.5 text-primary" />
            AI Analyst Note
          </div>
          <div className="min-h-[96px] whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {note.isPending && !note.data ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Building intelligence note...
              </div>
            ) : (
              note.data?.text ?? "AI note is not available yet."
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
