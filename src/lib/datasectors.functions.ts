import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dsFetch, unwrapList } from "./datasectors.server";
import {
  type Equity,
  type Candle,
  mockEquities,
  mockCandles,
  findMockEquity,
} from "./mock-data";

export interface SearchResult {
  id: string;
  symbol: string;
  description: string;
  exchange: string;
  fullExchange: string;
  type: string;
}

export const searchStocks = createServerFn({ method: "GET" })
  .inputValidator(z.object({ query: z.string().min(1).max(50) }))
  .handler(async ({ data }) => {
    console.log("[searchStocks] query:", data.query);
    const { data: payload, error } = await dsFetch<{
      success: boolean;
      data: Array<{
        id: string;
        symbol: string;
        description: string;
        exchange: string;
        fullExchange: string;
        type: string;
      }>;
      count: number;
    }>(`/search/market`, { query: { query: data.query } });

    console.log("[searchStocks] raw payload:", JSON.stringify(payload)?.slice(0, 500));

    if (error || !payload) {
      console.warn("[searchStocks] error:", error);
      return { data: [] as SearchResult[], source: "error" as const, error };
    }

    // API returns { success: true, data: [...], count: N }
    const raw = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.data)
        ? payload.data
        : [];

    const results: SearchResult[] = raw
      .map((item) => ({
        id: (item.id as string) || `${item.exchange}:${item.symbol}`,
        symbol: (item.symbol as string) || "",
        description: (item.description as string) || "",
        exchange: (item.exchange as string) || "",
        fullExchange: (item.fullExchange as string) || (item.exchange as string) || "",
        type: (item.type as string) || "stock",
      }))
      .filter((r) => r.symbol !== "");

    console.log("[searchStocks] mapped results count:", results.length, results.slice(0, 3));
    return { data: results, source: "api" as const, error: null };
  });

