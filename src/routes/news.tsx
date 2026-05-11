import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect, useRef } from "react";
import { getDSNews } from "@/lib/datasectors.functions";
import { getTiingoNews } from "@/lib/tiingo.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ExternalLink, Newspaper, Sparkles, TrendingDown, TrendingUp,
  Search, RefreshCw, Filter, X, Clock, Tag,
} from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Market News — Stratum" },
      { name: "description", content: "Berita pasar real-time dengan full-text search, filter ticker, dan analisis sentimen." },
    ],
  }),
  component: NewsPage,
});

// ── Sentiment scoring ─────────────────────────────────────────────────────────
const BULLISH_WORDS = ["surge","beat","upgrade","rally","soar","record","growth","strong","boost","outperform","expand","win","profit","gain","rise","high","positive","optimistic","naik","untung","laba","tumbuh"];
const BEARISH_WORDS = ["fall","drop","miss","downgrade","plunge","loss","cut","weak","decline","warn","risk","concern","crash","sell","negative","turun","rugi","melemah","anjlok","koreksi"];

function scoreSentiment(text: string): { sentiment: "bullish" | "bearish" | "neutral"; score: number } {
  const t = text.toLowerCase();
  let s = 0;
  for (const w of BULLISH_WORDS) if (t.includes(w)) s++;
  for (const w of BEARISH_WORDS) if (t.includes(w)) s--;
  return {
    sentiment: s > 0 ? "bullish" : s < 0 ? "bearish" : "neutral",
    score: Math.min(10, Math.max(-10, s * 2)),
  };
}

// ── Map raw DS news item ──────────────────────────────────────────────────────
interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedDate: string;
  tickers: string[];
  tags: string[];
  imageUrl?: string;
}

function mapDSNews(r: Record<string, unknown>): NewsItem {
  const tickers = Array.isArray(r.tickers) ? r.tickers.map(String)
    : Array.isArray(r.symbols) ? r.symbols.map(String)
    : r.ticker ? [String(r.ticker)]
    : [];
  const tags = Array.isArray(r.tags) ? r.tags.map(String)
    : Array.isArray(r.categories) ? r.categories.map(String)
    : [];
  return {
    id: String(r.id ?? r._id ?? Math.random()),
    title: String(r.title ?? r.headline ?? ""),
    description: String(r.description ?? r.summary ?? r.content ?? r.body ?? ""),
    url: String(r.url ?? r.link ?? "#"),
    source: String(r.source ?? r.publisher ?? r.provider ?? ""),
    publishedDate: String(r.publishedDate ?? r.published_date ?? r.date ?? r.publishedAt ?? ""),
    tickers,
    tags,
    imageUrl: r.imageUrl ? String(r.imageUrl) : r.image ? String(r.image) : undefined,
  };
}

function mapTiingoNews(r: Record<string, unknown>): NewsItem {
  return {
    id: String(r.id ?? Math.random()),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    url: String(r.url ?? "#"),
    source: String(r.source ?? ""),
    publishedDate: String(r.publishedDate ?? ""),
    tickers: Array.isArray(r.tickers) ? r.tickers.map(String) : [],
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
  };
}

