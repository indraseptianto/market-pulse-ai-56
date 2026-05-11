import { useMemo } from "react";
import { GlassCard } from "@/components/common/GlassCard";
import { TrendingUp, TrendingDown, Minus, Users } from "lucide-react";
import type { OwnershipRecord } from "@/services/ownership/ownershipTypes";

interface Props {
  record: OwnershipRecord;
  compact?: boolean;
}

function FloatGauge({ value }: { value: number }) {
  const color =
    value >= 40 ? "#10b981" : value >= 20 ? "#f59e0b" : "#ef4444";
  const label =
    value >= 40 ? "High" : value >= 20 ? "Medium" : "Low";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Free Float</span>
        <span className="font-semibold num" style={{ color }}>
          {value.toFixed(2)}% · {label}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-accent/40">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, value)}%`, background: color }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

export function FreeFloatCard({ record, compact = false }: Props) {
  const history = record.freeFloatHistory;
  const current = record.currentFreeFloat;

  const trend = useMemo(() => {
    if (history.length < 2) return null;
    const diff = history[0].percentage - history[1].percentage;
    return diff;
  }, [history]);

  if (compact) {
    return (
      <div className="rounded-xl border border-border/50 bg-background/40 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Free Float</span>
          {trend != null && (
            <span className={`text-[10px] flex items-center gap-0.5 ${trend > 0 ? "text-gain" : trend < 0 ? "text-loss" : "text-muted-foreground"}`}>
              {trend > 0 ? <TrendingUp className="h-3 w-3" /> : trend < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {trend > 0 ? "+" : ""}{trend.toFixed(2)}%
            </span>
          )}
        </div>
        {current != null && <FloatGauge value={current} />}
        {record.currentShareholders != null && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" />
            {record.currentShareholders.toLocaleString("id-ID")} shareholders
          </div>
        )}
      </div>
    );
  }

  return (
    <GlassCard>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4 text-primary" />
          Free Float Analytics
        </div>
        {trend != null && (
          <span className={`flex items-center gap-1 text-xs font-medium ${trend > 0 ? "text-gain" : trend < 0 ? "text-loss" : "text-muted-foreground"}`}>
            {trend > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : trend < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
            {trend > 0 ? "+" : ""}{trend.toFixed(2)}% vs prev period
          </span>
        )}
      </div>

      {current != null && (
        <div className="mb-4">
          <FloatGauge value={current} />
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current Float</div>
          <div className="mt-0.5 text-sm font-semibold num text-primary">
            {current != null ? `${current.toFixed(2)}%` : "—"}
          </div>
        </div>
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Shareholders</div>
          <div className="mt-0.5 text-sm font-semibold num">
            {record.currentShareholders != null
              ? record.currentShareholders.toLocaleString("id-ID")
              : "—"}
          </div>
        </div>
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Non-Float</div>
          <div className="mt-0.5 text-sm font-semibold num">
            {current != null ? `${(100 - current).toFixed(2)}%` : "—"}
          </div>
        </div>
      </div>

      {/* History table */}
      {history.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Float History
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 text-left">
                  <th className="pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Period</th>
                  <th className="pb-1.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Float %</th>
                  <th className="pb-1.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Shareholders</th>
                  <th className="pb-1.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Change</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-b border-border/20 hover:bg-accent/20">
                    <td className="py-1.5 text-muted-foreground">{h.period}</td>
                    <td className="py-1.5 text-right font-semibold num">{h.percentage.toFixed(2)}%</td>
                    <td className="py-1.5 text-right num">
                      {h.numberOfShareholders.toLocaleString("id-ID")}
                    </td>
                    <td className={`py-1.5 text-right num ${h.shareholderChange != null && h.shareholderChange > 0 ? "text-gain" : h.shareholderChange != null && h.shareholderChange < 0 ? "text-loss" : "text-muted-foreground"}`}>
                      {h.shareholderChange != null
                        ? `${h.shareholderChange > 0 ? "+" : ""}${h.shareholderChange.toLocaleString("id-ID")}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
