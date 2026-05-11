import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { getInstitutionalInvestors, getInvestorActivity } from "@/lib/datasectors.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { fmtCompact, fmtPrice } from "@/lib/formatters";
import {
  Building2, TrendingUp, TrendingDown, RefreshCw,
  Search, ArrowRight, Users, Zap, BarChart2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useMounted } from "@/hooks/use-mounted";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export const Route = createFileRoute("/institutional")({
  head: () => ({
    meta: [
      { title: "Institutional Tracker — Stratum" },
      { name: "description", content: "Pantau pergerakan institusi besar dan smart money di pasar IDX." },
    ],
  }),
  component: InstitutionalPage,
});

function safeNum(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v); if (isFinite(n)) return n; }
  return null;
}

function unwrapArray(payload: unknown): Record<string, unknown>[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const o = payload as Record<string, unknown>;
  for (const k of ["data", "results", "investors", "items"]) {
    if (Array.isArray(o[k])) return o[k] as Record<string, unknown>[];
  }
  return [];
}

interface Institution {
  id: string;
  name: string;
  type: string;
  totalValue: number | null;
  totalHoldings: number | null;
  topHolding: string | null;
  recentAction: "buy" | "sell" | "hold" | null;
  changeValue: number | null;
}

function mapInstitution(r: Record<string, unknown>): Institution {
  return {
    id: String(r.id ?? r._id ?? Math.random()),
    name: String(r.name ?? r.investor_name ?? r.investorName ?? r.institution ?? ""),
    type: String(r.type ?? r.investor_type ?? r.investorType ?? "institution"),
    totalValue: safeNum(r.total_value ?? r.totalValue ?? r.aum ?? r.portfolioValue),
    totalHoldings: safeNum(r.total_holdings ?? r.totalHoldings ?? r.holdingsCount ?? r.count),
    topHolding: String(r.top_holding ?? r.topHolding ?? r.ticker ?? r.symbol ?? ""),
    recentAction: (r.recent_action ?? r.recentAction ?? r.action ?? null) as Institution["recentAction"],
    changeValue: safeNum(r.change_value ?? r.changeValue ?? r.netChange),
  };
}

function InstitutionCard({ inst }: { inst: Institution }) {
  const actionCfg = {
    buy:  { color: "text-gain",  bg: "bg-success/15",     label: "↑ Akumulasi" },
    sell: { color: "text-loss",  bg: "bg-destructive/15", label: "↓ Distribusi" },
    hold: { color: "text-warning", bg: "bg-warning/15",   label: "→ Hold" },
  };
  const cfg = inst.recentAction ? actionCfg[inst.recentAction] : null;

  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-3 space-y-2.5 hover:bg-accent/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate max-w-[180px]">{inst.name || "—"}</div>
            <div className="text-[10px] text-muted-foreground capitalize">{inst.type}</div>
          </div>
        </div>
        {cfg && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-lg bg-background/60 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">AUM / Value</div>
          <div className="text-xs font-semibold num mt-0.5">
            {inst.totalValue != null ? `Rp ${fmtCompact(inst.totalValue)}` : "—"}
          </div>
        </div>
        <div className="rounded-lg bg-background/60 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Holdings</div>
          <div className="text-xs font-semibold num mt-0.5">
            {inst.totalHoldings != null ? inst.totalHoldings.toLocaleString() : "—"}
          </div>
        </div>
      </div>
      {inst.topHolding && (
        <div className="flex items-center justify-between rounded-lg bg-primary/10 px-2.5 py-1.5">
          <span className="text-[10px] text-muted-foreground">Top Holding</span>
          <Link to="/stocks/$symbol" params={{ symbol: inst.topHolding }} className="font-mono text-xs font-bold text-primary hover:underline">
            {inst.topHolding}
          </Link>
        </div>
      )}
    </div>
  );
}