// Best-effort mapper — DataSectors may return varied keys; map what we know,
// fall back gracefully.
function mapEquity(raw: Record<string, unknown>): Equity | null {
  const symbol =
    (raw.symbol as string) ||
    (raw.ticker as string) ||
    (raw.code as string) ||
    "";
  if (!symbol) return null;
  const num = (k: string): number | null => {
    const v = raw[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  return {
    symbol: symbol.toUpperCase(),
    name: (raw.name as string) || (raw.company_name as string) || symbol,
    price: num("price") ?? num("last") ?? num("close") ?? 0,
    change: num("change") ?? 0,
    change_pct:
      num("change_pct") ?? num("change_percent") ?? num("percent_change") ?? 0,
    volume: num("volume") ?? 0,
    market_cap: num("market_cap") ?? num("marketCap") ?? 0,
    sector: (raw.sector as string) || "Unknown",
    industry: (raw.industry as string) || undefined,
    pe_ratio: num("pe_ratio") ?? num("pe"),
    pb_ratio: num("pb_ratio") ?? num("pb"),
    roe: num("roe"),
    roa: num("roa"),
    debt_to_equity: num("debt_to_equity") ?? num("der"),
    dividend_yield: num("dividend_yield"),
  };
}

export const getEquities = createServerFn({ method: "GET" })
  .inputValidator(
    z
      .object({
        sort: z.string().optional(),
        sector: z.string().optional(),
        limit: z.number().min(1).max(200).optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch("/stocks/v2/equities", {
      query: {
        sort: data?.sort,
        sector: data?.sector,
        limit: data?.limit ?? 100,
      },
    });
    if (error || !payload) {
      return { data: mockEquities, source: "mock" as const, error };
    }
    const list = unwrapList<Record<string, unknown>>(payload)
      .map(mapEquity)
      .filter((x): x is Equity => x !== null);
    if (list.length === 0) {
      return { data: mockEquities, source: "mock" as const, error: "empty response" };
    }
    return { data: list, source: "api" as const, error: null };
  });

export const getEquityDetail = createServerFn({ method: "GET" })
  .inputValidator(z.object({ symbol: z.string().min(1).max(20) }))
  .handler(async ({ data }) => {
    const sym = data.symbol.toUpperCase();
    const { data: payload, error } = await dsFetch("/stocks/v2/equities", {
      query: { symbol: sym, limit: 1 },
    });
    if (!error && payload) {
      const list = unwrapList<Record<string, unknown>>(payload)
        .map(mapEquity)
        .filter((x): x is Equity => x !== null);
      const match = list.find((e) => e.symbol === sym) || list[0];
      if (match) return { data: match, source: "api" as const, error: null };
    }
    const fallback = findMockEquity(sym) || {
      ...mockEquities[0],
      symbol: sym,
      name: sym,
    };
    return { data: fallback, source: "mock" as const, error };
  });

export const getKeyRatios = createServerFn({ method: "GET" })
  .inputValidator(z.object({ symbol: z.string().min(1).max(20) }))
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch("/stocks/v2/key-ratios", {
      query: { symbol: data.symbol.toUpperCase() },
    });
    const e = findMockEquity(data.symbol) || mockEquities[0];
    const fallback = {
      pe_ratio: e.pe_ratio,
      pb_ratio: e.pb_ratio,
      roe: e.roe,
      roa: e.roa,
      debt_to_equity: e.debt_to_equity,
      dividend_yield: e.dividend_yield,
      eps: e.eps,
      book_value: e.book_value,
      beta: e.beta,
      high_52w: e.high_52w,
      low_52w: e.low_52w,
      shares_outstanding: e.shares_outstanding,
      revenue_ttm: e.revenue_ttm,
      net_income_ttm: e.net_income_ttm,
      net_margin: 12.4,
      operating_margin: 18.6,
      revenue_growth: 8.2,
      earnings_growth: 5.7,
    };
    if (error || !payload) {
      return { data: fallback, source: "mock" as const, error };
    }
    return {
      data: { ...fallback, ...(payload as Record<string, unknown>) },
      source: "api" as const,
      error: null,
    };
  });

interface CandleRaw {
  time?: string | number;
  date?: string;
  t?: number | string;
  open?: number;
  o?: number;
  high?: number;
  h?: number;
  low?: number;
  l?: number;
  close?: number;
  c?: number;
  volume?: number;
  v?: number;
}

export const getCandles = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      symbol: z.string().min(1).max(20),
      interval: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch("/chart/candles", {
      query: { symbol: data.symbol.toUpperCase(), interval: data.interval ?? "1D" },
    });
    if (error || !payload) {
      const base = findMockEquity(data.symbol)?.price ?? 5000;
      return { data: mockCandles(base, 90), source: "mock" as const, error };
    }
    const raw = unwrapList<CandleRaw>(payload);
    const candles: Candle[] = raw
      .map((r) => {
        const time =
          (typeof r.time === "string" ? r.time : undefined) ||
          r.date ||
          (typeof r.t === "number"
            ? new Date(r.t).toISOString().slice(0, 10)
            : typeof r.t === "string"
              ? r.t
              : undefined);
        if (!time) return null;
        return {
          time,
          open: Number(r.open ?? r.o ?? 0),
          high: Number(r.high ?? r.h ?? 0),
          low: Number(r.low ?? r.l ?? 0),
          close: Number(r.close ?? r.c ?? 0),
          volume: Number(r.volume ?? r.v ?? 0),
        };
      })
      .filter((c): c is Candle => c !== null && c.close > 0);
    if (candles.length === 0) {
      const base = findMockEquity(data.symbol)?.price ?? 5000;
      return { data: mockCandles(base, 90), source: "mock" as const, error: "empty" };
    }
    return { data: candles, source: "api" as const, error: null };
  });

// ── Economic Calendar ────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  country: string;
  countryCode: string;
  date: string;       // ISO datetime string
  time: string;       // e.g. "14:30"
  volatility: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  unit: string | null;
  currency: string | null;
  description: string | null;
}

function mapCalendarEvent(raw: Record<string, unknown>): CalendarEvent {
  return {
    id: String(raw.id ?? raw._id ?? Math.random()),
    title: String(raw.title ?? raw.name ?? raw.event ?? ""),
    country: String(raw.country ?? ""),
    countryCode: String(raw.countryCode ?? raw.country_code ?? raw.cc ?? ""),
    date: String(raw.date ?? raw.datetime ?? raw.time ?? ""),
    time: String(raw.time ?? raw.eventTime ?? ""),
    volatility: (raw.volatility ?? raw.impact ?? "NONE") as CalendarEvent["volatility"],
    actual: raw.actual != null ? String(raw.actual) : null,
    forecast: raw.forecast != null ? String(raw.forecast) : null,
    previous: raw.previous != null ? String(raw.previous) : null,
    unit: raw.unit != null ? String(raw.unit) : null,
    currency: raw.currency != null ? String(raw.currency) : null,
    description: raw.description != null ? String(raw.description) : null,
  };
}

