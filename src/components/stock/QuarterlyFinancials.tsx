import { useState, useMemo } from "react";
import { GlassCard } from "@/components/common/GlassCard";
import { fmtCompact, fmtNum } from "@/lib/formatters";
import { BarChart3, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

type Period = "quarterly" | "annual";

interface FinancialRow {
  period: string;
  revenue: number | null;
  netIncome: number | null;
  eps: number | null;
  epsEst: number | null;
  revenueEst: number | null;
  surprise: number | null;
  reportDate: string | null;
}

// ── Deep-extract helpers ──────────────────────────────────────────────────────
function safeNum(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v !== "") { const n = Number(v); if (isFinite(n)) return n; }
  return null;
}

function extractQuarters(payload: Record<string, unknown>): FinancialRow[] {
  // DataSectors v2/earnings returns nested structure:
  // { data: { History: { quarterly: [...], annual: [...] }, Forecast: { quarterly: [...] }, LastActual: {...} } }
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const history = (data.History ?? data.history ?? {}) as Record<string, unknown>;
  const forecast = (data.Forecast ?? data.forecast ?? {}) as Record<string, unknown>;

  const histQ = Array.isArray(history.quarterly) ? history.quarterly as Record<string, unknown>[] : [];
  const foreQ = Array.isArray(forecast.quarterly) ? forecast.quarterly as Record<string, unknown>[] : [];

  const rows: FinancialRow[] = histQ.map((q) => ({
    period: String(q.period ?? q.date ?? q.quarter ?? ""),
    revenue: safeNum(q.revenue ?? q.Revenue),
    netIncome: safeNum(q.netIncome ?? q.net_income ?? q.NetIncome),
    eps: safeNum(q.eps ?? q.EPS ?? q.actualEPS),
    epsEst: safeNum(q.epsEstimate ?? q.eps_estimate ?? q.forecastEPS),
    revenueEst: safeNum(q.revenueEstimate ?? q.revenue_estimate),
    surprise: safeNum(q.surprise ?? q.epsSurprise ?? q.eps_surprise),
    reportDate: q.reportDate != null ? String(q.reportDate) : null,
  })).filter((r) => r.period !== "");

  // Append forecast quarters (mark with *)
  foreQ.slice(0, 4).forEach((q) => {
    const period = String(q.period ?? q.date ?? q.quarter ?? "");
    if (!period || rows.find((r) => r.period === period)) return;
    rows.push({
      period: `${period}*`,
      revenue: null,
      netIncome: null,
      eps: null,
      epsEst: safeNum(q.epsEstimate ?? q.eps_estimate ?? q.forecastEPS),
      revenueEst: safeNum(q.revenueEstimate ?? q.revenue_estimate),
      surprise: null,
      reportDate: null,
    });
  });

  return rows.slice(-12); // last 12 quarters
}