function TradeRow({ trade }: { trade: ReturnType<typeof mapTrade> }) {
  const isBuy = trade.tradeType === "buy";
  return (
    <tr className="border-b border-border/20 hover:bg-accent/20 transition-colors">
      <td className="px-4 py-2.5">
        <div className="text-xs font-semibold">{trade.investorName || "—"}</div>
        <div className="text-[10px] text-muted-foreground capitalize">{trade.investorType}</div>
      </td>
      <td className="px-4 py-2.5">
        <Link to="/stocks/$symbol" params={{ symbol: trade.ticker }} className="font-mono text-xs font-bold text-primary hover:underline">
          {trade.ticker}
        </Link>
        <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">{trade.companyName}</div>
      </td>
      <td className="px-4 py-2.5 text-center">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isBuy ? "bg-success/15 text-gain" : "bg-destructive/15 text-loss"}`}>
          {isBuy ? "↑ Beli" : "↓ Jual"}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right num text-xs">
        {trade.sharesTraded != null ? fmtCompact(trade.sharesTraded) : "—"}
      </td>
      <td className="px-4 py-2.5 text-right num text-xs">
        {trade.transactionValue != null ? `Rp ${fmtCompact(trade.transactionValue)}` : "—"}
      </td>
      <td className="px-4 py-2.5 text-right">
        {trade.ownershipChangePct != null ? (
          <span className={`text-xs font-semibold num ${trade.ownershipChangePct >= 0 ? "text-gain" : "text-loss"}`}>
            {trade.ownershipChangePct >= 0 ? "+" : ""}{trade.ownershipChangePct.toFixed(2)}%
          </span>
        ) : "—"}
      </td>
      <td className="px-4 py-2.5 text-right text-[10px] text-muted-foreground">
        {trade.date?.slice(0, 10) ?? "—"}
      </td>
    </tr>
  );
}

function mapTrade(r: Record<string, unknown>) {
  return {
    id: String(r.id ?? r._id ?? Math.random()),
    investorName: String(r.investor_name ?? r.investorName ?? r.name ?? ""),
    investorType: String(r.investor_type ?? r.investorType ?? "institution"),
    tradeType: String(r.trade_type ?? r.tradeType ?? "buy") as "buy" | "sell",
    ticker: String(r.ticker ?? r.symbol ?? ""),
    companyName: String(r.company_name ?? r.companyName ?? ""),
    sector: String(r.sector ?? ""),
    sharesTraded: safeNum(r.shares_traded ?? r.sharesTraded),
    transactionValue: safeNum(r.transaction_value ?? r.transactionValue),
    price: safeNum(r.price),
    ownershipChangePct: safeNum(r.ownership_change_pct ?? r.ownershipChangePct),
    sharesBefore: safeNum(r.shares_before ?? r.sharesBefore),
    sharesAfter: safeNum(r.shares_after ?? r.sharesAfter),
    ownershipBefore: safeNum(r.ownership_before ?? r.ownershipBefore),
    ownershipAfter: safeNum(r.ownership_after ?? r.ownershipAfter),
    date: String(r.date ?? r.transaction_date ?? ""),
    category: r.category != null ? String(r.category) : null,
  };
}

function InstitutionalPage() {
  const mounted = useMounted();
  const instFn = useServerFn(getInstitutionalInvestors);
  const tradeFn = useServerFn(getInvestorActivity);

  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState<"all" | "buy" | "sell">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "insider" | "institution">("all");
  const [tab, setTab] = useState<"activity" | "institutions">("activity");

  const instQuery = useQuery({
    queryKey: ["institutional-investors"],
    queryFn: () => instFn({ data: { limit: 50 } }),
    staleTime: 300_000,
    retry: false,
    enabled: mounted,
  });

  const tradeQuery = useQuery({
    queryKey: ["investor-activity", "all"],
    queryFn: () => tradeFn({ data: { limit: 100 } }),
    staleTime: 120_000,
    retry: false,
    enabled: mounted,
  });

  const institutions: Institution[] = useMemo(() => {
    const raw = unwrapArray(instQuery.data?.data);
    return raw.map(mapInstitution).filter(i => i.name);
  }, [instQuery.data]);

  const trades = useMemo(() => {
    const raw = unwrapArray(tradeQuery.data?.data);
    return raw.map(mapTrade);
  }, [tradeQuery.data]);

  const filteredTrades = useMemo(() => {
    const q = search.trim().toUpperCase();
    return trades.filter(t => {
      if (q && !t.ticker.includes(q) && !t.investorName.toUpperCase().includes(q) && !t.companyName.toUpperCase().includes(q)) return false;
      if (tradeFilter !== "all" && t.tradeType !== tradeFilter) return false;
      if (typeFilter !== "all" && t.investorType !== typeFilter) return false;
      return true;
    });
  }, [trades, search, tradeFilter, typeFilter]);

  const filteredInst = useMemo(() => {
    const q = search.trim().toUpperCase();
    return institutions.filter(i => !q || i.name.toUpperCase().includes(q) || (i.topHolding ?? "").includes(q));
  }, [institutions, search]);

  // Stats
  const buyCount = trades.filter(t => t.tradeType === "buy").length;
  const sellCount = trades.filter(t => t.tradeType === "sell").length;
  const totalValue = trades.reduce((s, t) => s + (t.transactionValue ?? 0), 0);

  // Top stocks by activity
  const topStocks = useMemo(() => {
    const map = new Map<string, { buy: number; sell: number; value: number }>();
    trades.forEach(t => {
      const cur = map.get(t.ticker) ?? { buy: 0, sell: 0, value: 0 };
      if (t.tradeType === "buy") cur.buy++;
      else cur.sell++;
      cur.value += t.transactionValue ?? 0;
      map.set(t.ticker, cur);
    });
    return Array.from(map.entries())
      .map(([ticker, v]) => ({ ticker, ...v, net: v.buy - v.sell }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [trades]);

  return (
    <PageTransition>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-semibold tracking-tight">Institutional Tracker</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Pantau pergerakan institusi besar dan smart money di pasar IDX.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { instQuery.refetch(); tradeQuery.refetch(); }}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <GlassCard className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Transaksi</div>
            <div className="text-2xl font-bold num mt-1">{trades.length}</div>
          </GlassCard>
          <GlassCard className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Akumulasi</div>
            <div className="text-2xl font-bold text-gain num mt-1">{buyCount}</div>
          </GlassCard>
          <GlassCard className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Distribusi</div>
            <div className="text-2xl font-bold text-loss num mt-1">{sellCount}</div>
          </GlassCard>
          <GlassCard className="p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Nilai</div>
            <div className="text-xl font-bold num mt-1">Rp {fmtCompact(totalValue)}</div>
          </GlassCard>
        </div>

        {/* Top stocks chart */}
        {topStocks.length > 0 && (
          <GlassCard>
            <div className="mb-3 text-sm font-medium flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />
              Saham Paling Aktif (Institusi)
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topStocks} margin={{ left: 0, right: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                <XAxis dataKey="ticker" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "11px" }}
                />
                <Bar dataKey="buy" name="Beli" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sell" name="Jual" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari saham atau investor..." className="pl-9 h-9" />
          </div>
          <Select value={tradeFilter} onValueChange={v => setTradeFilter(v as typeof tradeFilter)}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Aksi</SelectItem>
              <SelectItem value="buy">↑ Akumulasi</SelectItem>
              <SelectItem value="sell">↓ Distribusi</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={v => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              <SelectItem value="institution">Institusi</SelectItem>
              <SelectItem value="insider">Insider</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1">
          {[
            { id: "activity" as const, label: "Trade Activity", icon: <TrendingUp className="h-3.5 w-3.5" /> },
            { id: "institutions" as const, label: "Institutions", icon: <Building2 className="h-3.5 w-3.5" /> },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${tab === t.id ? "border-primary/60 bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:text-foreground"}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Trade Activity Tab */}
        {tab === "activity" && (
          <GlassCard className="p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3 text-xs text-muted-foreground">
              <span>
                <span className="text-foreground font-medium num">{filteredTrades.length}</span> transaksi
              </span>
              {tradeQuery.isLoading && <span className="text-primary animate-pulse">Memuat...</span>}
            </div>
            {filteredTrades.length === 0 && !tradeQuery.isLoading ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 opacity-40" />
                <div className="text-sm">Tidak ada data transaksi.</div>
                <div className="text-xs">DataSectors mungkin memerlukan plan berbayar untuk endpoint ini.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-background/30 text-left">
                      <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground">Investor</th>
                      <th className="px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground">Saham</th>
                      <th className="px-4 py-2.5 text-center text-[10px] uppercase tracking-wider text-muted-foreground">Aksi</th>
                      <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Lembar</th>
                      <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Nilai</th>
                      <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Δ Kepemilikan</th>
                      <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.slice(0, 100).map(t => <TradeRow key={t.id} trade={t} />)}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        )}

        {/* Institutions Tab */}
        {tab === "institutions" && (
          <>
            {instQuery.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-32 animate-pulse rounded-xl bg-accent/30" />
                ))}
              </div>
            ) : filteredInst.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredInst.map(inst => <InstitutionCard key={inst.id} inst={inst} />)}
              </div>
            ) : (
              <GlassCard>
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Users className="h-8 w-8 opacity-40" />
                  <div className="text-sm">Data institusi tidak tersedia.</div>
                  <div className="text-xs text-center max-w-sm">
                    Endpoint <code>/api/stocks/institutional-investors</code> mungkin memerlukan plan berbayar atau parameter berbeda. Data trade activity di tab sebelumnya menggunakan endpoint yang berbeda.
                  </div>
                </div>
              </GlassCard>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}