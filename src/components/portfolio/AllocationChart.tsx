import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { GlassCard } from "@/components/common/GlassCard";

export interface AllocationItem {
  symbol: string;
  value: number;
  pct: number;
  color: string;
}

interface Props {
  data: AllocationItem[];
  totalValue: number;
}

const COLORS = ["#10b981","#38bdf8","#a78bfa","#f59e0b","#f472b6","#2dd4bf","#ef4444","#6366f1","#84cc16","#f97316"];

export function AllocationChart({ data, totalValue }: Props) {
  const chartData = data.map((d, i) => ({
    name: d.symbol,
    value: d.value,
    pct: d.pct,
    color: d.color || COLORS[i % COLORS.length],
  }));

  const fmt = (v: number) => `IDR ${v.toLocaleString("id-ID", { notation: "compact", maximumFractionDigits: 1 })}`;

  return (
    <GlassCard className="p-4">
      <h3 className="text-sm font-semibold mb-1">Allocation</h3>
      <p className="text-[11px] text-muted-foreground mb-3">
        Total: IDR {totalValue.toLocaleString("id-ID", { notation: "compact", maximumFractionDigits: 1 })}
      </p>
      {chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" strokeWidth={2}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [fmt(Number(value)), ""] as [string, string]} contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
            <Legend formatter={(value: string) => <span className="text-xs">{value}</span>} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </GlassCard>
  );
}
