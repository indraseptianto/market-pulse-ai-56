import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getBatchPrices, getEquities } from "@/lib/datasectors.functions";
import { mockEquities, type Equity } from "@/lib/mock-data";
import { evaluateValuation, type ValuationResult } from "@/lib/valuation";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { fmtPrice, fmtPct, fmtCompact, changeClass } from "@/lib/formatters";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingDown,
  TrendingUp,
  Minus,
  Target,
  RotateCcw,
  ArrowDown,
  ArrowUp,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";
import { isIDXTradingHours } from "@/hooks/use-live-price";

export const Route = createFileRoute("/fair-value")({
  head: () => ({
    meta: [
      { title: "Fair Value Screener — Stratum" },
      {
        name: "description",
        content:
          "Temukan saham undervalued menggunakan Graham Number, Fair PE, dan Book Value anchor. Filter saham murah berdasarkan margin of safety.",
      },
    ],
  }),
  component: FairValuePage,
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface ScoredEquity {
  equity: Equity;
  valuation: ValuationResult;
}

type SortKey = "score" | "upside" | "price" | "market_cap" | "pe_ratio" | "roe";

// ── Verdict config ─────────────────────────────────────────────────────────────
const VERDICT_CONFIG = {
  Undervalued: {
    label: "Undervalued",
    color: "text-gain",
    bg: "bg-success/15",
    border: "border-success/30",
    icon: TrendingDown,
    dot: "bg-success",
  },
  "Fair Value": {
    label: "Fair Value",
    color: "text-warning",
    bg: "bg-warning/15",
    border: "border-warning/30",
    icon: Minus,
    dot: "bg-warning",
  },
  Overvalued: {
    label: "Overvalued",
    color: "text-loss",
    bg: "bg-destructive/15",
    border: "border-destructive/30",
    icon: TrendingUp,
    dot: "bg-destructive",
  },
  "Insufficient Data": {
    label: "No Data",
    color: "text-muted-foreground",
    bg: "bg-accent/20",
    border: "border-border/40",
    icon: Info,
    dot: "bg-muted-foreground",
  },
};

// ── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, (score + 100) / 2));
  const color =
    score >= 15 ? "#10b981" : score <= -15 ? "#ef4444" : "#f59e0b";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-accent/40">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span
        className="text-xs font-semibold num w-8 text-right"
        style={{ color }}
      >
        {score > 0 ? "+" : ""}
        {score}
      </span>
    </div>
  );
}

