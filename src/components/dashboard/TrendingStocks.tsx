import { Link } from "@tanstack/react-router";
import { GlassCard } from "@/components/common/GlassCard";
import type { Equity } from "@/lib/mock-data";
import { fmtPct, fmtPrice, fmtCompact, changeClass } from "@/lib/formatters";
import { Flame } from "lucide-react";
import { motion } from "framer-motion";

export function TrendingStocks({ equities }: { equities: Equity[] }) {
  const trending = [...equities]
    .sort((a, b) => Math.abs(b.change_pct) * b.volume - Math.abs(a.change_pct) * a.volume)
    .slice(0, 6);

  return (
    <GlassCard>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Flame className="h-4 w-4 text-warning" />
        Trending Stocks
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {trending.map((e, i) => (
          <motion.div
            key={e.symbol}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              to="/stocks/$symbol"
              params={{ symbol: e.symbol }}
              className="block rounded-xl border border-border/40 p-3 transition-all hover:border-primary/40 hover:bg-accent/30"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-semibold">{e.symbol}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {e.sector}
                  </div>
                </div>
                <div className={`text-xs num font-medium ${changeClass(e.change_pct)}`}>
                  {fmtPct(e.change_pct)}
                </div>
              </div>
              <div className="mt-2 flex items-end justify-between">
                <div className="text-base num font-semibold">{fmtPrice(e.price)}</div>
                <div className="text-xs text-muted-foreground">
                  Vol {fmtCompact(e.volume)}
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  );
}
