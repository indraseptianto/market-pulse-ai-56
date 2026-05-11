import { GlassCard } from "@/components/common/GlassCard";
import { Sparkles, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStockAnalysis } from "@/lib/ai.functions";
import type { Equity } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

export function AIAnalysis({ equity }: { equity: Equity }) {
  const fn = useServerFn(getStockAnalysis);
  const m = useMutation({
    mutationFn: () =>
      fn({
        data: {
          symbol: equity.symbol,
          name: equity.name,
          price: equity.price,
          change_pct: equity.change_pct,
          sector: equity.sector,
          pe_ratio: equity.pe_ratio ?? null,
          roe: equity.roe ?? null,
          debt_to_equity: equity.debt_to_equity ?? null,
          dividend_yield: equity.dividend_yield ?? null,
        },
      }),
  });

  useEffect(() => {
    m.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equity.symbol]);

  return (
    <GlassCard className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--gradient-primary)" }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold">AI Analyst Note</div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "…" : "Refresh"}
          </Button>
        </div>
        <div className="mt-4 min-h-[96px] text-sm leading-relaxed text-foreground/90">
          {m.isPending && !m.data ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analyzing {equity.symbol}…
            </div>
          ) : (
            m.data?.text
          )}
        </div>
      </div>
    </GlassCard>
  );
}
