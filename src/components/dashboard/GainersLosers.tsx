import { Link } from "@tanstack/react-router";
import { GlassCard } from "@/components/common/GlassCard";
import { fmtPct, fmtPrice, changeClass } from "@/lib/formatters";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { Equity } from "@/lib/mock-data";
import { motion } from "framer-motion";

export function GainersLosers({ equities }: { equities: Equity[] }) {
  const gainers = [...equities]
    .sort((a, b) => b.change_pct - a.change_pct)
    .slice(0, 5);
  const losers = [...equities]
    .sort((a, b) => a.change_pct - b.change_pct)
    .slice(0, 5);

  const Row = ({ e, i }: { e: Equity; i: number }) => (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.04 }}
    >
      <Link
        to="/stocks/$symbol"
        params={{ symbol: e.symbol }}
        className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-accent/40"
      >
        <div className="min-w-0">
          <div className="font-mono text-sm font-semibold">{e.symbol}</div>
          <div className="truncate text-xs text-muted-foreground">{e.name}</div>
        </div>
        <div className="text-right">
          <div className="text-sm num">{fmtPrice(e.price)}</div>
          <div className={`text-xs num ${changeClass(e.change_pct)}`}>
            {fmtPct(e.change_pct)}
          </div>
        </div>
      </Link>
    </motion.div>
  );

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <GlassCard>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-gain" />
          Top Gainers
        </div>
        <div className="space-y-1">
          {gainers.map((e, i) => (
            <Row key={e.symbol} e={e} i={i} />
          ))}
        </div>
      </GlassCard>
      <GlassCard>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <TrendingDown className="h-4 w-4 text-loss" />
          Top Losers
        </div>
        <div className="space-y-1">
          {losers.map((e, i) => (
            <Row key={e.symbol} e={e} i={i} />
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
