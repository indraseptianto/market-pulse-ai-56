# Market Pulse AI-56

Dashboard pasar saham Indonesia (IDX) dengan AI-powered analysis. Built dengan TanStack Start, React 19, dan Supabase.

[![Status](https://img.shields.io/badge/status-active-brightgreen)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/indraseptianto/market-pulse-ai-56/ci.yml?branch=main&label=CI)](https://github.com/indraseptianto/market-pulse-ai-56/actions)
[![Framework](https://img.shields.io/badge/framework-TanStack%20Start-blue)](https://tanstack.com/start)
[![License](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

**Live Demo:** [market-pulse-ai-56.vercel.app](https://market-pulse-ai-56.vercel.app)

## ✨ Features

- **📊 Dashboard** — Overview pasar saham Indonesia dengan hot movers, sector heatmap, dan index tracking
- **🔍 Screener** — Filter saham berdasarkan fundamental (PER, PBV, dividend yield, dll)
- **💹 Technical Analysis** — Chart interactive dengan indikator (MA, RSI, MACD, Bollinger)
- **📈 Fair Value** — Analisis valuasi dengan DCF, relative valuation, dan AI recommendation
- **💰 Dividends** — History dividen dan yield tracker
- **📅 Earnings Calendar** — Jadwal release laporan keuangan
- **🏦 Portfolio** — Track portofolio saham dengan P&L tracking
- **📰 News & Sentiment** — News aggregator dengan sentiment analysis via AI
- **🧠 AI Analyst** — Stock chatbot powered by MiniMax M2.5 untuk analisis real-time
- **📋 Watchlist** — Custom watchlist dengan alert
- **💱 Forex** — Mata uang asing dan kurs
- **₿ Crypto** — Crypto price tracker
- **🏢 Institutional** — Data investor institusi (PTKP, Reksa Dana)
- **💵 Smart Money** — Tracking aliran dana smart money
- **🌐 IDX Data** — Direct access ke data resmi Bursa Efek Indonesia
- **📆 Corporate Events** — IPO, dividends, dan split events calendar

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start (React 19) |
| Styling | TailwindCSS v4 + shadcn/ui |
| Charts | lightweight-charts v5 + Recharts v3 |
| Data | TanStack Query v5 + DataSectors API |
| Database | Supabase (Postgres + Auth) |
| AI | MiniMax M2.5 via Hermes Router |
| Deployment | Vercel |
| Runtime | Bun / Node.js 22+ |

## 🚀 Quick Start

### Prerequisites

- Node.js 22+ atau Bun
- Supabase project (optional, untuk auth & database)
- DataSectors API key (untuk price data)

### Installation

```bash
# Clone repository
git clone https://github.com/indraseptianto/market-pulse-ai-56.git
cd market-pulse-ai-56

# Install dependencies (pakai bun recomended)
bun install
# atau npm install

# Copy environment file
cp .env.example .env
```

### Environment Variables

```env
# ============================================================
# Server-only variables (do NOT prefix with VITE_)
# ============================================================

# DataSectors API — stock price/candle data
DATASECTORS_API_KEY=your_datasectors_api_key

# Stock Chatbot AI backend (OpenAI-compatible endpoint)
OPENAI_API_BASE_URL=http://43.133.150.19:20128/v1
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=ocg/minimax-m2.5

# Gemini AI — news sentiment analysis (optional)
GEMINI_API_KEY=your_gemini_api_key

# Supabase — server-side (service role key for admin ops)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Development only — enables mock data fallback in non-production
ENABLE_MOCK_DATA=false

# ============================================================
# Client-exposed variables (prefix with VITE_)
# ============================================================

# Supabase — client-side (publishable key, safe for browser)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

### Development

```bash
bun dev      # Start development server
bun build    # Production build
bun preview  # Preview production build
bun lint     # Run ESLint
bun format   # Format code with Prettier
bun typecheck  # Run TypeScript check
```

### Build & Deploy

```bash
# Production build (automated via Vercel)
bun build

# Manual deploy to Vercel
vercel --prod
```

## 📁 Project Structure

```
market-pulse-ai-56/
├── src/
│   ├── components/          # React components (shadcn + custom)
│   │   ├── ui/              # shadcn/ui base components
│   │   ├── charts/           # Chart components
│   │   ├── screener/         # Screener widgets
│   │   ├── sectors/          # Sector analysis
│   │   └── stock/            # Stock detail components
│   ├── routes/               # TanStack Router pages (21 routes)
│   │   ├── index.tsx         # Dashboard
│   │   ├── screener.tsx      # Stock screener
│   │   ├── stocks.$symbol.tsx # Stock detail
│   │   └── ...               # 21 routes total
│   ├── lib/
│   │   ├── ai.functions.ts   # AI server functions (7 functions)
│   │   ├── datasectors.functions.ts # DataSectors API integration
│   │   ├── supabase/          # Supabase client + hooks
│   │   ├── mock-data.ts       # Mock data for development
│   │   └── utils.ts           # Utility functions
│   ├── server.ts              # Server entry (SSR + AI proxy)
│   └── routeTree.gen.ts       # Generated route tree
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql   # Database schema + RLS
│       └── 002_portfolio_alerts.sql # Portfolio & alerts tables
├── public/                   # Static assets
├── .env.example              # Environment template
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vercel.json               # Vercel deployment config
```

## 🗄️ Database Schema

### Running Migrations

Run both migrations in **Supabase SQL Editor** (Dashboard → SQL Editor → New query):

**Step 1:** Run `supabase/migrations/001_initial_schema.sql`
```sql
-- Paste contents of 001_initial_schema.sql and execute
```

**Step 2:** Run `supabase/migrations/002_portfolio_alerts.sql`
```sql
-- Paste contents of 002_portfolio_alerts.sql and execute
```

### Schema Tables

| Table | Purpose | Auth |
|-------|---------|------|
| `public.watchlist_items` | User watchlist with RLS | User owns their items |
| `public.alerts` | Price/volume/RSI/dividend alerts | User owns their alerts |
| `public.user_settings` | Theme, language, AI tone preferences | User owns their settings |
| `public.screener_presets` | Saved screener filter presets | User owns their presets |
| `public.portfolio_positions` | Stock positions (Supabase sync) | User owns their positions |
| `public.portfolio_transactions` | BUY/SELL/DIV transactions | User owns their transactions |
| `public.portfolio_snapshots` | Daily P&L snapshots for history | User owns their snapshots |

All tables have Row Level Security (RLS) policies for data isolation. A trigger auto-creates `user_settings` on new user signup.

## 🤖 AI Features

7 AI server functions:

1. `getMarketSummary` — Market overview dengan AI commentary
2. `getStockAnalysis` — Deep dive analysis per stock
3. `getTechnicalAnalysis` — Technical indicator analysis
4. `getIntelligenceNote` — Trading signal dengan risk assessment
5. `getDividendNote` — Dividend stock analysis
6. `getNewsSentiment` — News sentiment scoring
7. `getNewsIntelligence` — News intelligence briefing

All AI calls memiliki:
- Retry logic dengan exponential backoff
- 1-hour cache untuk menghindari rate limit
- Fallback ke cached data kalau AI unavailable

## 🌐 API Integrations

| Source | Purpose | Auth |
|--------|---------|------|
| DataSectors | Stock prices, candles, financials, dividends, earnings, IPO | API Key |
| IDX | Official stock data | Public |
| Supabase | User data, auth, persistence | Client/Service key |
| Hermes Router | AI chatbot | Bearer token |
| MiniMax M2.5 | AI analysis | Internal routing |

## 📊 Available Routes (21 total)

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Market overview, hot movers, indices |
| `/screener` | Screener | Filter saham dengan 20+ criteria |
| `/stocks/:symbol` | Stock Detail | Price chart, financials, news, AI analysis |
| `/portfolio` | Portfolio | Portfolio tracker dengan P&L |
| `/dividends` | Dividends | Dividend history & yield |
| `/technical` | Technical | Technical analysis tools |
| `/fair-value` | Fair Value | Valuation analysis |
| `/earnings` | Earnings | Earnings calendar |
| `/calendar` | Calendar | Corporate actions calendar |
| `/corporate-events` | Corporate Events | IPO, dividends, splits events |
| `/institutional` | Institutional | Institusional ownership data |
| `/smart-money` | Smart Money | Smart money flow tracking |
| `/news` | News | News feed dengan sentiment |
| `/sectors` | Sectors | Sector analysis & heatmap |
| `/watchlist` | Watchlist | User watchlist |
| `/settings` | Settings | App preferences |
| `/crypto` | Crypto | Crypto price tracker |
| `/forex` | Forex | Currency rates |
| `/idx-data` | IDX Data | Official IDX data access |

## 🧪 Development

### Adding a New Route

```bash
# Buat route baru di src/routes/
src/routes/new-page.tsx
# Route otomatis register via TanStack Router convention
```

### Adding shadcn/ui Components

```bash
npx shadcn@latest add button
```

### Database Migrations

```bash
# Apply migrations to Supabase
supabase db push
# atau via Supabase dashboard
```

## 📝 License

MIT License — see [LICENSE](LICENSE) file.

## 🙏 Credits

- [TanStack Start](https://tanstack.com/start) — Full-stack React framework
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [DataSectors](https://datasectors.io) — Stock market data
- [Supabase](https://supabase.com) — Database & Auth