export const getEconomicCalendar = createServerFn({ method: "GET" })
  .inputValidator(
    z
      .object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        countryCode: z.string().optional(),
        volatility: z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).optional(),
        limit: z.number().min(1).max(500).optional(),
        timezone: z.string().optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    const today = new Date();
    const startDate =
      data?.startDate ??
      new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const endDate =
      data?.endDate ??
      new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);

    const { data: payload, error } = await dsFetch<{ success: boolean; data: unknown }>("/calendar", {
      query: {
        startDate,
        endDate,
        countryCode: data?.countryCode,
        volatility: data?.volatility,
        limit: data?.limit ?? 200,
        timezone: data?.timezone ?? "GMT+7",
      },
    });

    console.log("[getEconomicCalendar] error:", error, "payload keys:", payload ? Object.keys(payload) : null);

    if (error || !payload) {
      return { data: [] as CalendarEvent[], source: "error" as const, error };
    }

    const raw = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as Record<string, unknown>).data)
        ? ((payload as Record<string, unknown>).data as unknown[])
        : [];

    const events: CalendarEvent[] = (raw as Record<string, unknown>[]).map(mapCalendarEvent);
    return { data: events, source: "api" as const, error: null };
  });

// ── Chart Saham (IDX OHLCV) ──────────────────────────────────────────────────

export type ChartTimeframe = "daily" | "1m" | "5m" | "15m" | "30m" | "1h" | "4h";

interface ChartSahamBar {
  date?: string;
  datetime?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const getChartSaham = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      symbol: z.string().min(1).max(20),
      timeframe: z.enum(["daily", "1m", "5m", "15m", "30m", "1h", "4h"]).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sym = data.symbol.toUpperCase();
    const tf = data.timeframe ?? "daily";
    const today = new Date();
    const toDate = data.to ?? today.toISOString().slice(0, 10);
    const fromDate =
      data.from ??
      new Date(today.getTime() - 365 * 86400000).toISOString().slice(0, 10);

    const { data: payload, error } = await dsFetch<{ success: boolean; data: unknown }>(
      `/chart-saham/${sym}/${tf}`,
      { query: { from: fromDate, to: toDate, limit: "0" } },
    );

    console.log("[getChartSaham]", sym, tf, "error:", error);

    if (error || !payload) {
      const base = findMockEquity(sym)?.price ?? 5000;
      return { data: mockCandles(base, 365, `ds:${sym}`), source: "mock" as const, error };
    }

    const rawArr = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as Record<string, unknown>).data)
        ? ((payload as Record<string, unknown>).data as ChartSahamBar[])
        : [];

    const candles: Candle[] = (rawArr as ChartSahamBar[])
      .map((r) => {
        const time = (r.date ?? r.datetime ?? "").slice(0, 10);
        if (!time) return null;
        return {
          time,
          open: Number(r.open ?? 0),
          high: Number(r.high ?? 0),
          low: Number(r.low ?? 0),
          close: Number(r.close ?? 0),
          volume: Number(r.volume ?? 0),
        };
      })
      .filter((c): c is Candle => c !== null && c.close > 0)
      .sort((a, b) => a.time.localeCompare(b.time));

    if (candles.length === 0) {
      const base = findMockEquity(sym)?.price ?? 5000;
      return { data: mockCandles(base, 365, `ds:${sym}`), source: "mock" as const, error: "empty" };
    }
    return { data: candles, source: "api" as const, error: null };
  });

// ── Chart Price (multi-exchange via EXCHANGE:SYMBOL) ─────────────────────────

export const getChartPrice = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      symbol: z.string().min(1).max(40), // format: EXCHANGE:SYMBOL e.g. IDX:BBCA
      timeframe: z.string().optional(),  // D, W, M, 60, 240 etc.
      range: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<{ success: boolean; data: unknown }>(
      `/chart/price`,
      {
        query: {
          symbol: data.symbol,
          timeframe: data.timeframe ?? "D",
          range: data.range ?? 365,
        },
      },
    );

    console.log("[getChartPrice]", data.symbol, "error:", error);

    if (error || !payload) {
      return { data: [] as Candle[], source: "error" as const, error };
    }

    const rawArr = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as Record<string, unknown>).data)
        ? ((payload as Record<string, unknown>).data as Record<string, unknown>[])
        : [];

    const candles: Candle[] = (rawArr as Record<string, unknown>[])
      .map((r) => {
        const time =
          r.datetime
            ? String(r.datetime).slice(0, 10)
            : r.time
              ? new Date(Number(r.time) * 1000).toISOString().slice(0, 10)
              : "";
        if (!time) return null;
        return {
          time,
          open: Number(r.open ?? 0),
          high: Number(r.high ?? 0),
          low: Number(r.low ?? 0),
          close: Number(r.close ?? 0),
          volume: Number(r.volume ?? 0),
        };
      })
      .filter((c): c is Candle => c !== null && c.close > 0)
      .sort((a, b) => a.time.localeCompare(b.time));

    return { data: candles, source: "api" as const, error: null };
  });

