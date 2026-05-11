import { useMemo } from "react";
import { GlassCard } from "@/components/common/GlassCard";
import { Lightbulb, AlertTriangle, CheckCircle, Info } from "lucide-react";
import type { OwnershipRecord } from "@/services/ownership/ownershipTypes";

interface Props {
  record: OwnershipRecord;
}

type InsightLevel = "positive" | "warning" | "info" | "negative";

interface Insight {
  level: InsightLevel;
  title: string;
  description: string;
}

const LEVEL_CONFIG: Record<InsightLevel, { icon: typeof CheckCircle; color: string; bg: string; border: string }> = {
  positive: { icon: CheckCircle, color: "text-gain", bg: "bg-success/10", border: "border-success/30" },
  warning: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
  negative: { icon: AlertTriangle, color: "text-loss", bg: "bg-destructive/10", border: "border-destructive/30" },
  info: { icon: Info, color: "text-primary", bg: "bg-primary/10", border: "border-primary/30" },
};

function generateInsights(record: OwnershipRecord): Insight[] {
  const a = record.analytics;
  const ff = record.currentFreeFloat ?? 0;
  const insights: Insight[] = [];

  // Free float insights
  if (ff >= 40) {
    insights.push({
      level: "positive",
      title: "Healthy Free Float",
      description: `${ff.toFixed(1)}% free float provides good liquidity for retail and institutional investors. Lower bid-ask spreads expected.`,
    });
  } else if (ff < 15) {
    insights.push({
      level: "negative",
      title: "Very Low Free Float",
      description: `Only ${ff.toFixed(1)}% of shares are freely tradeable. This creates significant liquidity risk and potential for price manipulation.`,
    });
  } else {
    insights.push({
      level: "warning",
      title: "Limited Free Float",
      description: `${ff.toFixed(1)}% free float is below the 40% threshold. Institutional investors may face difficulty building or exiting large positions.`,
    });
  }

  // Government control
  if (a.isGovernmentControlled) {
    insights.push({
      level: "info",
      title: "Government-Controlled Entity",
      description: `The government holds ${a.governmentPct.toFixed(1)}% of shares. This provides stability and policy support but may limit operational flexibility.`,
    });
  }

  // Family control
  if (a.isFamilyControlled) {
    insights.push({
      level: "warning",
      title: "Family-Controlled Company",
      description: `Concentrated family ownership (${a.insiderPct.toFixed(1)}% insider) may create governance risks. Minority shareholder interests could be secondary.`,
    });
  }

  // Concentration risk
  if (a.concentrationRisk === "VERY_HIGH") {
    insights.push({
      level: "negative",
      title: "Extreme Ownership Concentration",
      description: `The largest shareholder controls ${a.top1Concentration.toFixed(1)}% of shares. Top 3 holders control ${a.top3Concentration.toFixed(1)}%. This is a significant governance risk.`,
    });
  } else if (a.concentrationRisk === "HIGH") {
    insights.push({
      level: "warning",
      title: "High Ownership Concentration",
      description: `Top holder at ${a.top1Concentration.toFixed(1)}%. While common in Indonesian markets, this limits minority shareholder influence.`,
    });
  } else if (a.concentrationRisk === "LOW") {
    insights.push({
      level: "positive",
      title: "Well-Distributed Ownership",
      description: `No single holder dominates with the largest at ${a.top1Concentration.toFixed(1)}%. This supports better corporate governance.`,
    });
  }

  // Institutional support
  if (a.institutionalDominance === "HIGH") {
    insights.push({
      level: "positive",
      title: "Strong Institutional Backing",
      description: `${(a.institutionalPct + a.governmentPct).toFixed(1)}% held by institutions. Strong institutional support typically indicates quality and stability.`,
    });
  }

  // Foreign ownership
  if (a.hasForeignMajority) {
    insights.push({
      level: "info",
      title: "Foreign Majority Ownership",
      description: `Foreign entities control ${a.foreignPct.toFixed(1)}% of shares. This brings international capital but may expose the stock to foreign exchange and geopolitical risks.`,
    });
  } else if (a.foreignPct >= 20) {
    insights.push({
      level: "positive",
      title: "Significant Foreign Interest",
      description: `${a.foreignPct.toFixed(1)}% foreign ownership signals international investor confidence in this company.`,
    });
  }

  // Retail friendly
  if (a.isRetailFriendly) {
    insights.push({
      level: "positive",
      title: "Retail-Friendly Stock",
      description: `With ${a.publicPct.toFixed(1)}% public float and no dominant single holder, this stock is accessible and liquid for retail investors.`,
    });
  }

  // Transparency
  if (a.transparencyScore >= 70) {
    insights.push({
      level: "positive",
      title: "High Transparency Score",
      description: `Transparency score of ${a.transparencyScore}/100 indicates good ownership disclosure and dispersed structure.`,
    });
  } else if (a.transparencyScore < 40) {
    insights.push({
      level: "warning",
      title: "Low Transparency Score",
      description: `Transparency score of ${a.transparencyScore}/100 suggests concentrated ownership with limited public float. Due diligence recommended.`,
    });
  }

  return insights;
}

export function OwnershipInsights({ record }: Props) {
  const insights = useMemo(() => generateInsights(record), [record]);

  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2 text-sm font-medium">
        <Lightbulb className="h-4 w-4 text-primary" />
        Ownership Intelligence Insights
      </div>

      <div className="space-y-2.5">
        {insights.map((insight, i) => {
          const cfg = LEVEL_CONFIG[insight.level];
          const Icon = cfg.icon;
          return (
            <div
              key={i}
              className={`flex gap-3 rounded-xl border p-3 ${cfg.bg} ${cfg.border}`}
            >
              <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${cfg.color}`} />
              <div>
                <div className={`text-xs font-semibold ${cfg.color}`}>{insight.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {insight.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dividend history */}
      {record.dividends.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Dividend History
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 text-left">
                  <th className="pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Year</th>
                  <th className="pb-1.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground">DPS</th>
                  <th className="pb-1.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Payment Date</th>
                  <th className="pb-1.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Type</th>
                </tr>
              </thead>
              <tbody>
                {record.dividends.map((d, i) => (
                  <tr key={i} className="border-b border-border/20 hover:bg-accent/20">
                    <td className="py-1.5 font-medium">{d.fiscalYear}</td>
                    <td className="py-1.5 text-right num font-semibold text-gain">
                      {d.dividendPerShare.toLocaleString("id-ID")} {d.currency}
                    </td>
                    <td className="py-1.5 text-right text-muted-foreground">{d.paymentDate}</td>
                    <td className="py-1.5 text-right">
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                        {d.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
