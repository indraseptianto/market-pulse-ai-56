import { createFileRoute } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import {
  getCryptoTrending,
  getCryptoStrongTrend,
  getCryptoEvents,
  getCryptoCorrelation,
  getCryptoWalls,
  getCryptoOrderbookImbalance,
} from "@/lib/datasectors.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Zap, BarChart3, Calendar, RefreshCw, Activity, Bug } from "lucide-react";
import { fmtPct, fmtCompact } from "@/lib/formatters";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";

export const Route = createFileRoute("/crypto")({
  head: () => ({
    meta: [
      { title: "Crypto Markets — Stratum" },
      { name: "description", content: "Crypto intelligence powered by DataSectors: trending, strong trends, orderbook walls, correlation, and events." },
    ],
  }),
  component: CryptoPage,
});

// ── Deep-extract helpers ──────────────────────────────────────────────────────
function safeNum(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v !== "") { const n = Number(v); if (isFinite(n)) return n; }
  return null;
}

// Recursively find first array in any nested object
function deepArr(v: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 4) return [];
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    // Try common wrapper keys first
    for (const k of ["data", "coins", "results", "items", "list", "trending", "strong_bullish", "strong_bearish", "correlations", "bids", "asks", "walls"]) {
      if (Array.isArray(obj[k])) return obj[k] as Record<string, unknown>[];
    }
    // Then recurse into any object value
    for (const val of Object.values(obj)) {
      if (val && typeof val === "object") {
        const found = deepArr(val, depth + 1);
        if (found.length > 0) return found;
      }
    }
  }
  return [];
}

// Extract a named sub-array from response
function extractArr(payload: unknown, ...keys: string[]): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  for (const k of keys) {
    if (Array.isArray(obj[k])) return obj[k] as Record<string, unknown>[];
    // Check inside .data
    const d = obj.data;
    if (d && typeof d === "object" && !Array.isArray(d)) {
      const inner = (d as Record<string, unknown>)[k];
      if (Array.isArray(inner)) return inner as Record<string, unknown>[];
    }
  }
  return deepArr(payload);
}

const COIN_COLORS: Record<string, string> = {
  BTC: "#f7931a", ETH: "#627eea", SOL: "#9945ff", BNB: "#f3ba2f",
  XRP: "#00aae4", ADA: "#0033ad", DOGE: "#c2a633", AVAX: "#e84142",
};

function coinColor(s: string) { return COIN_COLORS[s.toUpperCase()] ?? "#38bdf8"; }