function unwrapNewsArray(payload: unknown): Record<string, unknown>[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const o = payload as Record<string, unknown>;
  for (const k of ["data", "news", "articles", "results", "items"]) {
    if (Array.isArray(o[k])) return o[k] as Record<string, unknown>[];
  }
  return [];
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.slice(0, 10);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}j lalu`;
  const days = Math.floor(hrs / 24);
  return `${days}h lalu`;
}

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Sentiment badge ───────────────────────────────────────────────────────────
function SentimentBadge({ sentiment, score }: { sentiment: "bullish" | "bearish" | "neutral"; score: number }) {
  if (sentiment === "bullish") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gain">
      <TrendingUp className="h-3 w-3" /> Bullish {score > 0 ? `+${score}` : ""}
    </span>
  );
  if (sentiment === "bearish") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-loss">
      <TrendingDown className="h-3 w-3" /> Bearish {score < 0 ? score : ""}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      <Sparkles className="h-3 w-3" /> Neutral
    </span>
  );
}

// ── News card ─────────────────────────────────────────────────────────────────
function NewsCard({ item }: { item: NewsItem }) {
  const sig = scoreSentiment(`${item.title} ${item.description}`);
  return (
    <GlassCard className="hover:bg-accent/20 transition-colors group">
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="block space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Newspaper className="h-3 w-3" />
            <span className="font-medium">{item.source || "News"}</span>
            <span>·</span>
            <Clock className="h-3 w-3" />
            <span>{timeAgo(item.publishedDate)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <SentimentBadge sentiment={sig.sentiment} score={sig.score} />
            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <h3 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {item.title}
        </h3>

        {item.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
            {item.description}
          </p>
        )}

        {(item.tickers.length > 0 || item.tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {item.tickers.slice(0, 5).map(t => (
              <Link
                key={t}
                to="/stocks/$symbol"
                params={{ symbol: t.toUpperCase() }}
                onClick={e => e.stopPropagation()}
                className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase text-primary hover:bg-primary/20 transition-colors"
              >
                {t}
              </Link>
            ))}
            {item.tags.slice(0, 3).map(t => (
              <span key={t} className="rounded-full bg-accent/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        )}
      </a>
    </GlassCard>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function NewsPage() {
  const mounted = useMounted();
  const dsFn = useServerFn(getDSNews);
  const tiingoFn = useServerFn(getTiingoNews);

  const [searchInput, setSearchInput] = useState("");
  const [tickerInput, setTickerInput] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<"all" | "bullish" | "bearish" | "neutral">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "datasectors" | "tiingo">("all");

  const debouncedSearch = useDebounce(searchInput.trim(), 500);
  const debouncedTicker = useDebounce(tickerInput.trim(), 500);

  // DataSectors news
  const dsQuery = useQuery({
    queryKey: ["ds-news", debouncedSearch, debouncedTicker],
    queryFn: () => dsFn({ data: {
      query: debouncedSearch || undefined,
      ticker: debouncedTicker || undefined,
      limit: 50,
    }}),
    staleTime: 60_000,
    retry: false,
    enabled: mounted,
  });

  // Tiingo news as fallback/supplement
  const tiingoQuery = useQuery({
    queryKey: ["tiingo-news", debouncedTicker],
    queryFn: () => tiingoFn({ data: debouncedTicker ? { tickers: debouncedTicker, limit: 30 } : { limit: 30 } }),
    staleTime: 60_000,
    enabled: mounted,
  });

  // Merge and deduplicate
  const allNews = useMemo(() => {
    const dsRaw = unwrapNewsArray(dsQuery.data?.data).map(mapDSNews);
    const tiingoRaw = (tiingoQuery.data?.data ?? []) as Record<string, unknown>[];
    const tiingoMapped = tiingoRaw.map(mapTiingoNews);

    // Deduplicate by title similarity
    const seen = new Set<string>();
    const merged: (NewsItem & { dataSource: string })[] = [];

    for (const item of dsRaw) {
      const key = item.title.slice(0, 40).toLowerCase();
      if (!seen.has(key)) { seen.add(key); merged.push({ ...item, dataSource: "datasectors" }); }
    }
    for (const item of tiingoMapped) {
      const key = item.title.slice(0, 40).toLowerCase();
      if (!seen.has(key)) { seen.add(key); merged.push({ ...item, dataSource: "tiingo" }); }
    }

    return merged.sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());
  }, [dsQuery.data, tiingoQuery.data]);

  // Filter by sentiment and source
  const filtered = useMemo(() => {
    return allNews.filter(item => {
      if (sourceFilter !== "all" && item.dataSource !== sourceFilter) return false;
      if (sentimentFilter !== "all") {
        const sig = scoreSentiment(`${item.title} ${item.description}`);
        if (sig.sentiment !== sentimentFilter) return false;
      }
      return true;
    });
  }, [allNews, sentimentFilter, sourceFilter]);

  // Sentiment stats
  const stats = useMemo(() => {
    const bullish = allNews.filter(n => scoreSentiment(`${n.title} ${n.description}`).sentiment === "bullish").length;
    const bearish = allNews.filter(n => scoreSentiment(`${n.title} ${n.description}`).sentiment === "bearish").length;
    return { bullish, bearish, neutral: allNews.length - bullish - bearish, total: allNews.length };
  }, [allNews]);

  const isLoading = dsQuery.isLoading || tiingoQuery.isLoading;
  const hasSearch = debouncedSearch || debouncedTicker;

  const clearFilters = () => { setSearchInput(""); setTickerInput(""); setSentimentFilter("all"); setSourceFilter("all"); };

  return (
    <PageTransition>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-semibold tracking-tight">Market News</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Berita pasar real-time dengan full-text search dan analisis sentimen.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { dsQuery.refetch(); tiingoQuery.refetch(); }}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>

        {/* Sentiment stats */}
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => setSentimentFilter(sentimentFilter === "bullish" ? "all" : "bullish")}
            className={`rounded-xl border p-3 text-left transition-colors ${sentimentFilter === "bullish" ? "border-success/60 bg-success/15" : "border-border/40 bg-background/40 hover:bg-accent/20"}`}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bullish</div>
            <div className="text-2xl font-bold text-gain num mt-1">{stats.bullish}</div>
          </button>
          <button onClick={() => setSentimentFilter(sentimentFilter === "neutral" ? "all" : "neutral")}
            className={`rounded-xl border p-3 text-left transition-colors ${sentimentFilter === "neutral" ? "border-warning/60 bg-warning/15" : "border-border/40 bg-background/40 hover:bg-accent/20"}`}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Neutral</div>
            <div className="text-2xl font-bold text-warning num mt-1">{stats.neutral}</div>
          </button>
          <button onClick={() => setSentimentFilter(sentimentFilter === "bearish" ? "all" : "bearish")}
            className={`rounded-xl border p-3 text-left transition-colors ${sentimentFilter === "bearish" ? "border-destructive/60 bg-destructive/15" : "border-border/40 bg-background/40 hover:bg-accent/20"}`}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Bearish</div>
            <div className="text-2xl font-bold text-loss num mt-1">{stats.bearish}</div>
          </button>
        </div>

        {/* Search & filters */}
        <div className="flex flex-wrap gap-2">
          {/* Full-text search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Cari berita... (full-text)"
              className="pl-9 h-9"
            />
          </div>
          {/* Ticker filter */}
          <div className="relative w-36">
            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={tickerInput}
              onChange={e => setTickerInput(e.target.value.toUpperCase())}
              placeholder="Ticker (BBCA)"
              className="pl-9 h-9 font-mono"
            />
          </div>
          {/* Source filter */}
          <Select value={sourceFilter} onValueChange={v => setSourceFilter(v as typeof sourceFilter)}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Sumber</SelectItem>
              <SelectItem value="datasectors">DataSectors</SelectItem>
              <SelectItem value="tiingo">Tiingo</SelectItem>
            </SelectContent>
          </Select>
          {/* Clear */}
          {(searchInput || tickerInput || sentimentFilter !== "all" || sourceFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
              <X className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Menampilkan <span className="text-foreground font-medium">{filtered.length}</span> dari {stats.total} berita
            {hasSearch && <span className="ml-1 text-primary">· hasil pencarian</span>}
          </span>
          {dsQuery.data?.source === "error" && (
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] text-warning">
              DataSectors tidak tersedia — menampilkan Tiingo
            </span>
          )}
        </div>

        {/* News list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <GlassCard>
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Newspaper className="h-8 w-8 opacity-40" />
              <div className="text-sm">Tidak ada berita yang cocok.</div>
              {hasSearch && <Button variant="ghost" size="sm" onClick={clearFilters}>Hapus filter</Button>}
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => <NewsCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </PageTransition>
  );
}