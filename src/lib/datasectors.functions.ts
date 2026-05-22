import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { allowMockFallback, dsFetch, unwrapList } from "./datasectors.server";
import {
  type Equity,
  type Candle,
  mockEquities,
  mockCandles,
  findMockEquity,
} from "./mock-data";

const IDX_TIME_ZONE = "Asia/Jakarta";

function formatDateInTimeZone(date: Date, timeZone = IDX_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function idxDate(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return formatDateInTimeZone(date);
}

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
        symbols: z.array(z.string()).optional(), // specific symbols to fetch prices for
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    // If specific symbols requested, fetch real prices for them
    if (data?.symbols && data.symbols.length > 0) {
      const toDate = idxDate();
      const fromDate = idxDate(-10);

      const priceResults = await Promise.allSettled(
        data.symbols.slice(0, 60).map(async (sym) => {
          const { data: payload } = await dsFetch<unknown>(
            `/chart-saham/${sym.toUpperCase()}/daily`,
            { query: { from: fromDate, to: toDate, limit: "0" }, retries: 1, timeoutMs: 8000 },
          );
          if (!payload) return null;
          const inner = (payload as Record<string, unknown>).data as Record<string, unknown> | null;
          const innerData = inner?.data as Record<string, unknown> | null;
          const chartData = innerData?.data as Record<string, unknown> | null;
          const chartbit = chartData?.chartbit as Record<string, unknown>[] | null;
          if (!chartbit?.length) return null;
          const sorted = [...chartbit].sort((a, b) =>
            String(b.date ?? "").localeCompare(String(a.date ?? ""))
          );
          const latest = sorted[0];
          const prev   = sorted[1];
          const close     = Number(latest.close ?? 0);
          const prevClose = Number(prev?.close ?? close);
          const change    = close - prevClose;
          const shares    = Number(latest.shareoutstanding ?? 0);
          const mock = findMockEquity(sym) || { ...mockEquities[0], symbol: sym.toUpperCase() };
          return {
            ...mock,
            symbol: sym.toUpperCase(),
            price: close,
            change: +change.toFixed(2),
            change_pct: +((prevClose > 0 ? change / prevClose : 0) * 100).toFixed(4),
            volume: Number(latest.volume ?? 0),
            market_cap: close * shares,
            prev_close: prevClose,
            day_high: Number(latest.high ?? close),
            day_low: Number(latest.low ?? close),
            shares_outstanding: shares,
          } as Equity;
        })
      );

      const list = priceResults
        .map(r => r.status === "fulfilled" ? r.value : null)
        .filter((x): x is Equity => x !== null);

      if (list.length > 0) return { data: list, source: "api" as const, error: null };
    }

    // Default: use v2/equities for the list (company info + fundamentals)
    const { data: payload, error } = await dsFetch("/stocks/v2/equities", {
      query: {
        sort: data?.sort,
        sector: data?.sector,
        limit: data?.limit ?? 100,
      },
    });
    if (error || !payload) {
      return allowMockFallback()
        ? { data: mockEquities, source: "mock" as const, error }
        : { data: [] as Equity[], source: "error" as const, error };
    }
    const list = unwrapList<Record<string, unknown>>(payload)
      .map(mapEquity)
      .filter((x): x is Equity => x !== null);
    if (list.length === 0) {
      return allowMockFallback()
        ? { data: mockEquities, source: "mock" as const, error: "empty response" }
        : { data: [] as Equity[], source: "error" as const, error: "empty response" };
    }
    return { data: list, source: "api" as const, error: null };
  });

