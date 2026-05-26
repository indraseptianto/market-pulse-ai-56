import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getBatchPrices, getEquities } from "@/lib/datasectors.functions";
import { mockEquities, type Equity } from "@/lib/mock-data";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { fmtPct, fmtPrice, fmtCompact, fmtNum, changeClass } from "@/lib/formatters";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, Filter, RotateCcw, Database, Zap, Users, Globe, Save, Bookmark, Trash2 } from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";
import { getOwnershipBySymbol, getSmartMoneySignals } from "@/services/ownership/ownershipService";
import { useScreenerPresets, useSaveScreenerPreset, useDeleteScreenerPreset } from "@/integrations/supabase/hooks";
import { toast } from "sonner";
import { isIDXTradingHours } from "@/hooks/use-live-price";
import { fetchOfficialIndex, hasOfficialData } from "@/lib/idx-official";

export const Route = createFileRoute("/screener")({
  head: () => ({
    meta: [
      { title: "Screener — Stratum" },
      {
        name: "description",
        content:
          "Advanced stock screener with PE, PB, ROE, ROA, dividend yield, debt to equity, sector and market cap filters.",
      },
    ],
  }),
  component: ScreenerPage,
});

type SortKey =
  | "market_cap"
  | "volume"
  | "change_pct"
  | "price"
  | "pe_ratio"
  | "roe"
  | "dividend_yield";

