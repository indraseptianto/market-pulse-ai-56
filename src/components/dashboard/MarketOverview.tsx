import { GlassCard } from "@/components/common/GlassCard";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { ArrowDownRight, ArrowUpRight, Activity, BarChart3 } from "lucide-react";
import { fmtCompact } from "@/lib/formatters";
import type { Equity } from "@/lib/mock-data";

export function MarketOverview({ equities }: { equities: Equity[] }) {
  const total = equities.length;
  const advancers = equities.filter((e) => e.change_pct > 0).length;
  const decliners = equities.filter((e) => e.change_pct < 0).length;
  const breadth = total ? (advancers / total) * 100 : 0;
  const totalVolume = equities.reduce((s, e) => s + (e.volume || 0), 0);
  const totalCap = equities.reduce((s, e) => s + (e.market_cap || 0), 0);
  const avgChange =
    total ? equities.reduce((s, e) => s + (e.change_pct || 0), 0) / total : 0;

  const stats = [
    {
      label: "Market Breadth",
      icon: Activity,
      value: <AnimatedNumber value={breadth} digits={1} suffix="%" />,
      hint: `${advancers} up · ${decliners} down`,
      tone: breadth >= 50 ? "text-gain" : "text-loss",
    },
    {
      label: "Avg Change",
      icon: avgChange >= 0 ? ArrowUpRight : ArrowDownRight,
      value: <AnimatedNumber value={avgChange} digits={2} suffix="%" />,
      hint: "Across tracked equities",
      tone: avgChange >= 0 ? "text-gain" : "text-loss",
    },
    {
      label: "Total Volume",
      icon: BarChart3,
      value: <span>{fmtCompact(totalVolume)}</span>,
      hint: "Shares traded",
      tone: "text-foreground",
    },
    {
      label: "Total Market Cap",
      icon: BarChart3,
      value: <span>{fmtCompact(totalCap)}</span>,
      hint: "IDR aggregate",
      tone: "text-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <GlassCard key={s.label}>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{s.label}</span>
            <s.icon className={`h-4 w-4 ${s.tone}`} />
          </div>
          <div className={`mt-3 text-2xl font-semibold num ${s.tone}`}>
            {s.value}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{s.hint}</div>
        </GlassCard>
      ))}
    </div>
  );
}
