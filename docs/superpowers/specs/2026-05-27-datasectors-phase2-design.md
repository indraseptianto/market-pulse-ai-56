# Phase 2 Implementation — Smart Money, Dividends, Custom Charts + AI Upgrade

**Date:** 2026-05-27
**Status:** Design Approved
**Scope:** Smart Money Scanner + Dividend Features + Custom Charts + AI Endpoint Upgrade

---

## 1. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Frontend                            │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐  │
│  │ /smart  │  │ /dividend│  │ Chart     │  │ Stocks   │  │
│  │ -money  │  │          │  │ (Drawing, │  │ $symbol  │  │
│  │ Scanner │  │ Scanner  │  │ Templates,│  │ + AI Note│  │
│  └────┬────┘  └────┬─────┘  │ Multi-tick)│  │ + Div Tab│  │
│       │            │        └────┬───────┘  └────┬─────┘  │
│  ┌────▼────────────▼────────────▼────────────────▼─┐  │
│  │     datasectors.functions.ts (Smart Money + Div)  │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           │                              │
│  ┌────────────────────────▼─────────────────────────┐   │
│  │            ai.functions.ts (NEW ENDPOINT)        │   │
│  │  base_url: http://43.133.150.19:20128/v1        │   │
│  │  model: kimi-minimax-m2.5                       │   │
│  │  retry: 1x after 3s → cached fallback         │   │
│  └─────────────────────────────────────────────────┘   │
│                           │                              │
│  ┌────────────────────────▼─────────────────────────┐   │
│  │         DataSectors API + localStorage          │   │
│  │  (drawings, templates, analysis cache)           │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 2. AI Functions — Updated Endpoint

### Configuration
- **BASE_URL:** `http://43.133.150.19:20128/v1`
- **API_KEY:** from `process.env.AI_ANALYST_API_KEY`
- **MODEL:** `kimi-minimax-m2.5`
- **Temperature:** 0.25

### Retry + Cache Strategy

```
Request → API call
  ├── Success (200) → return response
  ├── Rate Limited (429) → wait 3s → retry once
  │     ├── Success → return response + cache
  │     └── Fail → fallbackCached()
  └── Other Error → fallbackCached()

fallbackCached():
  ├── Check localStorage AI_CACHE
  │     ├── Fresh cache (< 1 hour) → return cached text + note
  │     └── Stale cache (> 1 hour) → return "AI rate limited. Last cached: [text]"
  └── No cache → return "AI is rate-limited. Try again shortly."
```

### Cache Structure (localStorage key: `stratum_ai_cache`)
```typescript
{
  [symbol: string]: {
    timestamp: number,  // Date.now()
    text: string,       // AI response
    type: "market" | "stock" | "technical" | "intelligence" | "dividend"
  }
}
```

### Server Functions (unchanged signatures, new implementation)
1. `getMarketSummary` — market briefing, 3 sentences
2. `getStockAnalysis` — equity analyst note, 4 sentences with risk score 1-10
3. `getTechnicalAnalysis` — trader-grade technical note, 4 sentences with Buy/Hold/Sell call
4. `getStockIntelligenceNote` — Indonesian analyst note, 5 bullets + stance
5. `getDividendNote` — (NEW) dividend sustainability note, 4 bullets: yield safety, payout ratio, cash flow, overall stance

---

## 3. Smart Money Scanner Page

**File:** `src/routes/smart-money.tsx` (NEW)
**URL:** `/smart-money`

### Header
- Title: "Smart Money Tracker"
- Subtitle: "Pantau akumulasi dan distribusi institusi besar"
- DataSourceBadge: DS

### Filter Bar
- **Timeframe selector:** 1D, 1W, 1M (default), 3M, 6M, 1Y — pill buttons
- **Signal filter:** All, 🟢 Akumulasi Aktif, 🔴 Distribution, ⚪ Neutral
- **Sort by:** Net Flow (default), Volume, Ownership Change, Signal Strength
- **Min flow input:** number field (default 0 = show all)
- **Refresh button** with spinning state

### Table
| Column | Description |
|---|---|
| Symbol | Link to `/stocks/$symbol` |
| Last | Current price |
| Chg% | % change with color |
| Net Flow | Net foreign flow in IDR (fmtCompact) |
| Volume | Foreign volume |
| Inst. Own% | Institutional ownership % |
| Own Δ | Ownership change from period |
| Signal | 🟢 / 🔴 / ⚪ badge |
| Sparkline | 1M mini chart (30 data points) |

- Pagination: 20 rows per page
- Row click → navigate to stock detail

### DS API Usage
- `getInstitutionalInvestors` — fetch all institutional activity
- `getInvestorActivity` — per-symbol historical for sparklines
- `getCandles` — for sparkline data (1M daily candles)

