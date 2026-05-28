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
  onSortChange: (s: "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "score") => void;
}

const COLS = ["1D", "1W", "1M", "3M", "6M", "1Y"] as const;
const COL_KEYS: Record<typeof COLS[number], keyof RotationData> = {
  "1D": "change1d", "1W": "change1w", "1M": "change1m",
  "3M": "change3m", "6M": "change6m", "1Y": "change1y",
};

export function SectorRotationTable({ data, sortBy, onSortChange }: Props) {
  const sorted = [...data].sort((a, b) => {
    if (sortBy === "score") return b.momentumScore - a.momentumScore;
    return ((b[COL_KEYS[sortBy as keyof typeof COL_KEYS] as keyof RotationData] as number) || 0) - ((a[COL_KEYS[sortBy as keyof typeof COL_KEYS] as keyof RotationData] as number) || 0);
  });

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
              <th key={c} className={`px-3 py-2.5 text-right cursor-pointer ${sortBy === c ? "text-primary" : ""}`}
                onClick={() => onSortChange(c)}>
                {c}{sortBy === c ? " ▲" : ""}
              </th>
            ))}
            <th className={`px-3 py-2.5 text-right cursor-pointer ${sortBy === "score" ? "text-primary" : ""}`}
              onClick={() => onSortChange("score")}>
              Score{sortBy === "score" ? " ▲" : ""}
            </th>
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
                const val = sector[COL_KEYS[c]] as number;
                return (
                  <td key={c} className={`px-3 py-2.5 text-right font-mono text-xs ${changeClass(val)}`}>
                    {val >= 0 ? "+" : ""}{val.toFixed(2)}%
                  </td>
                );
              })}
              <td className="px-3 py-2.5 text-right">
                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-mono ${
                  sector.momentumScore >= 70 ? "border-green-500/40 text-green-400" :
                  sector.momentumScore >= 50 ? "border-yellow-500/40 text-yellow-400" :
                  "border-red-500/40 text-red-400"
                }`}>
                  {sector.momentumScore}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
  );
}