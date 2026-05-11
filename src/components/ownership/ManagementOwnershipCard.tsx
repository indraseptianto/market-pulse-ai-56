import { GlassCard } from "@/components/common/GlassCard";
import { UserCheck, Shield, Briefcase } from "lucide-react";
import type { OwnershipRecord } from "@/services/ownership/ownershipTypes";

interface Props {
  record: OwnershipRecord;
}

const ROLE_COLORS: Record<string, string> = {
  "President Director": "#38bdf8",
  "Vice President Director": "#60a5fa",
  "Director": "#818cf8",
  "President Commissioner": "#f59e0b",
  "Vice President Commissioner": "#fbbf24",
  "Commissioner": "#fcd34d",
  "Independent Commissioner": "#10b981",
  "Audit Committee": "#34d399",
};

function getRoleColor(role: string): string {
  for (const [key, color] of Object.entries(ROLE_COLORS)) {
    if (role.includes(key)) return color;
  }
  return "#94a3b8";
}

function getRoleIcon(role: string) {
  if (role.toLowerCase().includes("commissioner")) return <Shield className="h-3 w-3" />;
  if (role.toLowerCase().includes("director")) return <Briefcase className="h-3 w-3" />;
  return <UserCheck className="h-3 w-3" />;
}

export function ManagementOwnershipCard({ record }: Props) {
  const { managements, shareholders, analytics } = record;

  // Find management members who are also shareholders
  const mgmtShareholders = shareholders.filter((s) =>
    managements.some((m) => m.name.toLowerCase() === s.name.toLowerCase())
  );

  const directors = managements.filter((m) => m.isDirector);
  const commissioners = managements.filter((m) => m.isCommissioner);
  const independents = managements.filter((m) => m.isIndependent);

  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2 text-sm font-medium">
        <UserCheck className="h-4 w-4 text-primary" />
        Management & Insider Ownership
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Insider %</div>
          <div className="mt-0.5 text-sm font-semibold num text-primary">
            {analytics.insiderPct > 0 ? `${analytics.insiderPct.toFixed(1)}%` : "—"}
          </div>
        </div>
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Directors</div>
          <div className="mt-0.5 text-sm font-semibold num">{directors.length}</div>
        </div>
        <div className="rounded-lg bg-background/40 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Commissioners</div>
          <div className="mt-0.5 text-sm font-semibold num">{commissioners.length}</div>
        </div>
      </div>

      {/* Insider shareholders */}
      {mgmtShareholders.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Management Shareholders
          </div>
          <div className="space-y-1.5">
            {mgmtShareholders.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2">
                <div>
                  <div className="text-xs font-medium">{s.name}</div>
                  <div className="text-[10px] text-muted-foreground capitalize">{s.type}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold num text-primary">{s.percentage.toFixed(2)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Board of Directors */}
      {directors.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Board of Directors
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {directors.map((m, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-background/40 px-3 py-2">
                <span style={{ color: getRoleColor(m.role) }}>
                  {getRoleIcon(m.role)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{m.name}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{m.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Board of Commissioners */}
      {commissioners.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Board of Commissioners
            {independents.length > 0 && (
              <span className="ml-2 rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] text-success">
                {independents.length} Independent
              </span>
            )}
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {commissioners.map((m, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-background/40 px-3 py-2">
                <span style={{ color: getRoleColor(m.role) }}>
                  {getRoleIcon(m.role)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{m.name}</div>
                  <div className="flex items-center gap-1">
                    <span className="truncate text-[10px] text-muted-foreground">{m.role}</span>
                    {m.isIndependent && (
                      <span className="shrink-0 rounded-full bg-success/15 px-1 text-[9px] text-success">Ind</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
