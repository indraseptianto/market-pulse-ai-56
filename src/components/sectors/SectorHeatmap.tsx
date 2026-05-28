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
  const normalized = (clamped + 5) / 10;
  if (pct < 0) {
    const intensity = Math.min(1, Math.abs(pct) / 3);
    return `rgba(239, 68, 68, ${0.15 + intensity * 0.6})`;
  }
  const intensity = Math.min(1, pct / 3);
  return `rgba(16, 185, 129, ${0.15 + intensity * 0.6})`;
}

function getTextColor(pct: number): string {
  return Math.abs(pct) > 1.5 ? "#fff" : "#94a3b8";
}

function formatCap(cap: number): string {
  if (cap >= 1e15) return `${(cap / 1e15).toFixed(1)}Q`;
  if (cap >= 1e12) return `${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9) return `${(cap / 1e9).toFixed(1)}B`;
  return `${(cap / 1e6).toFixed(0)}M`;
}

export function SectorHeatmap({ data, timeframe, onSectorClick }: Props) {
  if (data.length === 0) {
    return <GlassCard className="p-8 text-center text-muted-foreground">No sector data available</GlassCard>;
  }

  const sorted = [...data].sort((a, b) => b.totalMarketCap - a.totalMarketCap);
  const totalCap = sorted.reduce((s, d) => s + d.totalMarketCap, 0);

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Sector Heatmap</h3>
        <span className="text-[11px] text-muted-foreground">{timeframe}</span>
      </div>
      <div className="flex items-center gap-3 mb-3 text-[10px] text-muted-foreground">
        <span className="text-red-400">■ Worst</span>
        <div className="flex gap-0.5">
          {["rgba(239,68,68,0.6)","rgba(239,68,68,0.2)","rgba(148,163,184,0.2)","rgba(16,185,129,0.2)","rgba(16,185,129,0.6)"].map((c) => (
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
              style={{ background: getColor(sector.avgChangePct), minHeight: Math.max(56, weight * 200) }}
            >
              <p className="font-semibold text-[11px] leading-tight mb-0.5 truncate" style={{ color: getTextColor(sector.avgChangePct) }}>{sector.name}</p>
              <p className="text-lg font-bold leading-tight" style={{ color: getTextColor(sector.avgChangePct) }}>
                {sector.avgChangePct > 0 ? "+" : ""}{sector.avgChangePct.toFixed(2)}%
              </p>
              <p className="text-[9px] mt-0.5 opacity-70" style={{ color: getTextColor(sector.avgChangePct) }}>{formatCap(sector.totalMarketCap)}</p>
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