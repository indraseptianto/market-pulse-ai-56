import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getTiingoNews } from "@/lib/tiingo.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExternalLink, Newspaper, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Market News — Stratum" },
      {
        name: "description",
        content:
          "Realtime market news with sentiment analysis, ticker tagging and impact scoring powered by Tiingo News.",
      },
    ],
  }),
  component: NewsPage,
});

const BULLISH_WORDS = ["surge", "beat", "upgrade", "rally", "soar", "record", "growth", "strong", "boost", "outperform", "expand", "win"];
const BEARISH_WORDS = ["fall", "drop", "miss", "downgrade", "plunge", "loss", "cut", "weak", "decline", "warn", "risk", "concern"];

function score(text: string): { sentiment: "bullish" | "bearish" | "neutral"; score: number } {
  const t = text.toLowerCase();
  let s = 0;
  for (const w of BULLISH_WORDS) if (t.includes(w)) s += 1;
  for (const w of BEARISH_WORDS) if (t.includes(w)) s -= 1;
  return {
    sentiment: s > 0 ? "bullish" : s < 0 ? "bearish" : "neutral",
    score: Math.min(10, Math.max(-10, s * 2)),
  };
}

function NewsPage() {
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState("");

  const fn = useServerFn(getTiingoNews);
  const news = useQuery({
    queryKey: ["tiingo-news", filter],
    queryFn: () => fn({ data: filter ? { tickers: filter, limit: 50 } : { limit: 50 } }),
    staleTime: 60_000,
  });

  const items = news.data?.data ?? [];

  return (
    <PageTransition>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Market News</h1>
            <p className="text-sm text-muted-foreground">
              Tagged with sentiment & impact score. Filter by ticker or sector.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setFilter(draft.toLowerCase().trim());
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="ticker(s), comma-sep"
              className="w-[200px] font-mono"
            />
            <Button size="sm" type="submit">
              Filter
            </Button>
            {filter && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFilter("");
                  setDraft("");
                }}
              >
                Clear
              </Button>
            )}
          </form>
        </div>

        {news.data?.source === "mock" && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            Showing demo news — Tiingo response unavailable.
          </div>
        )}

        {news.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <GlassCard>
            <div className="py-10 text-center text-sm text-muted-foreground">No news available.</div>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {items.map((n) => {
              const sig = score(`${n.title} ${n.description}`);
              return (
                <GlassCard key={n.id} className="hover:bg-accent/20 transition-colors">
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="block space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                        <Newspaper className="h-3 w-3" />
                        <span>{n.source}</span>
                        <span>·</span>
                        <span>{new Date(n.publishedDate).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <SentimentBadge sentiment={sig.sentiment} score={sig.score} />
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                    <h3 className="text-base font-semibold leading-snug">{n.title}</h3>
                    {n.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{n.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {n.tickers?.slice(0, 6).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase text-primary"
                        >
                          {t}
                        </span>
                      ))}
                      {n.tags?.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-accent/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </a>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function SentimentBadge({ sentiment, score }: { sentiment: "bullish" | "bearish" | "neutral"; score: number }) {
  if (sentiment === "bullish") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gain">
        <TrendingUp className="h-3 w-3" /> Bullish · {Math.abs(score)}
      </span>
    );
  }
  if (sentiment === "bearish") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-loss">
        <TrendingDown className="h-3 w-3" /> Bearish · {Math.abs(score)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
      <Sparkles className="h-3 w-3" /> Neutral
    </span>
  );
}
