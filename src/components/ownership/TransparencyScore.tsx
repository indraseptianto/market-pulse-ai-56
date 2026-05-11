import { GlassCard } from "@/components/common/GlassCard";
import { ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import type { OwnershipRecord } from "@/services/ownership/ownershipTypes";

interface Props {
  record: OwnershipRecord;
  compact?: boolean;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const label =
    score >= 70 ? "Transparent" : score >= 50 ? "Moderate" : "Opaque";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--color-accent)" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
        <text x="48" y="44" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>
          {score}
        </text>
        <text x="48" y="58" textAnchor="middle" fontSize="9" fill="#94a3b8">
          /100
        </text>
      </svg>
      <span className="text-xs font-medium" style={{ color }}>{label}</span>
    </div>
  );
}

const RISK_CONFIG = {
  LOW: { label: "Low Risk", color: "text-gain", bg: "bg-success/15", icon: ShieldCheck },
  MEDIUM: { label: "Medium Risk", color: "text-warning", bg: "bg-warning/15", icon: Shield },
  HIGH: { label: "High Risk", color: "text-loss", bg: "bg-destructive/15", icon: ShieldAlert },
  VERY_HIGH: { label: "Very High Risk", color: "text-loss", bg: "bg-destructive/20", icon: ShieldAlert },
};

const OWNERSHIP_TYPE_LABELS = {
  GOVERNMENT: "Government-Controlled",
  FAMILY: "Family-Controlled",
  INSTITUTIONAL: "Institutional",
  DISPERSED: "Dispersed / Public",
  MIXED: "Mixed Ownership",
};

export function TransparencyScore({ record, compact = false }: Props) {
  const a = record.analytics;
  const risk = RISK_CONFIG[a.concentrationRisk];
  const RiskIcon = risk.icon;

  if (compact) {
    return (
      <div className="rounded-xl border border-border/50 bg-background/40 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Transparency</span>
          <span className={`text-xs font-semibold ${a.transparencyScore >= 70 ? "text-gain" : a.transparencyScore >= 50 ? "text-warning" : "text-loss"}`}>
            {a.transparencyScore}/100
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent/40">
          <div
            className="h-full rounded-full"
            style={{
              width: `${a.transparencyScore}%`,
              background: a.transparencyScore >= 70 ? "#10b981" : a.transparencyScore >= 50 ? "#f59e0b" : "#ef4444",
            }}
          />
        </div>
        <div className={`flex items-center gap-1 text-[10px] ${risk.color}`}>
          <RiskIcon className="h-3 w-3" />
          {risk.label} · {OWNERSHIP_TYPE_LABELS[a.ownershipType]}
        </div>
      </div>
    );
  }

  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Transparency & Risk Score
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <ScoreRing score={a.transparencyScore} />

        <div className="flex-1 space-y-3">
          {/* Concentration risk badge */}
          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${risk.bg} ${risk.color}`}>
            <RiskIcon className="h-3.5 w-3.5" />
            Concentration Risk: {risk.label}
          </div>

          {/* Ownership type */}
          <div className="rounded-lg bg-background/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ownership Type</div>
            <div className="mt-0.5 text-sm font-semibold">{OWNERSHIP_TYPE_LABELS[a.ownershipType]}</div>
          </div>

          {/* HHI */}
          <div className="rounded-lg bg-background/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Herfindahl Index (HHI)
            </div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-sm font-semibold num">{a.herfindahlIndex.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground">
                {a.herfindahlIndex >= 2500 ? "Highly concentrated" : a.herfindahlIndex >= 1500 ? "Moderately concentrated" : "Competitive"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Flags */}
      <div className="mt-4 flex flex-wrap gap-2">
        {a.isGovernmentControlled && (
          <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-[11px] font-medium text-blue-400">
            🏛 Government Controlled
          </span>
        )}
        {a.isFamilyControlled && (
          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-400">
            👨‍👩‍👧 Family Controlled
          </span>
        )}
        {a.isRetailFriendly && (
          <span className="rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-medium text-success">
            ✅ Retail Friendly
          </span>
        )}
        {a.hasHighInsiderOwnership && (
          <span className="rounded-full bg-orange-500/15 px-2.5 py-1 text-[11px] font-medium text-orange-400">
            ⚠ High Insider Ownership
          </span>
        )}
        {a.hasForeignMajority && (
          <span className="rounded-full bg-purple-500/15 px-2.5 py-1 text-[11px] font-medium text-purple-400">
            🌐 Foreign Majority
          </span>
        )}
      </div>

      {/* Concentration breakdown */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Top 1 Holder", value: `${a.top1Concentration.toFixed(1)}%` },
          { label: "Top 3 Holders", value: `${a.top3Concentration.toFixed(1)}%` },
          { label: "Top 5 Holders", value: `${a.top5Concentration.toFixed(1)}%` },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-background/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="mt-0.5 text-sm font-semibold num">{s.value}</div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
