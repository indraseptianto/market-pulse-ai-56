# Phase 3 — News + Sentiment Intelligence
**Feature Spec — market-pulse-ai-56**

> Upgrade news page dari keyword-sentiment → AI-powered sentiment + per-article AI summary + market sentiment dashboard + stock-specific news tab.

**Owner:** Eden Rekno
**Date:** 2026-05-28
**Status:** Draft → Approved

---

## 1. Concept & Vision

Fase ini upgrade sistem berita dari yang bersifat "tampilkan dan beri badge" menjadi "pahami dan analisis". Setiap berita tidak hanya ditampilkan, tapi juga: (a) dianalisis sentimennya oleh AI (bukan keyword matching), (b) diberikan ringkasan 1-2 kalimat oleh AI, (c) dirangkum sentimen market keseluruhan per sektor/waktu. User mendapat berita + insight, bukan hanya headlines.

**Feel:** Analyst-grade news intelligence — seperti punya equity research analyst yang baca berita untuk kamu, kasih verdict, dan track sentiment trend.

---

## 2. What Exists (Baseline)

### news.tsx — Current State
- 4 tabs: Latest, Search, Trending, Categories
- `scoreSentiment()` — keyword matching (BULLISH_WORDS / BEARISH_WORDS array), score -10 to +10
- NewsCard — shows title, description, image, tickers, sentiment badge, time
- Uses DS API: `getDSNewsLatest`, `getDSNewsSearch`, `getDSNewsCategories`, `getDSNewsTrending`
- Sentiment badge: 🟢 bullish / 🔴 bearish / ⚪ neutral (color-coded)
- No AI per-article summary, no sentiment trend, no stock-specific news

### stocks.$symbol.tsx — Current State
- 5 tabs: Overview, Financials, Technical, News, Dividends
- News tab currently renders basic news list (placeholder or DS news)
- No per-symbol news intelligence

---

## 3. What to Build

### Task A: AI-Powered Sentiment (news.tsx)

**Problem:** Keyword matching (`scoreSentiment()`) menghasilkan false positive (kata "cut" di context "cost cut" ≠ bearish) dan tidak nuanced.

**Solution:** Use `getNewsSentiment` AI server function (new) for accurate LLM-based scoring.

**Implementation:**
- New server function `getNewsSentiment` in `ai.functions.ts` — takes article title + description, returns sentiment + confidence + key_factors
- Fallback: keep `scoreSentiment()` keyword function as backup if AI fails
- Show confidence score (0-100%) as a small bar next to sentiment badge

**UI changes to NewsCard:**
- Replace simple badge with: sentiment badge + confidence bar (thin progress bar)
- Add "AI" indicator icon next to sentiment badge
- Key factors shown on hover (tooltip): "driven by: earnings beat, analyst upgrade"

---

### Task B: News Intelligence Note (news.tsx)

**Problem:** User harus baca 5-10 berita untuk dapat gambaran. Butuh AI yang rangkum.

**Solution:** Batch news into groups (by sector or time), give AI summary note.

**Implementation:**
- New tab: **"Intelligence"** (between Search and Trending)
- Fetch top 20 latest articles
- Group by: detected sector/topic (auto-categorize)
- For each group: `getNewsIntelligenceNote` AI call → 2-sentence summary + key theme
- Show as "Intelligence cards" — sector icon + headline summary + article count
- Example: "Banking Sector — 3 articles. Banks showing strong Q1 results driven by NIM expansion. Overall sentiment: cautiously bullish."

---

### Task C: Stock-Specific News (stocks.$symbol.tsx)

**Problem:** News tab di stock detail page tidak ada konten bermakna.

**Solution:** Fetch news filtered to the specific symbol.

**Implementation:**
- Replace placeholder news tab with real news for the symbol
- Call `getDSNewsSearch({ query: symbol })` or `getDSNews({ query: symbol })`
- Show: sentiment badge, headline, time, source
- Add "Sentiment Summary" box: AI analysis of recent news for this stock
- Show sentiment trend (last 7 days news) as mini bar chart
- Add: "Add to watch" button → stores symbol to localStorage watchlist

---

### Task D: Market Sentiment Dashboard (news.tsx)

**Problem:** User tidak punya gambaran market-wide sentiment.

**Solution:** Aggregate sentiment across all visible news, show as market mood indicator.

