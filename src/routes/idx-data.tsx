import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Database, Download, ExternalLink, FileSpreadsheet, RefreshCcw, Search } from "lucide-react";

import { GlassCard } from "@/components/common/GlassCard";
import { PageTransition } from "@/components/layout/PageTransition";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOfficialIndexData, type OfficialIndexItem } from "@/lib/idx-official";

export const Route = createFileRoute("/idx-data")({
  head: () => ({
    meta: [
      { title: "IDX Official Data Dashboard · Stratum" },
      { name: "description", content: "Progress monitor dan katalog JSON/Excel official IDX data." },
    ],
  }),
  component: IdxDataPage,
});

const STATUS_TONE: Record<string, string> = {
  selesai: "bg-success/15 text-success",
  partial: "bg-warning/15 text-warning",
  partial_llm: "bg-primary/15 text-primary",
  gagal: "bg-destructive/15 text-destructive",
  unknown: "bg-muted text-muted-foreground",
};

function IdxDataPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const idx = useQuery({
    queryKey: ["idx-official-index-full"],
    queryFn: fetchOfficialIndexData,
    staleTime: 300_000,
  });

  const items = idx.data?.items ?? [];
  const summary = idx.data?.summary;
  const statusCounts = summary?.status_counts ?? countByStatus(items);
  const processed = summary?.processed_total ?? items.length;
  const universe = summary?.universe_total ?? items.length;
  const remaining = summary?.remaining_total ?? Math.max(universe - processed, 0);
  const progress = universe ? Math.min(100, Math.round((processed / universe) * 1000) / 10) : 0;

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return items
      .filter((item) => status === "all" || normalizeStatus(item.status) === status)
      .filter((item) => !q || item.code.toUpperCase().includes(q) || (item.company_name ?? "").toUpperCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [items, query, status]);

  const latest = useMemo(() => {
    return [...items]
      .filter((item) => item.scraped_at)
      .sort((a, b) => String(b.scraped_at).localeCompare(String(a.scraped_at)))
      .slice(0, 8);
  }, [items]);

  if (idx.isLoading) {
    return (
      <PageTransition>
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-4">
        <GlassCard className="overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-emerald-500/20 via-primary/10 to-transparent" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                <Database className="h-3.5 w-3.5" /> Official IDX Pipeline
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">IDX Data Control Room</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Monitor progress scraping official IDX/emiten, cek status parser lokal + LLM fallback, dan download JSON/Excel yang dipublish ke Vercel.
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>Generated</div>
              <div className="mt-1 font-mono text-sm text-foreground">{formatDate(idx.data?.generated_at)}</div>
              <a href="/data/idx-official/index.json" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-primary hover:underline">
                Open index <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          <div className="relative mt-5 grid gap-3 md:grid-cols-4">
            <Stat label="Published" value={items.length.toLocaleString()} detail="JSON/Excel on Vercel" />
            <Stat label="Processed" value={`${processed.toLocaleString()} / ${universe.toLocaleString()}`} detail={`${progress}% universe`} />
            <Stat label="Remaining" value={remaining.toLocaleString()} detail="pipeline queue" />
            <Stat label="LLM Fallback" value={items.filter((item) => item.has_llm_fallback).length.toLocaleString()} detail="partial review candidates" />
          </div>
          <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-background/60">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400" style={{ width: `${progress}%` }} />
          </div>
        </GlassCard>

        <div className="grid gap-4 lg:grid-cols-3">
          <GlassCard className="lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Official Data Catalog</div>
                <div className="text-xs text-muted-foreground">{filtered.length.toLocaleString()} rows shown</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search code/name..."
                    className="h-9 w-52 rounded-lg border border-border/60 bg-background/60 pl-9 pr-3 text-xs outline-none focus:border-primary"
                  />
                </div>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="h-9 rounded-lg border border-border/60 bg-background/60 px-3 text-xs outline-none focus:border-primary"
                >
                  <option value="all">All status</option>
                  {Object.keys(statusCounts).sort().map((key) => (
                    <option key={key} value={normalizeStatus(key)}>{key}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Files</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 250).map((item) => (
                    <tr key={item.code} className="border-b border-border/30 hover:bg-accent/30">
                      <td className="px-3 py-2 font-mono font-semibold">
                        <Link to="/stocks/$symbol" params={{ symbol: item.code }} className="text-primary hover:underline">
                          {item.code}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <div className="max-w-[260px] truncate">{item.company_name}</div>
                        <div className="text-[10px] text-muted-foreground">{formatDate(item.scraped_at)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={item.status} />
                        {item.has_llm_fallback && <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">LLM</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <a href={item.json} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs hover:bg-accent">
                            JSON <Download className="h-3 w-3" />
                          </a>
                          {item.excel && (
                            <a href={item.excel} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs hover:bg-accent">
                              Excel <FileSpreadsheet className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <div className="space-y-4">
            <GlassCard>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <RefreshCcw className="h-4 w-4 text-primary" /> Status Mix
              </div>
              <div className="space-y-2">
                {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2 text-sm">
                    <StatusBadge status={key} />
                    <span className="font-mono text-muted-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard>
              <div className="mb-3 text-sm font-medium">Latest Processed</div>
              <div className="space-y-2">
                {latest.map((item) => (
                  <Link key={`${item.code}-${item.scraped_at}`} to="/stocks/$symbol" params={{ symbol: item.code }} className="block rounded-lg bg-background/40 px-3 py-2 hover:bg-background/60">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold text-primary">{item.code}</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{item.company_name}</div>
                  </Link>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/45 p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const normalized = normalizeStatus(status);
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_TONE[normalized] ?? STATUS_TONE.unknown}`}>
      {status || "unknown"}
    </span>
  );
}

function normalizeStatus(status?: string | null) {
  return String(status || "unknown").toLowerCase();
}

function countByStatus(items: OfficialIndexItem[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = normalizeStatus(item.status);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}
