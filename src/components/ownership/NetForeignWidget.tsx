import { GlassCard } from "@/components/common/GlassCard";
import { Globe, TrendingUp, TrendingDown } from "lucide-react";
import type { OwnershipRecord } from "@/services/ownership/ownershipTypes";

interface Props {
  record: OwnershipRecord;
  compact?: boolean;
}

export function NetForeignWidget({ record, compact = false }: Props) {
  const a = record.analytics;
  const foreignPct = a.foreignPct;
  const hasForeign = foreignPct > 0;

  // Determine foreign ownership strength
  const strength =
    foreignPct >= 30 ? "Strong" : foreignPct >= 10 ? "Moderate" : foreignPct > 0 ? "Minimal" : "None";
  const strengthColor =
    foreignPct >= 30 ? "#10b981" : foreignPct >= 10 ? "#f59e0b" : "#94a3b8";

  // Find foreign shareholders
  const foreignHolders = record.shareholders.filter((s) => s.type === "foreign");

  if (compact) {
    return (
      <div className="rounded-xl border border-border/50 bg-background/40 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Globe className="h-3.5 w-3.5 text-primary" />
            Foreign Ownership
          </div>
          <span className="text-xs font-semibold num" style={{ color: strengthColor }}>
            {hasForeign ? `${foreignPct.toFixed(1)}%` : "—"}
          </span>
        </div>
        {hasForeign && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent/40">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, foreignPct)}%`, background: strengthColor }}
            />
          </div>
        )}
        <div className="text-[10px] text-muted-foreground">
          {strength} foreign presence · {foreignHolders.length} foreign holder{foreignHolders.length !== 1 ? "s" : ""}
        </div>
      </div>
    );
  }

  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2 text-sm font-medium">
        <Globe className="h-4 w-4 text-primary" />
        Net Foreign Ownership
      </div>

      {/* Main metric */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <Globe className="h-7 w-7 text-primary" />
        </div>
        <div>
          <div className="text-3xl font-bold num" style={{ color: strengthColor }}>
            {hasForeign ? `${foreignPct.toFixed(2)}%` : "—"}
          </div>
          <div className="text-sm text-muted-foreground">
            {strength} foreign presence
          </div>
          {a.hasForeignMajority && (
            <div className="mt-1 flex items-center gap-1 text-xs text-gain">
              <TrendingUp className="h-3 w-3" />
              Foreign majority holder
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Foreign %</div>
          <div className="mt-0.5 text-sm font-semibold num" style={{ color: strengthColor }}>
            {hasForeign ? `${foreignPct.toFixed(2)}%` : "—"}
          </div>
        </div>
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Foreign Holders</div>
          <div className="mt-0.5 text-sm font-semibold num">{foreignHolders.length}</div>
        </div>
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Domestic %</div>
          <div className="mt-0.5 text-sm font-semibold num">
            {hasForeign ? `${(100 - foreignPct - a.treasuryPct).toFixed(2)}%` : "—"}
          </div>
        </div>
      </div>

      {/* Foreign holders list */}
      {foreignHolders.length > 0 ? (
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Foreign Shareholders
          </div>
          <div className="space-y-1.5">
            {foreignHolders.map((h, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">{h.normalizedName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-accent/40">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(100, h.percentage)}%`, background: strengthColor }}
                    />
                  </div>
                  <span className="text-xs font-semibold num w-12 text-right">
                    {h.percentage.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 bg-accent/10 px-4 py-3 text-sm text-muted-foreground">
          No foreign shareholders identified in the ownership structure.
        </div>
      )}

      {/* Signal */}
      {hasForeign && (
        <div className={`mt-3 flex items-center gap-2 rounded-xl border p-3 ${
          foreignPct >= 20 ? "border-success/30 bg-success/10" : "border-border/40 bg-accent/10"
        }`}>
          {foreignPct >= 20 ? (
            <TrendingUp className="h-4 w-4 text-gain" />
          ) : (
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground">
            {foreignPct >= 30
              ? "Strong foreign institutional interest — positive signal for international investors"
              : foreignPct >= 10
              ? "Moderate foreign presence — some international institutional interest"
              : "Minimal foreign ownership — primarily domestic investor base"}
          </span>
        </div>
      )}
    </GlassCard>
  );
}
