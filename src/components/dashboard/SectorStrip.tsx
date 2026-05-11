import { GlassCard } from "@/components/common/GlassCard";
import { fmtPct, changeClass } from "@/lib/formatters";
import type { Equity } from "@/lib/mock-data";

export function SectorStrip({ equities }: { equities: Equity[] }) {
  const map = new Map<string, { sum: number; count: number; cap: number }>();
  for (const e of equities) {
    const m = map.get(e.sector) || { sum: 0, count: 0, cap: 0 };
    m.sum += e.change_pct;
    m.count += 1;
    m.cap += e.market_cap;
    map.set(e.sector, m);
  }
  const sectors = [...map.entries()]
    .map(([name, v]) => ({
      name,
      change_pct: v.sum / v.count,
      cap: v.cap,
    }))
    .sort((a, b) => b.change_pct - a.change_pct);

  return (
    <GlassCard>
      <div className="mb-3 flex items-center justify-between text-sm font-medium">
        <span>Sector Performance</span>
        <span className="text-xs text-muted-foreground">
          {sectors.length} sectors
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {sectors.map((s) => {
          const intensity = Math.min(1, Math.abs(s.change_pct) / 3);
          const positive = s.change_pct >= 0;
          return (
            <div
              key={s.name}
              className="rounded-xl border border-border/40 px-3 py-3 transition-transform hover:scale-[1.02]"
              style={{
                background: positive
                  ? `oklch(0.78 0.18 155 / ${0.06 + intensity * 0.18})`
                  : `oklch(0.68 0.22 22 / ${0.06 + intensity * 0.18})`,
              }}
            >
              <div className="truncate text-xs text-muted-foreground">
                {s.name}
              </div>
              <div
                className={`mt-1 text-base font-semibold num ${changeClass(s.change_pct)}`}
              >
                {fmtPct(s.change_pct)}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
