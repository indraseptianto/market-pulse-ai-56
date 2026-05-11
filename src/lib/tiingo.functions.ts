import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { tiingoFetch } from "./tiingo.server";
import { mockCandles, findMockEquity, type Candle } from "./mock-data";

interface TiingoBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
  adjOpen?: number;
  adjHigh?: number;
  adjLow?: number;
  adjVolume?: number;
}

function tickerForTiingo(symbol: string): string {
  // IDX tickers (2–6 uppercase letters) → append .jk for Tiingo
  const s = symbol.trim().toUpperCase();
  // If it already has an exchange suffix (e.g. AAPL, BTC), leave as-is
  // IDX stocks are typically 2–6 alpha chars with no digits
  if (/^[A-Z]{2,6}$/.test(s)) return `${s.toLowerCase()}.jk`;
  return s.toLowerCase();
}

export const getTiingoPrices = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      symbol: z.string().min(1).max(20),
      timeframe: z.enum(["daily", "weekly", "monthly"]).optional(),
      days: z.number().min(7).max(2000).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const ticker = tickerForTiingo(data.symbol);
    const days = data.days ?? 365;
    const start = new Date(Date.now() - days * 86400000)
      .toISOString()
      .slice(0, 10);
    const freq =
      data.timeframe === "weekly"
        ? "weekly"
        : data.timeframe === "monthly"
          ? "monthly"
          : "daily";

    const { data: payload, error } = await tiingoFetch<TiingoBar[]>(
      `/tiingo/daily/${ticker}/prices`,
      { query: { startDate: start, resampleFreq: freq } },
    );

    if (error || !Array.isArray(payload) || payload.length === 0) {
      const base = findMockEquity(data.symbol)?.price ?? 5000;
      return {
        data: mockCandles(base, Math.min(days, 365), `tiingo:${data.symbol}`),
        source: "mock" as const,
        error,
      };
    }
    const candles: Candle[] = payload.map((b) => ({
      time: b.date.slice(0, 10),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
    }));
    return { data: candles, source: "tiingo" as const, error: null };
  });

interface TiingoNewsItem {
  id: number;
  title: string;
  description: string;
  url: string;
  publishedDate: string;
  source: string;
  tickers: string[];
  tags: string[];
}

export const getTiingoNews = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      tickers: z.string().optional(),
      tags: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
    }).optional(),
  )
  .handler(async ({ data }) => {
    const { data: payload, error } = await tiingoFetch<TiingoNewsItem[]>(
      "/tiingo/news",
      {
        query: {
          tickers: data?.tickers,
          tags: data?.tags,
          limit: data?.limit ?? 30,
          sortBy: "publishedDate",
        },
      },
    );
    if (error || !Array.isArray(payload)) {
      return { data: mockNews(data?.tickers), source: "mock" as const, error };
    }
    return { data: payload, source: "tiingo" as const, error: null };
  });

function mockNews(tickers?: string): TiingoNewsItem[] {
  const t = tickers ? tickers.split(",")[0].toUpperCase() : "MARKET";
  const headlines = [
    `${t} surges as institutional flows accelerate`,
    `Analysts upgrade ${t} on improving fundamentals`,
    `${t} reports stronger-than-expected quarterly earnings`,
    `Sector rotation lifts ${t} on macro tailwinds`,
    `${t} announces strategic partnership, shares climb`,
    `Risk-off sentiment weighs on ${t} in early trading`,
    `${t} dividend hike signals management confidence`,
    `Technical breakout in ${t} draws momentum traders`,
  ];
  return headlines.map((h, i) => ({
    id: i + 1,
    title: h,
    description:
      "Market participants are watching the move closely as volume builds and option activity expands across near-dated strikes.",
    url: "#",
    publishedDate: new Date(Date.now() - i * 3 * 3600 * 1000).toISOString(),
    source: ["Reuters", "Bloomberg", "CNBC", "MarketWatch"][i % 4],
    tickers: [t.toLowerCase()],
    tags: ["Equities"],
  }));
}

interface TiingoCryptoTop {
  ticker: string;
  baseCurrency: string;
  quoteCurrency: string;
  topOfBookData?: { lastSaleTimestamp: string; lastPrice: number; lastSize: number }[];
  priceData?: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    date: string;
  }[];
}

export const getTiingoCrypto = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      tickers: z.string().optional(),
    }).optional(),
  )
  .handler(async ({ data }) => {
    const tickers =
      data?.tickers ?? "btcusd,ethusd,solusd,bnbusd,xrpusd,adausd,dogeusd,avaxusd";
    const { data: payload, error } = await tiingoFetch<TiingoCryptoTop[]>(
      "/tiingo/crypto/top",
      { query: { tickers } },
    );
    if (error || !Array.isArray(payload)) {
      return {
        data: tickers.split(",").map((t) => ({
          ticker: t,
          price: 100 + Math.abs(t.charCodeAt(0) - 60) * 23,
          change_pct: 0,
        })),
        source: "mock" as const,
        error,
      };
    }
    const out = payload.map((c) => {
      const last = c.topOfBookData?.[0]?.lastPrice ?? c.priceData?.[0]?.close ?? 0;
      const open = c.priceData?.[0]?.open ?? last;
      return {
        ticker: c.ticker,
        price: last,
        change_pct: open ? ((last - open) / open) * 100 : 0,
      };
    });
    return { data: out, source: "tiingo" as const, error: null };
  });

export const getTiingoIEX = createServerFn({ method: "GET" })
  .inputValidator(z.object({ symbol: z.string().min(1).max(20) }))
  .handler(async ({ data }) => {
    const ticker = tickerForTiingo(data.symbol);
    const { data: payload, error } = await tiingoFetch<
      Array<{
        ticker: string;
        last: number;
        prevClose: number;
        high: number;
        low: number;
        open: number;
        volume: number;
        timestamp: string;
      }>
    >(`/iex/${ticker}`);
    if (error || !Array.isArray(payload) || payload.length === 0) {
      return { data: null, source: "mock" as const, error };
    }
    return { data: payload[0], source: "tiingo" as const, error: null };
  });
