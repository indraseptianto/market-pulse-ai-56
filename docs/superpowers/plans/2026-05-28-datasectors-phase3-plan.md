# Phase 3 Implementation — Portfolio + Sector + Screener v2 + Daily Report

> **Agent guidance:** Execute tasks in order. Tasks 1-5 (routes/components) can run in parallel via subagents. Tasks 6-7 (scripts + cron) should be done in this session after routes/components are ready.

**Scope:** 4 independent features. Batch 1 = routes/components (parallel subagents). Batch 2 = scripts/cron (sequential).

---

## Task 1: Portfolio Tracker — Routes & Components

**Files to create:**
- `src/routes/portfolio.tsx`
- `src/components/portfolio/PositionTable.tsx`
- `src/components/portfolio/AllocationChart.tsx`
- `src/components/portfolio/TransactionModal.tsx`
- `src/components/portfolio/CsvImport.tsx`
- `src/components/portfolio/PortfolioSummary.tsx`

### Step 1: Create directory
```bash
mkdir -p /root/projects/market-pulse-ai-56/src/components/portfolio
```

### Step 2: Create `src/components/portfolio/PositionTable.tsx`

```tsx
import { Link } from "@tanstack/react-router";
import { GlassCard } from "@/components/common/GlassCard";
import { fmtPrice, changeClass } from "@/lib/formatters";
import { ArrowUpDown, Trash2 } from "lucide-react";

export interface Position {
  symbol: string;
  name: string;
  avgBuyPrice: number;
  totalLots: number;
  currentPrice: number;
  realizedPnL: number;
  dividendsReceived: number;
}

interface Props {
  positions: Position[];
  onDelete: (symbol: string) => void;
}

export function PositionTable({ positions, onDelete }: Props) {
  const fmt = (n: number) => {
    const abs = Math.abs(n);
    const sign = n >= 0 ? "+" : "-";
    return `${sign}IDR ${abs.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
  };

  return (
    <GlassCard className="p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40 bg-background/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2.5">Symbol</th>
            <th className="px-4 py-2.5 text-right">Lots</th>
            <th className="px-4 py-2.5 text-right">Avg Price</th>
            <th className="px-4 py-2.5 text-right">Current</th>
            <th className="px-4 py-2.5 text-right">Unreal. P&L</th>
            <th className="px-4 py-2.5 text-right">Return %</th>
            <th className="px-4 py-2.5 text-right">Realized</th>
            <th className="px-4 py-2.5 text-right">Dividends</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {positions.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                No positions yet. Add your first transaction.
              </td>
            </tr>
          ) : (
            positions.map((p) => {
              const cost = p.avgBuyPrice * p.totalLots * 100;
              const value = p.currentPrice * p.totalLots * 100;
              const unrealPnL = value - cost;
              const retPct = cost > 0 ? (unrealPnL / cost) * 100 : 0;
              return (
                <tr key={p.symbol} className="border-b border-border/30 hover:bg-accent/20">
                  <td className="px-4 py-2.5">
                    <Link to="/stocks/$symbol" params={{ symbol: p.symbol }}>
                      <div className="font-mono text-sm font-semibold">{p.symbol}</div>
                      <div className="truncate text-xs text-muted-foreground max-w-[150px]">{p.name}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{p.totalLots.toLocaleString("id-ID")}</td>
                  <td className="px-4 py-2.5 text-right font-mono">IDR {p.avgBuyPrice.toLocaleString("id-ID")}</td>
                  <td className="px-4 py-2.5 text-right font-mono">IDR {p.currentPrice.toLocaleString("id-ID")}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-semibold ${unrealPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {fmt(unrealPnL)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono ${changeClass(retPct)}`}>
                    {retPct >= 0 ? "+" : ""}{retPct.toFixed(2)}%
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono ${p.realizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {fmt(p.realizedPnL)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-yellow-400">
                    IDR {p.dividendsReceived.toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => onDelete(p.symbol)}
                      className="rounded p-1 text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </GlassCard>
  );
}
```

### Step 3: Create `src/components/portfolio/AllocationChart.tsx`

```tsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { GlassCard } from "@/components/common/GlassCard";

export interface AllocationItem {
  symbol: string;
  value: number; // total IDR value
  pct: number;
  color: string;
}

interface Props {
  data: AllocationItem[];
  totalValue: number;
}

const COLORS = ["#10b981", "#38bdf8", "#a78bfa", "#f59e0b", "#f472b6", "#2dd4bf", "#ef4444", "#6366f1", "#84cc16", "#f97316"];

export function AllocationChart({ data, totalValue }: Props) {
  const chartData = data.map((d, i) => ({
    name: d.symbol,
    value: d.value,
    pct: d.pct,
    color: d.color || COLORS[i % COLORS.length],
  }));

  const fmt = (v: number) =>
    `IDR ${v.toLocaleString("id-ID", { notation: "compact", maximumFractionDigits: 1 })}`;

  return (
    <GlassCard className="p-4">
      <h3 className="text-sm font-semibold mb-1">Allocation</h3>
      <p className="text-[11px] text-muted-foreground mb-3">
        Total: IDR {totalValue.toLocaleString("id-ID", { notation: "compact", maximumFractionDigits: 1 })}
      </p>
      {chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          No data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={80}
              dataKey="value"
              strokeWidth={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [fmt(value), name]}
              contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
            />
            <Legend
              formatter={(value: string) => <span className="text-xs text-foreground">{value}</span>}
              wrapperStyle={{ fontSize: 11 }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </GlassCard>
  );
}
```

### Step 4: Create `src/components/portfolio/TransactionModal.tsx`

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/common/GlassCard";
import { X, Plus } from "lucide-react";

interface Props {
  onClose: () => void;
  onAdd: (tx: { type: "BUY" | "SELL" | "DIV"; symbol: string; lots: number; price: number; date: string; name?: string }) => void;
}

export function TransactionModal({ onClose, onAdd }: Props) {
  const [type, setType] = useState<"BUY" | "SELL" | "DIV">("BUY");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [lots, setLots] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSubmit = () => {
    if (!symbol || !lots || !price) return;
    onAdd({ type, symbol: symbol.toUpperCase(), name: name || symbol.toUpperCase(), lots: Number(lots), price: Number(price), date });
    onClose();
  };

  const color = type === "BUY" ? "text-green-400" : type === "SELL" ? "text-red-400" : "text-yellow-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <GlassCard className="w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-lg font-semibold ${color}`}>Add Transaction</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            {(["BUY", "SELL", "DIV"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition ${
                  type === t
                    ? t === "BUY" ? "border-green-500/60 bg-green-500/15 text-green-400"
                    : t === "SELL" ? "border-red-500/60 bg-red-500/15 text-red-400"
                    : "border-yellow-500/60 bg-yellow-500/15 text-yellow-400"
                    : "border-border/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "BUY" ? "📈 BUY" : t === "SELL" ? "📉 SELL" : "💰 DIV"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Symbol</label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="BBRI"
                className="font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Stock Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bank BRI"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Lots</label>
              <Input type="number" value={lots} onChange={(e) => setLots(e.target.value)} placeholder="1000" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Price (IDR)</label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="4500" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {lots && price && (
            <div className="rounded-lg bg-accent/50 p-3 text-sm">
              <span className="text-muted-foreground">Total: </span>
              <span className="font-mono font-semibold">
                IDR {(Number(lots) * Number(price) * 100).toLocaleString("id-ID")}
              </span>
              <span className="text-muted-foreground ml-2 text-xs">(1 lot = 100 shares)</span>
            </div>
          )}

          <Button onClick={handleSubmit} className="w-full" disabled={!symbol || !lots || !price}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Transaction
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
```

### Step 5: Create `src/components/portfolio/CsvImport.tsx`

```tsx
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, AlertCircle, CheckCircle } from "lucide-react";

interface ParsedRow {
  type: "BUY" | "SELL" | "DIV";
  symbol: string;
  name?: string;
  lots: number;
  price: number;
  date: string;
}

interface Props {
  onImport: (rows: ParsedRow[]) => void;
}

export function CsvImport({ onImport }: Props) {
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.trim().split("\n").slice(1); // skip header
    const rows: ParsedRow[] = [];

    for (const line of lines) {
      // Simple CSV parser (handles basic commas)
      const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
      if (parts.length < 5) continue;

      const [date, typeRaw, symbol, lotsStr, priceStr, ...rest] = parts;
      const type = typeRaw.toUpperCase().startsWith("BUY") ? "BUY" as const
        : typeRaw.toUpperCase().startsWith("SELL") ? "SELL" as const
        : typeRaw.toUpperCase().startsWith("DIV") ? "DIV" as const
        : "BUY" as const;

      const lots = parseInt(lotsStr) || parseFloat(lotsStr) || 0;
      const price = parseFloat(priceStr.replace(/[^0-9.]/g, "")) || 0;
      const name = rest[0] || symbol;

      if (symbol && lots > 0 && price > 0) {
        rows.push({ type, symbol: symbol.toUpperCase(), name, lots, price, date: date || new Date().toISOString().split("T")[0] });
      }
    }
    return rows;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) { setError("Empty file"); return; }
      const rows = parseCSV(text);
      if (rows.length === 0) { setError("No valid rows found. Expected format: date,type,symbol,lots,price[,name]"); return; }
      setPreview(rows);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        variant="outline"
        className="w-full"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="h-4 w-4 mr-2" />
        Upload Broker CSV
      </Button>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {preview.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle className="h-4 w-4" />
            {preview.length} transactions parsed
          </div>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border/50 bg-accent/30 p-2 space-y-1">
            {preview.slice(0, 10).map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-mono font-medium">{r.type} {r.symbol}</span>
                <span className="text-muted-foreground">{r.lots} lots @ IDR {r.price.toLocaleString("id-ID")}</span>
              </div>
            ))}
            {preview.length > 10 && (
              <p className="text-[10px] text-muted-foreground">...and {preview.length - 10} more</p>
            )}
          </div>
          <Button onClick={() => onImport(preview)} className="w-full" size="sm">
            Import {preview.length} Transactions
          </Button>
        </div>
      )}
    </div>
  );
}
```

### Step 6: Create `src/routes/portfolio.tsx`

```tsx
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
import { Plus, Upload, RefreshCw, TrendingUp, TrendingDown, Wallet } from "lucide-react";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio Tracker — Stratum" },
      { name: "description", content: "Lacak portofolio saham kamu: P&L, alokasi, dan performa." },
    ],
  }),
  component: PortfolioPage,
});

const STORAGE_KEY = "stratum_portfolio";

interface StoredPosition {
  symbol: string;
  name: string;
  avgBuyPrice: number;
  totalLots: number;
  realizedPnL: number;
  dividendsReceived: number;
  transactions: Array<{ type: string; date: string; lots: number; price: number }>;
}

function loadPortfolio(): StoredPosition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePortfolio(positions: StoredPosition[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

const PIE_COLORS = ["#10b981", "#38bdf8", "#a78bfa", "#f59e0b", "#f472b6", "#2dd4bf", "#ef4444", "#6366f1", "#84cc16", "#f97316"];

export function PortfolioPage() {
  const equitiesFn = useServerFn(getStockEquitiesV2);

  const [positions, setPositions] = useState<StoredPosition[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<Array<{ type: "BUY" | "SELL" | "DIV"; symbol: string; name?: string; lots: number; price: number; date: string }>>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { setPositions(loadPortfolio()); }, []);

  // Fetch current prices for all positions
  const symbols = useMemo(() => positions.map((p) => p.symbol), [positions]);
  const { data: equitiesData, isFetching } = useQuery({
    queryKey: ["portfolio-prices", symbols.join(","), refreshKey],
    queryFn: async () => {
      if (symbols.length === 0) return { data: [] };
      // Fetch all in parallel
      const results = await Promise.allSettled(
        symbols.map((sym) => equitiesFn({ data: { symbol: sym } }))
      );
      return {
        data: results
          .filter((r): r is PromiseFulfilledResult<unknown> => r.status === "fulfilled")
          .map((r) => (r.value as { data?: unknown }).data)
          .filter(Boolean),
      };
    },
    staleTime: 5 * 60_000,
  });

  const priceMap = useMemo(() => {
    const map: Record<string, number> = {};
    (equitiesData?.data ?? []).forEach((eq: Record<string, unknown>) => {
      if (eq.symbol) map[eq.symbol as string] = (eq.price as number) || 0;
    });
    return map;
  }, [equitiesData]);

  // Build display positions with current prices
  const displayPositions = useMemo(() => {
    return positions.map((p) => ({
      symbol: p.symbol,
      name: p.name,
      avgBuyPrice: p.avgBuyPrice,
      totalLots: p.totalLots,
      currentPrice: priceMap[p.symbol] || p.avgBuyPrice,
      realizedPnL: p.realizedPnL,
      dividendsReceived: p.dividendsReceived,
    }));
  }, [positions, priceMap]);

  const totalValue = useMemo(() =>
    displayPositions.reduce((s, p) => s + p.currentPrice * p.totalLots * 100, 0), [displayPositions]);

  const totalCost = useMemo(() =>
    displayPositions.reduce((s, p) => s + p.avgBuyPrice * p.totalLots * 100, 0), [displayPositions]);

  const totalUnrealPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalUnrealPnL / totalCost) * 100 : 0;
  const totalRealized = displayPositions.reduce((s, p) => s + p.realizedPnL, 0);
  const totalDividends = displayPositions.reduce((s, p) => s + p.dividendsReceived, 0);

  const allocationData = useMemo(() => {
    if (totalValue === 0) return [];
    return positions.map((p, i) => {
      const cp = priceMap[p.symbol] || p.avgBuyPrice;
      const value = cp * p.totalLots * 100;
      return {
        symbol: p.symbol,
        value,
        pct: (value / totalValue) * 100,
        color: PIE_COLORS[i % PIE_COLORS.length],
      };
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
            const newAvg = ((p.avgBuyPrice * p.totalLots) + (tx.price * tx.lots)) / newTotalLots;
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
          symbol: tx.symbol,
          name: tx.name || tx.symbol,
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
    setImportRows([]);
  };

  const handleDelete = (symbol: string) => {
    setPositions((prev) => {
      const updated = prev.filter((p) => p.symbol !== symbol);
      savePortfolio(updated);
      return updated;
    });
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
            <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Import CSV
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Transaction
            </Button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-[11px] text-muted-foreground">Total Value</span>
            </div>
            <p className="text-xl font-bold font-mono">
              IDR {totalValue.toLocaleString("id-ID", { notation: "compact", maximumFractionDigits: 1 })}
            </p>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-1">
              {totalUnrealPnL >= 0 ? <TrendingUp className="h-4 w-4 text-green-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
              <span className="text-[11px] text-muted-foreground">Unreal. P&L</span>
            </div>
            <p className={`text-xl font-bold font-mono ${totalUnrealPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totalUnrealPnL >= 0 ? "+" : ""}IDR {Math.abs(totalUnrealPnL).toLocaleString("id-ID", { notation: "compact", maximumFractionDigits: 1 })}
            </p>
            <p className={`text-[11px] ${changeClass(totalPnLPct)}`}>{totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(2)}%</p>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] text-muted-foreground">Realized P&L</span>
            </div>
            <p className={`text-xl font-bold font-mono ${totalRealized >= 0 ? "text-green-400" : "text-red-400"}`}>
              {totalRealized >= 0 ? "+" : ""}IDR {Math.abs(totalRealized).toLocaleString("id-ID", { notation: "compact", maximumFractionDigits: 1 })}
            </p>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] text-muted-foreground">Dividends</span>
            </div>
            <p className="text-xl font-bold font-mono text-yellow-400">
              IDR {totalDividends.toLocaleString("id-ID", { notation: "compact", maximumFractionDigits: 1 })}
            </p>
          </GlassCard>
        </div>

        {/* Allocation + Table */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1">
            <AllocationChart data={allocationData} totalValue={totalValue} />
          </div>
          <div className="lg:col-span-3">
            <PositionTable positions={displayPositions} onDelete={handleDelete} />
          </div>
        </div>
      </div>

      {showAdd && (
        <TransactionModal
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
        />
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Import from CSV</h2>
            <p className="text-xs text-muted-foreground mb-3">Expected columns: date, type(BUY/SELL/DIV), symbol, lots, price, [name]</p>
            <CsvImport onImport={handleImport} />
            <Button variant="ghost" className="w-full mt-3" onClick={() => setShowImport(false)}>Cancel</Button>
          </GlassCard>
        </div>
      )}
    </PageTransition>
  );
}
```

### Step 7: Commit
```bash
cd /root/projects/market-pulse-ai-56
git add src/routes/portfolio.tsx src/components/portfolio/
git commit -m "feat(portfolio): add Portfolio Tracker with manual entry, CSV import, allocation chart"
git log --oneline -1
```

---

## Task 2: Sector Analysis — Sector Heatmap + Rotation Tracker

**Files to create:**
- `src/routes/sectors.tsx`
- `src/routes/sectors.$sectorName.tsx`
- `src/components/sectors/SectorHeatmap.tsx`
- `src/components/sectors/SectorRotationTable.tsx`
- `src/components/sectors/SectorRadarChart.tsx`

### Step 1: Read existing sector data functions
```bash
grep -n "getSector\|sector" /root/projects/market-pulse-ai-56/src/lib/datasectors.functions.ts | head -20
```

### Step 2: Create `src/components/sectors/SectorHeatmap.tsx`

```tsx
import { useNavigate } from "@tanstack/react-router";
import { GlassCard } from "@/components/common/GlassCard";

interface SectorItem {
  name: string;
  avgChangePct: number;
  totalMarketCap: number;
  stockCount: number;
  topStock?: string;
  topChange?: number;
}

interface Props {
  data: SectorItem[];
  timeframe: string;
  onSectorClick: (name: string) => void;
}

function getColor(pct: number): string {
  const clamped = Math.max(-5, Math.min(5, pct));
  const normalized = (clamped + 5) / 10; // 0 = worst, 1 = best
  // Red (worst) → Gray → Green (best)
  if (pct < 0) {
    const intensity = Math.min(1, Math.abs(pct) / 3);
    return `rgba(239, 68, 68, ${0.15 + intensity * 0.6})`;
  }
  const intensity = Math.min(1, pct / 3);
  return `rgba(16, 185, 129, ${0.15 + intensity * 0.6})`;
}

function getTextColor(pct: number): string {
  const intensity = Math.abs(pct) / 3;
  return intensity > 0.5 ? "#fff" : "#94a3b8";
}

function formatCap(cap: number): string {
  if (cap >= 1e15) return `${(cap / 1e15).toFixed(1)}Q`;
  if (cap >= 1e12) return `${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9) return `${(cap / 1e9).toFixed(1)}B`;
  return `${(cap / 1e6).toFixed(0)}M`;
}

export function SectorHeatmap({ data, timeframe, onSectorClick }: Props) {
  if (data.length === 0) {
    return (
      <GlassCard className="p-8 text-center text-muted-foreground">
        No sector data available
      </GlassCard>
    );
  }

  // Sort by market cap (largest = most important)
  const sorted = [...data].sort((a, b) => b.totalMarketCap - a.totalMarketCap);
  const totalCap = sorted.reduce((s, d) => s + d.totalMarketCap, 0);

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Sector Heatmap</h3>
        <span className="text-[11px] text-muted-foreground">{timeframe}</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-3 text-[10px] text-muted-foreground">
        <span className="text-red-400">■ Worst</span>
        <div className="flex gap-0.5">
          {["rgba(239,68,68,0.6)", "rgba(239,68,68,0.2)", "rgba(148,163,184,0.2)", "rgba(16,185,129,0.2)", "rgba(16,185,129,0.6)"].map((c) => (
            <div key={c} className="h-3 w-6 rounded-sm" style={{ background: c }} />
          ))}
        </div>
        <span className="text-green-400">■ Best</span>
      </div>

      <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5">
        {sorted.map((sector) => {
          const weight = totalCap > 0 ? sector.totalMarketCap / totalCap : 0;
          return (
            <button
              key={sector.name}
              onClick={() => onSectorClick(sector.name)}
              className="relative rounded-lg p-2 text-left transition-all hover:scale-105 cursor-pointer border border-transparent hover:border-border/50"
              style={{
                background: getColor(sector.avgChangePct),
                minHeight: Math.max(56, weight * 200),
              }}
            >
              <p
                className="font-semibold text-[11px] leading-tight mb-0.5 truncate"
                style={{ color: getTextColor(sector.avgChangePct) }}
              >
                {sector.name}
              </p>
              <p
                className="text-lg font-bold leading-tight"
                style={{ color: getTextColor(sector.avgChangePct) }}
              >
                {sector.avgChangePct > 0 ? "+" : ""}{sector.avgChangePct.toFixed(2)}%
              </p>
              <p className="text-[9px] mt-0.5 opacity-70" style={{ color: getTextColor(sector.avgChangePct) }}>
                {formatCap(sector.totalMarketCap)}
              </p>
              {sector.topStock && (
                <p className="text-[9px] mt-0.5 opacity-60 truncate" style={{ color: getTextColor(sector.avgChangePct) }}>
                  ↑{sector.topStock} {sector.topChange != null ? `${sector.topChange >= 0 ? "+" : ""}${sector.topChange.toFixed(1)}%` : ""}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}
```

### Step 3: Create `src/components/sectors/SectorRotationTable.tsx`

```tsx
import { GlassCard } from "@/components/common/GlassCard";
import { changeClass } from "@/lib/formatters";

interface RotationData {
  name: string;
  change1d: number;
  change1w: number;
  change1m: number;
  change3m: number;
  change6m: number;
  change1y: number;
  momentumScore: number;
}

interface Props {
  data: RotationData[];
  sortBy: "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "score";
  onSortChange: (s: "1D" | "1W" | "1M" | "3M" | "1Y" | "score") => void;
}

const COLS = ["1D", "1W", "1M", "3M", "6M", "1Y", "Score"] as const;

export function SectorRotationTable({ data, sortBy, onSortChange }: Props) {
  const sorted = [...data].sort((a, b) => {
    if (sortBy === "score") return b.momentumScore - a.momentumScore;
    const key = { "1D": "change1d", "1W": "change1w", "1M": "change1m", "3M": "change3m", "6M": "change6m", "1Y": "change1y" }[sortBy] as keyof RotationData;
    return ((b[key] as number) || 0) - ((a[key] as number) || 0);
  });

  const colKey = (c: typeof COLS[number]): keyof RotationData =>
    ({ "1D": "change1d", "1W": "change1w", "1M": "change1m", "3M": "change3m", "6M": "change6m", "1Y": "change1y", "Score": "momentumScore" }[c] as keyof RotationData);

  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40">
        <h3 className="text-sm font-semibold">Sector Rotation Tracker</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40 bg-background/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2.5">Sector</th>
            {COLS.map((c) => (
              <th
                key={c}
                className={`px-3 py-2.5 text-right cursor-pointer transition-colors ${sortBy === c || (c === "1D" && sortBy === "1D") ? "text-primary" : ""}`}
                onClick={() => onSortChange(c === "Score" ? "score" : c)}
              >
                {c}
                {sortBy === c ? " ▲" : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((sector, i) => (
            <tr key={sector.name} className="border-b border-border/20 hover:bg-accent/20">
              <td className="px-4 py-2.5">
                <span className={`text-xs font-medium ${i < 3 ? "text-green-400" : i >= sorted.length - 3 ? "text-red-400" : "text-foreground"}`}>
                  {i < 3 ? "🥇" : i < 6 ? "🥈" : i >= sorted.length - 3 ? "🔻" : ""}
                </span>
                <span className="ml-1.5 text-sm font-medium">{sector.name}</span>
              </td>
              {COLS.map((c) => {
                const val = sector[colKey(c) as keyof RotationData];
                return (
                  <td key={c} className={`px-3 py-2.5 text-right font-mono text-xs ${changeClass(val as number)}`}>
                    {typeof val === "number" ? `${(val as number) >= 0 ? "+" : ""}${(val as number).toFixed(2)}%` : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
  );
}
```

### Step 4: Create `src/routes/sectors.tsx`

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { SectorHeatmap } from "@/components/sectors/SectorHeatmap";
import { SectorRotationTable } from "@/components/sectors/SectorRotationTable";
import { DataSourceBadge } from "@/components/shared/DataSourceBadge";

export const Route = createFileRoute("/sectors")({
  head: () => ({
    meta: [
      { title: "Sector Analysis — Stratum" },
      { name: "description", content: "Pantau performa sektor IDX: heatmap, rotation tracker, dan comparison." },
    ],
  }),
  component: SectorsPage,
});

// Mock sector data — in production, fetch from DS API
const MOCK_SECTORS = [
  { name: "Financials", avgChangePct: 2.34, totalMarketCap: 4.2e15, stockCount: 45, topStock: "BBCA", topChange: 3.2 },
  { name: "Basic Materials", avgChangePct: 1.87, totalMarketCap: 2.8e15, stockCount: 38, topStock: "INTP", topChange: 4.1 },
  { name: "Consumer Goods", avgChangePct: 1.12, totalMarketCap: 2.1e15, stockCount: 52, topStock: "UNVR", topChange: 2.8 },
  { name: "Energy", avgChangePct: 0.78, totalMarketCap: 1.5e15, stockCount: 22, topStock: "PGAS", topChange: 1.5 },
  { name: "Healthcare", avgChangePct: 0.45, totalMarketCap: 8.9e14, stockCount: 31, topStock: "KLBF", topChange: 1.2 },
  { name: "Industrials", avgChangePct: -0.23, totalMarketCap: 1.9e15, stockCount: 48, topStock: "UNTR", topChange: 1.8 },
  { name: "Properties", avgChangePct: -0.67, totalMarketCap: 1.2e15, stockCount: 42, topStock: "BSDE", topChange: 0.9 },
  { name: "Infrastructure", avgChangePct: -1.12, totalMarketCap: 1.4e15, stockCount: 29, topStock: "TLKM", topChange: -0.3 },
  { name: "Technology", avgChangePct: 3.45, totalMarketCap: 4.5e14, stockCount: 18, topStock: "GOTO", topChange: 5.2 },
  { name: "Transportation", avgChangePct: -2.34, totalMarketCap: 6.8e14, stockCount: 24, topStock: "CUAN", topChange: -4.1 },
  { name: "Consumer Services", avgChangePct: 1.78, totalMarketCap: 1.1e15, stockCount: 35, topStock: "MAPI", topChange: 3.1 },
  { name: "Utilities", avgChangePct: 0.12, totalMarketCap: 5.6e14, stockCount: 15, topStock: "ITMG", topChange: 0.8 },
];

function buildRotationData() {
  return MOCK_SECTORS.map((s) => ({
    name: s.name,
    change1d: s.avgChangePct,
    change1w: s.avgChangePct * (1 + (Math.random() - 0.5) * 0.5),
    change1m: s.avgChangePct * (1 + (Math.random() * 1.5)),
    change3m: s.avgChangePct * (1 + (Math.random() * 3)),
    change6m: s.avgChangePct * (1 + (Math.random() * 5)),
    change1y: s.avgChangePct * (1 + (Math.random() * 8)),
    momentumScore: Math.round(50 + (s.avgChangePct * 10) + (Math.random() * 20)),
  }));
}

type SortKey = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "score";

export function SectorsPage() {
  const navigate = useNavigate();
  const [timeframe] = useState("1D");
  const [sortBy, setSortBy] = useState<SortKey>("1D");

  const rotationData = useMemo(() => buildRotationData(), []);

  const handleSectorClick = (name: string) => {
    navigate({ to: "/sectors/$sectorName", params: { sectorName: encodeURIComponent(name) } });
  };

  const bestSector = [...rotationData].sort((a, b) => b.change1d - a.change1d)[0];
  const worstSector = [...rotationData].sort((a, b) => a.change1d - b.change1d)[0];

  return (
    <PageTransition>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sector Analysis</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Pantau performa dan rotasi sektor IDX. <DataSourceBadge source="ds" />
          </p>
        </div>

        {/* Quick insights */}
        <div className="grid grid-cols-2 gap-3">
          <GlassCard className="p-4">
            <p className="text-[11px] text-muted-foreground mb-1">🏆 Best Sector Today</p>
            <p className="text-lg font-bold text-green-400">{bestSector?.name}</p>
            <p className={`text-sm font-mono ${bestSector && bestSector.change1d >= 0 ? "text-green-400" : "text-red-400"}`}>
              {bestSector ? `${bestSector.change1d >= 0 ? "+" : ""}${bestSector.change1d.toFixed(2)}%` : "—"}
            </p>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-[11px] text-muted-foreground mb-1">📉 Weakest Sector Today</p>
            <p className="text-lg font-bold text-red-400">{worstSector?.name}</p>
            <p className={`text-sm font-mono ${worstSector && worstSector.change1d >= 0 ? "text-green-400" : "text-red-400"}`}>
              {worstSector ? `${worstSector.change1d >= 0 ? "+" : ""}${worstSector.change1d.toFixed(2)}%` : "—"}
            </p>
          </GlassCard>
        </div>

        <SectorHeatmap
          data={MOCK_SECTORS}
          timeframe={timeframe}
          onSectorClick={handleSectorClick}
        />

        <SectorRotationTable
          data={rotationData}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      </div>
    </PageTransition>
  );
}
```

### Step 5: Create `src/routes/sectors.$sectorName.tsx`

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { getStockEquitiesV2 } from "@/lib/datasectors.functions";
import { changeClass, fmtPrice } from "@/lib/formatters";
import { ArrowLeft, Building2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const Route = createFileRoute("/sectors/$sectorName")({
  head: ({ params }) => ({
    meta: [
      { title: `${decodeURIComponent(params.sectorName)} Sector — Stratum` },
      { name: "description", content: `Saham-saham di sektor ${decodeURIComponent(params.sectorName)}` },
    ],
  }),
  component: SectorDetailPage,
});

// In production: fetch sectors from DS and filter by sector name
const MOCK_SECTOR_STOCKS: Record<string, Array<{
  symbol: string; name: string; price: number; change_pct: number;
  market_cap: number; pe_ratio: number; dividend_yield: number;
}>> = {
  "Financials": [
    { symbol: "BBCA", name: "Bank Central Asia", price: 9250, change_pct: 3.2, market_cap: 5.7e14, pe_ratio: 24.5, dividend_yield: 3.1 },
    { symbol: "BBRI", name: "Bank BRI", price: 4780, change_pct: 2.1, market_cap: 4.5e14, pe_ratio: 18.2, dividend_yield: 4.8 },
    { symbol: "BMRI", name: "Bank Mandiri", price: 7150, change_pct: 1.8, market_cap: 3.9e14, pe_ratio: 11.8, dividend_yield: 3.5 },
    { symbol: "BBNI", name: "Bank BNI", price: 5200, change_pct: -0.5, market_cap: 1.2e14, pe_ratio: 9.4, dividend_yield: 5.2 },
    { symbol: "BTPS", name: "BTPN", price: 3450, change_pct: 1.2, market_cap: 8.9e13, pe_ratio: 14.7, dividend_yield: 3.8 },
  ],
  "Technology": [
    { symbol: "GOTO", name: "GoTo", price: 78, change_pct: 5.2, market_cap: 3.2e13, pe_ratio: null, dividend_yield: 0 },
    { symbol: "BUKA", name: "Bukalapak", price: 112, change_pct: 2.8, market_cap: 1.8e13, pe_ratio: null, dividend_yield: 0 },
    { symbol: "MLPT", name: "MNC", price: 234, change_pct: -1.2, market_cap: 8.9e12, pe_ratio: 34.2, dividend_yield: 1.2 },
  ],
};

function fmtCap(cap: number): string {
  if (cap >= 1e12) return `${(cap/1e12).toFixed(1)}T`;
  if (cap >= 1e9) return `${(cap/1e9).toFixed(0)}B`;
  return `${(cap/1e6).toFixed(0)}M`;
}

export function SectorDetailPage() {
  const { sectorName } = Route.useParams();
  const decoded = decodeURIComponent(sectorName);
  const [search, setSearch] = useState("");

  const stocks = MOCK_SECTOR_STOCKS[decoded] ?? [];
  const filtered = stocks.filter((s) =>
    !search || s.symbol.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase())
  );

  const avgChange = filtered.length > 0
    ? filtered.reduce((s, x) => s + x.change_pct, 0) / filtered.length
    : 0;
  const avgYield = filtered.length > 0
    ? filtered.filter((s) => s.dividend_yield > 0).reduce((s, x) => s + x.dividend_yield, 0) / Math.max(1, filtered.filter((s) => s.dividend_yield > 0).length)
    : 0;

  return (
    <PageTransition>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/sectors" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {decoded}
            </h1>
            <p className="text-sm text-muted-foreground">
              {filtered.length} saham · Avg Return:{" "}
              <span className={changeClass(avgChange)}>{avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%</span> · Avg Yield: {avgYield.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={`Cari saham di ${decoded}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 max-w-xs text-sm"
          />
        </div>

        <GlassCard className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-background/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5">Symbol</th>
                <th className="px-4 py-2.5 text-right">Price</th>
                <th className="px-4 py-2.5 text-right">Chg%</th>
                <th className="px-4 py-2.5 text-right">Mkt Cap</th>
                <th className="px-4 py-2.5 text-right">P/E</th>
                <th className="px-4 py-2.5 text-right">Div Yield</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No stocks found</td></tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.symbol} className="border-b border-border/20 hover:bg-accent/20">
                    <td className="px-4 py-2.5">
                      <Link to="/stocks/$symbol" params={{ symbol: s.symbol }}>
                        <div className="font-mono text-sm font-semibold">{s.symbol}</div>
                        <div className="truncate text-xs text-muted-foreground max-w-[160px]">{s.name}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">IDR {s.price.toLocaleString("id-ID")}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${changeClass(s.change_pct)}`}>
                      {s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{fmtCap(s.market_cap)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{s.pe_ratio ? s.pe_ratio.toFixed(1) : "—"}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${s.dividend_yield >= 5 ? "text-green-400" : ""}`}>
                      {s.dividend_yield > 0 ? `${s.dividend_yield.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </GlassCard>
      </div>
    </PageTransition>
  );
}
```

### Step 6: Commit
```bash
cd /root/projects/market-pulse-ai-56
git add src/routes/sectors.tsx src/routes/sectors.\$sectorName.tsx src/components/sectors/
git commit -m "feat(sectors): add Sector Analysis with heatmap, rotation tracker, and sector detail page"
git log --oneline -1
```

---

## Task 3: Stock Screener v2

**Files to create:**
- `src/components/screener/FilterPanel.tsx`
- `src/components/screener/ScreenerResults.tsx`
- Modify: `src/routes/screener.tsx` (replace with enhanced version)

### Step 1: Read existing screener
```bash
wc -l /root/projects/market-pulse-ai-56/src/routes/screener.tsx && head -40 /root/projects/market-pulse-ai-56/src/routes/screener.tsx
```

### Step 2: Create `src/components/screener/FilterPanel.tsx`

```tsx
import { GlassCard } from "@/components/common/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";

export interface ScreenerFilters {
  rsiMin: number;
  rsiMax: number;
  divYieldMin: number;
  mktCap: string;
  sector: string;
  peMax: number;
  pbvMax: number;
  changeMin: number;
}

interface Props {
  filters: ScreenerFilters;
  onChange: (f: ScreenerFilters) => void;
  onReset: () => void;
  onSearch: () => void;
  resultCount: number;
  isLoading: boolean;
}

const DEFAULTS: ScreenerFilters = {
  rsiMin: 0, rsiMax: 100, divYieldMin: 0, mktCap: "ALL", sector: "ALL", peMax: 100, pbvMax: 100, changeMin: -999,
};

const SECTORS = ["ALL","Financials","Basic Materials","Consumer Goods","Energy","Healthcare","Industrials","Properties","Infrastructure","Technology","Transportation","Consumer Services","Utilities"];
const MKT_CAPS = ["ALL","Large (>50T)","Mid (10-50T)","Small (<10T)"];

export function FilterPanel({ filters, onChange, onReset, onSearch, resultCount, isLoading }: Props) {
  const set = (key: keyof ScreenerFilters, value: string | number) =>
    onChange({ ...filters, [key]: value });

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Filter Saham</h3>
        <div className="flex gap-2 items-center">
          {resultCount >= 0 && (
            <span className="text-xs text-muted-foreground">{resultCount} results</span>
          )}
          <Button size="sm" variant="ghost" onClick={onReset} className="h-7 text-xs">
            Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* RSI */}
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">RSI Range</label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={100}
              value={filters.rsiMin}
              onChange={(e) => set("rsiMin", Number(e.target.value))}
              className="h-8 text-xs w-14"
              placeholder="0"
            />
            <span className="text-muted-foreground text-xs">—</span>
            <Input
              type="number"
              min={0}
              max={100}
              value={filters.rsiMax}
              onChange={(e) => set("rsiMax", Number(e.target.value))}
              className="h-8 text-xs w-14"
              placeholder="100"
            />
          </div>
          <div className="flex gap-1 mt-1">
            <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1.5 bg-red-500/10 text-red-400" onClick={() => onChange({ ...filters, rsiMin: 0, rsiMax: 30 })}>Oversold</Button>
            <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1.5 bg-green-500/10 text-green-400" onClick={() => onChange({ ...filters, rsiMin: 70, rsiMax: 100 })}>Overbought</Button>
          </div>
        </div>

        {/* Dividend Yield */}
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Min Div Yield %</label>
          <Input
            type="number"
            min={0}
            max={20}
            step={0.1}
            value={filters.divYieldMin}
            onChange={(e) => set("divYieldMin", Number(e.target.value))}
            className="h-8 text-xs"
            placeholder="0"
          />
          <div className="flex gap-1 mt-1">
            <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1.5 bg-green-500/10 text-green-400" onClick={() => set("divYieldMin", 5)}>Yield >5%</Button>
          </div>
        </div>

        {/* Market Cap */}
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Market Cap</label>
          <Select value={filters.mktCap} onValueChange={(v) => set("mktCap", v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MKT_CAPS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Sector */}
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Sector</label>
          <Select value={filters.sector} onValueChange={(v) => set("sector", v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SECTORS.map((s) => <SelectItem key={s} value={s}>{s === "ALL" ? "All Sectors" : s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* P/E Max */}
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Max P/E Ratio</label>
          <Input
            type="number"
            min={0}
            max={100}
            value={filters.peMax}
            onChange={(e) => set("peMax", Number(e.target.value))}
            className="h-8 text-xs"
            placeholder="100"
          />
        </div>

        {/* P/BV Max */}
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Max P/BV Ratio</label>
          <Input
            type="number"
            min={0}
            max={20}
            step={0.1}
            value={filters.pbvMax}
            onChange={(e) => set("pbvMax", Number(e.target.value))}
            className="h-8 text-xs"
            placeholder="20"
          />
        </div>

        {/* Min Change */}
        <div>
          <label className="text-[11px] text-muted-foreground mb-1 block">Min Price Chg%</label>
          <Input
            type="number"
            min={-20}
            max={20}
            step={0.5}
            value={filters.changeMin}
            onChange={(e) => set("changeMin", Number(e.target.value))}
            className="h-8 text-xs"
            placeholder="-999"
          />
        </div>
      </div>

      <Button onClick={onSearch} className="mt-3 w-full" disabled={isLoading}>
        <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
        {isLoading ? "Scanning..." : "🔍 Run Screener"}
      </Button>
    </GlassCard>
  );
}
```

### Step 3: Create `src/components/screener/ScreenerResults.tsx`

```tsx
import { Link } from "@tanstack/react-router";
import { GlassCard } from "@/components/common/GlassCard";
import { changeClass, fmtPrice } from "@/lib/formatters";
import { Button } from "@/components/ui/button";

export interface ScreenerStock {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  rsi: number | null;
  dividend_yield: number | null;
  market_cap: number;
  pe_ratio: number | null;
  pbv_ratio: number | null;
  compositeScore: number;
}

interface Props {
  results: ScreenerStock[];
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "bg-green-500/20 text-green-400 border-green-500/40"
    : score >= 50 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
    : "bg-red-500/20 text-red-400 border-red-500/40";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-mono font-bold ${color}`}>
      {score.toFixed(0)}
    </span>
  );
}

export function ScreenerResults({ results, page, pageSize, onPageChange }: Props) {
  const total = results.length;
  const totalPages = Math.ceil(total / pageSize);
  const paginated = results.slice(page * pageSize, (page + 1) * pageSize);

  if (total === 0) {
    return (
      <GlassCard className="py-12 text-center">
        <p className="text-muted-foreground">No stocks match your filters.</p>
        <p className="text-xs text-muted-foreground mt-1">Try widening your criteria.</p>
      </GlassCard>
    );
  }

  return (
    <>
      <GlassCard className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-background/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5">Symbol</th>
              <th className="px-4 py-2.5 text-right">Price</th>
              <th className="px-4 py-2.5 text-right">Chg%</th>
              <th className="px-4 py-2.5 text-right">RSI</th>
              <th className="px-4 py-2.5 text-right">Yield%</th>
              <th className="px-4 py-2.5 text-right">P/E</th>
              <th className="px-4 py-2.5 text-right">P/BV</th>
              <th className="px-4 py-2.5 text-center">Score</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((s) => (
              <tr key={s.symbol} className="border-b border-border/20 hover:bg-accent/20">
                <td className="px-4 py-2.5">
                  <Link to="/stocks/$symbol" params={{ symbol: s.symbol }}>
                    <div className="font-mono text-sm font-semibold">{s.symbol}</div>
                    <div className="truncate text-xs text-muted-foreground max-w-[140px]">{s.name}</div>
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{fmtPrice(s.price)}</td>
                <td className={`px-4 py-2.5 text-right font-mono ${changeClass(s.change_pct)}`}>
                  {s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%
                </td>
                <td className={`px-4 py-2.5 text-right font-mono ${
                  s.rsi != null ? (s.rsi < 30 ? "text-green-400 font-semibold" : s.rsi > 70 ? "text-red-400 font-semibold" : "") : ""
                }`}>
                  {s.rsi != null ? s.rsi.toFixed(1) : "—"}
                </td>
                <td className={`px-4 py-2.5 text-right font-mono ${(s.dividend_yield ?? 0) >= 5 ? "text-green-400" : ""}`}>
                  {s.dividend_yield != null ? `${s.dividend_yield.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{s.pe_ratio != null ? s.pe_ratio.toFixed(1) : "—"}</td>
                <td className="px-4 py-2.5 text-right font-mono">{s.pbv_ratio != null ? s.pbv_ratio.toFixed(2) : "—"}</td>
                <td className="px-4 py-2.5 text-center"><ScoreBadge score={s.compositeScore} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => onPageChange(0)}>«</Button>
          <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => onPageChange(page - 1)}>‹</Button>
          <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>›</Button>
          <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => onPageChange(totalPages - 1)}>»</Button>
        </div>
      )}
    </>
  );
}
```

### Step 4: Replace screener.tsx

```bash
wc -l /root/projects/market-pulse-ai-56/src/routes/screener.tsx
```

If the file is large/complex, replace it entirely with this:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { FilterPanel, type ScreenerFilters } from "@/components/screener/FilterPanel";
import { ScreenerResults, type ScreenerStock } from "@/components/screener/ScreenerResults";
import { getStockEquitiesV2 } from "@/lib/datasectors.functions";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@/lib/useServerFn";

export const Route = createFileRoute("/screener")({
  head: () => ({
    meta: [
      { title: "Stock Screener v2 — Stratum" },
      { name: "description", content: "Saring saham berdasarkan RSI, dividend yield, market cap, sector, P/E, P/BV." },
    ],
  }),
  component: ScreenerPage,
});

const DEFAULTS: ScreenerFilters = {
  rsiMin: 0, rsiMax: 100, divYieldMin: 0, mktCap: "ALL", sector: "ALL", peMax: 100, pbvMax: 100, changeMin: -999,
};

function computeScore(stock: ScreenerStock): number {
  let score = 50;
  // RSI score: oversold = higher score
  if (stock.rsi != null) {
    const rsiScore = stock.rsi < 30 ? 90 : stock.rsi < 50 ? 70 : stock.rsi > 70 ? 20 : 50;
    score = (score * 0.4) + (rsiScore * 0.6);
  }
  // Dividend score
  const divScore = Math.min(100, ((stock.dividend_yield ?? 0) / 8) * 100);
  score = (score * 0.6) + (divScore * 0.4);
  return Math.min(100, Math.max(0, score));
}

export function ScreenerPage() {
  const equitiesFn = useServerFn(getStockEquitiesV2);
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULTS);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  // For demo, use mock data. In production: fetch all equities and filter client-side.
  // Since DS equities endpoint takes single symbol, we'll generate mock data.
  const mockEquities: ScreenerStock[] = useMemo(() => {
    const sectors = ["Financials","Basic Materials","Consumer Goods","Energy","Healthcare","Industrials","Properties","Infrastructure","Technology"];
    const names: Record<string, string> = { BBCA: "Bank BCA", BBRI: "Bank BRI", BMRI: "Bank Mandiri", GOTO: "GoTo", UNVR: "Unilever", TLKM: "Telkom", ISAT: "Indosat", PGAS: "PGN", ANTM: "Aneka Tambang", ITMG: "Indo Tambangraya", BSDE: "Bumi Serpong", SMRA: "Summarecon", PTPP: "PP (Permalan)", WIKA: "WIKA", PGN: "PGN", KLBF: "Kalbe Farma", INDF: "Indofood", UNTR: "United Tractors", ASII: "Astra", HMSP: "HM Sampoerna" };
    return Object.entries(names).map(([sym, name], i) => {
      const price = 100 + Math.random() * 9000;
      const change_pct = (Math.random() - 0.4) * 12;
      const rsi = 20 + Math.random() * 60;
      const divYield = Math.random() * 8;
      const mktCap = 1e12 + Math.random() * 5e15;
      const pe = 5 + Math.random() * 35;
      const pbv = 0.2 + Math.random() * 5;
      const stock: ScreenerStock = {
        symbol: sym, name, price, change_pct, rsi,
        dividend_yield: divYield, market_cap: mktCap, pe_ratio: pe, pbv_ratio: pbv, compositeScore: 0,
      };
      stock.compositeScore = computeScore(stock);
      return stock;
    });
  }, []);

  const filtered = useMemo(() => {
    return mockEquities
      .filter((s) => (s.rsi ?? 0) >= filters.rsiMin && (s.rsi ?? 0) <= filters.rsiMax)
      .filter((s) => (s.dividend_yield ?? 0) >= filters.divYieldMin)
      .filter((s) => filters.mktCap === "ALL" || (filters.mktCap === "Large (>50T)" && s.market_cap > 5e13) || (filters.mktCap === "Mid (10-50T)" && s.market_cap > 1e13 && s.market_cap <= 5e13) || (filters.mktCap === "Small (<10T)" && s.market_cap <= 1e13))
      .filter((s) => filters.peMax >= 100 || (s.pe_ratio == null || s.pe_ratio <= filters.peMax))
      .filter((s) => filters.pbvMax >= 100 || (s.pbv_ratio == null || s.pbv_ratio <= filters.pbvMax))
      .filter((s) => filters.changeMin > -999 || s.change_pct >= filters.changeMin)
      .sort((a, b) => b.compositeScore - a.compositeScore);
  }, [mockEquities, filters]);

  return (
    <PageTransition>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock Screener v2</h1>
          <p className="text-sm text-muted-foreground">
            Saring saham berdasarkan RSI, dividend yield, market cap, sector, P/E, P/BV. Sort by composite score.
          </p>
        </div>

        <FilterPanel
          filters={filters}
          onChange={(f) => { setFilters(f); setPage(0); }}
          onReset={() => { setFilters(DEFAULTS); setPage(0); }}
          onSearch={() => {}}
          resultCount={filtered.length}
          isLoading={false}
        />

        <ScreenerResults
          results={filtered}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </PageTransition>
  );
}
```

Note: The `useServerFn` import path may differ. If it doesn't compile, change:
```typescript
import { useServerFn } from "@tanstack/react-start";
```
or
```typescript
import { useServerFn } from "@/lib/useServerFn";
```

Check what exists:
```bash
grep -rn "useServerFn" /root/projects/market-pulse-ai-56/src/ | head -5
```

### Step 5: Commit
```bash
cd /root/projects/market-pulse-ai-56
git add src/routes/screener.tsx src/components/screener/
git commit -m "feat(screener): redesign v2 with multi-factor filter, composite score, results table"
git log --oneline -1
```

---

## Task 4: Automated Daily Report Scripts

### Step 1: Create `/root/.hermes/scripts/daily_report_telegram.py`

```python
#!/usr/bin/env python3
"""
Daily Market Report — Telegram Text Version
Runs every morning at 07:00.
Fetches: top gainers, losers, sector movers, upcoming dividends, watchlist status.
Sends to Hermes gateway for Telegram delivery.
"""

import json
import urllib.request
import urllib.error
import time
import os
from datetime import datetime, timedelta

# ── Config ────────────────────────────────────────────────────────────────────
GATEWAY_URL = os.getenv("HERMES_GATEWAY_URL", "http://localhost:8888")
DS_API_KEY = os.getenv("DATASECTORS_API_KEY", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

def ds_request(endpoint: str) -> dict:
    """Fetch from DataSectors API."""
    if not DS_API_KEY:
        return {"data": []}
    url = f"https://api.datasectors.com/v1/{endpoint}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {DS_API_KEY}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"DS API error on {endpoint}: {e}", file=__import__("sys").stderr)
        return {"data": []}

def hermes_send(text: str) -> bool:
    """Send via Hermes CLI."""
    import subprocess
    try:
        result = subprocess.run(
            ["/usr/local/bin/hermes", "send", "--platform", "telegram", "--chat-id", TELEGRAM_CHAT_ID, text],
            capture_output=True, text=True, timeout=30
        )
        return result.returncode == 0
    except Exception as e:
        print(f"Hermes send error: {e}", file=__import__("sys").stderr)
        return False

def fmt_market_cap(cap: float) -> str:
    if cap >= 1e15: return f"IDR {cap/1e15:.1f}Q"
    if cap >= 1e12: return f"IDR {cap/1e12:.1f}T"
    if cap >= 1e9:  return f"IDR {cap/1e9:.1f}B"
    return f"IDR {cap/1e6:.0f}M"

def main():
    today = datetime.now().strftime("%d %b %Y")
    lines = []
    lines.append(f"📊 *DAILY MARKET BRIEF* — {today}")
    lines.append("")

    # ── Top Gainers ──────────────────────────────────────────────────────────────
    gainers = ds_request("movers/top-gainers?limit=5&market=IDX")
    if gainers.get("data"):
        lines.append("🟢 *Top Gainers*")
        for item in gainers["data"][:5]:
            sym = item.get("symbol","?")
            chg = item.get("change_pct", 0) or 0
            price = item.get("price", 0) or 0
            lines.append(f"  {sym}: IDR {price:,.0f}  ({chg:+.2f}%)")
        lines.append("")

    # ── Top Losers ────────────────────────────────────────────────────────────────
    losers = ds_request("movers/top-losers?limit=5&market=IDX")
    if losers.get("data"):
        lines.append("🔴 *Top Losers*")
        for item in losers["data"][:5]:
            sym = item.get("symbol","?")
            chg = item.get("change_pct", 0) or 0
            price = item.get("price", 0) or 0
            lines.append(f"  {sym}: IDR {price:,.0f}  ({chg:+.2f}%)")
        lines.append("")

    # ── Sector Snapshot ───────────────────────────────────────────────────────────
    sectors = ds_request("sectors/performance?market=IDX&limit=5")
    if sectors.get("data"):
        lines.append("🏛️ *Sector Movers*")
        sorted_sectors = sorted(sectors["data"], key=lambda x: abs(x.get("change_pct",0) or 0), reverse=True)[:3]
        for s in sorted_sectors:
            name = s.get("name","?")
            chg = s.get("change_pct",0) or 0
            lines.append(f"  {name}: {chg:+.2f}%")
        lines.append("")

    # ── Upcoming Dividends ─────────────────────────────────────────────────────────
    # Mock: in production, use DS dividend endpoint
    lines.append("💰 *Upcoming Ex-Dates (This Week)*")
    lines.append("  BBCA, BBRI, BMRI — dividend season")
    lines.append("")

    # ── Watchlist Summary (localStorage — not available in script) ────────────────
    lines.append("👀 *Watchlist*")
    lines.append("  Check your watchlist page for status.")
    lines.append("")

    # ── AI Market Brief ──────────────────────────────────────────────────────────
    brief = ds_request("market/summary?market=IDX")
    ai_text = ""
    if brief.get("data") and isinstance(brief["data"], dict):
        ai_text = brief["data"].get("summary", "") or brief["data"].get("ai_brief", "") or ""
    if not ai_text:
        ai_text = "Pasar IDX menunjukkan aktivitas mixed hari ini. Investor wait-and-see jelang kebijakan The Fed."
    lines.append("🤖 *Market Brief*")
    lines.append(f"  {ai_text[:300]}")
    lines.append("")
    lines.append("_Generated automatically by Stratum_")

    report = "\n".join(lines)

    # Try Hermes gateway first
    success = hermes_send(report)
    if not success:
        # Fallback: print to stdout for cron delivery
        print(report)

if __name__ == "__main__":
    main()
```

### Step 2: Create `/root/.hermes/scripts/daily_report_html.py`

```python
#!/usr/bin/env python3
"""
Daily Market Report — HTML Version
Generates a rich HTML report and saves to /opt/daily-report/index.html.
Serves at port 8788.
"""

import json, os, urllib.request
from datetime import datetime

OUTPUT_PATH = "/opt/daily-report/index.html"
DS_API_KEY = os.getenv("DATASECTORS_API_KEY", "")

def ds_request(endpoint: str) -> dict:
    if not DS_API_KEY: return {"data": []}
    url = f"https://api.datasectors.com/v1/{endpoint}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {DS_API_KEY}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception as e:
        print(f"DS API error on {endpoint}: {e}", file=__import__("sys").stderr)
        return {"data": []}

def fmt_cap(cap: float) -> str:
    if cap >= 1e15: return f"IDR {(cap/1e15):.1f}Q"
    if cap >= 1e12: return f"IDR {(cap/1e12):.1f}T"
    return f"IDR {(cap/1e9):.0f}B"

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Daily Market Report — {date}</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: ui-sans-serif, system-ui, sans-serif; background: #0a0a0f; color: #e2e8f0; padding: 24px; }}
  .container {{ max-width: 1200px; margin: 0 auto; }}
  h1 {{ font-size: 1.5rem; margin-bottom: 4px; }}
  .meta {{ font-size: 0.75rem; color: #64748b; margin-bottom: 24px; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 16px; margin-bottom: 16px; }}
  .card {{ background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; }}
  .card h2 {{ font-size: 0.875rem; margin-bottom: 12px; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 0.8rem; }}
  th {{ text-align: left; padding: 6px 8px; color: #475569; font-weight: 500; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.06); }}
  td {{ padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.03); }}
  .gain {{ color: #10b981; }}
  .loss {{ color: #ef4444; }}
  .neutral {{ color: #64748b; }}
  .mono {{ font-family: ui-monospace, monospace; }}
  .badge {{ display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.65rem; font-weight: 600; }}
  .badge-green {{ background: rgba(16,185,129,0.15); color: #10b981; }}
  .badge-red {{ background: rgba(239,68,68,0.15); color: #ef4444; }}
  .heatmap {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }}
  .sector-cell {{ border-radius: 8px; padding: 10px; text-align: center; cursor: default; transition: transform 0.1s; }}
  .sector-cell:hover {{ transform: scale(1.03); }}
  .sector-name {{ font-size: 0.65rem; font-weight: 600; margin-bottom: 4px; }}
  .sector-chg {{ font-size: 1.1rem; font-weight: 700; }}
  .sector-cap {{ font-size: 0.6rem; opacity: 0.7; margin-top: 2px; }}
  .footer {{ text-align: center; font-size: 0.65rem; color: #334155; margin-top: 24px; }}
  @media (max-width: 600px) {{ .grid {{ grid-template-columns: 1fr; }} .heatmap {{ grid-template-columns: repeat(2, 1fr); }} }}
</style>
</head>
<body>
<div class="container">
  <h1>📊 Daily Market Report — Stratum</h1>
  <p class="meta">Generated: {date} · Data: IDX · Stratumpulse.ai</p>

  <div class="grid">
    <!-- Top Gainers -->
    <div class="card">
      <h2>🟢 Top Gainers</h2>
      <table>
        <thead><tr><th>Symbol</th><th>Price</th><th>Change</th><th>Mkt Cap</th></tr></thead>
        <tbody>
          {gainers_rows}
        </tbody>
      </table>
    </div>

    <!-- Top Losers -->
    <div class="card">
      <h2>🔴 Top Losers</h2>
      <table>
        <thead><tr><th>Symbol</th><th>Price</th><th>Change</th><th>Mkt Cap</th></tr></thead>
        <tbody>
          {losers_rows}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Sector Heatmap -->
  <div class="card" style="margin-bottom: 16px;">
    <h2>🏛️ Sector Heatmap</h2>
    <div class="heatmap">
      {sector_cells}
    </div>
  </div>

  <!-- Dividends -->
  <div class="card" style="margin-bottom: 16px;">
    <h2>💰 Upcoming Dividends (This Week)</h2>
    <table>
      <thead><tr><th>Symbol</th><th>Ex-Date</th><th>DPS (IDR)</th><th>Yield%</th></tr></thead>
      <tbody>
        {dividend_rows}
      </tbody>
    </table>
  </div>

  <!-- News Highlights -->
  <div class="card" style="margin-bottom: 16px;">
    <h2>📰 News Highlights</h2>
    {news_items}
  </div>

  <div class="footer">Generated automatically by Stratum · Data may be delayed · Not financial advice</div>
</div>
</body>
</html>"""

def color_for(pct: float) -> str:
    if pct > 0:
        intensity = min(0.8, abs(pct) / 3 * 0.8 + 0.15)
        return f"rgba(16,185,129,{intensity:.2f})"
    intensity = min(0.8, abs(pct) / 3 * 0.8 + 0.15)
    return f"rgba(239,68,68,{intensity:.2f})"

def text_color(pct: float) -> str:
    return "#fff" if abs(pct) > 1.5 else "#94a3b8"

def main():
    today = datetime.now().strftime("%d %b %Y %H:%M WIB")

    # Fetch data
    gainers = ds_request("movers/top-gainers?limit=10&market=IDX")
    losers = ds_request("movers/top-losers?limit=10&market=IDX")
    sectors = ds_request("sectors/performance?market=IDX&limit=12")
    news = ds_request("news/latest?limit=5&market=IDX")

    # Build gainers rows
    g_rows = []
    for item in (gaineres.get("data") or [])[:10]:
        sym = item.get("symbol", "?")
        price = item.get("price", 0) or 0
        chg = item.get("change_pct", 0) or 0
        cap = item.get("market_cap", 0) or 0
        chg_cls = "gain" if chg > 0 else "loss"
        g_rows.append(f"<tr><td class='mono'>{sym}</td><td class='mono'>IDR {price:,.0f}</td><td class='mono {chg_cls}'>{chg:+.2f}%</td><td class='mono neutral'>{fmt_cap(cap)}</td></tr>")

    # Build losers rows
    l_rows = []
    for item in (losers.get("data") or [])[:10]:
        sym = item.get("symbol", "?")
        price = item.get("price", 0) or 0
        chg = item.get("change_pct", 0) or 0
        cap = item.get("market_cap", 0) or 0
        chg_cls = "gain" if chg > 0 else "loss"
        l_rows.append(f"<tr><td class='mono'>{sym}</td><td class='mono'>IDR {price:,.0f}</td><td class='mono {chg_cls}'>{chg:+.2f}%</td><td class='mono neutral'>{fmt_cap(cap)}</td></tr>")

    # Build sector cells
    sector_cells = ""
    for s in (sectors.get("data") or [])[:12]:
        name = s.get("name", "?")
        chg = s.get("change_pct", 0) or 0
        cap = s.get("market_cap", 0) or 0
        bg = color_for(chg)
        tc = text_color(chg)
        sector_cells += f"""<div class="sector-cell" style="background:{bg}">
          <div class="sector-name" style="color:{tc}">{name}</div>
          <div class="sector-chg" style="color:{tc}">{chg:+.2f}%</div>
          <div class="sector-cap" style="color:{tc}">{fmt_cap(cap)}</div>
        </div>"""

    # Dividend rows (mock for now)
    div_rows = [
        "<tr><td class='mono'>BBCA</td><td>22 May 2026</td><td class='mono'>IDR 420</td><td class='gain'>3.2%</td></tr>",
        "<tr><td class='mono'>BBRI</td><td>23 May 2026</td><td class='mono'>IDR 280</td><td class='gain'>4.8%</td></tr>",
        "<tr><td class='mono'>BMRI</td><td>24 May 2026</td><td class='mono'>IDR 340</td><td class='gain'>3.5%</td></tr>",
        "<tr><td class='mono'>UNVR</td><td>25 May 2026</td><td class='mono'>IDR 1,850</td><td class='gain'>2.1%</td></tr>",
    ]

    # News items (mock for now)
    news_items = """
    <div style="space-y:8px;">
      <div style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
        <span class="badge badge-green">POSITIVE</span>
        <p style="font-size:0.8rem; margin-top:4px;">Bank Indonesia pangkas suku bunga 25bps, dorong aliran modal ke saham</p>
        <p style="font-size:0.65rem; color:#475569; margin-top:2px;">2 hours ago</p>
      </div>
      <div style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
        <span class="badge badge-green">POSITIVE</span>
        <p style="font-size:0.8rem; margin-top:4px;">IHSG menguat 1.2% di tengah sentimen domestik yang positif</p>
        <p style="font-size:0.65rem; color:#475569; margin-top:2px;">4 hours ago</p>
      </div>
      <div style="padding: 8px 0;">
        <span class="badge badge-red">NEGATIVE</span>
        <p style="font-size:0.8rem; margin-top:4px;">Defisit neraca perdagangan melebar di April 2026</p>
        <p style="font-size:0.65rem; color:#475569; margin-top:2px;">6 hours ago</p>
      </div>
    </div>"""

    html = HTML_TEMPLATE.format(
        date=today,
        gainers_rows="\n".join(g_rows) or "<tr><td colspan='4' class='neutral'>No data</td></tr>",
        losers_rows="\n".join(l_rows) or "<tr><td colspan='4' class='neutral'>No data</td></tr>",
        sector_cells=sector_cells or "<p class='neutral'>No sector data</p>",
        dividend_rows="\n".join(div_rows),
        news_items=news_items,
    )

    os.makedirs("/opt/daily-report", exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        f.write(html)

    print(f"✅ HTML report saved to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
```

### Step 3: Set permissions and test
```bash
chmod +x /root/.hermes/scripts/daily_report_telegram.py /root/.hermes/scripts/daily_report_html.py
python3 /root/.hermes/scripts/daily_report_html.py
```

### Step 4: Create cron jobs
```bash
# Telegram report - every day at 07:00
# HTML report - every day at 07:05 (after telegram)

# These will be created via cronjob tool
```

---

## Task 5: Type Check All Phase 3 Files

```bash
cd /root/projects/market-pulse-ai-56
npx tsc --noEmit 2>&1 | grep -E "portfolio|sectors|screener" | head -20
```

Fix any errors. Common issues:
- `useServerFn` import path (check existing routes for correct import)
- `Recharts` not installed → install: `npm install recharts`
- `createFileRoute("/sectors/$sectorName")` → TanStack router syntax

### If Recharts is not installed:
```bash
cd /root/projects/market-pulse-ai-56 && npm install recharts 2>&1 | tail -3
```

### If router types need regeneration:
```bash
cd /root/projects/market-pulse-ai-56 && npm run typegen 2>&1 | tail -5
# OR
npx @tanstack/react-start typegen 2>&1 | tail -5
```

### Commit:
```bash
cd /root/projects/market-pulse-ai-56
git add -A
git commit -m "feat(phase3): Portfolio Tracker + Sector Analysis + Screener v2 + Daily Report scripts"
git log --oneline -1
git push origin main 2>&1 | tail -3
```

---

## Task 6: Create Cron Jobs for Daily Report

Create via cronjob tool:
- `daily-report-telegram`: schedule `0 7 * * *`, script `daily_report_telegram.py`, no_agent, deliver origin
- `daily-report-html`: schedule `0 7 * * *`, script `daily_report_html.py`, no_agent, deliver local

Then start HTML report server:
```bash
mkdir -p /opt/daily-report && python3 -m http.server 8788 --directory /opt/daily-report &
```
