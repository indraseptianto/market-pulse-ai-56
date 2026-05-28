import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { getForexOrderbook } from "@/lib/datasectors.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { DollarSign, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, BarChart2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";

export const Route = createFileRoute("/forex")({
  head: () => ({
    meta: [
      { title: "Forex — Stratum" },
      { name: "description", content: "Forex orderbook positioning dan sentiment analysis untuk major currency pairs." },
    ],
  }),
  component: ForexPage,
});

const FOREX_PAIRS = [
  { symbol: "EURUSD", label: "EUR/USD", flag: "🇪🇺🇺🇸" },
  { symbol: "USDIDR", label: "USD/IDR", flag: "🇺🇸🇮🇩" },
  { symbol: "GBPUSD", label: "GBP/USD", flag: "🇬🇧🇺🇸" },
  { symbol: "USDJPY", label: "USD/JPY", flag: "🇺🇸🇯🇵" },
  { symbol: "AUDUSD", label: "AUD/USD", flag: "🇦🇺🇺🇸" },
  { symbol: "USDSGD", label: "USD/SGD", flag: "🇺🇸🇸🇬" },
];

function safeNum(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); if (isFinite(n)) return n; }
  return null;
}

function deepFind(obj: unknown, ...keys: string[]): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  for (const k of keys) { if (k in o && o[k] != null) return o[k]; }
  for (const v of Object.values(o)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const f = deepFind(v, ...keys);
      if (f !== undefined) return f;
    }
  }
  return undefined;
}

interface ParsedForex {
  symbol: string;
  longPct: number | null;
  shortPct: number | null;
  longPositions: number | null;
  shortPositions: number | null;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  price: number | null;
  change: number | null;
}

function parseForexData(raw: unknown, symbol: string): ParsedForex {
  const longPct = safeNum(deepFind(raw, "longPct", "long_pct", "longPercent", "long_percent", "longs", "long"));
  const shortPct = safeNum(deepFind(raw, "shortPct", "short_pct", "shortPercent", "short_percent", "shorts", "short"));
  const longPos = safeNum(deepFind(raw, "longPositions", "long_positions", "longVolume", "long_volume"));
  const shortPos = safeNum(deepFind(raw, "shortPositions", "short_positions", "shortVolume", "short_volume"));
  const price = safeNum(deepFind(raw, "price", "last", "close", "rate", "bid"));
  const change = safeNum(deepFind(raw, "change", "change_pct", "changePct", "percentChange"));

  let sentiment: ParsedForex["sentiment"] = "NEUTRAL";
  if (longPct != null && shortPct != null) {
    if (longPct > shortPct + 10) sentiment = "BULLISH";
    else if (shortPct > longPct + 10) sentiment = "BEARISH";
  }

  return { symbol, longPct, shortPct, longPositions: longPos, shortPositions: shortPos, sentiment, price, change };
}

function SentimentBar({ long, short }: { long: number | null; short: number | null }) {
  if (long == null || short == null) return <div className="h-3 rounded-full bg-accent/40 text-center text-[10px] text-muted-foreground">No data</div>;
  const total = long + short || 100;
  const lPct = (long / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        <div className="h-full bg-gain transition-all" style={{ width: `${lPct}%` }} title={`Long ${lPct.toFixed(1)}%`} />
        <div className="h-full bg-loss transition-all" style={{ width: `${100 - lPct}%` }} title={`Short ${(100 - lPct).toFixed(1)}%`} />
      </div>
      <div className="flex justify-between text-[10px]">
        <span className="text-gain font-medium">Long {lPct.toFixed(1)}%</span>
        <span className="text-loss font-medium">Short {(100 - lPct).toFixed(1)}%</span>
      </div>
    </div>
  );
}

