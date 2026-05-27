import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback } from "react";
import { getDSNewsSearch, getDSNewsLatest, getDSNewsCategories, getDSNewsTrending, type NewsArticle } from "@/lib/datasectors.functions";
import { getNewsSentiment, getNewsIntelligenceNote } from "@/lib/ai.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Newspaper, Search, TrendingUp, Grid3X3, Clock, Brain, RefreshCw } from "lucide-react";
import { DataSourceBadge } from "@/components/shared/DataSourceBadge";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Market News — Stratum" },
      { name: "description", content: "Real-time market news with full-text search, categories, and sentiment analysis via DataSectors." },
    ],
  }),
  component: NewsPage,
});

const BULLISH_WORDS = ["surge","beat","upgrade","rally","soar","record","growth","strong","boost","outperform","expand","win","profit","gain","rise","high","positive","optimistic","naik","untung","laba","tumbuh"];
const BEARISH_WORDS = ["fall","drop","miss","downgrade","plunge","loss","cut","weak","decline","warn","risk","concern","crash","sell","negative","turun","rugi","melemah","anjlok","koreksi"];

export function scoreSentiment(text: string): { sentiment: "bullish" | "bearish" | "neutral"; score: number } {
  const t = text.toLowerCase();
  let s = 0;
  for (const w of BULLISH_WORDS) if (t.includes(w)) s++;
  for (const w of BEARISH_WORDS) if (t.includes(w)) s--;
  return {
    sentiment: s > 0 ? "bullish" : s < 0 ? "bearish" : "neutral",
    score: Math.min(10, Math.max(-10, s * 2)),
  };
}

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return dateStr; }
}

