import { useState } from "react";
import { GlassCard } from "@/components/common/GlassCard";
import { BarChart2 } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import type { OwnershipRecord } from "@/services/ownership/ownershipTypes";

interface Props {
  record: OwnershipRecord;
}

const TYPE_COLORS: Record<string, string> = {
  government: "#38bdf8",
  institutional: "#10b981",
  insider: "#f59e0b",
  public: "#a78bfa",
  foreign: "#f472b6",
  treasury: "#64748b",
  other: "#94a3b8",
};

const TYPE_LABELS: Record<string, string> = {
  government: "Government",
  institutional: "Institutional",
  insider: "Insider",
  public: "Public Float",
  foreign: "Foreign",
  treasury: "Treasury",
  other: "Other",
};

export function OwnershipBreakdownTable({ record }: Props) {
  const [view, setView] = useState<"pie" | "bar" | "table">("pie");
  const { shareholders, analytics } = record;

  // Build pie data from analytics
  const pieData = [
    { name: "Government", value: analytics.governmentPct, color: TYPE_COLORS.government },
    { name: "Institutional", value: analytics.institutionalPct, color: TYPE_COLORS.institutional },
    { name: "Insider", value: analytics.insiderPct, color: TYPE_COLORS.insider },
    { name: "Public Float", value: analytics.publicPct, color: TYPE_COLORS.public },
    { name: "Foreign", value: analytics.foreignPct, color: TYPE_COLORS.foreign },
    { name: "Treasury", value: analytics.treasuryPct, color: TYPE_COLORS.treasury },
  ].filter((d) => d.value > 0);

  // Bar data — top shareholders
  const barData = shareholders
    .filter((s) => !s.isTreasury)
    .slice(0, 8)
    .map((s) => ({
      name: s.normalizedName.length > 20 ? s.normalizedName.slice(0, 18) + "…" : s.normalizedName,
      pct: s.percentage,
      color: TYPE_COLORS[s.type] ?? TYPE_COLORS.other,
    }));

  return (
    <GlassCard>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BarChart2 className="h-4 w-4 text-primary" />
          Ownership Breakdown
        </div>
        <div className="flex gap-1">
          {(["pie", "bar", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] capitalize transition ${
                view === v
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Pie view */}
      {view === "pie" && (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {pieData.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(2)}%`, ""]}
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: "11px",
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(v) => (
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>{v}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}

      {/* Bar view */}
      {view === "bar" && (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
            />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(2)}%`, "Ownership"]}
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: "11px",
              }}
            />
            <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
              {barData.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Table view */}
      {view === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/40 text-left">
                <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground">#</th>
                <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Shareholder</th>
                <th className="pb-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Type</th>
                <th className="pb-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Shares</th>
                <th className="pb-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">%</th>
              </tr>
            </thead>
            <tbody>
              {shareholders.map((s, i) => (
                <tr key={i} className="border-b border-border/20 hover:bg-accent/20 transition-colors">
                  <td className="py-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: TYPE_COLORS[s.type] ?? "#94a3b8" }}
                      />
                      <span className="font-medium">{s.normalizedName}</span>
                      {s.isTreasury && (
                        <span className="rounded-full bg-accent/40 px-1.5 text-[9px] text-muted-foreground">
                          Treasury
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 text-right">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        background: `${TYPE_COLORS[s.type] ?? "#94a3b8"}20`,
                        color: TYPE_COLORS[s.type] ?? "#94a3b8",
                      }}
                    >
                      {TYPE_LABELS[s.type] ?? s.type}
                    </span>
                  </td>
                  <td className="py-2 text-right num text-muted-foreground">
                    {s.shares > 0 ? s.shares.toLocaleString("id-ID") : "—"}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-accent/40">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, s.percentage)}%`,
                            background: TYPE_COLORS[s.type] ?? "#94a3b8",
                          }}
                        />
                      </div>
                      <span className="font-semibold num w-12 text-right">{s.percentage.toFixed(2)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary row */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {pieData.map((d) => (
          <div key={d.name} className="rounded-lg bg-background/40 px-2 py-1.5 text-center">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{d.name}</div>
            <div className="mt-0.5 text-xs font-semibold num" style={{ color: d.color }}>
              {d.value.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