function extractAnnual(payload: Record<string, unknown>): FinancialRow[] {
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const history = (data.History ?? data.history ?? {}) as Record<string, unknown>;
  const forecast = (data.Forecast ?? data.forecast ?? {}) as Record<string, unknown>;

  const histA = Array.isArray(history.annual) ? history.annual as Record<string, unknown>[] : [];
  const foreA = Array.isArray(forecast.annual) ? forecast.annual as Record<string, unknown>[] : [];

  const rows: FinancialRow[] = histA.map((a) => ({
    period: String(a.period ?? a.year ?? a.date ?? ""),
    revenue: safeNum(a.revenue ?? a.Revenue),
    netIncome: safeNum(a.netIncome ?? a.net_income ?? a.NetIncome),
    eps: safeNum(a.eps ?? a.EPS ?? a.actualEPS),
    epsEst: safeNum(a.epsEstimate ?? a.eps_estimate),
    revenueEst: safeNum(a.revenueEstimate ?? a.revenue_estimate),
    surprise: safeNum(a.surprise ?? a.epsSurprise),
    reportDate: a.reportDate != null ? String(a.reportDate) : null,
  })).filter((r) => r.period !== "");

  foreA.slice(0, 3).forEach((a) => {
    const period = String(a.period ?? a.year ?? "");
    if (!period || rows.find((r) => r.period === period)) return;
    rows.push({
      period: `${period}*`,
      revenue: null, netIncome: null, eps: null,
      epsEst: safeNum(a.epsEstimate ?? a.eps_estimate),
      revenueEst: safeNum(a.revenueEstimate ?? a.revenue_estimate),
      surprise: null, reportDate: null,
    });
  });

  return rows.slice(-8);
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-foreground">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-muted-foreground">
          <span>{p.name}:</span>
          <span className="font-semibold text-foreground">{fmtCompact(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function QuarterlyFinancials({
  earningsPayload,
  isLoading,
}: {
  earningsPayload: Record<string, unknown> | null;
  isLoading: boolean;
}) {
  const [period, setPeriod] = useState<Period>("quarterly");
  const [metric, setMetric] = useState<"revenue" | "netIncome" | "eps">("revenue");
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => {
    if (!earningsPayload) return [];
    return period === "quarterly"
      ? extractQuarters(earningsPayload)
      : extractAnnual(earningsPayload);
  }, [earningsPayload, period]);

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        name: r.period,
        value: r[metric] ?? r[`${metric}Est` as keyof FinancialRow] ?? 0,
        est: metric === "eps" ? r.epsEst : metric === "revenue" ? r.revenueEst : null,
        isForecast: r.period.endsWith("*"),
        surprise: r.surprise,
      })),
    [rows, metric],
  );

  const displayRows = expanded ? rows : rows.slice(-6);

  if (isLoading) {
    return (
      <GlassCard>
        <div className="mb-4 flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4 text-primary" /> Quarterly Financials
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-accent/30" />
          ))}
        </div>
      </GlassCard>
    );
  }

  if (!earningsPayload || rows.length === 0) {
    return (
      <GlassCard>
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4 text-primary" /> Quarterly Financials
        </div>
        <p className="text-sm text-muted-foreground py-6 text-center">
          Earnings data not available for this symbol.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4 text-primary" />
          Quarterly Financials
          <span className="text-[10px] text-muted-foreground">* = forecast</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Period toggle */}
          <div className="flex overflow-hidden rounded-lg border border-border/50 text-[11px]">
            {(["quarterly", "annual"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 transition ${period === p ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {p === "quarterly" ? "Quarterly" : "Annual"}
              </button>
            ))}
          </div>
          {/* Metric toggle */}
          <div className="flex overflow-hidden rounded-lg border border-border/50 text-[11px]">
            {(["revenue", "netIncome", "eps"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-2.5 py-1 transition ${metric === m ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {m === "revenue" ? "Revenue" : m === "netIncome" ? "Net Income" : "EPS"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="mb-4 h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => fmtCompact(v)}
              width={52}
            />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
            <Bar dataKey="value" name={metric} radius={[3, 3, 0, 0]} maxBarSize={32}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.isForecast
                      ? "rgba(148,163,184,0.4)"
                      : (entry.value as number) >= 0
                        ? "rgba(16,185,129,0.7)"
                        : "rgba(239,68,68,0.7)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/40 text-left">
              <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Period</th>
              <th className="pb-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Revenue</th>
              <th className="pb-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Net Income</th>
              <th className="pb-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">EPS</th>
              <th className="pb-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">EPS Est.</th>
              <th className="pb-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Surprise</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((r) => (
              <tr key={r.period} className="border-b border-border/20 hover:bg-accent/20 transition-colors">
                <td className="py-2 font-mono font-semibold text-foreground">
                  {r.period}
                  {r.reportDate && (
                    <div className="text-[10px] text-muted-foreground font-normal">{r.reportDate}</div>
                  )}
                </td>
                <td className="py-2 text-right num">
                  {r.revenue != null ? fmtCompact(r.revenue) : r.revenueEst != null ? <span className="text-muted-foreground">{fmtCompact(r.revenueEst)}</span> : "—"}
                </td>
                <td className="py-2 text-right num">
                  {r.netIncome != null ? (
                    <span className={r.netIncome >= 0 ? "text-gain" : "text-loss"}>
                      {fmtCompact(r.netIncome)}
                    </span>
                  ) : "—"}
                </td>
                <td className="py-2 text-right num font-semibold">
                  {r.eps != null ? fmtNum(r.eps) : "—"}
                </td>
                <td className="py-2 text-right num text-muted-foreground">
                  {r.epsEst != null ? fmtNum(r.epsEst) : "—"}
                </td>
                <td className="py-2 text-right num">
                  {r.surprise != null ? (
                    <span className={`flex items-center justify-end gap-0.5 ${r.surprise >= 0 ? "text-gain" : "text-loss"}`}>
                      {r.surprise >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {r.surprise >= 0 ? "+" : ""}{r.surprise.toFixed(1)}%
                    </span>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > 6 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-3 flex w-full items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <><ChevronUp className="h-3.5 w-3.5" /> Show less</> : <><ChevronDown className="h-3.5 w-3.5" /> Show all {rows.length} periods</>}
        </button>
      )}
    </GlassCard>
  );
}
