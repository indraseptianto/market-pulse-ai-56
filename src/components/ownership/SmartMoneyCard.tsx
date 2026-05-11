import { GlassCard } from "@/components/common/GlassCard";
import { Zap, TrendingUp, TrendingDown, AlertTriangle, Minus } from "lucide-react";
import type { OwnershipRecord } from "@/services/ownership/ownershipTypes";
import type { SmartMoneySignal } from "@/services/ownership/ownershipService";

interface Props {
  record: OwnershipRecord;
  signal?: SmartMoneySignal;
}

const SIGNAL_CONFIG = {
  BULLISH: {
    label: "Bullish",
    color: "text-gain",
    bg: "bg-success/15",
    border: "border-success/30",
    icon: TrendingUp,
  },
  BEARISH: {
    label: "Bearish",
    color: "text-loss",
    bg: "bg-destructive/15",
    border: "border-destructive/30",
    icon: TrendingDown,
  },
  CAUTION: {
    label: "Caution",
    color: "text-warning",
    bg: "bg-warning/15",
    border: "border-warning/30",
    icon: AlertTriangle,
  },
  NEUTRAL: {
    label: "Neutral",
    color: "text-muted-foreground",
    bg: "bg-accent/20",
    border: "border-border/50",
    icon: Minus,
  },
};

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold num" style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent/40">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function SmartMoneyCard({ record, signal }: Props) {
  const a = record.analytics;
  const sig = signal?.signal ?? "NEUTRAL";
  const cfg = SIGNAL_CONFIG[sig];
  const SignalIcon = cfg.icon;

  // Compute sub-scores
  const institutionalScore = Math.min(100, Math.round(
    (a.institutionalPct + a.governmentPct) * 1.2
  ));
  const floatScore = Math.min(100, Math.round(
    (record.currentFreeFloat ?? 0) * 1.5
  ));
  const concentrationScore = Math.max(0, 100 - Math.round(a.top1Concentration));
  const transparencyScore = a.transparencyScore;

  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2 text-sm font-medium">
        <Zap className="h-4 w-4 text-primary" />
        Smart Money Intelligence
      </div>

      {/* Signal banner */}
      <div className={`mb-4 flex items-center gap-3 rounded-xl border p-3 ${cfg.bg} ${cfg.border}`}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
          <SignalIcon className={`h-5 w-5 ${cfg.color}`} />
        </div>
        <div>
          <div className={`text-sm font-semibold ${cfg.color}`}>
            {cfg.label} Signal
          </div>
          <div className="text-xs text-muted-foreground">
            {signal?.reason ?? "Analyzing ownership structure…"}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-bold num" style={{
            color: a.smartMoneyScore >= 60 ? "#10b981" : a.smartMoneyScore >= 40 ? "#f59e0b" : "#ef4444"
          }}>
            {a.smartMoneyScore}
          </div>
          <div className="text-[10px] text-muted-foreground">Score</div>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="space-y-3 mb-4">
        <ScoreBar
          label="Institutional Support"
          value={institutionalScore}
          color="#38bdf8"
        />
        <ScoreBar
          label="Float Liquidity"
          value={floatScore}
          color="#10b981"
        />
        <ScoreBar
          label="Concentration Safety"
          value={concentrationScore}
          color="#a78bfa"
        />
        <ScoreBar
          label="Transparency"
          value={transparencyScore}
          color="#f59e0b"
        />
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Institutional Dom.</div>
          <div className={`mt-0.5 text-sm font-semibold ${
            a.institutionalDominance === "HIGH" ? "text-gain"
            : a.institutionalDominance === "MEDIUM" ? "text-warning"
            : "text-muted-foreground"
          }`}>
            {a.institutionalDominance}
          </div>
        </div>
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Inst. + Gov. %</div>
          <div className="mt-0.5 text-sm font-semibold num">
            {(a.institutionalPct + a.governmentPct).toFixed(1)}%
          </div>
        </div>
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Foreign %</div>
          <div className="mt-0.5 text-sm font-semibold num">
            {a.foreignPct > 0 ? `${a.foreignPct.toFixed(1)}%` : "—"}
          </div>
        </div>
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Public %</div>
          <div className="mt-0.5 text-sm font-semibold num">
            {a.publicPct > 0 ? `${a.publicPct.toFixed(1)}%` : "—"}
          </div>
        </div>
      </div>

      {/* Risk warnings */}
      {(a.concentrationRisk === "HIGH" || a.concentrationRisk === "VERY_HIGH") && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
          <div className="text-xs text-warning">
            <strong>Concentration Risk:</strong> Top holder controls {a.top1Concentration.toFixed(1)}% of shares.
            {(record.currentFreeFloat ?? 100) < 20 && " Combined with low free float, this creates significant liquidity risk."}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
