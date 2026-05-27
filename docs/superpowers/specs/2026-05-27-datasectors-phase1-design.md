# Phase 1 Implementation — DataSectors API Full Integration

**Date:** 2026-05-27
**Status:** Design Approved
**Scope:** Technical Indicators + Finance News + Economic Calendar

---

## 1. Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                  │
│                                                      │
│  Lazy-loaded per tab (on mount):                     │
│  ┌─ Tab activated ─┐  ┌─ Tab activated ─┐          │
│  │ Technical        │  │ News            │          │
│  │ → Skeleton       │  │ → Skeleton       │          │
│  │ → Fetch DS API   │  │ → Fetch DS API   │          │
│  │ → Show + Cache   │  │ → Show + Cache   │          │
│  └──────────────────┘  └──────────────────┘          │
│                                                      │
│  Cache Layer (2-5 min TTL, stale-while-revalidate)  │
│  ┌─────────────────────────────────────────────────┐│
│  │ DS Response Cache │ Client Fallback │ Mock Data ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  DataSectors API (rate-limited, batched where avail) │
│  Hybrid fallback (client-side indicators.ts)          │
│  Tiingo (reduced, news fallback only)                │
└─────────────────────────────────────────────────────┘
```

### 1.2 Performance Strategy

| Strategy | Implementation |
|---|---|
| Lazy Loading | Each tab fetches only when activated |
| Cache TTL | 2 minutes (indicators), 5 minutes (news/calendar) |
| Skeleton-first | Immediate UI feedback, async data fetch |
| Batch requests | Indicator requests batched client-side before DS call |
| Fallback chain | DS → indicators.ts (client) → mock |

### 1.3 Fallback Chain

| Scenario | Behavior |
|---|---|
| DS rate limit hit | Fallback to `indicators.ts` (client-side) for technical |
| DS news fails | Show empty state + retry, no Tiingo fallback |
| DS calendar fails | Show cached data if available, else empty state |
| Network error | Per-feature error boundary, feature stays usable |
| All DS down | All features fallback to client-side/mock, app fully functional |

---

## 2. Technical Indicators

### 2.1 Approach: Hybrid (B)

- **Client-side** for basic indicators: SMA, EMA, RSI, MACD, Bollinger, ATR, Stochastic, VWAP (existing `indicators.ts`)
- **DS API** for advanced indicators: Ichimoku, Fibonacci, Parabolic SAR, ADX, CCI, Williams %R, etc.
- **Indicator picker** with searchable dropdown, grouped by category

### 2.2 New Functions in `datasectors.functions.ts`

| Function | Endpoint | Purpose |
|---|---|---|
| `getIndicator` | `/api/indicator/calculate` | Already exists — refine |
| `getIndicatorList` | `/api/indicator/list` | List all 50+ available indicators |
| `getIndicatorBatch` | Batch client-side | Fetch multiple indicators in one DS call |

### 2.3 UI Changes — `src/routes/technical.tsx`

**New layout:**
- **Explore Mode:** Symbol input + Indicator picker + Per-symbol chart grid
- **Scan Mode:** Universe selector + Batch indicator calculation + Enhanced table
- **Toggle:** Switch between modes
- **Indicator picker:** Searchable dropdown, grouped by category (Moving Average, Momentum, Trend, Volatility, Volume, Other)

### 2.4 New Components — `src/components/technical/`

| Component | Purpose |
|---|---|
| `IndicatorPicker.tsx` | Searchable dropdown with category grouping |
| `IndicatorChart.tsx` | Chart with selected indicator overlay |
| `TechnicalScanTable.tsx` | Enhanced table with more columns |

### 2.5 Keep Unchanged

- `src/lib/indicators.ts` — client-side computation, fallback when DS rate limited

---

## 3. Finance News

### 3.1 Approach: Full DS Integration (A)

Replace Tiingo dependency with all 4 DS news endpoints.

### 3.2 New Functions in `datasectors.functions.ts`

| Function | Endpoint | Purpose |
|---|---|---|
| `getDSNewsSearch` | `/api/news/search` | Full-text search across news |
| `getDSNewsLatest` | `/api/news/latest` | Latest news per symbol/market |
| `getDSNewsCategories` | `/api/news/categories` | News categories with counts |
| `getDSNewsTrending` | `/api/news/trending` | Trending news |
| `getDSNews` | Keep | Mark as deprecated, keep for backward compat |

### 3.3 UI Changes — `src/routes/news.tsx`

**Tab layout:**
- "Latest" — Latest news feed
- "Search" — Full-text search with date range, source filter, ticker filter
- "Trending" — Top stories with sentiment heat
- "Categories" — Category cards with article counts

**Improved article cards:**
- Sentiment badge (bullish/bearish/neutral)
- Ticker chips
- Image thumbnail
- Source + time ago

---

## 4. Economic Calendar

### 4.1 Approach: Full DS Integration (A)

Connect all 11 calendar endpoints.

### 4.2 New Functions in `datasectors.functions.ts`

| Function | Endpoint | Purpose |
|---|---|---|
| `getEconomicCalendar` | `/api/calendar` | Already exists — keep primary |
| `getCalendarIndicators` | `/api/calendar/indicators` | Events by indicator (NFP, GDP, CPI) |
| `getCalendarCurrencies` | `/api/calendar/currencies` | Events by currency (USD, EUR, IDR) |
| `getCalendarCountries` | `/api/calendar/countries` | Events by country |
| `getCalendarImportance` | `/api/calendar/importance` | Events by importance |
| `getCalendarVolatility` | `/api/calendar/volatility` | Events by volatility |
| `getCalendarUpcoming` | `/api/calendar/upcoming` | Upcoming high-impact events |
| `getCalendarHistorical` | `/api/calendar/historical` | Past events with actual data |
| `getCalendarConsensus` | `/api/calendar/consensus` | Consensus vs actual |
| `getCalendarDateRange` | `/api/calendar/date-range` | Events in specific range |

### 4.3 UI Changes — `src/routes/calendar.tsx`

**Filter sidebar:**
- Currency filter (USD, EUR, IDR, etc.)
- Country filter
- Importance filter (High/Medium/Low)
- Volatility filter
- Date range picker

**View modes:**
- "Timeline" (default) — chronological event list
- "Grid" — heatmap by country/impact
- "List" — compact list with filters

**Additional UI:**
- "Upcoming" highlight section for next 24h high-impact events
- "Historical" tab showing past events with actual vs forecast
- Event detail modal with full data (actual, forecast, previous, consensus)

---

## 5. Shared Components

### 5.1 New Shared Components — `src/components/shared/`

| Component | Purpose |
|---|---|
| `DataSourceBadge.tsx` | Shows "DS" vs "Client" vs "Mock" source per data fetch |
| `RateLimitIndicator.tsx` | Shows DS API usage (requests remaining, warn at 80%) |
| `ErrorBoundary.tsx` | Graceful fallback per feature |
| `LoadingSkeleton.tsx` | Unified loading state |

---

## 6. File Changes Summary

| File | Action | Est. Lines |
|---|---|---|
| `src/lib/datasectors.functions.ts` | Modify — add 12 new functions | +450 |
| `src/lib/indicators.ts` | Keep unchanged | 0 |
| `src/routes/technical.tsx` | Redesign — add indicator picker, chart grid, mode toggle | +300 |
| `src/routes/news.tsx` | Redesign — tab layout, full DS integration | +250 |
| `src/routes/calendar.tsx` | Redesign — sidebar filters, view modes, new tabs | +300 |
| `src/components/technical/IndicatorPicker.tsx` | New | +200 |
| `src/components/technical/IndicatorChart.tsx` | New | +180 |
| `src/components/technical/TechnicalScanTable.tsx` | New | +150 |
| `src/components/shared/DataSourceBadge.tsx` | New | +30 |
| `src/components/shared/RateLimitIndicator.tsx` | New | +40 |
| `src/components/shared/ErrorBoundary.tsx` | New | +60 |
| `src/components/shared/LoadingSkeleton.tsx` | New | +40 |
| **Total** | | **~2,000 lines** |

---

## 7. Testing Strategy

| Test Type | Scope |
|---|---|
| Unit tests | New functions in `datasectors.functions.ts` with mocked DS responses |
| Integration tests | DS API calls with real API key (rate-limit aware) |
| E2E smoke tests | All 3 pages load without console errors |
| Fallback tests | Simulate DS failure, verify graceful degradation |

---

## 8. Delivery

**Approach:** Big Bang — all 3 features complete + integrated together before commit.

**Verification criteria:**
- All 3 pages load without console errors
- Technical scanner shows indicator picker + DS indicator data
- News page has tab layout with full-text search
- Calendar page has filter sidebar with all 11 endpoint data visible
- Fallback works when DS rate limited or down
- No breaking changes to existing functionality