// ── Indicator (unified /api/indicator/calculate) ─────────────────────────────

export interface IndicatorPoint {
  time: number;       // unix seconds
  datetime: string;
  [key: string]: number | string | null;
}

export const getIndicator = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      symbol: z.string().min(1).max(40), // EXCHANGE:SYMBOL
      indicator: z.string().min(1),
      timeframe: z.string().optional(),
      range: z.number().optional(),
      params: z.record(z.unknown()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<{
      success: boolean;
      data: IndicatorPoint[];
      count: number;
    }>("/indicator/calculate", {
      query: {
        symbol: data.symbol,
        indicator: data.indicator,
        timeframe: data.timeframe ?? "D",
        range: data.range ?? 365,
        params: data.params ? JSON.stringify(data.params) : undefined,
      },
    });

    console.log("[getIndicator]", data.indicator, data.symbol, "error:", error);

    if (error || !payload) {
      return { data: [] as IndicatorPoint[], source: "error" as const, error };
    }

    const raw = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as Record<string, unknown>).data)
        ? ((payload as Record<string, unknown>).data as IndicatorPoint[])
        : [];

    return { data: raw, source: "api" as const, error: null };
  });

// ── Stock Earnings (quarterly/annual EPS, Revenue, Forecast) ─────────────────

export interface EarningsQuarter {
  period: string;       // e.g. "Q1 2025", "2024"
  periodType: "quarterly" | "annual";
  reportDate: string | null;
  revenue: number | null;
  revenueEst: number | null;
  eps: number | null;
  epsEst: number | null;
  netIncome: number | null;
  surprise: number | null;   // % surprise vs estimate
}

export const getStockEarnings = createServerFn({ method: "GET" })
  .inputValidator(z.object({ symbol: z.string().min(1).max(20), market: z.string().optional() }))
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<Record<string, unknown>>(
      "/stocks/v2/earnings",
      { query: { symbol: data.symbol.toUpperCase(), market: data.market ?? "id-id" } },
    );
    console.log("[getStockEarnings]", data.symbol, "error:", error);
    if (error || !payload) return { data: null as null, source: "error" as const, error };
    return { data: payload, source: "api" as const, error: null };
  });

// ── Stock Equities V2 (full company profile + financials) ────────────────────

export const getStockEquitiesV2 = createServerFn({ method: "GET" })
  .inputValidator(z.object({ symbol: z.string().min(1).max(20), market: z.string().optional() }))
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<Record<string, unknown>>(
      "/stocks/v2/equities",
      { query: { symbol: data.symbol.toUpperCase(), market: data.market ?? "id-id" } },
    );
    console.log("[getStockEquitiesV2]", data.symbol, "error:", error);
    if (error || !payload) return { data: null as null, source: "error" as const, error };
    return { data: payload, source: "api" as const, error: null };
  });

// ── Stock Key Ratios V2 (historical ratios + industry comparison) ─────────────

export const getStockKeyRatiosV2 = createServerFn({ method: "GET" })
  .inputValidator(z.object({ symbol: z.string().min(1).max(20), market: z.string().optional() }))
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<Record<string, unknown>>(
      "/stocks/v2/key-ratios",
      { query: { symbol: data.symbol.toUpperCase(), market: data.market ?? "id-id" } },
    );
    console.log("[getStockKeyRatiosV2]", data.symbol, "error:", error);
    if (error || !payload) return { data: null as null, source: "error" as const, error };
    return { data: payload, source: "api" as const, error: null };
  });

// ── Stock Insights (valuation/earnings/growth/health vs peers) ───────────────