// ── Raw debug panel ───────────────────────────────────────────────────────────
function RawPanel({ label, data }: { label: string; data: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
        <Bug className="h-3 w-3" /> {open ? "Hide" : "Show"} raw · {label}
      </button>
      {open && (
        <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-background/60 p-2 text-[9px] text-muted-foreground">
          {JSON.stringify(data, null, 2)?.slice(0, 2000)}
        </pre>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
function CryptoPage() {
  const [selectedCoin, setSelectedCoin] = useState("BTC");
  const [correlBase, setCorrelBase] = useState("BTC");

  const trendingFn  = useServerFn(getCryptoTrending);
  const strongFn    = useServerFn(getCryptoStrongTrend);
  const eventsFn    = useServerFn(getCryptoEvents);
  const correlFn    = useServerFn(getCryptoCorrelation);
  const wallsFn     = useServerFn(getCryptoWalls);
  const imbalanceFn = useServerFn(getCryptoOrderbookImbalance);

  const [trendingQ, strongQ, eventsQ, correlQ, wallsQ, imbalanceQ] = useQueries({
    queries: [
      // Stagger with gcTime to avoid hitting rate limits — only load on demand
      { queryKey: ["ds-crypto-trending"], queryFn: () => trendingFn({}), staleTime: 300_000, retry: false },
      { queryKey: ["ds-crypto-strong"], queryFn: () => strongFn({}), staleTime: 300_000, retry: false },
      { queryKey: ["ds-crypto-events"], queryFn: () => eventsFn({ data: undefined }), staleTime: 600_000, retry: false },
      { queryKey: ["ds-crypto-correl", correlBase], queryFn: () => correlFn({ data: { base: correlBase } }), staleTime: 300_000, retry: false },
      { queryKey: ["ds-crypto-walls", selectedCoin + "USDT"], queryFn: () => wallsFn({ data: { symbol: selectedCoin + "USDT" } }), staleTime: 120_000, retry: false },
      { queryKey: ["ds-crypto-imbalance", selectedCoin + "USDT"], queryFn: () => imbalanceFn({ data: { symbol: selectedCoin + "USDT" } }), staleTime: 120_000, retry: false },
    ],
  });

  const trendingRaw  = trendingQ.data?.data;
  const strongRaw    = strongQ.data?.data;
  const eventsRaw    = eventsQ.data?.data;
  const correlRaw    = correlQ.data?.data;
  const wallsRaw     = wallsQ.data?.data;
  const imbalanceRaw = imbalanceQ.data?.data;

  // ── Parse strong trend ────────────────────────────────────────────────────
  const strongBullish = useMemo(() => {
    if (!strongRaw || typeof strongRaw !== "object") return [];
    const obj = strongRaw as Record<string, unknown>;
    return (Array.isArray(obj.strong_bullish) ? obj.strong_bullish : []) as Record<string, unknown>[];
  }, [strongRaw]);

  const strongBearish = useMemo(() => {
    if (!strongRaw || typeof strongRaw !== "object") return [];
    const obj = strongRaw as Record<string, unknown>;
    return (Array.isArray(obj.strong_bearish) ? obj.strong_bearish : []) as Record<string, unknown>[];
  }, [strongRaw]);

  const strongNeutral = useMemo(() => {
    if (!strongRaw || typeof strongRaw !== "object") return [];
    const obj = strongRaw as Record<string, unknown>;
    return (Array.isArray(obj.neutral) ? obj.neutral : []) as Record<string, unknown>[];
  }, [strongRaw]);

  // ── Parse trending ────────────────────────────────────────────────────────
  const trendingCoins = useMemo(() => extractArr(trendingRaw).slice(0, 12), [trendingRaw]);

  // ── Parse events ──────────────────────────────────────────────────────────
  const cryptoEvents = useMemo(() => extractArr(eventsRaw).slice(0, 8), [eventsRaw]);

  // ── Parse correlation ─────────────────────────────────────────────────────
  const correlData = useMemo(() => {
    const arr = extractArr(correlRaw, "correlations", "data");
    return arr.slice(0, 10).map((c) => ({
      name: String(c.symbol ?? c.coin ?? c.name ?? c.ticker ?? ""),
      value: safeNum(c.correlation ?? c.value ?? c.corr ?? c.pearson) ?? 0,
    })).filter(c => c.name);
  }, [correlRaw]);

  // ── Parse walls ───────────────────────────────────────────────────────────
  const bidWalls = useMemo(() => {
    if (!wallsRaw || typeof wallsRaw !== "object") return [];
    const obj = wallsRaw as Record<string, unknown>;
    const arr = Array.isArray(obj.bids) ? obj.bids
      : Array.isArray(obj.bid_walls) ? obj.bid_walls
      : Array.isArray(obj.support) ? obj.support
      : extractArr(wallsRaw, "bids", "bid_walls", "support");
    return (arr as Record<string, unknown>[]).slice(0, 5);
  }, [wallsRaw]);

  const askWalls = useMemo(() => {
    if (!wallsRaw || typeof wallsRaw !== "object") return [];
    const obj = wallsRaw as Record<string, unknown>;
    const arr = Array.isArray(obj.asks) ? obj.asks
      : Array.isArray(obj.ask_walls) ? obj.ask_walls
      : Array.isArray(obj.resistance) ? obj.resistance
      : extractArr(wallsRaw, "asks", "ask_walls", "resistance");
    return (arr as Record<string, unknown>[]).slice(0, 5);
  }, [wallsRaw]);

  // ── Parse imbalance ───────────────────────────────────────────────────────
  const imbalanceRatio = useMemo(() => {
    if (!imbalanceRaw) return null;
    const obj = imbalanceRaw as Record<string, unknown>;
    return safeNum(obj.imbalance ?? obj.ratio ?? obj.imbalance_ratio ?? obj.buy_ratio ?? obj.buyRatio);
  }, [imbalanceRaw]);

  const buyPct  = imbalanceRatio != null ? Math.max(0, Math.min(100, 50 + imbalanceRatio * 50)) : null;
  const sellPct = buyPct != null ? 100 - buyPct : null;

  const anyLoading = trendingQ.isLoading || strongQ.isLoading;
  const isRateLimited = [trendingQ, strongQ, eventsQ, correlQ, wallsQ, imbalanceQ]
    .some(q => q.error && String(q.error).includes("429"));

  return (
    <PageTransition>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Crypto Markets</h1>
            <p className="text-sm text-muted-foreground">
              DataSectors · Trending · Strong trends · Orderbook walls · Correlation · Events
            </p>
          </div>
          <div className="flex items-center gap-2">
            {anyLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary text-[11px]">
              DataSectors API
            </Badge>
          </div>
        </div>

        {/* Rate limit warning */}
        {isRateLimited && (
          <div className="rounded-xl border border-warning/30 bg-warning/8 px-4 py-3 text-sm text-warning">
            ⚠️ <strong>Rate limit reached (HTTP 429)</strong> — DataSectors free plan allows 100 requests/day and 10/minute.
            Some data may not load. Wait a minute and refresh, or upgrade your DataSectors plan.
          </div>
        )}

        {/* ── STRONG TREND + TRENDING ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Strong Trend */}
          <GlassCard>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-primary" /> Strong Trend Signals
            </div>
            {strongQ.isLoading ? (
              <div className="space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-9 rounded-lg"/>)}</div>
            ) : strongQ.isError ? (
              <p className="text-sm text-destructive py-4 text-center">API error: {String(strongQ.error)}</p>
            ) : strongBullish.length === 0 && strongBearish.length === 0 ? (
              <div>
                <p className="text-sm text-muted-foreground py-2 text-center">No strong trend data parsed.</p>
                <RawPanel label="strong-trend" data={strongRaw} />
              </div>
            ) : (
              <div className="space-y-1.5">
                {strongBullish.slice(0, 5).map((c, i) => {
                  const sym = String(c.symbol ?? c.ticker ?? c.coin ?? c.name ?? "");
                  const pct = safeNum(c.change_pct ?? c.changePercent ?? c.priceChangePercent ?? c.change);
                  return (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-success/8 border border-success/20 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3.5 w-3.5 text-success shrink-0" />
                        <span className="font-mono text-sm font-semibold">{sym || `#${i+1}`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {pct != null && <span className="text-xs text-success num">+{pct.toFixed(2)}%</span>}
                        <Badge variant="outline" className="text-[10px] border-success/30 text-success px-1.5">Bullish</Badge>
                      </div>
                    </div>
                  );
                })}
                {strongBearish.slice(0, 3).map((c, i) => {
                  const sym = String(c.symbol ?? c.ticker ?? c.coin ?? c.name ?? "");
                  const pct = safeNum(c.change_pct ?? c.changePercent ?? c.priceChangePercent ?? c.change);
                  return (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-destructive/8 border border-destructive/20 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-3.5 w-3.5 text-destructive shrink-0" />
                        <span className="font-mono text-sm font-semibold">{sym || `#${i+1}`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {pct != null && <span className="text-xs text-destructive num">{pct.toFixed(2)}%</span>}
                        <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive px-1.5">Bearish</Badge>
                      </div>
                    </div>
                  );
                })}
                {strongNeutral.length > 0 && (
                  <p className="text-[11px] text-muted-foreground pt-1">{strongNeutral.length} neutral coins</p>
                )}
              </div>
            )}
          </GlassCard>

          {/* Trending */}
          <GlassCard>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4 text-primary" /> Trending Coins
            </div>
            {trendingQ.isLoading ? (
              <div className="space-y-2">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-9 rounded-lg"/>)}</div>
            ) : trendingCoins.length === 0 ? (
              <div>
                <p className="text-sm text-muted-foreground py-2 text-center">No trending data parsed.</p>
                <RawPanel label="trending" data={trendingRaw} />
              </div>
            ) : (
              <div className="space-y-1.5">
                {trendingCoins.map((c, i) => {
                  const name   = String(c.name ?? c.symbol ?? c.id ?? c.coin ?? "");
                  const symbol = String(c.symbol ?? c.id ?? c.ticker ?? "");
                  const rank   = safeNum(c.market_cap_rank ?? c.rank ?? c.score);
                  const pct    = safeNum(c.price_change_percentage_24h ?? c.change_24h ?? c.change_pct ?? c.priceChangePercent);
                  const price  = safeNum(c.current_price ?? c.price ?? c.last_price);
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-lg bg-background/40 px-3 py-2">
                      <span className="w-5 shrink-0 text-[11px] text-muted-foreground num">{rank ?? i + 1}</span>
                      <div
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold"
                        style={{ background: coinColor(symbol) + "33", color: coinColor(symbol) }}
                      >
                        {(symbol || name).slice(0, 3).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{name || symbol || "—"}</div>
                        {price != null && <div className="text-[10px] text-muted-foreground num">${price.toLocaleString("en-US", { maximumFractionDigits: price > 100 ? 2 : 4 })}</div>}
                      </div>
                      {pct != null && (
                        <span className={`text-xs num font-semibold shrink-0 ${pct >= 0 ? "text-success" : "text-destructive"}`}>
                          {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>

        {/* ── ORDERBOOK ANALYSIS ── */}
        <div className="space-y-3">
          {/* Coin selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Orderbook for:</span>
            {["BTC","ETH","SOL","BNB","XRP","ADA","DOGE"].map((coin) => (
              <button
                key={coin}
                onClick={() => setSelectedCoin(coin)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-mono transition ${
                  selectedCoin === coin
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {coin}
              </button>
            ))}
            {(wallsQ.isFetching || imbalanceQ.isFetching) && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Imbalance */}
            <GlassCard>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <BarChart3 className="h-4 w-4 text-primary" /> Imbalance · {selectedCoin}USDT
              </div>
              {imbalanceQ.isLoading ? <Skeleton className="h-20 rounded-xl" /> :
               buyPct == null ? (
                <div>
                  <p className="text-sm text-muted-foreground py-2 text-center">No imbalance data.</p>
                  <RawPanel label="imbalance" data={imbalanceRaw} />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-success">Buy {buyPct.toFixed(1)}%</span>
                    <span className="text-destructive">Sell {sellPct!.toFixed(1)}%</span>
                  </div>
                  <div className="flex h-5 w-full overflow-hidden rounded-full">
                    <div className="bg-success/70 transition-all" style={{ width: `${buyPct}%` }} />
                    <div className="bg-destructive/70 transition-all" style={{ width: `${sellPct}%` }} />
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    {buyPct > 55 ? "🟢 Buy pressure dominant" : buyPct < 45 ? "🔴 Sell pressure dominant" : "⚪ Balanced"}
                  </p>
                </div>
              )}
            </GlassCard>

            {/* Bid walls */}
            <GlassCard>
              <div className="mb-3 text-sm font-medium text-success">🟢 Bid Walls (Support)</div>
              {wallsQ.isLoading ? <Skeleton className="h-20 rounded-xl" /> :
               bidWalls.length === 0 ? (
                <div>
                  <p className="text-sm text-muted-foreground py-2 text-center">No bid wall data.</p>
                  <RawPanel label="walls" data={wallsRaw} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  {bidWalls.map((w, i) => {
                    const price = safeNum(w.price ?? w.level ?? w.priceLevel);
                    const size  = safeNum(w.size ?? w.quantity ?? w.volume ?? w.amount);
                    return (
                      <div key={i} className="flex justify-between rounded-lg bg-success/8 px-3 py-1.5 text-xs">
                        <span className="num font-semibold text-success">${price?.toLocaleString() ?? "—"}</span>
                        <span className="text-muted-foreground num">{size != null ? fmtCompact(size) : "—"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>

            {/* Ask walls */}
            <GlassCard>
              <div className="mb-3 text-sm font-medium text-destructive">🔴 Ask Walls (Resistance)</div>
              {wallsQ.isLoading ? <Skeleton className="h-20 rounded-xl" /> :
               askWalls.length === 0 ? (
                <div>
                  <p className="text-sm text-muted-foreground py-2 text-center">No ask wall data.</p>
                  <RawPanel label="walls" data={wallsRaw} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  {askWalls.map((w, i) => {
                    const price = safeNum(w.price ?? w.level ?? w.priceLevel);
                    const size  = safeNum(w.size ?? w.quantity ?? w.volume ?? w.amount);
                    return (
                      <div key={i} className="flex justify-between rounded-lg bg-destructive/8 px-3 py-1.5 text-xs">
                        <span className="num font-semibold text-destructive">${price?.toLocaleString() ?? "—"}</span>
                        <span className="text-muted-foreground num">{size != null ? fmtCompact(size) : "—"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          </div>
        </div>

        {/* ── CORRELATION ── */}
        <GlassCard>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4 text-primary" /> Correlation Matrix (30-day)
            </div>
            <div className="flex gap-1.5">
              {["BTC","ETH","SOL","BNB"].map((b) => (
                <button key={b} onClick={() => setCorrelBase(b)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-mono transition ${
                    correlBase === b ? "border-primary/60 bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:text-foreground"
                  }`}>{b}</button>
              ))}
            </div>
          </div>
          {correlQ.isLoading ? <Skeleton className="h-48 rounded-xl" /> :
           correlData.length === 0 ? (
            <div>
              <p className="text-sm text-muted-foreground py-6 text-center">No correlation data for {correlBase}.</p>
              <RawPanel label="correlation" data={correlRaw} />
            </div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={correlData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[-1, 1]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [v.toFixed(3), "Corr"]}
                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "11px" }} />
                  <Bar dataKey="value" radius={[3,3,0,0]} maxBarSize={40}>
                    {correlData.map((e, i) => <Cell key={i} fill={e.value >= 0 ? "rgba(16,185,129,0.7)" : "rgba(239,68,68,0.7)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>

        {/* ── EVENTS ── */}
        <GlassCard>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4 text-primary" /> Crypto Events Calendar
          </div>
          {eventsQ.isLoading ? (
            <div className="space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-14 rounded-xl"/>)}</div>
          ) : cryptoEvents.length === 0 ? (
            <div>
              <p className="text-sm text-muted-foreground py-4 text-center">No events data parsed.</p>
              <RawPanel label="events" data={eventsRaw} />
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {cryptoEvents.map((ev, i) => {
                const title = String(ev.title ?? ev.name ?? ev.event ?? ev.description ?? "");
                const coin  = String(ev.coin ?? ev.symbol ?? ev.ticker ?? ev.currencies ?? "");
                const date  = String(ev.date ?? ev.date_event ?? ev.start_date ?? ev.dateEvent ?? "");
                const isImp = Boolean(ev.is_important ?? ev.important ?? ev.isImportant);
                return (
                  <div key={i} className={`rounded-xl border px-3 py-2.5 space-y-1 ${isImp ? "border-warning/30 bg-warning/5" : "border-border/40 bg-background/40"}`}>
                    {coin && <div className="font-mono text-[11px] font-semibold text-primary uppercase">{coin}</div>}
                    <div className="text-xs font-medium line-clamp-2">{title || "—"}</div>
                    {date && <div className="text-[10px] text-muted-foreground">{date.slice(0, 10)}</div>}
                    {isImp && <Badge variant="outline" className="text-[9px] border-warning/30 text-warning px-1.5 py-0">Important</Badge>}
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>
    </PageTransition>
  );
}