export const getEquityDetail = createServerFn({ method: "GET" })
  .inputValidator(z.object({ symbol: z.string().min(1).max(20) }))
  .handler(async ({ data }) => {
    const sym = data.symbol.toUpperCase();

    // ── 1. Get company info from v2/equities ──────────────────────────────
    const { data: equityPayload } = await dsFetch<Record<string, unknown>>(
      "/stocks/v2/equities",
      { query: { symbol: sym } },
    );

    // ── 2. Get real-time price from the same chart-saham source used elsewhere
    const toDate = idxDate();
    const fromDate = idxDate(-10);
    const { data: pricePayload } = await dsFetch<unknown>(
      `/chart-saham/${sym}/daily`,
      { query: { from: fromDate, to: toDate }, retries: 0 },
    );

    const livePrice = pricePayload
      ? parseChartSahamResponse(pricePayload, sym, toDate).data
      : null;

    // Parse company info
    let companyInfo: Partial<{ name: string; sector: string; industry: string }> = {};
    if (equityPayload) {
      const d = equityPayload.data as Record<string, unknown> | null ?? equityPayload;
      const company = d?.company as Record<string, unknown> | null;
      companyInfo = {
        name: String(d?.displayName ?? d?.shortName ?? company?.name ?? sym),
        sector: String(company?.sector ?? d?.sector ?? ""),
        industry: String(company?.industry ?? d?.industry ?? ""),
      };
    }

    if (!livePrice && !allowMockFallback()) {
      return { data: null as Equity | null, source: "error" as const, error: "latest price unavailable" };
    }

    // Build merged equity
    const fallback = findMockEquity(sym) || { ...mockEquities[0], symbol: sym, name: sym };
    const equity: import("./mock-data").Equity = {
      ...fallback,
      symbol: sym,
      name: companyInfo.name || fallback.name,
      sector: companyInfo.sector || fallback.sector,
      industry: companyInfo.industry || fallback.industry,
      price: livePrice?.price ?? fallback.price,
      change: livePrice?.change ?? fallback.change,
      change_pct: livePrice?.change_pct ?? fallback.change_pct,
      volume: livePrice?.volume ?? fallback.volume,
      market_cap: livePrice?.marketCap ?? fallback.market_cap,
      prev_close: livePrice?.prevClose ?? fallback.prev_close,
      day_high: livePrice?.high ?? fallback.day_high,
      day_low: livePrice?.low ?? fallback.day_low,
      shares_outstanding: livePrice?.shareOutstanding ?? fallback.shares_outstanding,
    };

    const source = livePrice?.price ? "api" : "mock";
    return { data: equity, source: source as "api" | "mock", error: null };
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

function extractChartSahamBars(payload: unknown): Record<string, unknown>[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];

  const root = payload as Record<string, unknown>;
  const directData = root.data;
  if (Array.isArray(directData)) return directData as Record<string, unknown>[];

  const nested = directData as Record<string, unknown> | null;
  const nestedData = nested?.data as Record<string, unknown> | null;
  const chartData = nestedData?.data as Record<string, unknown> | null;
  const chartbit = chartData?.chartbit;
  if (Array.isArray(chartbit)) return chartbit as Record<string, unknown>[];

  return [];
}

function mapChartSahamBar(raw: Record<string, unknown>): Candle | null {
  const time = String(raw.datetime ?? raw.date ?? "").slice(0, 10);
  const close = Number(raw.close ?? 0);
  if (!time || close <= 0) return null;

  return {
    time,
    open: Number(raw.open ?? close),
    high: Number(raw.high ?? close),
    low: Number(raw.low ?? close),
    close,
    volume: Number(raw.volume ?? 0),
  };
}

export const getCandles = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      symbol: z.string().min(1).max(20),
      interval: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sym = data.symbol.toUpperCase();
    const toDate = idxDate();
    const fromDate = idxDate(-140);
    const timeframe = data.interval && data.interval !== "1D" ? data.interval : "daily";

    const { data: payload, error } = await dsFetch(`/chart-saham/${sym}/${timeframe}`, {
      query: { from: fromDate, to: toDate, limit: "0" },
    });
    if (error || !payload) {
      const base = findMockEquity(data.symbol)?.price ?? 5000;
      return allowMockFallback()
        ? { data: mockCandles(base, 90), source: "mock" as const, error }
        : { data: [] as Candle[], source: "error" as const, error };
    }

    const candles = extractChartSahamBars(payload)
      .map(mapChartSahamBar)
      .filter((c): c is Candle => c !== null)
      .sort((a, b) => a.time.localeCompare(b.time));

    if (candles.length === 0) {
      const base = findMockEquity(data.symbol)?.price ?? 5000;
      return allowMockFallback()
        ? { data: mockCandles(base, 90), source: "mock" as const, error: "empty" }
        : { data: [] as Candle[], source: "error" as const, error: "empty" };
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
    const toDate = data.to ?? idxDate();
    const fromDate = data.from ?? idxDate(-365);

    const { data: payload, error } = await dsFetch<{ success: boolean; data: unknown }>(
      `/chart-saham/${sym}/${tf}`,
      { query: { from: fromDate, to: toDate, limit: "0" } },
    );

    console.log("[getChartSaham]", sym, tf, "error:", error);

    if (error || !payload) {
      const base = findMockEquity(sym)?.price ?? 5000;
      return allowMockFallback()
        ? { data: mockCandles(base, 365, `ds:${sym}`), source: "mock" as const, error }
        : { data: [] as Candle[], source: "error" as const, error };
    }

    const rawArr = extractChartSahamBars(payload) as ChartSahamBar[];

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
      return allowMockFallback()
        ? { data: mockCandles(base, 365, `ds:${sym}`), source: "mock" as const, error: "empty" }
        : { data: [] as Candle[], source: "error" as const, error: "empty" };
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

// ── Helper: parse chart-saham response into StockPrice ───────────────────────
function parseChartSahamResponse(
  payload: unknown,
  sym: string,
  fallbackDate: string,
): { data: StockPrice | null; source: "api" | "error"; error: string | null } {
  const chartbit = extractChartSahamBars(payload);

  if (!chartbit || chartbit.length === 0) {
    return { data: null, source: "error", error: "no data" };
  }

  // Sort by unix_timestamp or datetime descending — get latest bar
  const sorted = [...chartbit].sort((a, b) => {
    const ta = Number(a.unix_timestamp ?? 0);
    const tb = Number(b.unix_timestamp ?? 0);
    if (ta !== tb) return tb - ta;
    return String(b.datetime ?? b.date ?? "").localeCompare(String(a.datetime ?? a.date ?? ""));
  });

  const latest = sorted[0];

  // For change calculation: find the previous day's last close
  // For 1m data: group by date, get last bar of previous trading day
  const latestDate = String(latest.datetime ?? latest.date ?? "").slice(0, 10);
  const prevDayBars = sorted.filter(b =>
    String(b.datetime ?? b.date ?? "").slice(0, 10) < latestDate
  );
  const prevClose = prevDayBars.length > 0
    ? Number(prevDayBars[0].close ?? 0)
    : Number(latest.open ?? latest.close ?? 0); // fallback to open

  const close  = Number(latest.close ?? 0);
  const change = close - prevClose;
  const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
  const shares = Number(latest.shareoutstanding ?? latest.share_outstanding ?? 0);

  // Aggregate today's OHLV from all bars of the same date
  const todayBars = sorted.filter(b =>
    String(b.datetime ?? b.date ?? "").slice(0, 10) === latestDate
  );
  const dayHigh  = Math.max(...todayBars.map(b => Number(b.high ?? 0)));
  const dayLow   = Math.min(...todayBars.filter(b => Number(b.low ?? 0) > 0).map(b => Number(b.low ?? 0)));
  const dayOpen  = Number(todayBars[todayBars.length - 1]?.open ?? latest.open ?? close);
  const dayVol   = todayBars.reduce((s, b) => s + Number(b.volume ?? 0), 0);
  const dayValue = todayBars.reduce((s, b) => s + Number(b.value ?? 0), 0);

  const price: StockPrice = {
    symbol: sym,
    price: close,
    open: dayOpen,
    high: dayHigh > 0 ? dayHigh : close,
    low: dayLow > 0 ? dayLow : close,
    prevClose,
    change: +change.toFixed(2),
    change_pct: +changePct.toFixed(4),
    volume: dayVol || Number(latest.volume ?? 0),
    value: dayValue || Number(latest.value ?? 0),
    foreignBuy: Number(latest.foreign_buy ?? latest.foreignbuy ?? 0),
    foreignSell: Number(latest.foreign_sell ?? latest.foreignsell ?? 0),
    foreignFlow: Number(latest.foreignflow ?? 0),
    date: latestDate || fallbackDate,
    shareOutstanding: shares,
    marketCap: close * shares,
  };

  return { data: price, source: "api", error: null };
}

// ── Real-time stock price via chart-saham (1m → daily fallback) ───────────────
// Daily is the canonical current IDX price; 1m is only a fallback because it can lag.
// Returns: close, open, high, low, volume, change, change_pct, foreignflow

export interface StockPrice {
  symbol: string;
  price: number;          // latest close
  open: number;
  high: number;
  low: number;
  prevClose: number;      // previous day close
  change: number;         // price - prevClose
  change_pct: number;     // (change / prevClose) * 100
  volume: number;
  value: number;          // transaction value in IDR
  foreignBuy: number;
  foreignSell: number;
  foreignFlow: number;    // net foreign flow (positive = net buy)
  date: string;           // YYYY-MM-DD
  shareOutstanding: number;
  marketCap: number;      // close * shareOutstanding
}

export const getStockPrice = createServerFn({ method: "GET" })
  .inputValidator(z.object({ symbol: z.string().min(1).max(20) }))
  .handler(async ({ data }) => {
    const sym = data.symbol.toUpperCase();
    const toDate = idxDate();
    const fromDate = idxDate(-10);

    const { data: dailyPayload, error: dailyError } = await dsFetch<unknown>(
      `/chart-saham/${sym}/daily`,
      { query: { from: fromDate, to: toDate, limit: "0" }, retries: 1, timeoutMs: 8000 },
    );
    if (!dailyError && dailyPayload) {
      const parsed = parseChartSahamResponse(dailyPayload, sym, toDate);
      if (parsed.data) return parsed;
    }

    const { data: payload, error } = await dsFetch<unknown>(
      `/chart-saham/${sym}/1m`,
      { query: { from: fromDate, to: toDate }, retries: 0, timeoutMs: 8000 },
    );
    if (error || !payload) {
      console.warn("[getStockPrice]", sym, "error:", dailyError ?? error);
      return { data: null as StockPrice | null, source: "error" as const, error: dailyError ?? error };
    }

    return parseChartSahamResponse(payload, sym, toDate);
  });

// ── Batch price for multiple symbols ─────────────────────────────────────────
// Fetches prices for up to 60 symbols in parallel.
export const getBatchPrices = createServerFn({ method: "GET" })
  .inputValidator(z.object({ symbols: z.array(z.string()).min(1).max(60) }))
  .handler(async ({ data }) => {
    const toDate = idxDate();
    const fromDate = idxDate(-10);

    const results = await Promise.allSettled(
      data.symbols.map(async (sym) => {
        const symbol = sym.toUpperCase();
        const { data: dailyPayload, error: dailyError } = await dsFetch<unknown>(
          `/chart-saham/${symbol}/daily`,
          { query: { from: fromDate, to: toDate, limit: "0" }, retries: 1, timeoutMs: 8000 },
        );
        if (!dailyError && dailyPayload) {
          const parsed = parseChartSahamResponse(dailyPayload, symbol, toDate);
          if (parsed.data) return parsed.data;
        }

        const { data: payload, error } = await dsFetch<unknown>(
          `/chart-saham/${symbol}/1m`,
          { query: { from: fromDate, to: toDate }, retries: 0, timeoutMs: 8000 },
        );
        if (error || !payload) return null;
        return parseChartSahamResponse(payload, symbol, toDate).data;
      })
    );

    const prices: Record<string, StockPrice> = {};
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value) {
        prices[data.symbols[i].toUpperCase()] = r.value;
      }
    });

    return { data: prices, source: "api" as const, error: null };
  });