function PairCard({ pair, data, isLoading, error }: {
  pair: typeof FOREX_PAIRS[0];
  data: ParsedForex | null;
  isLoading: boolean;
  error?: string | null;
}) {
  const sentimentCfg = {
    BULLISH: { color: "text-gain", bg: "bg-success/15", border: "border-success/30", icon: TrendingUp },
    BEARISH: { color: "text-loss", bg: "bg-destructive/15", border: "border-destructive/30", icon: TrendingDown },
    NEUTRAL: { color: "text-muted-foreground", bg: "bg-accent/20", border: "border-border/40", icon: BarChart2 },
  };
  const cfg = sentimentCfg[data?.sentiment ?? "NEUTRAL"];
  const SIcon = cfg.icon;

  return (
    <GlassCard className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{pair.flag}</span>
          <div>
            <div className="font-mono font-bold text-sm">{pair.label}</div>
            <div className="text-[10px] text-muted-foreground">{pair.symbol}</div>
          </div>
        </div>
        {data && (
          <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.border} ${cfg.color}`}>
            <SIcon className="h-3 w-3" />
            {data.sentiment}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-3 animate-pulse rounded-full bg-accent/40" />
          <div className="h-8 animate-pulse rounded-lg bg-accent/30" />
        </div>
      ) : data ? (
        <>
          <SentimentBar long={data.longPct} short={data.shortPct} />
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-background/40 px-2.5 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Long Pos.</div>
              <div className="mt-0.5 text-sm font-semibold num text-gain">
                {data.longPositions != null ? data.longPositions.toLocaleString() : data.longPct != null ? `${data.longPct.toFixed(1)}%` : "—"}
              </div>
            </div>
            <div className="rounded-lg bg-background/40 px-2.5 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Short Pos.</div>
              <div className="mt-0.5 text-sm font-semibold num text-loss">
                {data.shortPositions != null ? data.shortPositions.toLocaleString() : data.shortPct != null ? `${data.shortPct.toFixed(1)}%` : "—"}
              </div>
            </div>
          </div>
          {data.price != null && (
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
              <span className="text-xs text-muted-foreground">Rate</span>
              <span className="font-mono font-bold text-sm text-primary">{data.price.toFixed(4)}</span>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-border/40 bg-accent/10 px-3 py-4 text-center text-xs text-muted-foreground">
          <AlertTriangle className="h-5 w-5 mx-auto mb-1 opacity-40" />
          {error ? `Error: ${error}` : "Data tidak tersedia"}
        </div>
      )}
    </GlassCard>
  );
}

function ForexPage() {
  const mounted = useMounted();
  const fn = useServerFn(getForexOrderbook);
  const [selectedPair, setSelectedPair] = useState("EURUSD");

  const queries = FOREX_PAIRS.map(pair => ({
    pair,
    query: useQuery({
      queryKey: ["forex-orderbook", pair.symbol],
      queryFn: () => fn({ data: { symbol: pair.symbol } }),
      staleTime: 60_000,
      retry: false,
      enabled: mounted,
    }),
  }));

  const parsedData = useMemo(() =>
    queries.map(({ pair, query }) => ({
      pair,
      data: query.data?.data ? parseForexData(query.data.data, pair.symbol) : null,
      isLoading: query.isLoading,
      error: query.data?.error ?? (query.isError ? "API error" : null),
    })),
    [queries]
  );

  const selected = parsedData.find(d => d.pair.symbol === selectedPair);

  const chartData = parsedData
    .filter(d => d.data?.longPct != null)
    .map(d => ({
      name: d.pair.label,
      long: d.data!.longPct ?? 0,
      short: d.data!.shortPct ?? (100 - (d.data!.longPct ?? 50)),
    }));

  const bullishCount = parsedData.filter(d => d.data?.sentiment === "BULLISH").length;
  const bearishCount = parsedData.filter(d => d.data?.sentiment === "BEARISH").length;

  return (
    <PageTransition>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-semibold tracking-tight">Forex</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Orderbook positioning dan sentiment analysis untuk major currency pairs.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => queries.forEach(q => q.query.refetch())}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          <GlassCard className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pairs Tracked</div>
            <div className="text-2xl font-bold num mt-1">{FOREX_PAIRS.length}</div>
          </GlassCard>
          <GlassCard className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bullish Pairs</div>
            <div className="text-2xl font-bold text-gain num mt-1">{bullishCount}</div>
          </GlassCard>
          <GlassCard className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bearish Pairs</div>
            <div className="text-2xl font-bold text-loss num mt-1">{bearishCount}</div>
          </GlassCard>
        </div>

        {/* Sentiment chart */}
        {chartData.length > 0 && (
          <GlassCard>
            <div className="mb-3 text-sm font-medium flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />
              Long vs Short Positioning
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ left: 0, right: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 10, fill: "#94a3b8" }} domain={[0, 100]} />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(1)}%`, ""]}
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "11px" }}
                />
                <Bar dataKey="long" name="Long %" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="short" name="Short %" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        )}

        {/* Pair cards grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {parsedData.map(({ pair, data, isLoading, error }) => (
            <PairCard key={pair.symbol} pair={pair} data={data} isLoading={isLoading} error={error} />
          ))}
        </div>

        {/* Raw data debug */}
        <GlassCard>
          <div className="mb-2 text-xs text-muted-foreground">
            Data dari DataSectors <code>/api/forex/orderbook-positioning</code>. Jika semua pair menampilkan "Data tidak tersedia", kemungkinan endpoint ini memerlukan plan berbayar atau parameter berbeda.
          </div>
        </GlassCard>
      </div>
    </PageTransition>
  );
}