### Implementation Notes
- Use `useQueries` for sparklines (batch fetch top 20)
- Lazy load paginated data
- Signal calculation: net positive flow > threshold = 🟢, net negative = 🔴, else ⚪

---

## 4. Dividend Features

### A) Stock Detail Dividend Tab

**File:** `src/components/stock/DividendTab.tsx` (NEW)
**Integration:** Add tab to `stocks.$symbol.tsx` — new tab "Dividends" after "Overview"

#### Tab Content
1. **Summary Stats Row:**
   - Current Yield% (large number)
   - DPS (Dividend Per Share)
   - Frequency badge: Annual / Semi-Annual / Quarterly
   - Payout Ratio %
   - Next Ex-Date countdown (or "N/A" if not available)

2. **Dividend History Timeline:**
   - Bar chart: dividend amount per year (last 5 years)
   - X-axis: year, Y-axis: DPS in IDR
   - Hover: exact amount + ex-date
   - Color: green bars for positive trend, red for declining

3. **AI Dividend Note:**
   - Call `getDividendNote` with: yield%, payout ratio, DPS, frequency, sector
   - Display in a GlassCard with AI badge
   - Loading state with Skeleton
   - Rate limit fallback: "AI sedang diproses, coba lagi nanti."

4. **Dividend Events List:**
   - Last 8 dividend events (date, ex-date, amount, status: Paid/Upcoming)
   - Table format: Date | Ex-Date | DPS (IDR) | Total Dividend | Status

#### Data Sources
- `getEquityDetail` — existing dividend fields (dividend_yield, dividend_per_share, etc.)
- `getStockEarnings` — historical dividends if available in earnings data
- Fallback: parse from quarterly financials if DS doesn't have explicit dividend endpoint

### B) Dividend Scanner Page

**File:** `src/routes/dividends.tsx` (NEW)
**URL:** `/dividends`

#### Header
- Title: "Dividend Tracker"
- Subtitle: "Pendapatan passive dari dividen berkualitas"
- DataSourceBadge: DS

#### Filter Bar
- **Min Yield:** slider 0-15% (default 2%), shows count
- **Frequency:** All, Annual, Semi-Annual, Quarterly
- **Sector:** dropdown of sectors
- **Sort by:** Yield% (default), DPS, Payout Ratio, Ex-Date
- **Upcoming ex-dates:** toggle "This Week" / "This Month" / "All"

#### Table
| Column | Description |
|---|---|
| Symbol | Link to `/stocks/$symbol` |
| Name | Company name |
| Price | Current price |
| Yield% | Dividend yield with color (green > 5%, yellow 2-5%, white < 2%) |
| DPS | Dividend per share |
| Payout% | Payout ratio |
| Frequency | Badge: Annual / Semi / Quarter |
| Next Ex-Date | Countdown ("3 days" in red, "15 days" normal, "N/A") |
| Yield Trend | Sparkline: 5-year yield trend |

- Pagination: 20 per page
- Row click → navigate to stock detail with Dividends tab active

#### Calendar Widget
- "Upcoming Ex-Dates This Month" — top 10 sorted by closest ex-date
- Each row: Symbol, Name, Ex-Date, Days until, Yield%
- Countdown highlights: < 7 days = red, < 14 days = yellow

#### DS API Usage
- `getStockEquitiesV2` — all stocks with dividend fields
- `getEquityDetail` — per-stock dividend details
- Fallback: compute yield from `dividend_yield` field, estimate ex-dates from historical pattern

---

## 5. Custom Charts

**File:** `src/components/charts/AdvancedChart.tsx` (extend existing)

### A) Drawing Tools

**Toolbar overlay** (floating, top-right of chart):
- Tool buttons: Line, Fibo Retracement, Horizontal Line, Arrow, Clear
- Color picker: 6 preset colors (red, green, blue, yellow, white, orange)
- Line width: thin (1px), medium (2px), thick (3px)
- "Save Drawing" auto-saves on change

**Storage:** `localStorage` key: `stratum_drawings`
```typescript
{
  [symbol: string]: {
    [timeframe: string]: Drawing[]  // Drawing = { type, points, color, width }
  }
}
```

**Implementation:**
- SVG overlay on top of candlestick chart
- Mouse events: mousedown → mousemove → mouseup for drawing
- Fibonacci: auto-calculate levels 0%, 23.6%, 38.2%, 50%, 61.8%, 100%
- Load drawings on symbol/timeframe change
- Multi-timeframe sync: drawings on 1D visible when switching to 1W (optional toggle)

### B) Chart Templates

**Template selector dropdown** (in chart toolbar):
- Preset templates: "Default", "Scalping Setup", "Swing Trade", "Investment View"
- Each template has: timeframe, indicator set, overlays, comparison tickers

