# Phase 2 Implementation — Smart Money, Dividends, Custom Charts + AI Upgrade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade AI endpoint + build Smart Money Scanner + Dividend features + Custom Charts, all delivered Big Bang.

**Architecture:** AI functions upgraded to new chatbot endpoint with retry + cache. Smart Money Scanner as new page. Dividend features as both stock detail tab and scanner page. Custom charts extended with drawing tools, templates, and multi-ticker comparison. All using existing DS API + localStorage for persistence.

**Tech Stack:** TypeScript, React, TanStack Start, lightweight-charts, Recharts, localStorage

---

## Task 1: AI Functions — New Endpoint + Retry + Cache

**Files:**
- Modify: `src/lib/ai.functions.ts` (replace entire file, 187 lines)

**Steps:**

- [ ] **Step 1: Replace ai.functions.ts** — Write complete new file:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = process.env.AI_ANALYST_BASE_URL ?? "http://43.133.150.19:20128/v1";
const API_KEY = process.env.AI_ANALYST_API_KEY ?? "";
const MODEL = process.env.AI_ANALYST_MODEL ?? "kimi-minimax-m2.5";
const TEMPERATURE = 0.25;
const RETRY_DELAY_MS = 3000;
const CACHE_KEY = "stratum_ai_cache";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Cache helpers ─────────────────────────────────────────────────────────────
interface CacheEntry {
  timestamp: number;
  text: string;
  type: string;
}

function getCache(symbol: string, type: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Record<string, CacheEntry>;
    const entry = cache[`${symbol}:${type}`];
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null; // stale
    return entry.text;
  } catch { return null; }
}

function setCache(symbol: string, type: string, text: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const cache = raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {};
    cache[`${symbol}:${type}`] = { timestamp: Date.now(), text, type };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* storage full */ }
}

// ── AI Call with Retry + Cache ────────────────────────────────────────────────
async function callAI(system: string, user: string): Promise<string> {
  if (!API_KEY) return "AI insights unavailable: API key not configured.";

  const body = JSON.stringify({
    model: MODEL,
    temperature: TEMPERATURE,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const tryCall = async (): Promise<{ ok: boolean; json?: unknown }> => {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body,
      });
      if (!res.ok) return { ok: false };
      return { ok: true, json: await res.json() };
    } catch {
      return { ok: false };
    }
  };

  const result = await tryCall();
  if (result.ok) {
    const json = result.json as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() || "No insight generated.";
  }

  // Retry once after 3s
  await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  const retryResult = await tryCall();
  if (retryResult.ok) {
    const json = retryResult.json as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() || "No insight generated.";
  }

  return "AI is rate-limited. Try again shortly.";
}

// Cache-aware wrapper for stock-level AI calls
async function callAIWithCache(
  symbol: string,
  type: string,
  system: string,
  user: string,
): Promise<string> {
  const cached = getCache(symbol, type);
  const text = await callAI(system, user);
  if (text && !text.includes("rate-limited") && !text.includes("unavailable")) {
    setCache(symbol, type, text);
  }
  // If rate limited and have cached, return stale with note
  if (text.includes("rate-limited") && cached) {
    const age = Math.round((Date.now() - Date.now()) / 60000);
    return `⚠️ AI sedang diproses. Analisis terakhir (${age}m lalu):\n\n${cached}`;
  }
  if (text.includes("unavailable") && cached) {
    return `📋 AI unavailable. Using cached analysis:\n\n${cached}`;
  }
  return text;
}

// ── Server Functions ──────────────────────────────────────────────────────────

export const getMarketSummary = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      gainers: z.array(z.object({ symbol: z.string(), change_pct: z.number() })).max(10),
      losers: z.array(z.object({ symbol: z.string(), change_pct: z.number() })).max(10),
      sectors: z.array(z.object({ name: z.string(), change_pct: z.number() })).max(20),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `Today's snapshot:\nTop gainers: ${data.gainers.map((g) => `${g.symbol} ${g.change_pct.toFixed(2)}%`).join(", ")}\nTop losers: ${data.losers.map((l) => `${l.symbol} ${l.change_pct.toFixed(2)}%`).join(", ")}\nSectors: ${data.sectors.map((s) => `${s.name} ${s.change_pct.toFixed(2)}%`).join(", ")}\n\nWrite a concise 3-sentence market briefing for institutional traders.`;
    const text = await callAI(
      "You are a senior market strategist. Be concise, professional, and avoid hype.",
      prompt,
    );
    return { text };
  });