export const getStockInsights = createServerFn({ method: "GET" })
  .inputValidator(z.object({ symbol: z.string().min(1).max(20), market: z.string().optional() }))
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<Record<string, unknown>>(
      "/stocks/v2/insights",
      { query: { symbol: data.symbol.toUpperCase(), market: data.market ?? "id-id" } },
    );
    console.log("[getStockInsights]", data.symbol, "error:", error);
    if (error || !payload) return { data: null as null, source: "error" as const, error };
    return { data: payload, source: "api" as const, error: null };
  });

// ── Investor Trade Activity (insider/institutional filings) ──────────────────

export interface InvestorTrade {
  id: string;
  investorName: string;
  investorType: "insider" | "institution";
  tradeType: "buy" | "sell";
  ticker: string;
  companyName: string;
  sector: string;
  sharesTraded: number | null;
  transactionValue: number | null;
  price: number | null;
  ownershipChangePct: number | null;
  sharesBefore: number | null;
  sharesAfter: number | null;
  ownershipBefore: number | null;
  ownershipAfter: number | null;
  date: string;
  category: string | null;
}

export const getInvestorActivity = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      slug: z.string().optional(),
      timeRange: z.string().optional(),
      limit: z.number().optional(),
      skip: z.number().optional(),
      tradeType: z.enum(["buy", "sell"]).optional(),
    }).optional(),
  )
  .handler(async ({ data }) => {
    const today = new Date();
    const endDate = today.toISOString().slice(0, 10);
    const startDate = new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10);
    const timeRange = data?.timeRange ?? `${startDate}:${endDate}`;

    const { data: payload, error } = await dsFetch<Record<string, unknown>>(
      "/stocks/investors/trade-activity",
      {
        query: {
          slug: data?.slug ?? "all",
          time_range: timeRange,
          limit: data?.limit ?? 50,
          skip: data?.skip ?? 0,
          trade_type: data?.tradeType,
        },
      },
    );
    console.log("[getInvestorActivity] error:", error);
    if (error || !payload) return { data: [] as InvestorTrade[], source: "error" as const, error };

    const raw = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as Record<string, unknown>).data)
        ? ((payload as Record<string, unknown>).data as Record<string, unknown>[])
        : [];

    const trades: InvestorTrade[] = (raw as Record<string, unknown>[]).map((r) => ({
      id: String(r.id ?? r._id ?? Math.random()),
      investorName: String(r.investor_name ?? r.investorName ?? r.name ?? ""),
      investorType: (r.investor_type ?? r.investorType ?? "insider") as "insider" | "institution",
      tradeType: (r.trade_type ?? r.tradeType ?? "buy") as "buy" | "sell",
      ticker: String(r.ticker ?? r.symbol ?? ""),
      companyName: String(r.company_name ?? r.companyName ?? ""),
      sector: String(r.sector ?? ""),
      sharesTraded: r.shares_traded != null ? Number(r.shares_traded) : null,
      transactionValue: r.transaction_value != null ? Number(r.transaction_value) : null,
      price: r.price != null ? Number(r.price) : null,
      ownershipChangePct: r.ownership_change_pct != null ? Number(r.ownership_change_pct) : null,
      sharesBefore: r.shares_before != null ? Number(r.shares_before) : null,
      sharesAfter: r.shares_after != null ? Number(r.shares_after) : null,
      ownershipBefore: r.ownership_before != null ? Number(r.ownership_before) : null,
      ownershipAfter: r.ownership_after != null ? Number(r.ownership_after) : null,
      date: String(r.date ?? r.transaction_date ?? ""),
      category: r.category != null ? String(r.category) : null,
    }));

    return { data: trades, source: "api" as const, error: null };
  });

// ── Crypto helpers ────────────────────────────────────────────────────────────
// All DS crypto endpoints return { success: boolean, data: nullable }
// We log the FULL raw response so we can see the actual structure.
function logCrypto(label: string, payload: unknown, error: string | null) {
  console.log(`[${label}] error:`, error);
  console.log(`[${label}] raw:`, JSON.stringify(payload)?.slice(0, 800));
}

// ── Crypto: Trending coins ────────────────────────────────────────────────────
export const getCryptoTrending = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: payload, error } = await dsFetch<unknown>("/crypto/trending");
    logCrypto("getCryptoTrending", payload, error);
    if (error || !payload) return { data: null as null, source: "error" as const, error };
    return { data: payload, source: "api" as const, error: null };
  });