**Template structure** (localStorage key: `stratum_chart_templates`):
```typescript
interface ChartTemplate {
  id: string;
  name: string;
  indicators: string[];        // ["RSI", "MACD", "BB"]
  overlays: string[];          // ["SMA20", "SMA50"]
  comparison: string[];        // ["BBRI", "ANTM"]
  timeframe: string;
  chartType: "candle" | "line" | "area";
}
```

**Implementation:**
- Quick switch dropdown in chart toolbar
- "Save as Template" button → name input modal → save to localStorage
- "Manage Templates" → list all saved, delete option
- Templates persist across sessions

### C) Multi-Symbol Comparison

**Comparison panel** (below chart):
- "+ Add ticker" input field
- Up to 5 tickers in overlay
- Normalize: all prices set to 0% at chart start date
- Color-coded: each ticker has unique color (cycling through 8 preset colors)
- Legend: ticker name + current % change + color swatch

**Correlation matrix** (sidebar, collapsible):
- Compute Pearson correlation between normalized price series
- Show: ticker1 vs ticker2 = +0.72 (green) / -0.45 (red)
- Only shown when 2+ tickers added

**Implementation:**
- Fetch candles for each comparison ticker (batch via `Promise.all`)
- Normalize: `normalized[i] = ((price[i] / price[0]) - 1) * 100`
- Render as line chart overlaid on main candlestick
- Axis: % change (0% center line), right-side Y axis for comparison

---

## 6. Stocks Symbol Page Changes

### New Dividends Tab
- Add to tab list: Overview | Financials | Technical | Dividends | News
- Default: Overview tab active
- Link from dividend scanner: navigate with `?tab=dividends`

### Tab routing
- Parse `?tab=` from URL, fallback to "overview"
- Preserve tab state on navigation

---

## 7. DataSectors Functions — Additions

### New Functions
1. `getDividendNote` — AI-powered dividend analysis (4 sentences)
2. `getSmartMoneyScanner` — fetch all stocks with smart money signals
3. `getDividendScanner` — fetch all stocks sorted by dividend yield

### Changes to Existing
- `getEquityDetail` — ensure dividend fields are in return type: `dividend_yield`, `dividend_per_share`, `dividend_frequency`, `payout_ratio`, `last_dividend_date`
- `getInstitutionalInvestors` — ensure return includes: `net_flow`, `volume`, `ownership_pct`, `ownership_change`, `signal`

---

## 8. Error Handling

| Scenario | Behavior |
|---|---|
| AI rate limited (429) | Retry once after 3s → cache fallback |
| AI error | Display "AI sedang diproses, coba lagi nanti." with retry button |
| DS smart money fails | Show empty state with "Data tidak tersedia" + retry |
| DS dividends fails | Show empty state, hide dividend tab |
| Chart drawing fails | Silently skip, no user-facing error |
| localStorage full | Graceful degradation, drawings not saved |

---

## 9. File Changes Summary

| File | Action | Lines | Priority |
|---|---|---|---|
| `src/lib/ai.functions.ts` | Replace with new endpoint + retry + cache | ~130 | P1 |
| `src/routes/smart-money.tsx` | NEW — Smart Money Scanner | ~350 | P2 |
| `src/routes/dividends.tsx` | NEW — Dividend Scanner | ~400 | P3 |
| `src/routes/stocks.$symbol.tsx` | Add Dividends tab + tab routing | ~+80 | P3 |
| `src/components/stock/DividendTab.tsx` | NEW — dividend timeline + AI note | ~250 | P3 |
| `src/components/charts/AdvancedChart.tsx` | Extend — Drawing, Templates, Compare | ~+350 | P4 |
| `src/lib/datasectors.functions.ts` | Add: getDividendNote, getSmartMoneyScanner, getDividendScanner | ~+80 | P1 |
| **Total** | | **~1,720 lines** | |

---

## 10. Dependencies

- No new npm packages required
- Reuse existing: recharts, lucide-react, tailwind, @tanstack/react-query
- localStorage for drawings, templates, AI cache (no server storage needed)

---

## 11. Testing Checklist

- [ ] AI endpoint responds with correct model
- [ ] Retry triggers on 429, cache fallback works after 2 failures
- [ ] Smart Money table loads with sparklines
- [ ] Smart Money filters (timeframe, signal, sort) work correctly
- [ ] Dividend timeline renders on stock detail
- [ ] AI Dividend Note generates and displays
- [ ] Dividend Scanner table sorts by yield
- [ ] Ex-date countdown accurate
- [ ] Drawing tools: line, fibo, horizontal draw and save
- [ ] Chart templates save/load
- [ ] Multi-ticker comparison normalized correctly
- [ ] Full flow: Smart Money → Stock Detail → Chart → AI Note works end-to-end