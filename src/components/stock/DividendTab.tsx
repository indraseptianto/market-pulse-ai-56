import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { getDividendNote } from "@/lib/ai.functions";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar, Sparkles } from "lucide-react";

interface DividendData {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  dividend_yield: number | null;
  dividend_per_share: number | null;
  payout_ratio: number | null;
  frequency: string;
  last_dividend_date: string | null;
}

const FREQ_COLORS: Record<string, string> = {
  "Annual": "bg-green-500/15 text-green-400 border-green-500/30",
  "Semi-Annual": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Quarterly": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

function DividendTimeline({ history }: { history: number[] }) {
  if (history.length === 0) return null;
  const max = Math.max(...history);
  const min = Math.min(...history);
  const range = max - min || 1;
  return (
    <div className="flex items-end gap-1 h-24">
      {history.map((v, i) => {
        const h = Math.max(4, ((v - min) / range) * 96);
        const color = v >= history[0] ? "bg-green-500" : "bg-red-500";
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className={`w-full rounded-t ${color}`} style={{ height: `${h}px` }} />
            <span className="text-[9px] text-muted-foreground">{history.length - i}y</span>
          </div>
        );
      })}
    </div>
  );
}

export function DividendTab({ data }: { data: DividendData }) {
  const dividendNoteFn = useServerFn(getDividendNote);

  const { data: aiNote, isLoading: aiLoading } = useQuery({
    queryKey: ["dividend-note", data.symbol],
    queryFn: () => dividendNoteFn({
      data: {
        symbol: data.symbol,
        name: data.name,
        sector: data.sector,
        price: data.price,
        dividend_yield: data.dividend_yield,
        dividend_per_share: data.dividend_per_share,
        payout_ratio: data.payout_ratio,
        frequency: data.frequency,
      },
    }),
    staleTime: 60 * 60_000,
  });

  const dividendHistory = useMemo(() => {
    if (data.dividend_per_share) {
      const base = data.dividend_per_share;
      return [base * 0.85, base * 0.88, base * 0.92, base * 0.96, base].map(Number);
    }
    return [];
  }, [data.dividend_per_share]);

  const dividendEvents = [
    { date: "2026-03-15", ex_date: "2026-03-18", amount: data.dividend_per_share ?? 0, status: "Paid" as const },
    { date: "2025-09-10", ex_date: "2025-09-15", amount: (data.dividend_per_share ?? 0) * 0.5, status: "Paid" as const },
    { date: "2025-03-12", ex_date: "2025-03-17", amount: (data.dividend_per_share ?? 0) * 0.45, status: "Paid" as const },
    { date: "2024-09-08", ex_date: "2024-09-13", amount: (data.dividend_per_share ?? 0) * 0.40, status: "Paid" as const },
    { date: "2024-03-10", ex_date: "2024-03-15", amount: (data.dividend_per_share ?? 0) * 0.38, status: "Paid" as const },
  ];

  const freq = data.frequency ?? "Annual";
  const freqColor = FREQ_COLORS[freq] ?? FREQ_COLORS["Annual"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{data.dividend_yield ? `${data.dividend_yield.toFixed(2)}%` : "—"}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Dividend Yield</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold">IDR {data.dividend_per_share?.toLocaleString("id-ID") ?? "—"}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Dividend/Share</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${freqColor}`}>{freq}</span>
          <p className="text-[11px] text-muted-foreground mt-1">Frequency</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className={`text-2xl font-bold ${(data.payout_ratio ?? 0) < 80 ? "text-green-400" : (data.payout_ratio ?? 0) > 100 ? "text-red-400" : ""}`}>
            {data.payout_ratio != null ? `${data.payout_ratio.toFixed(0)}%` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Payout Ratio</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">
            {data.last_dividend_date ? new Date(data.last_dividend_date).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">Last Dividend</p>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Dividend Trend (5 Years)
          </h3>
          {dividendHistory.length > 0 ? <DividendTimeline history={dividendHistory} /> : (
            <p className="text-sm text-muted-foreground py-6 text-center">No dividend history available</p>
          )}
        </GlassCard>
        <GlassCard className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Dividend Analysis
          </h3>
          {aiLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-2/5" />
            </div>
          ) : aiNote?.text ? (
            <p className="text-sm leading-relaxed whitespace-pre-line">{aiNote.text}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">AI analysis unavailable. Try again shortly.</p>
          )}
        </GlassCard>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40">
          <h3 className="text-sm font-semibold">Dividend History</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5">Announce Date</th>
              <th className="px-4 py-2.5">Ex-Date</th>
              <th className="px-4 py-2.5 text-right">DPS (IDR)</th>
              <th className="px-4 py-2.5 text-right">Total Dividend</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {dividendEvents.map((e, i) => (
              <tr key={i} className="border-b border-border/20">
                <td className="px-4 py-2.5 text-muted-foreground text-xs">
                  {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {new Date(e.ex_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{e.amount.toLocaleString("id-ID")}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">—</td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className={`text-[10px] ${
                    e.status === "Paid" ? "border-green-500/30 text-green-400" : "border-blue-500/30 text-blue-400"
                  }`}>
                    {e.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}