// ── Crypto: Strong trend ──────────────────────────────────────────────────────
export const getCryptoStrongTrend = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: payload, error } = await dsFetch<unknown>("/crypto/strong-trend");
    logCrypto("getCryptoStrongTrend", payload, error);
    if (error || !payload) return { data: null as null, source: "error" as const, error };
    return { data: payload, source: "api" as const, error: null };
  });

// ── Crypto: Events — start_date & end_date are REQUIRED per spec ──────────────
export const getCryptoEvents = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      skip: z.string().optional(),
      important: z.string().optional(),
      source_reliable: z.string().optional(),
    }).optional(),
  )
  .handler(async ({ data }) => {
    const today = new Date();
    const start = data?.start_date ?? new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const end   = data?.end_date   ?? new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const { data: payload, error } = await dsFetch<unknown>("/crypto/events", {
      query: {
        start_date: start,
        end_date: end,
        skip: data?.skip ?? "0",
        important: data?.important ?? "false",
        source_reliable: data?.source_reliable ?? "true",
      },
    });
    logCrypto("getCryptoEvents", payload, error);
    if (error || !payload) return { data: null as null, source: "error" as const, error };
    return { data: payload, source: "api" as const, error: null };
  });

// ── Crypto: Details by ticker ─────────────────────────────────────────────────
export const getCryptoDetails = createServerFn({ method: "GET" })
  .inputValidator(z.object({ ticker: z.string().min(1), lang: z.string().optional() }))
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<unknown>(
      `/crypto/details/${encodeURIComponent(data.ticker)}`,
      { query: { lang: data.lang ?? "en" } },
    );
    logCrypto(`getCryptoDetails:${data.ticker}`, payload, error);
    if (error || !payload) return { data: null as null, source: "error" as const, error };
    return { data: payload, source: "api" as const, error: null };
  });

// ── Crypto: Global heatmap ────────────────────────────────────────────────────
export const getCryptoHeatmap = createServerFn({ method: "GET" })
  .inputValidator(z.object({ symbol: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<unknown>(
      "/crypto/global-heatmap",
      { query: { symbol: data.symbol.toUpperCase() } },
    );
    logCrypto(`getCryptoHeatmap:${data.symbol}`, payload, error);
    if (error || !payload) return { data: null as null, source: "error" as const, error };
    return { data: payload, source: "api" as const, error: null };
  });

// ── Crypto: Orderbook walls ───────────────────────────────────────────────────
export const getCryptoWalls = createServerFn({ method: "GET" })
  .inputValidator(z.object({ symbol: z.string().min(1), limit: z.number().optional() }))
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<unknown>(
      "/crypto/walls",
      { query: { symbol: data.symbol.toUpperCase(), limit: data.limit ?? 100 } },
    );
    logCrypto(`getCryptoWalls:${data.symbol}`, payload, error);
    if (error || !payload) return { data: null as null, source: "error" as const, error };
    return { data: payload, source: "api" as const, error: null };
  });

// ── Crypto: Correlation matrix ────────────────────────────────────────────────
export const getCryptoCorrelation = createServerFn({ method: "GET" })
  .inputValidator(z.object({ base: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<unknown>(
      "/crypto/correlation",
      { query: { base: data.base.toUpperCase() } },
    );
    logCrypto(`getCryptoCorrelation:${data.base}`, payload, error);
    if (error || !payload) return { data: null as null, source: "error" as const, error };
    return { data: payload, source: "api" as const, error: null };
  });

// ── Crypto: Orderbook imbalance ───────────────────────────────────────────────
export const getCryptoOrderbookImbalance = createServerFn({ method: "GET" })
  .inputValidator(z.object({ symbol: z.string().min(1), limit: z.number().optional() }))
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<unknown>(
      "/crypto/orderbook-imbalance",
      { query: { symbol: data.symbol.toUpperCase(), limit: data.limit ?? 100 } },
    );
    logCrypto(`getCryptoOrderbookImbalance:${data.symbol}`, payload, error);
    if (error || !payload) return { data: null as null, source: "error" as const, error };
    return { data: payload, source: "api" as const, error: null };
  });

// ── Forex: Orderbook Positioning ─────────────────────────────────────────────
export const getForexOrderbook = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      symbol: z.string().optional(), // e.g. "EURUSD", "USDIDR"
    }).optional(),
  )
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<unknown>(
      "/forex/orderbook-positioning",
      { query: { symbol: data?.symbol } },
    );
    console.log("[getForexOrderbook] error:", error, "symbol:", data?.symbol);
    if (error || !payload) return { data: null as null, source: "error" as const, error };
    return { data: payload, source: "api" as const, error: null };
  });

