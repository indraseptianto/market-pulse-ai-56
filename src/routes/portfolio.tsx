import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Button } from "@/components/ui/button";
import { PositionTable } from "@/components/portfolio/PositionTable";
import { AllocationChart } from "@/components/portfolio/AllocationChart";
import { TransactionModal } from "@/components/portfolio/TransactionModal";
import { CsvImport } from "@/components/portfolio/CsvImport";
import { getStockEquitiesV2 } from "@/lib/datasectors.functions";
import { changeClass } from "@/lib/formatters";
import { Plus, Upload, TrendingUp, TrendingDown, Wallet } from "lucide-react";

export const Route = createFileRoute("/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio Tracker — Stratum" }, { name: "description", content: "Lacak portofolio saham kamu: P&L, alokasi, dan performa." }] }),
  component: PortfolioPage,
});

const STORAGE_KEY = "stratum_portfolio";

interface StoredPosition {
  symbol: string; name: string; avgBuyPrice: number; totalLots: number;
  realizedPnL: number; dividendsReceived: number;
  transactions: Array<{ type: string; date: string; lots: number; price: number }>;
}

function loadPortfolio(): StoredPosition[] {
  if (typeof window === "undefined") return [];
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

function savePortfolio(positions: StoredPosition[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

const PIE_COLORS = ["#10b981","#38bdf8","#a78bfa","#f59e0b","#f472b6","#2dd4bf","#ef4444","#6366f1","#84cc16","#f97316"];

export function PortfolioPage() {
  const equitiesFn = useServerFn(getStockEquitiesV2);
  const [positions, setPositions] = useState<StoredPosition[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { setPositions(loadPortfolio()); }, []);

  const symbols = useMemo(() => positions.map((p) => p.symbol), [positions]);
  const { data: equitiesData } = useQuery({
    queryKey: ["portfolio-prices", symbols.join(","), refreshKey],
    queryFn: async () => {
      if (symbols.length === 0) return { data: [] };
      const results = await Promise.allSettled(symbols.map((sym) => equitiesFn({ data: { symbol: sym } })));
      return { data: results.filter((r): r is PromiseFulfilledResult<unknown> => r.status === "fulfilled").map((r) => (r.value as { data?: unknown }).data).filter(Boolean) };
    },
    staleTime: 5 * 60_000,
  });

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
      (equitiesData?.data as Array<Record<string, unknown>> ?? []).forEach((eq) => { if (eq.symbol) map[eq.symbol as string] = (eq.price as number) || 0; });
    return map;
  }, [equitiesData]);

  const displayPositions = useMemo(() => positions.map((p) => ({
    symbol: p.symbol, name: p.name, avgBuyPrice: p.avgBuyPrice, totalLots: p.totalLots,
    currentPrice: priceMap[p.symbol] || p.avgBuyPrice, realizedPnL: p.realizedPnL, dividendsReceived: p.dividendsReceived,
  })), [positions, priceMap]);

  const totalValue = useMemo(() => displayPositions.reduce((s, p) => s + p.currentPrice * p.totalLots * 100, 0), [displayPositions]);
  const totalCost = useMemo(() => displayPositions.reduce((s, p) => s + p.avgBuyPrice * p.totalLots * 100, 0), [displayPositions]);
  const totalUnrealPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalUnrealPnL / totalCost) * 100 : 0;
  const totalRealized = displayPositions.reduce((s, p) => s + p.realizedPnL, 0);
  const totalDividends = displayPositions.reduce((s, p) => s + p.dividendsReceived, 0);

  const allocationData = useMemo(() => {
    if (totalValue === 0) return [];
    return positions.map((p, i) => {
      const cp = priceMap[p.symbol] || p.avgBuyPrice;
      const value = cp * p.totalLots * 100;
      return { symbol: p.symbol, value, pct: (value / totalValue) * 100, color: PIE_COLORS[i % PIE_COLORS.length] };
    }).sort((a, b) => b.value - a.value);
  }, [positions, priceMap, totalValue]);

  const handleAdd = (tx: { type: "BUY" | "SELL" | "DIV"; symbol: string; name?: string; lots: number; price: number; date: string }) => {
    setPositions((prev) => {
      const existing = prev.find((p) => p.symbol === tx.symbol);
      let updated: StoredPosition[];
      if (existing) {
        updated = prev.map((p) => {
          if (p.symbol !== tx.symbol) return p;
          const newTx = { type: tx.type, date: tx.date, lots: tx.lots, price: tx.price };
          if (tx.type === "BUY") {
            const newTotalLots = p.totalLots + tx.lots;
            const newAvg = newTotalLots > 0 ? ((p.avgBuyPrice * p.totalLots) + (tx.price * tx.lots)) / newTotalLots : tx.price;
            return { ...p, totalLots: newTotalLots, avgBuyPrice: newAvg, transactions: [...p.transactions, newTx] };
          } else if (tx.type === "SELL") {
            const pnl = (tx.price - p.avgBuyPrice) * tx.lots * 100;
            return { ...p, totalLots: Math.max(0, p.totalLots - tx.lots), realizedPnL: p.realizedPnL + pnl, transactions: [...p.transactions, newTx] };
          } else {
            return { ...p, dividendsReceived: p.dividendsReceived + (tx.price * tx.lots * 100), transactions: [...p.transactions, newTx] };
          }
        });
      } else {
        const newPos: StoredPosition = {
          symbol: tx.symbol, name: tx.name || tx.symbol,
          avgBuyPrice: tx.type === "BUY" ? tx.price : 0,
          totalLots: tx.type === "BUY" ? tx.lots : 0,
          realizedPnL: tx.type === "SELL" ? (tx.price * tx.lots * 100) : 0,
          dividendsReceived: tx.type === "DIV" ? (tx.price * tx.lots * 100) : 0,
          transactions: [{ type: tx.type, date: tx.date, lots: tx.lots, price: tx.price }],
        };
        updated = [...prev, newPos];
      }
      savePortfolio(updated);
      setRefreshKey((k) => k + 1);
      return updated;
    });
  };

  const handleImport = (rows: Array<{ type: "BUY" | "SELL" | "DIV"; symbol: string; name?: string; lots: number; price: number; date: string }>) => {
    rows.forEach((r) => handleAdd(r));
    setShowImport(false);
  };

  const handleDelete = (symbol: string) => {
    setPositions((prev) => { const updated = prev.filter((p) => p.symbol !== symbol); savePortfolio(updated); return updated; });
  };

  return (
    <PageTransition>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Portfolio Tracker</h1>
            <p className="text-sm text-muted-foreground">Lacak portofolio saham kamu</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowImport(true)}><Upload className="h-3.5 w-3.5 mr-1.5" />Import CSV</Button>
            <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Add Transaction</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-1"><Wallet className="h-4 w-4 text-primary" /><span className="text-[11px] text-muted-foreground">Total Value</span></div>
            <p className="text-xl font-bold font-mono">IDR {totalValue.toLocaleString("id-ID", { notation: "compact", maximumFractionDigits: 1 })}</p>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-1">{totalUnrealPnL >= 0 ? <TrendingUp className="h-4 w-4 text-green-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}<span className="text-[11px] text-muted-foreground">Unreal. P&L</span></div>
            <p className={`text-xl font-bold font-mono ${totalUnrealPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totalUnrealPnL >= 0 ? "+" : "-"}IDR {Math.abs(totalUnrealPnL).toLocaleString("id-ID", { notation: "compact", maximumFractionDigits: 1 })}
            </p>
            <p className={`text-[11px] ${changeClass(totalPnLPct)}`}>{totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(2)}%</p>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-1"><span className="text-[11px] text-muted-foreground">Realized P&L</span></div>
            <p className={`text-xl font-bold font-mono ${totalRealized >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totalRealized >= 0 ? "+" : "-"}IDR {Math.abs(totalRealized).toLocaleString("id-ID", { notation: "compact", maximumFractionDigits: 1 })}
            </p>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-1"><span className="text-[11px] text-muted-foreground">Dividends</span></div>
            <p className="text-xl font-bold font-mono text-yellow-400">IDR {totalDividends.toLocaleString("id-ID", { notation: "compact", maximumFractionDigits: 1 })}</p>
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1"><AllocationChart data={allocationData} totalValue={totalValue} /></div>
          <div className="lg:col-span-3"><PositionTable positions={displayPositions} onDelete={handleDelete} /></div>
        </div>
      </div>

      {showAdd && <TransactionModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Import from CSV</h2>
            <p className="text-xs text-muted-foreground mb-3">Columns: date, type(BUY/SELL/DIV), symbol, lots, price, [name]</p>
            <CsvImport onImport={handleImport} />
            <Button variant="ghost" className="w-full mt-3" onClick={() => setShowImport(false)}>Cancel</Button>
          </GlassCard>
        </div>
      )}
    </PageTransition>
  );
}
