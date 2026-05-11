import { useState, useMemo } from "react";
import { GlassCard } from "@/components/common/GlassCard";
import { FreeFloatCard } from "./FreeFloatCard";
import { ManagementOwnershipCard } from "./ManagementOwnershipCard";
import { TransparencyScore } from "./TransparencyScore";
import { OwnershipBreakdownTable } from "./OwnershipBreakdownTable";
import { SmartMoneyCard } from "./SmartMoneyCard";
import { NetForeignWidget } from "./NetForeignWidget";
import { OwnershipInsights } from "./OwnershipInsights";
import { getOwnershipBySymbol } from "@/services/ownership/ownershipService";
import { getSmartMoneySignals } from "@/services/ownership/ownershipService";
import {
  Database,
  Users,
  BarChart2,
  Globe,
  Zap,
  Lightbulb,
  UserCheck,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

interface Props {
  symbol: string;
}

type Tab =
  | "overview"
  | "breakdown"
  | "management"
  | "foreign"
  | "smart"
  | "insights";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview",    label: "Overview",    icon: <Database className="h-3 w-3" /> },
  { id: "breakdown",   label: "Breakdown",   icon: <BarChart2 className="h-3 w-3" /> },
  { id: "management",  label: "Management",  icon: <UserCheck className="h-3 w-3" /> },
  { id: "foreign",     label: "Foreign",     icon: <Globe className="h-3 w-3" /> },
  { id: "smart",       label: "Smart Money", icon: <Zap className="h-3 w-3" /> },
  { id: "insights",    label: "Insights",    icon: <Lightbulb className="h-3 w-3" /> },
];

export function OwnershipIntelligencePanel({ symbol }: Props) {
  const [tab, setTab] = useState<Tab>("overview");

  const record = useMemo(() => getOwnershipBySymbol(symbol), [symbol]);
  const signal = useMemo(() => {
    if (!record) return undefined;
    return getSmartMoneySignals().find((s) => s.symbol === symbol);
  }, [record, symbol]);

  // No data state
  if (!record) {
    return (
      <GlassCard>
        <div className="flex items-center gap-2 mb-3 text-sm font-medium">
          <Database className="h-4 w-4 text-primary" />
          Ownership Intelligence
        </div>
        <div className="rounded-xl border border-border/40 bg-accent/10 px-4 py-6 text-center">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <div className="text-sm font-medium mb-1">No Ownership Data</div>
          <div className="text-xs text-muted-foreground">
            Detailed ownership intelligence is not yet available for{" "}
            <strong>{symbol}</strong> in our IDNFinancials dataset.
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">
            Available stocks: BBCA, BBRI, BMRI, TLKM, ASII, BREN, BYAN, AMMN, TPIA, DCII
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header card */}
      <GlassCard>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Database className="h-4 w-4 text-primary" />
              Ownership Intelligence — {record.symbol}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{record.companyName}</div>
          </div>
          <a
            href={record.idnFinancialsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            IDNFinancials <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Quick stats strip */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-4">
          <div className="rounded-lg bg-background/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Free Float</div>
            <div className={`mt-0.5 text-sm font-semibold num ${
              (record.currentFreeFloat ?? 0) >= 40 ? "text-gain"
              : (record.currentFreeFloat ?? 0) >= 20 ? "text-warning"
              : "text-loss"
            }`}>
              {record.currentFreeFloat != null ? `${record.currentFreeFloat.toFixed(2)}%` : "—"}
            </div>
          </div>
          <div className="rounded-lg bg-background/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Transparency</div>
            <div className={`mt-0.5 text-sm font-semibold num ${
              record.analytics.transparencyScore >= 70 ? "text-gain"
              : record.analytics.transparencyScore >= 50 ? "text-warning"
              : "text-loss"
            }`}>
              {record.analytics.transparencyScore}/100
            </div>
          </div>
          <div className="rounded-lg bg-background/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Smart Money</div>
            <div className={`mt-0.5 text-sm font-semibold num ${
              record.analytics.smartMoneyScore >= 60 ? "text-gain"
              : record.analytics.smartMoneyScore >= 40 ? "text-warning"
              : "text-loss"
            }`}>
              {record.analytics.smartMoneyScore}/100
            </div>
          </div>
          <div className="rounded-lg bg-background/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Conc. Risk</div>
            <div className={`mt-0.5 text-sm font-semibold ${
              record.analytics.concentrationRisk === "LOW" ? "text-gain"
              : record.analytics.concentrationRisk === "MEDIUM" ? "text-warning"
              : "text-loss"
            }`}>
              {record.analytics.concentrationRisk.replace("_", " ")}
            </div>
          </div>
        </div>

        {/* Compact widgets row */}
        <div className="grid gap-2 sm:grid-cols-3">
          <FreeFloatCard record={record} compact />
          <TransparencyScore record={record} compact />
          <NetForeignWidget record={record} compact />
        </div>

        {/* Tab bar */}
        <div className="mt-4 flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] transition ${
                tab === t.id
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <FreeFloatCard record={record} />
          <TransparencyScore record={record} />
        </div>
      )}

      {tab === "breakdown" && <OwnershipBreakdownTable record={record} />}

      {tab === "management" && <ManagementOwnershipCard record={record} />}

      {tab === "foreign" && <NetForeignWidget record={record} />}

      {tab === "smart" && <SmartMoneyCard record={record} signal={signal} />}

      {tab === "insights" && <OwnershipInsights record={record} />}
    </div>
  );
}