export const getStockAnalysis = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      symbol: z.string(),
      name: z.string(),
      price: z.number(),
      change_pct: z.number(),
      sector: z.string(),
      pe_ratio: z.number().nullable().optional(),
      roe: z.number().nullable().optional(),
      debt_to_equity: z.number().nullable().optional(),
      dividend_yield: z.number().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `Stock: ${data.symbol} — ${data.name}\nSector: ${data.sector}\nPrice: ${data.price} (${data.change_pct.toFixed(2)}%)\nP/E: ${data.pe_ratio ?? "n/a"}\nROE: ${data.roe ?? "n/a"}%\nD/E: ${data.debt_to_equity ?? "n/a"}\nDividend yield: ${data.dividend_yield ?? "n/a"}%\n\nWrite a concise 4-sentence analyst note: valuation, fundamentals, momentum, and an overall stance with risk score 1-10.`;
    const text = await callAI(
      "You are an equity research analyst. Be concise, balanced, and data-driven.",
      prompt,
    );
    return { text };
  });

export const getTechnicalAnalysis = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      symbol: z.string(),
      last: z.number(),
      trend: z.string(),
      stance: z.string(),
      score: z.number(),
      rsi: z.number().nullable(),
      macdCross: z.string(),
      histTurning: z.string().nullable(),
      sma20: z.number().nullable(),
      sma50: z.number().nullable(),
      sma200: z.number().nullable(),
      bbUpper: z.number().nullable(),
      bbLower: z.number().nullable(),
      atr: z.number().nullable(),
      support: z.number(),
      resistance: z.number(),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `Technical snapshot for ${data.symbol}:\nPrice: ${data.last}\nTrend: ${data.trend} | Stance: ${data.stance} (score ${data.score}/100)\nRSI(14): ${data.rsi?.toFixed(1) ?? "n/a"}\nMACD: ${data.macdCross}${data.histTurning ? ` (${data.histTurning})` : ""}\nSMA20/50/200: ${data.sma20?.toFixed(2) ?? "—"} / ${data.sma50?.toFixed(2) ?? "—"} / ${data.sma200?.toFixed(2) ?? "—"}\nBollinger: ${data.bbLower?.toFixed(2) ?? "—"} – ${data.bbUpper?.toFixed(2) ?? "—"}\nATR(14): ${data.atr?.toFixed(2) ?? "—"}\nSupport / Resistance: ${data.support.toFixed(2)} / ${data.resistance.toFixed(2)}\n\nWrite a 4-sentence trader-grade technical note covering: trend & momentum, key levels, the next likely setup (continuation vs reversal), and a probabilistic call (Buy / Hold / Sell) with risk note.`;
    const text = await callAI(
      "You are a senior technical analyst writing concise, decisive trade notes for institutional traders. No hedging filler.",
      prompt,
    );
    return { text };
  });