// ── Institutional Investors: Summary ─────────────────────────────────────────
export const getInstitutionalInvestors = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      symbol: z.string().optional(),
      limit: z.number().optional(),
      skip: z.number().optional(),
    }).optional(),
  )
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<unknown>(
      "/stocks/institutional-investors",
      {
        query: {
          symbol: data?.symbol,
          limit: data?.limit ?? 50,
          skip: data?.skip ?? 0,
        },
      },
    );
    console.log("[getInstitutionalInvestors] error:", error);
    if (error || !payload) return { data: null as null, source: "error" as const, error };
    return { data: payload, source: "api" as const, error: null };
  });

// ── Finance News (DataSectors) ────────────────────────────────────────────────
export const getDSNews = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      query: z.string().optional(),
      ticker: z.string().optional(),
      limit: z.number().optional(),
      skip: z.number().optional(),
    }).optional(),
  )
  .handler(async ({ data }) => {
    const { data: payload, error } = await dsFetch<unknown>("/news", {
      query: {
        q: data?.query,
        ticker: data?.ticker,
        limit: data?.limit ?? 30,
        skip: data?.skip ?? 0,
      },
    });
    console.log("[getDSNews] error:", error);
    if (error || !payload) return { data: null as null, source: "error" as const, error };
    return { data: payload, source: "api" as const, error: null };
  });

// ── Earnings Calendar ─────────────────────────────────────────────────────────
export const getEarningsCalendar = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      symbol: z.string().optional(),
      market: z.string().optional(),
      limit: z.number().optional(),
    }).optional(),
  )
  .handler(async ({ data }) => {
    const today = new Date();
    const startDate = data?.startDate ?? new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const endDate   = data?.endDate   ?? new Date(today.getTime() + 60 * 86400000).toISOString().slice(0, 10);

    // Try /stocks/earnings first (list of upcoming earnings)
    const { data: payload, error } = await dsFetch<unknown>("/stocks/earnings", {
      query: {
        startDate,
        endDate,
        symbol: data?.symbol,
        market: data?.market ?? "id-id",
        limit: data?.limit ?? 200,
      },
    });
    console.log("[getEarningsCalendar] error:", error);
    if (error || !payload) return { data: null as null, source: "error" as const, error };
    return { data: payload, source: "api" as const, error: null };
  });

// ── Live Price from chart-saham (most recent daily candle) ───────────────────
// Returns the latest OHLCV + foreign flow for a single IDX stock.
export interface LivePrice {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;           // current / last price
  volume: number;
  value: number;           // transaction value (IDR)
  sharesOutstanding: number;
  foreignBuy: number;
  foreignSell: number;
  foreignFlow: number;     // net foreign flow (negative = net sell)
  frequency: number;       // number of transactions
  // Derived
  change: number;          // close - prev_close (not available from single candle)
  change_pct: number;
  market_cap: number;      // close * sharesOutstanding
}

export const getLivePrice = createServerFn({ method: "GET" })
  .inputValidator(z.object({ symbol: z.string().min(1).max(20) }))
  .handler(async ({ data }) => {
    const sym = data.symbol.toUpperCase();
    const today = new Date();
    const toDate = today.toISOString().slice(0, 10);
    const fromDate = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);

    const { data: payload, error } = await dsFetch<unknown>(
      `/chart-saham/${sym}/daily`,
      { query: { from: fromDate, to: toDate } },
    );

    if (error || !payload) {
      console.warn("[getLivePrice]", sym, "error:", error);
      return { data: null as LivePrice | null, source: "error" as const, error };
    }

    // Navigate nested structure: payload.data.data.data.chartbit[]
    const chartbit = extractChartbit(payload);
    if (!chartbit || chartbit.length === 0) {
      return { data: null as LivePrice | null, source: "error" as const, error: "no data" };
    }

    // Most recent candle is first
    const latest = chartbit[0] as Record<string, unknown>;
    const prev   = chartbit[1] as Record<string, unknown> | undefined;

    const close = Number(latest.close ?? 0);
    const prevClose = prev ? Number(prev.close ?? close) : close;
    const change = +(close - prevClose).toFixed(2);
    const change_pct = prevClose > 0 ? +((change / prevClose) * 100).toFixed(2) : 0;
    const shares = Number(latest.shareoutstanding ?? 0);

    const lp: LivePrice = {
      symbol: sym,
      date: String(latest.date ?? toDate),
      open: Number(latest.open ?? 0),
      high: Number(latest.high ?? 0),
      low: Number(latest.low ?? 0),
      close,
      volume: Number(latest.volume ?? 0),
      value: Number(latest.value ?? 0),
      sharesOutstanding: shares,
      foreignBuy: Number(latest.foreignbuy ?? 0),
      foreignSell: Number(latest.foreignsell ?? 0),
      foreignFlow: Number(latest.foreignflow ?? 0),
      frequency: Number(latest.frequency ?? 0),
      change,
      change_pct,
      market_cap: shares > 0 ? close * shares : 0,
    };

    return { data: lp, source: "api" as const, error: null };
  });

