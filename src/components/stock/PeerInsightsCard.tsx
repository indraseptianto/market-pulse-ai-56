import { GlassCard } from "@/components/common/GlassCard";
import { cn } from "@/lib/utils";
import { BadgeCheck, CircleDashed, Scale, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

type InsightStatus = "good" | "bad" | "NA";

interface InsightItem {
  key: string;
  label: string;
  value: string;
  status: InsightStatus;
  category: string;
}

const CATEGORY_META: Record<string, { label: string; icon: typeof Scale }> = {
  valuation: { label: "Valuation", icon: Scale },
  earnings: { label: "Earnings", icon: BadgeCheck },
  growth: { label: "Growth", icon: TrendingUp },
  performance: { label: "Performance", icon: Sparkles },
  health: { label: "Health", icon: ShieldCheck },
};

const CATEGORY_ORDER = ["valuation", "earnings", "growth", "performance", "health"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapPayload(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;
  if ("data" in payload) return unwrapPayload(payload.data);
  if ("insights" in payload) return unwrapPayload(payload.insights);
  return payload;
}

function titleize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function asStatus(value: unknown): InsightStatus {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "good" || normalized === "positive" || normalized === "better") return "good";
  if (normalized === "bad" || normalized === "negative" || normalized === "worse") return "bad";
  return "NA";
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "NA";
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toFixed(2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return `${value.length} items`;
  if (isRecord(value)) {
    const preferred = value.value ?? value.current ?? value.actual ?? value.metric ?? value.result ?? value.text;
    if (preferred !== undefined && preferred !== value) return formatValue(preferred);
    return "Available";
  }
  return String(value);
}

function extractItem(category: string, key: string, raw: unknown): InsightItem | null {
  if (!isRecord(raw)) {
    return {
      key,
      label: titleize(key),
      value: formatValue(raw),
      status: "NA",
      category,
    };
  }

  const status = asStatus(raw.status ?? raw.insight_status ?? raw.signal ?? raw.rating);
  const value =
    raw.value ??
    raw.current ??
    raw.actual ??
    raw.metric ??
    raw.result ??
    raw.description ??
    raw.summary ??
    raw.text;

  return {
    key,
    label: titleize(String(raw.label ?? raw.name ?? key)),
    value: formatValue(value),
    status,
    category,
  };
}

function collectInsights(payload: unknown): InsightItem[] {
  const root = unwrapPayload(payload);
  if (!isRecord(root)) return [];

  const items: InsightItem[] = [];
  for (const category of CATEGORY_ORDER) {
    const categoryPayload = root[category];
    if (!isRecord(categoryPayload) && !Array.isArray(categoryPayload)) continue;

    if (Array.isArray(categoryPayload)) {
      categoryPayload.forEach((entry, index) => {
        const key = isRecord(entry) ? String(entry.key ?? entry.metric ?? entry.name ?? `${category}-${index}`) : `${category}-${index}`;
        const item = extractItem(category, key, entry);
        if (item) items.push(item);
      });
      continue;
    }

    for (const [key, value] of Object.entries(categoryPayload)) {
      const item = extractItem(category, key, value);
      if (item) items.push(item);
    }
  }

  return items.filter((item) => item.value !== "NA").slice(0, 18);
}

function statusClass(status: InsightStatus): string {
  if (status === "good") return "border-success/30 bg-success/10 text-gain";
  if (status === "bad") return "border-destructive/30 bg-destructive/10 text-loss";
  return "border-border/50 bg-background/50 text-muted-foreground";
}

export function PeerInsightsCard({
  payload,
  isLoading,
}: {
  payload: unknown;
  isLoading: boolean;
}) {
  const insights = collectInsights(payload);
  const good = insights.filter((item) => item.status === "good").length;
  const bad = insights.filter((item) => item.status === "bad").length;
  const score = insights.length > 0 ? Math.round((good / (good + bad || insights.length)) * 100) : null;

  if (isLoading) {
    return (
      <GlassCard>
        <div className="h-28 animate-pulse rounded-xl bg-accent/30" />
      </GlassCard>
    );
  }

  if (insights.length === 0) return null;

  return (
    <GlassCard>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            DataSectors Peer Insights
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Valuation, earnings, growth, performance, and health versus peers.
          </div>
        </div>
        {score !== null && (
          <div className="rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Peer Score</div>
            <div className={cn("num text-lg font-semibold", score >= 60 ? "text-gain" : score >= 40 ? "text-warning" : "text-loss")}>
              {score}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        {CATEGORY_ORDER.map((category) => {
          const group = insights.filter((item) => item.category === category);
          if (group.length === 0) return null;
          const meta = CATEGORY_META[category];
          const Icon = meta.icon;
          return (
            <div key={category} className="rounded-xl border border-border/40 bg-background/35 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium">
                <Icon className="h-3.5 w-3.5 text-primary" />
                {meta.label}
              </div>
              <div className="space-y-2">
                {group.slice(0, 4).map((item) => (
                  <div key={`${item.category}-${item.key}`} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] text-muted-foreground">{item.label}</span>
                      <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium", statusClass(item.status))}>
                        {item.status === "NA" ? <CircleDashed className="h-2.5 w-2.5" /> : item.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="truncate text-xs font-semibold num">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