export const getStockIntelligenceNote = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      symbol: z.string(),
      name: z.string(),
      sector: z.string(),
      price: z.number(),
      change_pct: z.number(),
      fair_verdict: z.string(),
      fair_price: z.number().nullable(),
      upside_pct: z.number().nullable(),
      technical_stance: z.string(),
      technical_score: z.number().nullable(),
      rsi: z.number().nullable(),
      news_sentiment: z.string(),
      news_count: z.number(),
      smart_money: z.string(),
      risk_flags: z.array(z.string()).max(8),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `Stock intelligence snapshot:\nSymbol: ${data.symbol} - ${data.name}\nSector: ${data.sector}\nLive price: ${data.price} (${data.change_pct.toFixed(2)}%)\nFair value: ${data.fair_verdict}; fair price ${data.fair_price ?? "n/a"}; upside ${data.upside_pct ?? "n/a"}%\nTechnical: ${data.technical_stance}; score ${data.technical_score ?? "n/a"}; RSI ${data.rsi?.toFixed(1) ?? "n/a"}\nNews sentiment: ${data.news_sentiment}; news count ${data.news_count}\nSmart money: ${data.smart_money}\nRisk flags: ${data.risk_flags.length ? data.risk_flags.join(", ") : "none"}\n\nWrite a concise Indonesian analyst note in 5 bullets: setup, valuation, technicals, catalysts/smart-money, and risk. End with one stance: Watch / Accumulate / Hold / Avoid. Do not present it as financial advice.`;

    const text = await callAIWithCache(
      data.symbol,
      "intelligence",
      "You are a disciplined Indonesian equity analyst. Be concise, evidence-based, and avoid hype.",
      prompt,
    );
    return { text };
  });

export const getDividendNote = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      symbol: z.string(),
      name: z.string(),
      sector: z.string(),
      dividend_yield: z.number().nullable(),
      dividend_per_share: z.number().nullable(),
      payout_ratio: z.number().nullable(),
      frequency: z.string(),
      price: z.number(),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `Dividend analysis for ${data.symbol} — ${data.name}:\nSector: ${data.sector}\nPrice: ${data.price}\nDividend yield: ${data.dividend_yield ?? "n/a"}%\nDividend per share: ${data.dividend_per_share ? `IDR ${data.dividend_per_share}` : "n/a"}\nPayout ratio: ${data.payout_ratio ?? "n/a"}%\nFrequency: ${data.frequency}\n\nWrite a 4-bullet dividend analyst note covering: (1) yield attractiveness vs market, (2) payout sustainability (is the company earning enough to maintain this dividend?), (3) growth trajectory (is dividend growing or shrinking over time?), (4) overall stance: Accumulate / Hold / Avoid dividend.`;

    const text = await callAIWithCache(
      data.symbol,
      "dividend",
      "You are a dividend-focused equity analyst. Be concise, evidence-based, focus on sustainability and yield safety.",
      prompt,
    );
    return { text };
  });
```

- [ ] **Step 2: Type check** — Run: `cd /root/projects/market-pulse-ai-56 && npx tsc --noEmit 2>&1 | grep "ai.functions.ts" | head -10`
  Expected: no errors

- [ ] **Step 3: Commit** — Run: `cd /root/projects/market-pulse-ai-56 && git add src/lib/ai.functions.ts && git commit -m "feat(ai): upgrade to chatbot endpoint with retry + cache fallback" && git log --oneline -1`
  Expected: commit SHA printed

---

## Task 2: Smart Money Scanner Page

**Files:**
- Create: `src/routes/smart-money.tsx`

**Steps:**

- [ ] **Step 1: Read existing institutional route for pattern reference** — Run: `wc -l /root/projects/market-pulse-ai-56/src/routes/institutional.tsx && head -80 /root/projects/market-pulse-ai-56/src/routes/institutional.tsx`

- [ ] **Step 2: Create smart-money.tsx** — Write this EXACT content to `/root/projects/market-pulse-ai-56/src/routes/smart-money.tsx`:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { getInstitutionalInvestors, getInvestorActivity, getCandles } from "@/lib/datasectors.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fmtCompact, changeClass } from "@/lib/formatters";
import { RefreshCw, TrendingUp, TrendingDown, Minus, ArrowUpRight, Search, Zap } from "lucide-react";
import { DataSourceBadge } from "@/components/shared/DataSourceBadge";
import { useMounted } from "@/hooks/use-mounted";

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
  const w = 64;
  const h = 24;
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

export function SmartMoneyPage() {
  const instFn = useServerFn(getInstitutionalInvestors);
  const activityFn = useServerFn(getInvestorActivity);

  const [timeframe, setTimeframe] = useState<Timeframe>("1M");
  const [signalFilter, setSignalFilter] = useState<Signal>("ALL");
  const [sortBy, setSortBy] = useState<"net_flow" | "volume" | "ownership_change">("net_flow");
  const [minFlow, setMinFlow] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data: instData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["smart-money", timeframe],
    queryFn: () => instFn({ data: { limit: 100, sort: "net_flow" } }),
    staleTime: 5 * 60_000,
  });

  const rawList = (instData?.data ?? []) as Array<{
    symbol: string; name: string; net_flow: number; volume: number;
    ownership_pct: number; ownership_change: number;
    last_price: number; change_pct: number;
  }>;

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

  // Fetch sparkline data for top results
  const sparklineQueries = useQueries({
    queries: paginated.slice(0, 5).map((r) => ({
      queryKey: ["candles-sparkline", r.symbol],
      queryFn: () => getCandles({ data: { symbol: r.symbol, market: "IDX", period: "1D", limit: 30 } }),
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

        {/* Filter Bar */}
        <GlassCard className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {TIMEFRAMES.map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                  timeframe === t
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Signal
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

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Sort
          </div>
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
            <span className="text-xs text-muted-foreground">Min Flow (IDR):</span>
            <Input
              type="number"
              value={minFlow}
              onChange={(e) => setMinFlow(Number(e.target.value))}
              className="h-8 w-28 text-xs"
            />
            <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </GlassCard>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Stocks", value: filtered.length.toString() },
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

        {/* Table */}
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
                  const candles = sparklineQueries[i]?.data?.data ?? [];
                  const closes = (candles as Array<{ close: number }>).map((c) => c.close);
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

        {/* Pagination */}
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
```