function NewsCard({ article }: { article: NewsArticle }) {
  const { sentiment } = scoreSentiment(article.title + " " + article.description);
  const sentimentColor = sentiment === "bullish" ? "text-green-400 border-green-500/30 bg-green-500/10" : sentiment === "bearish" ? "text-red-400 border-red-500/30 bg-red-500/10" : "text-muted-foreground border-border";

  return (
    <GlassCard className="group hover:bg-accent/30 transition-colors">
      <a href={article.url} target="_blank" rel="noopener noreferrer" className="block">
        <div className="flex items-start gap-3">
          {article.imageUrl && (
            <img src={article.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {article.title}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {article.description}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {article.tickers.slice(0, 4).map((t) => (
                <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                  {t}
                </Badge>
              ))}
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sentimentColor}`}>
                {sentiment}
              </Badge>
              <span className="text-[10px] text-muted-foreground ml-auto">{formatTimeAgo(article.publishedDate)}</span>
            </div>
          </div>
        </div>
      </a>
    </GlassCard>
  );
}

function NewsCardV2({ article }: { article: NewsArticle }) {
  const sentimentFn = useServerFn(getNewsSentiment);
  const [expanded, setExpanded] = useState(false);

  const { data: aiSentiment } = useQuery({
    queryKey: ["news-sentiment", article.id],
    queryFn: () => sentimentFn({
      data: {
        title: article.title,
        description: article.description,
        tickers: article.tickers,
        articleUrl: article.url,
      },
    }),
    staleTime: 60 * 60_000, // 1 hour cache
    enabled: expanded, // Only load when expanded
  });

  const basicSentiment = scoreSentiment(article.title + " " + article.description);
  const sentiment = aiSentiment?.sentiment ?? basicSentiment.sentiment;
  const confidence = aiSentiment?.confidence ?? Math.min(90, 40 + Math.abs(basicSentiment.score) * 5);
  const isAI = !!aiSentiment;

  const sentimentConfig = {
    bullish: { color: "text-green-400", bg: "bg-green-500/15", border: "border-green-500/30", icon: "🟢", label: "Bullish" },
    bearish: { color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30", icon: "🔴", label: "Bearish" },
    neutral: { color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border", icon: "⚪", label: "Neutral" },
  }[sentiment as "bullish" | "bearish" | "neutral"] ?? { color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border", icon: "⚪", label: "Neutral" };

  return (
    <GlassCard className="group hover:bg-accent/30 transition-colors">
      <div className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3">
          {article.imageUrl && (
            <img src={article.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors flex-1">
                {article.title}
              </h3>
              {expanded && isAI && (
                <Badge variant="outline" className="text-[9px] px-1.5 shrink-0 bg-primary/10 border-primary/30 text-primary">
                  AI
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {article.description}
            </p>

            {/* Sentiment + Confidence bar */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {article.tickers.slice(0, 4).map((t) => (
                <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                  {t}
                </Badge>
              ))}

              {/* Sentiment badge with confidence */}
              <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${sentimentConfig.color} ${sentimentConfig.bg} ${sentimentConfig.border}`}>
                <span>{sentimentConfig.icon}</span>
                <span>{sentimentConfig.label}</span>
                {expanded && (
                  <div className="flex items-center gap-1 ml-1">
                    <div className="w-8 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${sentiment === "bullish" ? "bg-green-400" : sentiment === "bearish" ? "bg-red-400" : "bg-muted-foreground"}`}
                        style={{ width: `${confidence}%` }}
                      />
                    </div>
                    <span className="text-[9px] opacity-75">{Math.round(confidence)}%</span>
                  </div>
                )}
              </div>

              <span className="text-[10px] text-muted-foreground ml-auto">{formatTimeAgo(article.publishedDate)}</span>
            </div>

            {/* Expanded: AI summary */}
            {expanded && (
              <div className="mt-2 pt-2 border-t border-border/30">
                {aiSentiment?.summary ? (
                  <p className="text-xs leading-relaxed text-muted-foreground italic">
                    💡 {aiSentiment.summary}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                )}
                {aiSentiment?.keyFactors && aiSentiment.keyFactors.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {aiSentiment.keyFactors.slice(0, 3).map((f: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[9px] px-1 py-0 bg-muted/50">
                        {f}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {article.url && (
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="block mt-2 pt-2 border-t border-border/30 text-[10px] text-muted-foreground hover:text-primary transition-colors">
          Baca lengkap →
        </a>
      )}
    </GlassCard>
  );
}

function MarketSentimentGauge({ articles }: { articles: NewsArticle[] }) {
  const sentiments = articles.map(a => scoreSentiment(a.title + " " + a.description).sentiment);
  const bullish = sentiments.filter(s => s === "bullish").length;
  const bearish = sentiments.filter(s => s === "bearish").length;
  const neutral = sentiments.filter(s => s === "neutral").length;
  const total = sentiments.length || 1;

  const bPct = Math.round((bullish / total) * 100);
  const brPct = Math.round((bearish / total) * 100);
  const nPct = 100 - bPct - brPct;

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Market Sentiment</h3>
        <span className="text-[10px] text-muted-foreground">{articles.length} articles</span>
      </div>
      <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden">
        <div className="bg-green-500 h-full transition-all" style={{ width: `${bPct}%` }} title={`Bullish: ${bPct}%`} />
        <div className="bg-muted h-full transition-all" style={{ width: `${nPct}%` }} title={`Neutral: ${nPct}%`} />
        <div className="bg-red-500 h-full transition-all" style={{ width: `${brPct}%` }} title={`Bearish: ${brPct}%`} />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px]">
        <span className="text-green-400">🟢 {bPct}% Bullish</span>
        <span className="text-muted-foreground">⚪ {nPct}% Neutral</span>
        <span className="text-red-400">🔴 {brPct}% Bearish</span>
      </div>
    </GlassCard>
  );
}

function SectorIntelligenceView({
  intelligenceData,
  onRefresh,
}: {
  intelligenceData: { note?: string; sentiment?: string; theme?: string; tickersMentioned?: string[] };
  onRefresh: () => void;
}) {
  // Injected via the NewsPage component
  return (
    <div className="space-y-4">
      {intelligenceData.note && (
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">AI Market Intelligence</h3>
            {intelligenceData.sentiment && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${intelligenceData.sentiment === "bullish" ? "text-green-400 border-green-500/30 bg-green-500/10" : intelligenceData.sentiment === "bearish" ? "text-red-400 border-red-500/30 bg-red-500/10" : "text-muted-foreground border-border"}`}>
                {intelligenceData.sentiment}
              </Badge>
            )}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{intelligenceData.note}</p>
          {intelligenceData.theme && intelligenceData.theme !== "N/A" && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-2 bg-primary/10 border-primary/30 text-primary">
              {intelligenceData.theme}
            </Badge>
          )}
        </GlassCard>
      )}
      {intelligenceData.tickersMentioned && intelligenceData.tickersMentioned.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-[10px] text-muted-foreground mr-1 self-center">Tickers mentioned:</span>
          {intelligenceData.tickersMentioned.slice(0, 8).map((t: string, i: number) => (
            <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
              {t}
            </Badge>
          ))}
        </div>
      )}
      <div className="text-center">
        <Button size="sm" variant="ghost" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Refresh Intelligence
        </Button>
      </div>
    </div>
  );
}

export function NewsPage() {
  const searchFn = useServerFn(getDSNewsSearch);
  const latestFn = useServerFn(getDSNewsLatest);
  const categoriesFn = useServerFn(getDSNewsCategories);
  const trendingFn = useServerFn(getDSNewsTrending);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("latest");

  // Latest news
  const { data: latestData, isLoading: latestLoading } = useQuery({
    queryKey: ["ds-news-latest"],
    queryFn: () => latestFn({ data: { limit: 30 } }),
    staleTime: 5 * 60_000,
    enabled: activeTab === "latest",
  });

  // Trending
  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ["ds-news-trending"],
    queryFn: () => trendingFn({ data: { limit: 15 } }),
    staleTime: 5 * 60_000,
    enabled: activeTab === "trending",
  });

  // Categories
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ["ds-news-categories"],
    queryFn: () => categoriesFn(),
    staleTime: 10 * 60_000,
    enabled: activeTab === "categories",
  });

  // Search
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["ds-news-search", searchQuery],
    queryFn: () => searchFn({ data: { query: searchQuery, limit: 30 } }),
    staleTime: 5 * 60_000,
    enabled: activeTab === "search" && searchQuery.length > 2,
  });

  const latestArticles = (latestData?.data ?? []) as NewsArticle[];
  const trendingArticles = (trendingData?.data ?? []) as NewsArticle[];
  const searchArticles = (searchData?.data ?? []) as NewsArticle[];
  const categories = (categoriesData?.data ?? []) as { name: string; count: number }[];

  const intelligenceNoteFn = useServerFn(getNewsIntelligenceNote);
  const [sectorGroups, setSectorGroups] = useState<Array<{
    sector: string;
    articles: NewsArticle[];
    note?: string;
    sentiment: "bullish" | "bearish" | "neutral";
    confidence: number;
  }>>([]);
  const [sectorLoading, setSectorLoading] = useState(false);

  const { data: intelligenceData, isLoading: intelligenceLoading } = useQuery({
    queryKey: ["news-intelligence-v2", latestArticles.map(a => a.id)],
    queryFn: () => intelligenceNoteFn({ data: { articles: latestArticles.slice(0, 10).map(a => ({ title: a.title, description: a.description, tickers: a.tickers })) } }),
    staleTime: 30 * 60_000,
    enabled: activeTab === "intelligence" && latestArticles.length > 0 && sectorGroups.length === 0,
  });

  // Group articles by sector when intelligenceData arrives
  useEffect(() => {
    if (!intelligenceData || latestArticles.length === 0) return;

    const sectorKeywords: Record<string, string> = {
      bb: "Banking", bca: "Banking", bni: "Banking", bri: "Banking", mandiri: "Banking",
      ptba: "Mining", itmg: "Mining", adro: "Mining", BukitAsam: "Mining",
      tlkm: "Telecom", isat: "Telecom", excl: "Telecom",
      unvr: "Consumer", HMSP: "Consumer", ICBP: "Consumer",
      freeport: "Commodities", antm: "Commodities",
      JSMR: "Infrastructure", WIKA: "Infrastructure",
      PGAS: "Energy", medis: "Healthcare", HEAL: "Healthcare",
    };

    const groups: Record<string, NewsArticle[]> = {};
    for (const article of latestArticles) {
      let assigned = false;
      for (const ticker of article.tickers.slice(0, 2)) {
        const upper = ticker.toLowerCase();
        for (const [key, sector] of Object.entries(sectorKeywords)) {
          if (upper.includes(key)) {
            groups[sector] = groups[sector] ?? [];
            groups[sector].push(article);
            assigned = true;
            break;
          }
        }
        if (assigned) break;
      }
      if (!assigned) {
        groups["Market"] = groups["Market"] ?? [];
        groups["Market"].push(article);
      }
    }

    const scoredGroups = Object.entries(groups).map(([sector, arts]) => {
      const sentScores = arts.map(a => scoreSentiment(a.title + " " + a.description).sentiment);
      const bCount = sentScores.filter(s => s === "bullish").length;
      const brCount = sentScores.filter(s => s === "bearish").length;
      const confidence = Math.round(((bCount + brCount) / (arts.length || 1)) * 100);
      const dominantSentiment: "bullish" | "bearish" | "neutral" =
        bCount > brCount ? "bullish" : brCount > bCount ? "bearish" : "neutral";
      return {
        sector,
        articles: arts.slice(0, 5),
        sentiment: dominantSentiment,
        confidence,
        note: arts.length > 2
          ? `${arts.length} berita · Sentimen ${dominantSentiment} · ${confidence}% konsistensi`
          : arts[0]?.title.slice(0, 100) + "...",
      };
    });

    scoredGroups.sort((a, b) => b.articles.length - a.articles.length);
    setSectorGroups(scoredGroups);
    setSectorLoading(false);
  }, [intelligenceData, latestArticles]);

  useEffect(() => {
    if (activeTab === "intelligence" && latestArticles.length > 0 && sectorGroups.length === 0) {
      setSectorLoading(true);
    }
  }, [activeTab, latestArticles, sectorGroups]);

  return (
    <PageTransition>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Market News</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Real-time news via DataSectors API with full-text search.{" "}
            <DataSourceBadge source="ds" />
          </p>
        </div>

        {/* Market Sentiment Gauge */}
        <MarketSentimentGauge articles={latestArticles} />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-wrap items-center gap-3">
            <TabsList>
              <TabsTrigger value="latest" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Latest
              </TabsTrigger>
              <TabsTrigger value="search" className="gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Search
              </TabsTrigger>
              <TabsTrigger value="trending" className="gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Trending
              </TabsTrigger>
              <TabsTrigger value="intelligence" className="gap-1.5">
                <Brain className="h-3.5 w-3.5" />
                Intelligence
              </TabsTrigger>
              <TabsTrigger value="categories" className="gap-1.5">
                <Grid3X3 className="h-3.5 w-3.5" />
                Categories
              </TabsTrigger>
            </TabsList>

            {activeTab === "search" && (
              <div className="flex-1 flex items-center gap-2 max-w-md">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder="Search news..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
              </div>
            )}
          </div>

          {/* LATEST TAB */}
          <TabsContent value="latest" className="mt-4">
            {latestLoading ? (
              <Skeleton className="h-48 rounded-xl" />
            ) : latestArticles.length > 0 ? (
              <div className="space-y-3">
                {latestArticles.map((a) => <NewsCardV2 key={a.id} article={a} />)}
              </div>
            ) : (
              <GlassCard className="py-12 text-center">
                <Newspaper className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No news available from DataSectors</p>
                <p className="text-xs text-muted-foreground mt-1">Check API key configuration</p>
              </GlassCard>
            )}
          </TabsContent>

          {/* SEARCH TAB */}
          <TabsContent value="search" className="mt-4">
            {searchQuery.length < 3 ? (
              <GlassCard className="py-12 text-center">
                <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Type at least 3 characters to search</p>
              </GlassCard>
            ) : searchLoading ? (
              <Skeleton className="h-48 rounded-xl" />
            ) : searchArticles.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{searchArticles.length} results for "{searchQuery}"</p>
                {searchArticles.map((a) => <NewsCardV2 key={a.id} article={a} />)}
              </div>
            ) : (
              <GlassCard className="py-12 text-center">
                <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No results found for "{searchQuery}"</p>
              </GlassCard>
            )}
          </TabsContent>

          {/* TRENDING TAB */}
          <TabsContent value="trending" className="mt-4">
            {trendingLoading ? (
              <Skeleton className="h-48 rounded-xl" />
            ) : trendingArticles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trendingArticles.map((a) => <NewsCardV2 key={a.id} article={a} />)}
              </div>
            ) : (
              <GlassCard className="py-12 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No trending news available</p>
              </GlassCard>
            )}
          </TabsContent>

          {/* INTELLIGENCE TAB — Sector-grouped AI summaries */}
          <TabsContent value="intelligence" className="mt-4">
            {intelligenceLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 rounded-xl" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-32 rounded-xl" />
                  <Skeleton className="h-32 rounded-xl" />
                </div>
              </div>
            ) : !intelligenceData ? (
              <GlassCard className="py-12 text-center">
                <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No intelligence data available</p>
                <p className="text-xs text-muted-foreground mt-1">Switch to the Latest tab to load articles first</p>
              </GlassCard>
            ) : (
              <SectorIntelligenceView intelligenceData={intelligenceData} onRefresh={useCallback(() => {
                // eslint-disable-next-line @tanstack/use-query-enforce-equal-data-refresh
              }, [])} />
            )}
          </TabsContent>

          {/* CATEGORIES TAB */}
          <TabsContent value="categories" className="mt-4">
            {categoriesLoading ? (
              <Skeleton className="h-32 rounded-xl" />
            ) : categories.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {categories.map((cat) => (
                  <GlassCard key={cat.name} className="p-4 cursor-pointer hover:bg-accent/30 transition-colors">
                    <p className="font-medium text-sm">{cat.name}</p>
                    <p className="text-2xl font-bold mt-2">{cat.count.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">articles</p>
                  </GlassCard>
                ))}
              </div>
            ) : (
              <GlassCard className="py-12 text-center">
                <Grid3X3 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No categories available</p>
              </GlassCard>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