// ── Upside badge ──────────────────────────────────────────────────────────────
function UpsideBadge({ upside }: { upside: number | null }) {
  if (upside == null) return <span className="text-muted-foreground">—</span>;
  const color =
    upside >= 15 ? "text-gain" : upside <= -15 ? "text-loss" : "text-warning";
  return (
    <span className={`font-semibold num ${color}`}>
      {upside > 0 ? "+" : ""}
      {upside.toFixed(1)}%
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function FairValuePage() {
  const fn = useServerFn(getEquities);
  const batchFn = useServerFn(getBatchPrices);
  const mounted = useMounted();

  const { data, isLoading } = useQuery({
    queryKey: ["equities", "fair-value"],
    queryFn: () => fn({ data: { limit: 200 } }),
    staleTime: 60_000,
    enabled: mounted,
  });

  const baseUniverse = useMemo(
    () => (data?.data?.length ? data.data : mockEquities),
    [data?.data],
  );
  const fairValueSymbols = useMemo(
    () => baseUniverse.map((equity) => equity.symbol.toUpperCase()).slice(0, 60),
    [baseUniverse],
  );
  const prices = useQuery({
    queryKey: ["batch-prices-fair-value", fairValueSymbols.join(",")],
    queryFn: () => batchFn({ data: { symbols: fairValueSymbols } }),
    staleTime: 25_000,
    refetchInterval: isIDXTradingHours() ? 30_000 : 5 * 60_000,
    refetchIntervalInBackground: false,
    enabled: mounted && fairValueSymbols.length > 0,
  });
  const liveMap = prices.data?.data ?? {};
  const universe = useMemo(
    () =>
      baseUniverse.map((equity) => {
        const live = liveMap[equity.symbol.toUpperCase()];
        if (!live) return equity;
        return {
          ...equity,
          price: live.price,
          change: live.change,
          change_pct: live.change_pct,
          volume: live.volume,
          market_cap: live.marketCap || equity.market_cap,
          prev_close: live.prevClose,
          day_high: live.high,
          day_low: live.low,
          shares_outstanding: live.shareOutstanding || equity.shares_outstanding,
        };
      }),
    [baseUniverse, liveMap],
  );

  // ── Filters ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("all");
  const [verdictFilter, setVerdictFilter] = useState<"all" | "Undervalued" | "Fair Value" | "Overvalued">("all");
  const [minUpside, setMinUpside] = useState(-50);
  const [maxPE, setMaxPE] = useState(100);
  const [minROE, setMinROE] = useState(0);
  const [sort, setSort] = useState<SortKey>("score");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const sectors = useMemo(
    () => Array.from(new Set(universe.map((e) => e.sector))).sort(),
    [universe],
  );

  // ── Score all equities ─────────────────────────────────────────────────────
  const scored: ScoredEquity[] = useMemo(
    () =>
      universe
        .map((equity) => ({
          equity,
          valuation: evaluateValuation({
            price: equity.price,
            eps: equity.eps,
            book_value: equity.book_value,
            pe_ratio: equity.pe_ratio,
            roe: equity.roe,
            dividend_yield: equity.dividend_yield,
          }),
        }))
        .filter((s) => s.valuation.verdict !== "Insufficient Data"),
    [universe],
  );

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const undervalued = scored.filter((s) => s.valuation.verdict === "Undervalued").length;
    const fairValue = scored.filter((s) => s.valuation.verdict === "Fair Value").length;
    const overvalued = scored.filter((s) => s.valuation.verdict === "Overvalued").length;
    const avgUpside =
      scored.length > 0
        ? scored.reduce((sum, s) => sum + (s.valuation.upsidePct ?? 0), 0) / scored.length
        : 0;
    return { undervalued, fairValue, overvalued, avgUpside, total: scored.length };
  }, [scored]);

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    let out = scored.filter(({ equity, valuation }) => {
      if (q && !equity.symbol.includes(q) && !equity.name.toUpperCase().includes(q))
        return false;
      if (sector !== "all" && equity.sector !== sector) return false;
      if (verdictFilter !== "all" && valuation.verdict !== verdictFilter) return false;
      if (valuation.upsidePct != null && valuation.upsidePct < minUpside) return false;
      if (equity.pe_ratio != null && equity.pe_ratio > maxPE) return false;
      if (equity.roe != null && equity.roe < minROE) return false;
      return true;
    });

    out = [...out].sort((a, b) => {
      let av = 0, bv = 0;
      switch (sort) {
        case "score":     av = a.valuation.score;          bv = b.valuation.score;          break;
        case "upside":    av = a.valuation.upsidePct ?? -999; bv = b.valuation.upsidePct ?? -999; break;
        case "price":     av = a.equity.price;             bv = b.equity.price;             break;
        case "market_cap":av = a.equity.market_cap;        bv = b.equity.market_cap;        break;
        case "pe_ratio":  av = a.equity.pe_ratio ?? 999;   bv = b.equity.pe_ratio ?? 999;   break;
        case "roe":       av = a.equity.roe ?? 0;          bv = b.equity.roe ?? 0;          break;
      }
      return dir === "desc" ? bv - av : av - bv;
    });
    return out;
  }, [scored, search, sector, verdictFilter, minUpside, maxPE, minROE, sort, dir]);

  const reset = () => {
    setSearch("");
    setSector("all");
    setVerdictFilter("all");
    setMinUpside(-50);
    setMaxPE(100);
    setMinROE(0);
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
      onClick={() => {
        if (sort === k) setDir(dir === "desc" ? "asc" : "desc");
        else { setSort(k); setDir("desc"); }
      }}
    >
      {label}
      {sort === k && (dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
    </button>
  );

  return (
    <PageTransition>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Fair Value Screener</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Temukan saham undervalued menggunakan Graham Number, Fair PE, dan Book Value anchor.
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <GlassCard className="p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/15">
                <TrendingDown className="h-4 w-4 text-gain" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Undervalued</div>
                <div className="text-xl font-bold text-gain num">{stats.undervalued}</div>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/15">
                <Minus className="h-4 w-4 text-warning" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Fair Value</div>
                <div className="text-xl font-bold text-warning num">{stats.fairValue}</div>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/15">
                <TrendingUp className="h-4 w-4 text-loss" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overvalued</div>
                <div className="text-xl font-bold text-loss num">{stats.overvalued}</div>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Upside</div>
                <div className={`text-xl font-bold num ${stats.avgUpside >= 0 ? "text-gain" : "text-loss"}`}>
                  {stats.avgUpside > 0 ? "+" : ""}{stats.avgUpside.toFixed(1)}%
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
          {/* Filters sidebar */}
          <GlassCard className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Target className="h-4 w-4" /> Filter Valuasi
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Cari Saham</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Kode atau nama…"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Verdict</Label>
              <Select value={verdictFilter} onValueChange={(v) => setVerdictFilter(v as typeof verdictFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="Undervalued">🟢 Undervalued (Murah)</SelectItem>
                  <SelectItem value="Fair Value">🟡 Fair Value</SelectItem>
                  <SelectItem value="Overvalued">🔴 Overvalued (Mahal)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Sektor</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Sektor</SelectItem>
                  {sectors.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Min Upside %</Label>
                <span className="num text-muted-foreground">{minUpside}%</span>
              </div>
              <Slider value={[minUpside]} min={-50} max={100} step={5} onValueChange={(v) => setMinUpside(v[0])} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Max P/E</Label>
                <span className="num text-muted-foreground">{maxPE}×</span>
              </div>
              <Slider value={[maxPE]} min={5} max={60} step={1} onValueChange={(v) => setMaxPE(v[0])} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Min ROE %</Label>
                <span className="num text-muted-foreground">{minROE}%</span>
              </div>
              <Slider value={[minROE]} min={0} max={30} step={1} onValueChange={(v) => setMinROE(v[0])} />
            </div>

            {/* Method explanation */}
            <div className="rounded-xl border border-border/40 bg-accent/10 p-3 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Metode Valuasi</div>
              <div className="space-y-1 text-[11px] text-muted-foreground">
                <div className="flex items-start gap-1.5">
                  <CheckCircle className="h-3 w-3 text-gain mt-0.5 shrink-0" />
                  <span><strong>Graham Number</strong> — √(22.5 × EPS × BV)</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle className="h-3 w-3 text-gain mt-0.5 shrink-0" />
                  <span><strong>Fair PE</strong> — berbasis ROE + growth</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle className="h-3 w-3 text-gain mt-0.5 shrink-0" />
                  <span><strong>Book Value</strong> — P/B anchor + ROE bonus</span>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Results table */}
          <GlassCard className="p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3 text-xs text-muted-foreground">
              <span>
                Menampilkan{" "}
                <span className="text-foreground font-medium num">{filtered.length}</span> dari{" "}
                {scored.length} saham
              </span>
              {(data?.source === "mock" || !data?.data?.length) && (
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-warning">
                  Metadata fallback
                </span>
              )}
              {prices.isFetching && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                  Updating prices
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-background/30 text-left">
                    <th className="px-4 py-2.5 font-medium">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Saham</span>
                    </th>
                    <th className="px-4 py-2.5 text-right">
                      <SortHeader k="price" label="Harga" />
                    </th>
                    <th className="px-4 py-2.5 text-right">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Fair Value</span>
                    </th>
                    <th className="px-4 py-2.5 text-right">
                      <SortHeader k="upside" label="Upside" />
                    </th>
                    <th className="px-4 py-2.5 text-right">
                      <SortHeader k="score" label="Score" />
                    </th>
                    <th className="hidden px-4 py-2.5 text-right md:table-cell">
                      <SortHeader k="pe_ratio" label="P/E" />
                    </th>
                    <th className="hidden px-4 py-2.5 text-right lg:table-cell">
                      <SortHeader k="roe" label="ROE" />
                    </th>
                    <th className="hidden px-4 py-2.5 text-right lg:table-cell">
                      <SortHeader k="market_cap" label="Mkt Cap" />
                    </th>
                    <th className="px-4 py-2.5 text-right">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Verdict</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map(({ equity, valuation }) => {
                    const cfg = VERDICT_CONFIG[valuation.verdict];
                    const VIcon = cfg.icon;
                    return (
                      <tr
                        key={equity.symbol}
                        className="border-b border-border/30 transition-colors hover:bg-accent/30"
                      >
                        {/* Symbol + name */}
                        <td className="px-4 py-2.5">
                          <Link to="/stocks/$symbol" params={{ symbol: equity.symbol }} className="block">
                            <div className="font-mono text-sm font-semibold">{equity.symbol}</div>
                            <div className="truncate text-xs text-muted-foreground max-w-[160px]">
                              {equity.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground/60">{equity.sector}</div>
                          </Link>
                        </td>

                        {/* Current price */}
                        <td className="px-4 py-2.5 text-right">
                          <div className="font-semibold num">{fmtPrice(equity.price)}</div>
                          <div className={`text-xs num ${changeClass(equity.change_pct)}`}>
                            {fmtPct(equity.change_pct)}
                          </div>
                        </td>

                        {/* Fair price */}
                        <td className="px-4 py-2.5 text-right">
                          {valuation.fairPrice != null ? (
                            <div className="font-semibold num text-primary">
                              {fmtPrice(valuation.fairPrice)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Upside */}
                        <td className="px-4 py-2.5 text-right">
                          <UpsideBadge upside={valuation.upsidePct} />
                        </td>

                        {/* Score bar */}
                        <td className="px-4 py-2.5 text-right">
                          <ScoreBar score={valuation.score} />
                        </td>

                        {/* P/E */}
                        <td className="hidden px-4 py-2.5 text-right num md:table-cell">
                          {equity.pe_ratio != null ? equity.pe_ratio.toFixed(1) : "—"}
                        </td>

                        {/* ROE */}
                        <td className="hidden px-4 py-2.5 text-right num lg:table-cell">
                          {equity.roe != null ? `${equity.roe.toFixed(1)}%` : "—"}
                        </td>

                        {/* Market cap */}
                        <td className="hidden px-4 py-2.5 text-right num lg:table-cell">
                          {fmtCompact(equity.market_cap)}
                        </td>

                        {/* Verdict badge */}
                        <td className="px-4 py-2.5 text-right">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <AlertTriangle className="h-8 w-8 opacity-40" />
                          <div className="text-sm">Tidak ada saham yang cocok dengan filter ini.</div>
                          <Button variant="ghost" size="sm" onClick={reset}>
                            Reset filter
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Top picks highlight */}
            {filtered.length > 0 && verdictFilter === "Undervalued" && (
              <div className="border-t border-border/40 px-4 py-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                  Top 3 Picks Termurah
                </div>
                <div className="flex flex-wrap gap-2">
                  {filtered.slice(0, 3).map(({ equity, valuation }) => (
                    <Link
                      key={equity.symbol}
                      to="/stocks/$symbol"
                      params={{ symbol: equity.symbol }}
                      className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 hover:bg-success/20 transition-colors"
                    >
                      <div>
                        <div className="font-mono text-xs font-bold text-gain">{equity.symbol}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Upside {valuation.upsidePct != null ? `+${valuation.upsidePct.toFixed(1)}%` : "—"}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </PageTransition>
  );
}
