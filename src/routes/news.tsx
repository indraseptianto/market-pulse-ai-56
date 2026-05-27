import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getDSNewsSearch, getDSNewsLatest, getDSNewsCategories, getDSNewsTrending, type NewsArticle } from "@/lib/datasectors.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Newspaper, Search, TrendingUp, Grid3X3, Clock } from "lucide-react";
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
                {latestArticles.map((a) => <NewsCard key={a.id} article={a} />)}
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
                {searchArticles.map((a) => <NewsCard key={a.id} article={a} />)}
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
                {trendingArticles.map((a) => <NewsCard key={a.id} article={a} />)}
              </div>
            ) : (
              <GlassCard className="py-12 text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No trending news available</p>
              </GlassCard>
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
