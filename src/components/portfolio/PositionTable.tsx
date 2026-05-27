import { Link } from "@tanstack/react-router";
import { GlassCard } from "@/components/common/GlassCard";
import { fmtPrice, changeClass } from "@/lib/formatters";
import { Trash2 } from "lucide-react";

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
            <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No positions yet. Add your first transaction.</td></tr>
          ) : positions.map((p) => {
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
                <td className={`px-4 py-2.5 text-right font-mono font-semibold ${unrealPnL >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt(unrealPnL)}</td>
                <td className={`px-4 py-2.5 text-right font-mono ${changeClass(retPct)}`}>{retPct >= 0 ? "+" : ""}{retPct.toFixed(2)}%</td>
                <td className={`px-4 py-2.5 text-right font-mono ${p.realizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt(p.realizedPnL)}</td>
                <td className="px-4 py-2.5 text-right font-mono text-yellow-400">IDR {p.dividendsReceived.toLocaleString("id-ID")}</td>
                <td className="px-4 py-2.5">
                  <button onClick={() => onDelete(p.symbol)} className="rounded p-1 text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </GlassCard>
  );
}