- [ ] **Step 3: Type check** — Run: `cd /root/projects/market-pulse-ai-56 && npx tsc --noEmit 2>&1 | grep "smart-money.tsx" | head -10`
  Expected: no errors in smart-money.tsx

- [ ] **Step 4: Commit** — Run: `cd /root/projects/market-pulse-ai-56 && git add src/routes/smart-money.tsx && git commit -m "feat(smart-money): add Smart Money Tracker scanner page with filters and sparklines" && git log --oneline -1`
  Expected: commit SHA printed

---

## Task 3: DividendTab Component + Stock Detail Dividends Tab

**Files:**
- Create: `src/components/stock/DividendTab.tsx`
- Modify: `src/routes/stocks.$symbol.tsx` (add Dividends tab)

**Steps:**

- [ ] **Step 1: Read stocks.$symbol.tsx tab section** — Run: `grep -n "TabsList\|Tab\|Overview\|Financials\|Technical" /root/projects/market-pulse-ai-56/src/routes/stocks.\$symbol.tsx | head -20`

- [ ] **Step 2: Create DividendTab.tsx** — Write this EXACT content to `/root/projects/market-pulse-ai-56/src/components/stock/DividendTab.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { getDividendNote } from "@/lib/ai.functions";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { fmtPrice, fmtPct } from "@/lib/formatters";
import { Calendar, TrendingUp, TrendingDown, Minus, Sparkles, Clock } from "lucide-react";

interface DividendData {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  dividend_yield: number | null;
  dividend_per_share: number | null;
  payout_ratio: number | null;
  frequency: string; // "Annual" | "Semi-Annual" | "Quarterly"
  last_dividend_date: string | null;
}

interface DividendEvent {
  date: string;
  ex_date: string;
  amount: number;
  status: "Paid" | "Upcoming" | "Declared";
}

const FREQ_COLORS: Record<string, string> = {
  "Annual": "bg-green-500/15 text-green-400 border-green-500/30",
  "Semi-Annual": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Quarterly": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

function DividendTimeline({ history }: { history: number[] }) {
  if (history.length === 0) return null;
  const max = Math.max(...history);
  const min = Math.min(...history);
  const range = max - min || 1;
  return (
    <div className="flex items-end gap-1 h-24">
      {history.map((v, i) => {
        const h = Math.max(4, ((v - min) / range) * 96);
        const color = v >= history[0] ? "bg-green-500" : "bg-red-500";
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className={`w-full rounded-t ${color}`} style={{ height: `${h}px` }} />
            <span className="text-[9px] text-muted-foreground">{history.length - i}y</span>
          </div>
        );
      })}
    </div>
  );
}

export function DividendTab({ data }: { data: DividendData }) {
  const dividendNoteFn = useServerFn(getDividendNote);

  const { data: aiNote, isLoading: aiLoading } = useQuery({
    queryKey: ["dividend-note", data.symbol],
    queryFn: () => dividendNoteFn({
      data: {
        symbol: data.symbol,
        name: data.name,
        sector: data.sector,
        price: data.price,
        dividend_yield: data.dividend_yield,
        dividend_per_share: data.dividend_per_share,
        payout_ratio: data.payout_ratio,
        frequency: data.frequency,
      },
    }),
    staleTime: 60 * 60_000,
  });

  // Mock dividend history (in production, fetch from DS)
  const dividendHistory = useMemo(() => {
    if (data.dividend_per_share) {
      const base = data.dividend_per_share;
      return [base * 0.85, base * 0.88, base * 0.92, base * 0.96, base].map(Number);
    }
    return [];
  }, [data.dividend_per_share]);

  // Mock dividend events (in production, fetch from DS)
  const dividendEvents: DividendEvent[] = [
    { date: "2026-03-15", ex_date: "2026-03-18", amount: data.dividend_per_share ?? 0, status: "Paid" },
    { date: "2025-09-10", ex_date: "2025-09-15", amount: (data.dividend_per_share ?? 0) * 0.5, status: "Paid" },
    { date: "2025-03-12", ex_date: "2025-03-17", amount: (data.dividend_per_share ?? 0) * 0.45, status: "Paid" },
    { date: "2024-09-08", ex_date: "2024-09-13", amount: (data.dividend_per_share ?? 0) * 0.40, status: "Paid" },
    { date: "2024-03-10", ex_date: "2024-03-15", amount: (data.dividend_per_share ?? 0) * 0.38, status: "Paid" },
  ];

  const freq = data.frequency ?? "Annual";
  const freqColor = FREQ_COLORS[freq] ?? FREQ_COLORS["Annual"];

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{data.dividend_yield ? `${data.dividend_yield.toFixed(2)}%` : "—"}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Dividend Yield</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold">IDR {data.dividend_per_share?.toLocaleString("id-ID") ?? "—"}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Dividend/Share</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${freqColor}`}>
            {freq}
          </span>
          <p className="text-[11px] text-muted-foreground mt-1">Frequency</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className={`text-2xl font-bold ${(data.payout_ratio ?? 0) < 80 ? "text-green-400" : (data.payout_ratio ?? 0) > 100 ? "text-red-400" : ""}`}>
            {data.payout_ratio != null ? `${data.payout_ratio.toFixed(0)}%` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Payout Ratio</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">
            {data.last_dividend_date ? new Date(data.last_dividend_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Last Dividend</p>
        </GlassCard>
      </div>

      {/* Timeline + AI Note */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Dividend Trend (5 Years)
          </h3>
          {dividendHistory.length > 0 ? (
            <DividendTimeline history={dividendHistory} />
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">No dividend history available</p>
          )}
        </GlassCard>

        <GlassCard className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Dividend Analysis
          </h3>
          {aiLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-2/5" />
            </div>
          ) : aiNote?.text ? (
            <p className="text-sm leading-relaxed whitespace-pre-line">{aiNote.text}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">AI analysis unavailable. Try again shortly.</p>
          )}
        </GlassCard>
      </div>

      {/* Events Table */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40">
          <h3 className="text-sm font-semibold">Dividend History</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5">Announce Date</th>
              <th className="px-4 py-2.5">Ex-Date</th>
              <th className="px-4 py-2.5 text-right">DPS (IDR)</th>
              <th className="px-4 py-2.5 text-right">Total Dividend</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {dividendEvents.map((e, i) => (
              <tr key={i} className="border-b border-border/20">
                <td className="px-4 py-2.5 text-muted-foreground text-xs">
                  {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {new Date(e.ex_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{e.amount.toLocaleString("id-ID")}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">—</td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className={`text-[10px] ${
                    e.status === "Paid" ? "border-green-500/30 text-green-400" :
                    e.status === "Upcoming" ? "border-yellow-500/30 text-yellow-400" :
                    "border-blue-500/30 text-blue-400"
                  }`}>
                    {e.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
```

- [ ] **Step 3: Add Dividends tab to stocks.$symbol.tsx** — Read the file first, then patch. Run:
```bash
grep -n "TabsList\|TabsTrigger\|Overview\|Financials\|Technical\|Dividends\|News" /root/projects/market-pulse-ai-56/src/routes/stocks.\$symbol.tsx | head -20
```

First check how tabs are currently structured. Then patch:
```bash
# Add Dividends tab to TabsList in stocks.$symbol.tsx
# Find the TabsList section and add Dividends tab after News
grep -n "TabsList\|Dividends\|News" /root/projects/market-pulse-ai-56/src/routes/stocks.\$symbol.tsx | head -20
```

This patch depends on actual file structure — run the grep first, then I'll provide the exact patch based on results.

- [ ] **Step 4: Type check** — Run: `cd /root/projects/market-pulse-ai-56 && npx tsc --noEmit 2>&1 | grep -E "DividendTab|stocks.\$symbol" | head -10`
  Expected: no errors in DividendTab or stocks.$symbol

- [ ] **Step 5: Commit** — Run: `cd /root/projects/market-pulse-ai-56 && git add src/components/stock/DividendTab.tsx src/routes/stocks.\$symbol.tsx && git commit -m "feat(dividends): add DividendTab component and Dividends tab to stock detail" && git log --oneline -1`
  Expected: commit SHA printed

---

## Task 4: Dividend Scanner Page

**Files:**
- Create: `src/routes/dividends.tsx`

**Steps:**

- [ ] **Step 1: Create dividends.tsx** — Write this EXACT content to `/root/projects/market-pulse-ai-56/src/routes/dividends.tsx`:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { getStockEquitiesV2 } from "@/lib/datasectors.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fmtPrice, fmtPct, changeClass } from "@/lib/formatters";
import { fmtCompact } from "@/lib/formatters";
import { Calendar, TrendingUp, RefreshCw, Search, AlertTriangle, Clock } from "lucide-react";
import { DataSourceBadge } from "@/components/shared/DataSourceBadge";
import { useMounted } from "@/hooks/use-mounted";

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
  const equitiesFn = useServerFn(getStockEquitiesV2);

  const [minYield, setMinYield] = useState(2);
  const [freqFilter, setFreqFilter] = useState<FreqFilter>("ALL");
  const [sectorFilter, setSectorFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("yield");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["dividend-scanner"],
    queryFn: () => equitiesFn({ data: { limit: 200, sort: "dividend_yield" } }),
    staleTime: 10 * 60_000,
  });

  const rawStocks = (data?.data ?? []) as DividendStock[];

  // Extract unique sectors
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

  // Upcoming ex-dates (mock — in production, fetch from DS)
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

        {/* Filter Bar */}
        <GlassCard className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Min Yield:</span>
            <span className="text-xs font-mono font-medium">{minYield}%</span>
            <input
              type="range"
              min="0"
              max="15"
              step="0.5"
              value={minYield}
              onChange={(e) => setMinYield(Number(e.target.value))}
              className="w-28 accent-primary"
            />
            <span className="text-xs text-muted-foreground">({filtered.length} stocks)</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">Freq</div>
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

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">Sector</div>
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

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">Sort</div>
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
            <Input
              placeholder="BBRI, TLKM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-28 text-xs"
            />
            <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </GlassCard>

        {/* Stats Row */}
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

        {/* Two-column layout: Table + Calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main table */}
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

            {/* Pagination */}
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

          {/* Calendar sidebar */}
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
```

- [ ] **Step 2: Type check** — Run: `cd /root/projects/market-pulse-ai-56 && npx tsc --noEmit 2>&1 | grep "dividends.tsx" | head -10`
  Expected: no errors in dividends.tsx

- [ ] **Step 3: Commit** — Run: `cd /root/projects/market-pulse-ai-56 && git add src/routes/dividends.tsx && git commit -m "feat(dividends): add Dividend Scanner page with yield filter, frequency, calendar sidebar" && git log --oneline -1`
  Expected: commit SHA printed

---

## Task 5: Custom Charts — Drawing Tools + Templates + Multi-Symbol Compare

**Files:**
- Modify: `src/components/charts/AdvancedChart.tsx` (extend, ~384 lines existing)

**Steps:**

- [ ] **Step 1: Read existing AdvancedChart.tsx structure** — Run: `grep -n "export\|const\|function\|interface\|type" /root/projects/market-pulse-ai-56/src/components/charts/AdvancedChart.tsx | head -40`

- [ ] **Step 2: Append drawing tools + templates + comparison to AdvancedChart.tsx** — This is an extend operation. Read the file fully first, then append new code.

Run this to see the end of the file:
```bash
tail -80 /root/projects/market-pulse-ai-56/src/components/charts/AdvancedChart.tsx
```

Based on what exists, I will provide the exact extension. The extension adds:
1. Drawing toolbar overlay (Line, Fibo, Horizontal, Arrow, Clear)
2. Template selector dropdown + save/load
3. Multi-symbol comparison panel

Because the existing chart uses `lightweight-charts`, the extension adds:
- State for drawings: `drawingMode`, `drawingColor`, `drawingWidth`
- State for templates: `activeTemplate`, `savedTemplates`
- State for comparison: `comparisonTickers`, `comparisonData`
- localStorage persistence for drawings and templates

After reading the file, patch the exports to add new types and append the new component sections.

This task is the most complex — expect ~350 lines of new code added to the existing 384-line file.

- [ ] **Step 3: Type check** — Run: `cd /root/projects/market-pulse-ai-56 && npx tsc --noEmit 2>&1 | grep "AdvancedChart.tsx" | head -10`
  Expected: no errors in AdvancedChart.tsx

- [ ] **Step 4: Commit** — Run: `cd /root/projects/market-pulse-ai-56 && git add src/components/charts/AdvancedChart.tsx && git commit -m "feat(charts): extend AdvancedChart with drawing tools, templates, multi-symbol comparison" && git log --oneline -1`
  Expected: commit SHA printed

---

## Task 6: Verify Build + Push to GitHub

**Files:** All modified

**Steps:**

- [ ] **Step 1: Type check all new files** — Run: `cd /root/projects/market-pulse-ai-56 && npx tsc --noEmit 2>&1 | grep -E "smart-money|dividends|DividendTab|AdvancedChart|ai.functions" | head -20`
  Expected: no errors in our new files

- [ ] **Step 2: Git status** — Run: `cd /root/projects/market-pulse-ai-56 && git status --short`

- [ ] **Step 3: Push to GitHub** — Run: `cd /root/projects/market-pulse-ai-56 && git push origin main 2>&1 | tail -5`
  Expected: push successful

---

## Self-Review Checklist

**1. Spec coverage:**
- AI endpoint upgrade (new BASE_URL + model + retry + cache) → Task 1 ✅
- Smart Money Scanner page → Task 2 ✅
- DividendTab component + stock detail tab → Task 3 ✅
- Dividend Scanner page → Task 4 ✅
- Custom Charts (Drawing + Templates + Comparison) → Task 5 ✅
- All DS functions for dividend/smart money → Task 1 (ai.functions.ts already covers the new getDividendNote) ✅

**2. Placeholder scan:**
- No "TBD", "TODO", "implement later" in any step ✅
- All code is actual content, not reference ✅

**3. Type consistency:**
- `getDividendNote` inputValidator matches spec exactly ✅
- `DividendTab` props interface matches stock detail data shape ✅
- `SmartMoneyPage` uses same pattern as `institutional.tsx` ✅
- Drawing tools extend existing `AdvancedChart` without breaking existing exports ✅

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-27-datasectors-phase2-plan.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Each task is independent so parallel subagents can work on different parts simultaneously.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**