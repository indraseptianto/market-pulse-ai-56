import { GlassCard } from "@/components/common/GlassCard";
import { evaluateValuation, type ValuationInput } from "@/lib/valuation";
import { fmtPrice, fmtPct } from "@/lib/formatters";
import { Gauge, TrendingUp, TrendingDown, Minus } from "lucide-react";

export function FairValueCard(props: ValuationInput) {
  const v = evaluateValuation(props);
  const isCheap = v.verdict === "Undervalued";
  const isExpensive = v.verdict === "Overvalued";
  const tone = isCheap
    ? "text-gain border-success/40 bg-success/10"
    : isExpensive
      ? "text-loss border-destructive/40 bg-destructive/10"
      : "text-warning border-warning/40 bg-warning/10";
  const Icon = isCheap ? TrendingUp : isExpensive ? TrendingDown : Minus;

  // Score → 0..100 for the bar (centered at 50 = fair)
  const barPos = Math.max(0, Math.min(100, 50 + v.score / 2));

  return (
    <GlassCard>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Gauge className="h-4 w-4 text-primary" />
        Fair Value Estimate
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Verdict
          </div>
          <div
            className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {v.verdict}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Fair Price
          </div>
          <div className="text-lg font-semibold num">
            {v.fairPrice !== null ? fmtPrice(v.fairPrice) : "—"}
          </div>
          {v.upsidePct !== null && (
            <div
              className={`text-xs num ${v.upsidePct > 0 ? "text-gain" : v.upsidePct < 0 ? "text-loss" : "text-muted-foreground"}`}
            >
              {fmtPct(v.upsidePct)} upside
            </div>
          )}
        </div>
      </div>

      {/* Cheap ↔ Expensive bar */}
      <div className="mt-4">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-accent/40">
          <div
            className="absolute inset-y-0 left-0 right-0"
            style={{
              background:
                "linear-gradient(90deg, var(--color-success) 0%, var(--color-warning) 50%, var(--color-destructive) 100%)",
              opacity: 0.35,
            }}
          />
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow"
            style={{ left: `${barPos}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Cheap</span>
          <span>Fair</span>
          <span>Expensive</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        {v.components.map((c) => (
          <div key={c.label} className="rounded-lg bg-background/40 p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {c.label}
            </div>
            <div className="mt-0.5 num font-semibold">
              {c.value !== null ? c.value.toLocaleString() : "—"}
            </div>
            {c.note && (
              <div className="mt-0.5 text-[10px] text-muted-foreground">{c.note}</div>
            )}
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Estimasi gabungan dari Graham Number, Fair PE, dan Book-Value Anchor berdasarkan laporan
        keuangan terbaru. Bukan rekomendasi investasi.
      </p>
    </GlassCard>
  );
}