// ── Bulk live prices for multiple symbols ─────────────────────────────────────
// Fetches up to 10 symbols in parallel (rate-limit friendly).
export const getLivePrices = createServerFn({ method: "GET" })
  .inputValidator(z.object({
    symbols: z.array(z.string().min(1).max(20)).min(1).max(20),
  }))
  .handler(async ({ data }) => {
    const today = new Date();
    const toDate = today.toISOString().slice(0, 10);
    const fromDate = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);

    const results = await Promise.allSettled(
      data.symbols.map(async (sym) => {
        const s = sym.toUpperCase();
        const { data: payload, error } = await dsFetch<unknown>(
          `/chart-saham/${s}/daily`,
          { query: { from: fromDate, to: toDate }, retries: 0, timeoutMs: 8000 },
        );
        if (error || !payload) return null;
        const chartbit = extractChartbit(payload);
        if (!chartbit || chartbit.length === 0) return null;

        const latest = chartbit[0] as Record<string, unknown>;
        const prev   = chartbit[1] as Record<string, unknown> | undefined;
        const close = Number(latest.close ?? 0);
        const prevClose = prev ? Number(prev.close ?? close) : close;
        const change = +(close - prevClose).toFixed(2);
        const change_pct = prevClose > 0 ? +((change / prevClose) * 100).toFixed(2) : 0;
        const shares = Number(latest.shareoutstanding ?? 0);

        return {
          symbol: s,
          date: String(latest.date ?? toDate),
          open: Number(latest.open ?? 0),
          high: Number(latest.high ?? 0),
          low: Number(latest.low ?? 0),
          close,
          volume: Number(latest.volume ?? 0),
          value: Number(latest.value ?? 0),
          sharesOutstanding: shares,
          foreignBuy: Number(latest.foreignbuy ?? 0),
          foreignSell: Number(latest.foreignsell ?? 0),
          foreignFlow: Number(latest.foreignflow ?? 0),
          frequency: Number(latest.frequency ?? 0),
          change,
          change_pct,
          market_cap: shares > 0 ? close * shares : 0,
        } as LivePrice;
      }),
    );

    const prices: Record<string, LivePrice> = {};
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value) {
        prices[data.symbols[i].toUpperCase()] = r.value;
      }
    });

    return { data: prices, source: "api" as const, error: null };
  });

// ── Helper: extract chartbit array from nested DS response ────────────────────
function extractChartbit(payload: unknown): unknown[] | null {
  if (!payload) return null;
  // Shape 1: { success, data: { success, data: { data: { chartbit: [] } } } }
  try {
    const p = payload as Record<string, unknown>;
    const d1 = p.data as Record<string, unknown>;
    const d2 = d1?.data as Record<string, unknown>;
    const d3 = d2?.data as Record<string, unknown>;
    if (Array.isArray(d3?.chartbit)) return d3.chartbit as unknown[];
  } catch { /* fall through */ }
  // Shape 2: { data: { chartbit: [] } }
  try {
    const p = payload as Record<string, unknown>;
    const d = p.data as Record<string, unknown>;
    if (Array.isArray(d?.chartbit)) return d.chartbit as unknown[];
  } catch { /* fall through */ }
  // Shape 3: { chartbit: [] }
  try {
    const p = payload as Record<string, unknown>;
    if (Array.isArray(p.chartbit)) return p.chartbit as unknown[];
  } catch { /* fall through */ }
  // Shape 4: direct array
  if (Array.isArray(payload)) return payload as unknown[];
  return null;
}