**Implementation:**
- New row at top of news page (above tabs)
- Shows: Overall Market Sentiment gauge (bullish % / neutral % / bearish %)
- Animated gauge or pie chart using CSS
- Breakdown by sector if data available
- "Last updated: X minutes ago" timestamp
- Sentiment trend: mini sparkline of sentiment score over past 24h

---

### Task E: AI Sentiment Note Server Function

**New function:** `getNewsSentiment` in `ai.functions.ts`

```typescript
export const getNewsSentiment = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    title: z.string(),
    description: z.string(),
    tickers: z.array(z.string()).optional(),
  }))
  .handler(async ({ data }) => {
    // Call AI with article text → returns structured sentiment
  });

export const getNewsIntelligenceNote = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    articles: z.array(z.object({
      title: z.string(), description: z.string(), tickers: z.array(z.string())
    })).max(20),
    sector: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    // Batch AI call → sector summary + key themes
  });
```

---

## 4. Data Sources

| Feature | Source |
|---------|--------|
| News articles | DataSectors `getDSNewsLatest`, `getDSNewsSearch`, `getDSNews` |
| AI Sentiment | `getNewsSentiment` → chatbot endpoint |
| Sector grouping | AI auto-detect from tickers/title |
| Sentiment history | localStorage (client-side, 24h rolling window) |

---

## 5. Technical Approach

### New AI Functions (ai.functions.ts)
- `getNewsSentiment` — single article LLM analysis, Indonesian output, cache 1hr per article hash
- `getNewsIntelligenceNote` — batch 20 articles → sector summary, Indonesian

### Client-Side State
- `newsSentimentCache: Record<string, { sentiment, confidence, key_factors, timestamp }>` in localStorage
- `watchlist: string[]` in localStorage for "Add to watch" feature
- Sentiment history: rolling 24h window per article URL

### Performance Strategy
- AI sentiment called lazily: only when user expands an article (click to expand)
- Batch intelligence note: cached, refresh every 15 minutes
- Use `useDeferredValue` for non-critical UI updates

---

## 6. UI Design

### News Page (news.tsx)
```
┌─────────────────────────────────────────────┐
│ Market Sentiment Gauge                      │
│ 🟢 65% Bullish  ⚪ 25%  🔴 10% Bearish     │
│ ████████████████░░░░  [sparkline 24h]      │
└─────────────────────────────────────────────┘
Tabs: Latest | Search | Intelligence | Trending | Categories

Intelligence Tab:
┌──────────────────┐ ┌──────────────────┐
│ 🏦 Banking      │ │ ⚡ Energy       │
│ 3 articles      │ │ 5 articles      │
│ "Strong Q1..."  │ │ "Regulatory..." │
│ 🟢 2.1 conf    │ │ 🔴 -1.4 conf   │
└──────────────────┘ └──────────────────┘

Latest/Search/Trending:
┌─────────────────────────────────────────────┐
│ [img] Headline text here                   │
│ Description...                             │
│ BBCA BBCA BBCA  [🟢 85%] [AI]  2h ago     │
└─────────────────────────────────────────────┘
```

### Stock Detail — News Tab
```
┌─────────────────────────────────────────────┐
│ BBCA Sentiment Summary         [★ Watch]   │
│ 🟢 Bullish  (85% confidence)               │
│ "BBCA posted strong Q1 results with..."      │
├─────────────────────────────────────────────┤
│ Recent News (7 days)                        │
│ ┌──┐ ████ ███ ████ ██ ███ ██ ███         │
│ │7d│ sentiment bar chart                    │
└─────────────────────────────────────────────┘
```

---

## 7. Out of Scope (Future)

- Push notifications for breaking news (Phase 4)
- Social media sentiment (Twitter/X, Reddit)
- News compression / summarization via DSPy
- Multi-language translation
- News deduplication

---

## 8. Acceptance Criteria

- [ ] `getNewsSentiment` server function exists and calls chatbot endpoint
- [ ] `getNewsIntelligenceNote` server function exists and batches 20 articles
- [ ] NewsCard shows AI sentiment badge with confidence bar (not just keyword badge)
- [ ] Market Sentiment Gauge visible at top of news page
- [ ] Intelligence tab shows sector-grouped AI summaries
- [ ] Stock detail News tab shows symbol-filtered news with sentiment
- [ ] Watchlist button stores to localStorage
- [ ] All builds clean (no TS errors in new files)
- [ ] All committed and pushed to GitHub
