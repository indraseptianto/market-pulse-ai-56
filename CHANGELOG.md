# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-05-28

### Added

- **AI Chatbot (2 endpoints)**
  - `/api/stock-chat` — Stock chatbot for IDX analysis (STOCK_CHAT_BASE_URL)
  - `/api/chat` — Generic AI chatbot with OpenAI-compatible endpoint (OPENAI_API_BASE_URL, model `ocg/minimax-m2.5`)

- **8 DataSectors API endpoints**
  - `getStockDividendsEvents` — Dividend events by date range
  - `getStockDividendsDetails` — Per-ticker dividend history
  - `getStockEarningsEvents` — Earnings events by date range
  - `getStockEarningsDetails` — Per-ticker earnings history
  - `getStockIPOEvents` — IPO calendar by date range
  - `getStockSplitsEvents` — Stock split events by date range
  - `getStockSplitsDetails` — Per-ticker split history
  - `getNewsSearch` — Full-text news search with filters

- **Corporate Events Calendar page** (`/corporate-events`)
  - 3-tab layout: Earnings / Dividends / IPO
  - Date range selector (This Week / This Month / Next Month)
  - Search by ticker/company name
  - Event cards with countdown badges, beat/miss indicators

- **GitHub Actions CI pipeline**
  - Lint + Type check on push/PR
  - Build step with mock data for CI environment
  - Auto-cancels redundant runs

- **CONTRIBUTING.md** — Developer guide with branch strategy and PR checklist

### Changed

- **StockChatbot** — Now uses `/api/chat` endpoint with OPENAI_API_BASE_URL config
- **README** — Updated env vars, route count (21), badges, API integrations table
- **Supabase client** — Graceful fallback when not authenticated (SSR-safe)
- **Forex page** — Error propagation to UI (shows error state not just "Data tidak tersedia")
- **Stochastic indicator** — Fixed overflow (Math.max → loop, avoids RangeError on large arrays)
- **TickerTape** — Default empty array, null safety for equities prop
- **Sectors page** — Hydration fix (Math.random() → sin/cos deterministic)
- **Console logs** — All removed from production (now `if (import.meta.env.DEV)`)
- **Watchlist mutations** — Optimistic updates with rollback on failure
- **getCurrentUserId** — 30s in-memory cache to avoid 6+ redundant calls per page load
- **CSV Import** — File size validation (max 2MB) + type check

### Fixed

- **isCloudConnected badge** — Now checks `data !== null` (not just `!isError`)
- **Rate limiter** — Added to `/api/stock-chat` endpoint
- **Env var mismatch** — All env vars now have matching `.env.example` entries
- **Rules of Hooks** — Corrected useQueries pattern in forex.tsx
- **nginx proxy** — Fixed cryptoalert dashboard (8888 → 8787 port)

### Documentation

- README env vars updated to reflect actual current vars
- Route table expanded from 15 → 21 routes
- Added Vercel deployment badge and CI badge
- Added Vercel deployment URL to project header