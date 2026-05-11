# Phase 1: Premium Stock Analytics Platform — Core Foundation

A dark-mode fintech dashboard powered by DataSectors API, built on the existing TanStack Start template. This phase delivers the core layout, navigation, theming, and four key pages. Remaining pages (Technical Analysis, News, Economic Calendar, Crypto, Forex, Watchlist) ship in follow-up phases.

## What ships in Phase 1

**Pages**
- `/` Dashboard — market overview, top gainers/losers, sector performance strip, trending stocks, ticker tape, AI market summary card
- `/screener` Advanced Screener — filters (PE, PB, ROE, ROA, D/E, dividend yield, sector, market cap), sortable data table, pagination
- `/stocks/$symbol` Stock Detail — company profile, price/candlestick chart, key ratios, financials snapshot, AI stock analysis
- `/settings` Settings — theme toggle, AI preferences, notification toggles, language selector, watchlist management stub

**Shell & UX**
- Collapsible sidebar (shadcn `sidebar`) with icons + labels, sticky top navbar, search command palette (`cmd+k`)
- Dark theme as default with premium fintech tokens (deep navy background, neon-green/red gain-loss, glass cards, 2xl radii)
- Framer Motion page transitions, animated counters, skeleton loaders, smooth hover states
- Mobile-first responsive (sidebar collapses to sheet on mobile)

**Data layer**
- Lovable Cloud enabled; `DATASECTORS_API_KEY` stored as a secret
- Server functions proxy DataSectors endpoints (key never touches the browser):
  - `getEquities`, `getKeyRatios`, `getCandles`, `getEquityDetail`
- TanStack Query for caching, retries, loading states; typed responses with Zod
- Mock-data fallback when API returns empty/errors so UI is always demonstrable

**AI insights**
- Server function calling Lovable AI Gateway (`google/gemini-3-flash-preview`)
- Two endpoints: market summary (dashboard) + per-stock analysis (detail page)
- Surfaces 402/429 with friendly toasts

## Out of scope (later phases)

Technical Analysis page + indicator endpoints, News, Economic Calendar, Crypto, Forex, Watchlist persistence, command-palette global symbol search, TradingView-grade charts (Phase 1 uses Recharts).

## Technical details

**File structure**
```text
src/
  routes/
    __root.tsx                 # adds SidebarProvider, QueryClientProvider, Toaster, theme
    index.tsx                  # Dashboard
    screener.tsx
    stocks.$symbol.tsx
    settings.tsx
  components/
    layout/{AppSidebar,TopNav,CommandPalette,PageTransition}.tsx
    dashboard/{MarketOverview,GainersLosers,SectorStrip,TickerTape,AISummaryCard}.tsx
    screener/{FiltersPanel,ScreenerTable}.tsx
    stock/{PriceChart,KeyRatiosGrid,CompanyHeader,AIAnalysis}.tsx
    common/{StatCard,AnimatedNumber,Sparkline,GlassCard,LoadingSkeleton}.tsx
  lib/
    datasectors.server.ts      # fetch wrapper, retries, error normalization
    datasectors.functions.ts   # createServerFn endpoints
    ai.functions.ts            # Lovable AI summaries
    mock-data.ts               # fallback datasets
    formatters.ts              # currency, %, large numbers
  styles.css                   # dark-first fintech tokens
```

**Design tokens (in `src/styles.css`, oklch)**
- `--background` deep navy, `--card` slightly elevated glass, `--primary` cyan/blue accent, `--success` green for gains, `--destructive` red for losses, `--chart-1..5` for sectors. Glass utility class with subtle border + backdrop-blur. Default `<html class="dark">`.

**Server functions pattern**
- All DataSectors calls go through `createServerFn` in `datasectors.functions.ts`, helpers in `datasectors.server.ts` (Node-incompat-free: `fetch` only).
- Retry with exponential backoff (max 2), 10s timeout, normalized error shape `{ data, error }` so components never crash.
- Cache via TanStack Query: 60s stale time for lists, 30s for detail, 10min for ratios.

**Charts**
- Recharts `AreaChart` for price, custom candle renderer using `ComposedChart` + `Bar`/`Customized`. Lazy-imported per route to keep main bundle slim.

**Routing**
- Each route has its own `head()` with unique title/description/og.
- `errorComponent` + `notFoundComponent` on data routes; root keeps existing 404.

**Mobile**
- Sidebar uses shadcn `collapsible="icon"` on desktop, `Sheet` on mobile via `useIsMobile`.
- Tables become horizontally scrollable cards under `md`.

## Setup steps order
1. Enable Lovable Cloud, add `DATASECTORS_API_KEY` secret.
2. Update `styles.css` with dark fintech tokens; force dark mode on `<html>`.
3. Build layout shell (`__root.tsx`, sidebar, topnav, command palette stub).
4. Implement `datasectors.functions.ts` + mock fallback.
5. Build Dashboard, Screener, Stock Detail, Settings pages in that order.
6. Wire AI server function and surface in Dashboard + Stock Detail.
7. QA across mobile/desktop; verify build.