function ScreenerPage() {
  const fn = useServerFn(getEquities);
  const batchFn = useServerFn(getBatchPrices);
  const mounted = useMounted();
  const { data } = useQuery({
    queryKey: ["equities", "screener"],
    queryFn: () => fn({ data: { limit: 200 } }),
    staleTime: 60_000,
    enabled: mounted,
  });
  const officialIndex = useQuery({
    queryKey: ["idx-official-index"],
    queryFn: fetchOfficialIndex,
    staleTime: 600_000,
    enabled: mounted,
  });

  const baseUniverse = useMemo(() => {
    const source = data?.data?.length ? data.data : mockEquities;
    const seen = new Set(source.map((equity) => equity.symbol.toUpperCase()));
    const officialOnly = (officialIndex.data ?? [])
      .filter((item) => item.code && !seen.has(item.code.toUpperCase()))
      .map((item) => ({
        symbol: item.code.toUpperCase(),
        name: item.company_name || `${item.code.toUpperCase()} official IDX data`,
        price: 0,
        change: 0,
        change_pct: 0,
        volume: 0,
        market_cap: 0,
        sector: "Official IDX",
        industry: item.status ?? "Official data",
        pe_ratio: null,
        pb_ratio: null,
        roe: null,
        roa: null,
        debt_to_equity: null,
        dividend_yield: null,
        shares_outstanding: null,
      } satisfies Equity));
    return [...source, ...officialOnly];
  }, [data?.data, officialIndex.data]);
  const screenerSymbols = useMemo(
    () => baseUniverse.map((equity) => equity.symbol.toUpperCase()).slice(0, 60),
    [baseUniverse],
  );
  const prices = useQuery({
    queryKey: ["batch-prices-screener", screenerSymbols.join(",")],
    queryFn: () => batchFn({ data: { symbols: screenerSymbols } }),
    staleTime: 25_000,
    refetchInterval: isIDXTradingHours() ? 30_000 : 5 * 60_000,
    refetchIntervalInBackground: false,
    enabled: mounted && screenerSymbols.length > 0,
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

  const [search, setSearch] = useState("");
  const [sector, setSector] = useState<string>("all");
  const [maxPE, setMaxPE] = useState(60);
  const [minROE, setMinROE] = useState(0);
  const [maxDE, setMaxDE] = useState(3);
  const [minDiv, setMinDiv] = useState(0);
  const [sort, setSort] = useState<SortKey>("market_cap");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  // Ownership filters
  const [ownershipFilter, setOwnershipFilter] = useState<string>("all");

  const smartMoneySignals = useMemo(() => getSmartMoneySignals(), []);

  // ── Screener presets (Supabase) ───────────────────────────────────────────
  const presetsQ   = useScreenerPresets();
  const saveMut    = useSaveScreenerPreset();
  const deleteMut  = useDeleteScreenerPreset();
  const [presetName, setPresetName] = useState("");

  const currentFilters = { search, sector, maxPE, minROE, maxDE, minDiv, ownershipFilter };

  const savePreset = async () => {
    const name = presetName.trim() || `Preset ${new Date().toLocaleDateString("id-ID")}`;
    try {
      await saveMut.mutateAsync({ name, filters: currentFilters });
      toast.success(`Preset "${name}" disimpan`);
      setPresetName("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal";
      if (msg.includes("Not authenticated")) toast.error("Login diperlukan untuk menyimpan preset");
      else toast.error(msg);
    }
  };

  const loadPreset = (filters: Record<string, unknown>) => {
    if (typeof filters.search === "string") setSearch(filters.search);
    if (typeof filters.sector === "string") setSector(filters.sector);
    if (typeof filters.maxPE === "number") setMaxPE(filters.maxPE);
    if (typeof filters.minROE === "number") setMinROE(filters.minROE);
    if (typeof filters.maxDE === "number") setMaxDE(filters.maxDE);
    if (typeof filters.minDiv === "number") setMinDiv(filters.minDiv);
    if (typeof filters.ownershipFilter === "string") setOwnershipFilter(filters.ownershipFilter);
    toast.success("Preset dimuat");
  };

  const sectors = useMemo(
    () => Array.from(new Set(universe.map((e) => e.sector))).sort(),
    [universe],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    let out = universe.filter((e) => {
      if (q && !e.symbol.includes(q) && !e.name.toUpperCase().includes(q))
        return false;
      if (sector !== "all" && e.sector !== sector) return false;
      if (e.pe_ratio != null && e.pe_ratio > maxPE) return false;
      if (e.roe != null && e.roe < minROE) return false;
      if (e.debt_to_equity != null && e.debt_to_equity > maxDE) return false;
      if (e.dividend_yield != null && e.dividend_yield < minDiv) return false;

      // Ownership filters
      if (ownershipFilter !== "all") {
        const rec = getOwnershipBySymbol(e.symbol);
        if (!rec) return false; // only show stocks with ownership data when filter active
        const a = rec.analytics;
        const ff = rec.currentFreeFloat ?? 0;
        switch (ownershipFilter) {
          case "high_float":     if (ff < 40) return false; break;
          case "low_float":      if (ff > 15) return false; break;
          case "government":     if (!a.isGovernmentControlled) return false; break;
          case "family":         if (!a.isFamilyControlled) return false; break;
          case "retail_friendly": if (!a.isRetailFriendly) return false; break;
          case "smart_money": {
            const sig = smartMoneySignals.find((s) => s.symbol === e.symbol);
            if (!sig || sig.signal !== "BULLISH") return false;
            break;
          }
          case "high_concentration": {
            if (a.concentrationRisk !== "HIGH" && a.concentrationRisk !== "VERY_HIGH") return false;
            break;
          }
          case "high_transparency": if (a.transparencyScore < 65) return false; break;
        }
      }

      return true;
    });
    out = [...out].sort((a, b) => {
      const av = (a[sort] as number) ?? 0;
      const bv = (b[sort] as number) ?? 0;
      return dir === "desc" ? bv - av : av - bv;
    });
    return out;
  }, [universe, search, sector, maxPE, minROE, maxDE, minDiv, sort, dir, ownershipFilter, smartMoneySignals]);

  const reset = () => {
    setSearch("");
    setSector("all");
    setMaxPE(60);
    setMinROE(0);
    setMaxDE(3);
    setMinDiv(0);
    setOwnershipFilter("all");
  };

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
      onClick={() => {
        if (sort === k) setDir(dir === "desc" ? "asc" : "desc");
        else {
          setSort(k);
          setDir("desc");
        }
      }}
    >
      {label}
      {sort === k &&
        (dir === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUp className="h-3 w-3" />
        ))}
    </button>
  );

  return (
    <PageTransition>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Screener</h1>
          <p className="text-sm text-muted-foreground">
            Filter and sort the equity universe by valuation, profitability and yield.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
          <GlassCard className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4" /> Filters
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Search</Label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Symbol or name…"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Sector</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sectors</SelectItem>
                  {sectors.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Max P/E</Label>
                <span className="num text-muted-foreground">{maxPE}</span>
              </div>
              <Slider value={[maxPE]} min={5} max={100} step={1} onValueChange={(v) => setMaxPE(v[0])} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Min ROE %</Label>
                <span className="num text-muted-foreground">{minROE}</span>
              </div>
              <Slider value={[minROE]} min={0} max={30} step={1} onValueChange={(v) => setMinROE(v[0])} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Max D/E</Label>
                <span className="num text-muted-foreground">{maxDE}</span>
              </div>
              <Slider value={[maxDE]} min={0} max={5} step={0.1} onValueChange={(v) => setMaxDE(v[0])} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Min Dividend %</Label>
                <span className="num text-muted-foreground">{minDiv}</span>
              </div>
              <Slider value={[minDiv]} min={0} max={10} step={0.1} onValueChange={(v) => setMinDiv(v[0])} />
            </div>

            {/* Ownership Intelligence Filters */}
            <div className="border-t border-border/40 pt-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Database className="h-3.5 w-3.5" />
                Ownership Intelligence
              </div>
              <Select value={ownershipFilter} onValueChange={setOwnershipFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stocks</SelectItem>
                  <SelectItem value="high_float">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3 w-3 text-gain" /> High Free Float (≥40%)
                    </span>
                  </SelectItem>
                  <SelectItem value="low_float">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3 w-3 text-loss" /> Low Free Float (≤15%)
                    </span>
                  </SelectItem>
                  <SelectItem value="government">🏛 Government Controlled</SelectItem>
                  <SelectItem value="family">👨‍👩‍👧 Family Controlled</SelectItem>
                  <SelectItem value="retail_friendly">✅ Retail Friendly</SelectItem>
                  <SelectItem value="smart_money">
                    <span className="flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-primary" /> Smart Money Bullish
                    </span>
                  </SelectItem>
                  <SelectItem value="high_concentration">⚠ High Concentration Risk</SelectItem>
                  <SelectItem value="high_transparency">
                    <span className="flex items-center gap-1.5">
                      <Globe className="h-3 w-3 text-gain" /> High Transparency
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {ownershipFilter !== "all" && (
                <div className="rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1.5 text-[10px] text-primary">
                  Showing only stocks with IDNFinancials ownership data
                </div>
              )}
            </div>

            {/* Saved Presets */}
            <div className="border-t border-border/40 pt-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Bookmark className="h-3.5 w-3.5" />
                Preset Tersimpan
              </div>
              <div className="flex gap-1.5">
                <Input
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  placeholder="Nama preset..."
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" className="h-8 px-2" onClick={savePreset} disabled={saveMut.isPending}>
                  <Save className="h-3.5 w-3.5" />
                </Button>
              </div>
              {presetsQ.data && presetsQ.data.length > 0 && (
                <div className="space-y-1">
                  {presetsQ.data.map(p => (
                    <div key={p.id} className="flex items-center gap-1 rounded-lg bg-background/40 px-2 py-1.5">
                      <button
                        onClick={() => loadPreset(p.filters as Record<string, unknown>)}
                        className="flex-1 text-left text-xs truncate hover:text-primary transition-colors"
                      >
                        {p.name}
                      </button>
                      <button onClick={() => deleteMut.mutate(p.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3 text-xs text-muted-foreground">
              <span>
                Showing <span className="text-foreground font-medium num">{filtered.length}</span> of{" "}
                {universe.length} equities
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
                    <th className="px-4 py-2 font-medium">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        Symbol
                      </span>
                    </th>
                    <th className="px-4 py-2 text-right">
                      <SortHeader k="price" label="Price" />
                    </th>
                    <th className="px-4 py-2 text-right">
                      <SortHeader k="change_pct" label="Change" />
                    </th>
                    <th className="hidden px-4 py-2 text-right md:table-cell">
                      <SortHeader k="market_cap" label="Mkt Cap" />
                    </th>
                    <th className="hidden px-4 py-2 text-right lg:table-cell">
                      <SortHeader k="volume" label="Volume" />
                    </th>
                    <th className="hidden px-4 py-2 text-right md:table-cell">
                      <SortHeader k="pe_ratio" label="P/E" />
                    </th>
                    <th className="hidden px-4 py-2 text-right lg:table-cell">
                      <SortHeader k="roe" label="ROE" />
                    </th>
                    <th className="hidden px-4 py-2 text-right lg:table-cell">
                      <SortHeader k="dividend_yield" label="Div Yld" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map((e: Equity) => (
                    <tr
                      key={e.symbol}
                      className="border-b border-border/30 transition-colors hover:bg-accent/30"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          to="/stocks/$symbol"
                          params={{ symbol: e.symbol }}
                          className="block"
                        >
                          <div className="font-mono text-sm font-semibold">
                            {e.symbol}
                          </div>
                          <div className="truncate text-xs text-muted-foreground max-w-[180px]">
                            {e.name}
                          </div>
                          {hasOfficialData(officialIndex.data, e.symbol) && (
                            <div className="mt-0.5">
                              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                                Official IDX
                              </span>
                            </div>
                          )}
                          {(() => {
                            const rec = getOwnershipBySymbol(e.symbol);
                            if (!rec) return null;
                            const ff = rec.currentFreeFloat;
                            return (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {ff != null && (
                                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                                    ff >= 40 ? "bg-success/15 text-success"
                                    : ff >= 20 ? "bg-warning/15 text-warning"
                                    : "bg-destructive/15 text-destructive"
                                  }`}>
                                    FF {ff.toFixed(0)}%
                                  </span>
                                )}
                                {rec.analytics.isGovernmentControlled && (
                                  <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-medium text-blue-400">
                                    Gov
                                  </span>
                                )}
                                {rec.analytics.isFamilyControlled && (
                                  <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
                                    Family
                                  </span>
                                )}
                                {rec.analytics.isRetailFriendly && (
                                  <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-medium text-success">
                                    Retail✓
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right num">
                        {fmtPrice(e.price)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right num ${changeClass(e.change_pct)}`}
                      >
                        {fmtPct(e.change_pct)}
                      </td>
                      <td className="hidden px-4 py-2.5 text-right num md:table-cell">
                        {fmtCompact(e.market_cap)}
                      </td>
                      <td className="hidden px-4 py-2.5 text-right num lg:table-cell">
                        {fmtCompact(e.volume)}
                      </td>
                      <td className="hidden px-4 py-2.5 text-right num md:table-cell">
                        {fmtNum(e.pe_ratio)}
                      </td>
                      <td className="hidden px-4 py-2.5 text-right num lg:table-cell">
                        {fmtNum(e.roe)}
                      </td>
                      <td className="hidden px-4 py-2.5 text-right num lg:table-cell">
                        {fmtNum(e.dividend_yield)}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-sm text-muted-foreground"
                      >
                        No equities match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      </div>
    </PageTransition>
  );
}
