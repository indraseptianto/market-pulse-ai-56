import { createFileRoute, Link } from "@tanstack/react-router";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { changeClass } from "@/lib/formatters";
import { ArrowLeft, Building2 } from "lucide-react";
import { useState } from "react";
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

const MOCK_SECTOR_STOCKS: Record<string, Array<{
  symbol: string; name: string; price: number; change_pct: number;
  market_cap: number; pe_ratio: number | null; dividend_yield: number;
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

  const avgChange = filtered.length > 0 ? filtered.reduce((s, x) => s + x.change_pct, 0) / filtered.length : 0;
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
              {filtered.length} saham · Avg Return: <span className={changeClass(avgChange)}>{avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%</span> · Avg Yield: {avgYield.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder={`Cari saham di ${decoded}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 max-w-xs text-sm" />
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
              ) : filtered.map((s) => (
                <tr key={s.symbol} className="border-b border-border/20 hover:bg-accent/20">
                  <td className="px-4 py-2.5">
                    <Link to="/stocks/$symbol" params={{ symbol: s.symbol }}>
                      <div className="font-mono text-sm font-semibold">{s.symbol}</div>
                      <div className="truncate text-xs text-muted-foreground max-w-[160px]">{s.name}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">IDR {s.price.toLocaleString("id-ID")}</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${changeClass(s.change_pct)}`}>{s.change_pct >= 0 ? "+" : ""}{s.change_pct.toFixed(2)}%</td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{fmtCap(s.market_cap)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{s.pe_ratio ? s.pe_ratio.toFixed(1) : "—"}</td>
                  <td className={`px-4 py-2.5 text-right font-mono ${(s.dividend_yield ?? 0) >= 5 ? "text-green-400" : ""}`}>{s.dividend_yield > 0 ? `${s.dividend_yield.toFixed(1)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      </div>
    </PageTransition>
  );
}