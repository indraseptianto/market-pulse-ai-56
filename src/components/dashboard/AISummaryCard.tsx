import { GlassCard } from "@/components/common/GlassCard";
import { Sparkles, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getMarketSummary } from "@/lib/ai.functions";
import type { Equity } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function AISummaryCard({ equities }: { equities: Equity[] }) {
  const fn = useServerFn(getMarketSummary);
  const mutation = useMutation({
    mutationFn: async () => {
      const gainers = [...equities]
        .sort((a, b) => b.change_pct - a.change_pct)
        .slice(0, 5)
        .map((e) => ({ symbol: e.symbol, change_pct: e.change_pct }));
      const losers = [...equities]
        .sort((a, b) => a.change_pct - b.change_pct)
        .slice(0, 5)
        .map((e) => ({ symbol: e.symbol, change_pct: e.change_pct }));
      const map = new Map<string, { sum: number; count: number }>();
      equities.forEach((e) => {
        const m = map.get(e.sector) || { sum: 0, count: 0 };
        m.sum += e.change_pct;
        m.count += 1;
        map.set(e.sector, m);
      });
      const sectors = [...map.entries()].map(([name, v]) => ({
        name,
        change_pct: v.sum / v.count,
      }));
      return fn({ data: { gainers, losers, sectors } });
    },
  });

  useEffect(() => {
    if (equities.length > 0 && !mutation.data && !mutation.isPending) {
      mutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equities.length]);

  return (
    <GlassCard className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--gradient-primary)" }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">AI Market Briefing</div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Powered by Lovable AI
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
        <div className="mt-4 min-h-[88px] text-sm leading-relaxed text-foreground/90">
          {mutation.isPending && !mutation.data ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating institutional briefing…
            </div>
          ) : mutation.data ? (
            <motion.p
              key={mutation.data.text}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {mutation.data.text}
            </motion.p>
          ) : (
            <span className="text-muted-foreground">
              Briefing will appear once data loads.
            </span>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
