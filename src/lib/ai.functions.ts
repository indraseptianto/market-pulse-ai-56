import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = process.env.AI_ANALYST_BASE_URL ?? "http://43.133.150.19:20128/v1";
const API_KEY = process.env.AI_ANALYST_API_KEY ?? "";
const MODEL = process.env.AI_ANALYST_MODEL ?? "kimi-minimax-m2.5";
const TEMPERATURE = 0.25;
const RETRY_DELAY_MS = 3000;
const CACHE_KEY = "stratum_ai_cache";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Cache helpers ─────────────────────────────────────────────────────────────
interface CacheEntry {
  timestamp: number;
  text: string;
  type: string;
}

function getCache(symbol: string, type: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Record<string, CacheEntry>;
    const entry = cache[`${symbol}:${type}`];
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
    return entry.text;
  } catch { return null; }
}

function setCache(symbol: string, type: string, text: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const cache = raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {};
    cache[`${symbol}:${type}`] = { timestamp: Date.now(), text, type };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* storage full */ }
}

// ── AI Call with Retry + Cache ────────────────────────────────────────────────

interface AIResponse {
  ok: boolean;
  json?: unknown;
  status?: number;
}

async function tryCall(
  body: object,
  attempt = 1,
): Promise<AIResponse> {
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, json: await res.json() };
  } catch {
    return { ok: false };
  }
}

async function callAI(system: string, user: string): Promise<string> {
  if (!API_KEY) return "AI insights unavailable: API key not configured.";

  const body = {
    model: MODEL,
    temperature: TEMPERATURE,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  let result = await tryCall(body);
  if (result.ok) {
    const json = result.json as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() || "No insight generated.";
  }

  // Retry once after 3s on failure (not 400 errors)
  if (result.status !== 400) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    result = await tryCall(body);
    if (result.ok) {
      const json = result.json as { choices?: { message?: { content?: string } }[] };
      return json.choices?.[0]?.message?.content?.trim() || "No insight generated.";
    }
  }

  return "AI is rate-limited. Try again shortly.";
}

/**
 * Call AI with JSON output enforcement via response_format.
 * Falls back to regex extraction if provider doesn't support response_format.
 */
async function callAIJson<T = Record<string, unknown>>(
  system: string,
  user: string,
  schema?: z.ZodSchema<T>,
): Promise<{ data: T | null; text: string; source: "json" | "regex" | "fallback" }> {
  if (!API_KEY) {
    return { data: null, text: "AI insights unavailable: API key not configured.", source: "fallback" };
  }

  // Try structured output first (OpenAI-compatible with response_format)
  const structuredBody = {
    model: MODEL,
    temperature: 0.1, // Lower temp for structured output
    response_format: { type: "json_object" } as { type: "json_object" },
    messages: [
      { role: "system", content: `${system}\n\nIMPORTANT: You must respond with ONLY valid JSON. No markdown, no explanation, no preamble. The response must be parseable JSON.` },
      { role: "user", content: user },
    ],
  };

  let result = await tryCall(structuredBody);

  // Fallback to non-structured call if provider doesn't support response_format
  if (!result.ok) {
    const fallbackBody = {
      model: MODEL,
      temperature: 0.1,
      messages: [
        { role: "system", content: `${system}\n\nRespond ONLY with valid JSON. No markdown, no explanation.` },
        { role: "user", content: user },
      ],
    };
    result = await tryCall(fallbackBody);

    if (!result.ok) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      result = await tryCall(fallbackBody);
      if (!result.ok) {
        return { data: null, text: "AI is rate-limited. Try again shortly.", source: "fallback" };
      }
    }

    // Parse JSON from text response
    const json = result.json as { choices?: { message?: { content?: string } }[] };
    const rawText = json.choices?.[0]?.message?.content?.trim() ?? "";

    return parseJSONResponse(rawText, schema, rawText);
  }

  // Structured response — parse directly
  const json = result.json as { choices?: { message?: { content?: string } }[] };
  const rawText = json.choices?.[0]?.message?.content?.trim() ?? "";

  return parseJSONResponse(rawText, schema, rawText);
}

/** Extract and parse JSON from text response */
function parseJSONResponse<T>(
  rawText: string,
  schema?: z.ZodSchema<T>,
  fallbackText: string,
): { data: T | null; text: string; source: "json" | "regex" | "fallback" } {
  // Direct parse attempt
  try {
    const parsed = JSON.parse(rawText);
    if (schema) {
      const result = schema.safeParse(parsed);
      if (result.success) {
        return { data: result.data, text: rawText, source: "json" };
      }
    } else {
      return { data: parsed as T, text: rawText, source: "json" };
    }
  } catch { /* continue to regex */ }

  // Try extracting from markdown code blocks
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]+?)\s*```/) ?? rawText.match(/(\{[\s\S]+?\})/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[jsonMatch.length - 1].trim());
      if (schema) {
        const result = schema.safeParse(parsed);
        if (result.success) {
          return { data: result.data, text: jsonMatch[jsonMatch.length - 1], source: "regex" };
        }
      } else {
        return { data: parsed as T, text: jsonMatch[jsonMatch.length - 1], source: "regex" };
      }
    } catch { /* continue */ }
  }

  return { data: null, text: fallbackText, source: "fallback" };
}

async function callAIWithCache(
  symbol: string,
  type: string,
  system: string,
  user: string,
): Promise<string> {
  const cached = getCache(symbol, type);
  const text = await callAI(system, user);

  if (text.includes("rate-limited") && cached) {
    const cacheEntry = (() => {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const cache = JSON.parse(raw) as Record<string, CacheEntry>;
        return cache[`${symbol}:${type}`];
      } catch { return null; }
    })();
    const age = cacheEntry ? Math.round((Date.now() - cacheEntry.timestamp) / 60000) : 0;
    return `⚠️ AI sedang diproses. Analisis terakhir (${age}m lalu):\n\n${cached}`;
  }

  if (text.includes("unavailable") && cached) return `📋 AI unavailable. Using cached analysis:\n\n${cached}`;

  if (text && !text.includes("rate-limited") && !text.includes("unavailable")) {
    setCache(symbol, type, text);
  }

  return text;
}

// ── Server Functions ──────────────────────────────────────────────────────────

export const getMarketSummary = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      gainers: z.array(z.object({ symbol: z.string(), change_pct: z.number() })).max(10),
      losers: z.array(z.object({ symbol: z.string(), change_pct: z.number() })).max(10),
      sectors: z.array(z.object({ name: z.string(), change_pct: z.number() })).max(20),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `Today's snapshot:\nTop gainers: ${data.gainers.map((g) => `${g.symbol} ${g.change_pct.toFixed(2)}%`).join(", ")}\nTop losers: ${data.losers.map((l) => `${l.symbol} ${l.change_pct.toFixed(2)}%`).join(", ")}\nSectors: ${data.sectors.map((s) => `${s.name} ${s.change_pct.toFixed(2)}%`).join(", ")}\n\nWrite a concise 3-sentence market briefing for institutional traders.`;
    const text = await callAI("You are a senior market strategist. Be concise, professional, and avoid hype.", prompt);
    return { text };
  });

export const getStockAnalysis = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      symbol: z.string(), name: z.string(), price: z.number(), change_pct: z.number(),
      sector: z.string(), pe_ratio: z.number().nullable().optional(), roe: z.number().nullable().optional(),
      debt_to_equity: z.number().nullable().optional(), dividend_yield: z.number().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `Stock: ${data.symbol} — ${data.name}\nSector: ${data.sector}\nPrice: ${data.price} (${data.change_pct.toFixed(2)}%)\nP/E: ${data.pe_ratio ?? "n/a"}\nROE: ${data.roe ?? "n/a"}%\nD/E: ${data.debt_to_equity ?? "n/a"}\nDividend yield: ${data.dividend_yield ?? "n/a"}%\n\nWrite a concise 4-sentence analyst note: valuation, fundamentals, momentum, and an overall stance with risk score 1-10.`;
    const text = await callAI("You are an equity research analyst. Be concise, balanced, and data-driven.", prompt);
    return { text };
  });

export const getTechnicalAnalysis = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      symbol: z.string(), last: z.number(), trend: z.string(), stance: z.string(), score: z.number(),
      rsi: z.number().nullable(), macdCross: z.string(), histTurning: z.string().nullable(),
      sma20: z.number().nullable(), sma50: z.number().nullable(), sma200: z.number().nullable(),
      bbUpper: z.number().nullable(), bbLower: z.number().nullable(), atr: z.number().nullable(),
      support: z.number(), resistance: z.number(),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `Technical snapshot for ${data.symbol}:\nPrice: ${data.last}\nTrend: ${data.trend} | Stance: ${data.stance} (score ${data.score}/100)\nRSI(14): ${data.rsi?.toFixed(1) ?? "n/a"}\nMACD: ${data.macdCross}${data.histTurning ? ` (${data.histTurning})` : ""}\nSMA20/50/200: ${data.sma20?.toFixed(2) ?? "—"} / ${data.sma50?.toFixed(2) ?? "—"} / ${data.sma200?.toFixed(2) ?? "—"}\nBollinger: ${data.bbLower?.toFixed(2) ?? "—"} – ${data.bbUpper?.toFixed(2) ?? "—"}\nATR(14): ${data.atr?.toFixed(2) ?? "—"}\nSupport / Resistance: ${data.support.toFixed(2)} / ${data.resistance.toFixed(2)}\n\nWrite a 4-sentence trader-grade technical note covering: trend & momentum, key levels, the next likely setup (continuation vs reversal), and a probabilistic call (Buy / Hold / Sell) with risk note.`;
    const text = await callAI("You are a senior technical analyst writing concise, decisive trade notes for institutional traders. No hedging filler.", prompt);
    return { text };
  });

export const getStockIntelligenceNote = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      symbol: z.string(), name: z.string(), sector: z.string(), price: z.number(), change_pct: z.number(),
      fair_verdict: z.string(), fair_price: z.number().nullable(), upside_pct: z.number().nullable(),
      technical_stance: z.string(), technical_score: z.number().nullable(), rsi: z.number().nullable(),
      news_sentiment: z.string(), news_count: z.number(), smart_money: z.string(),
      risk_flags: z.array(z.string()).max(8),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `Stock intelligence snapshot:\nSymbol: ${data.symbol} - ${data.name}\nSector: ${data.sector}\nLive price: ${data.price} (${data.change_pct.toFixed(2)}%)\nFair value: ${data.fair_verdict}; fair price ${data.fair_price ?? "n/a"}; upside ${data.upside_pct ?? "n/a"}%\nTechnical: ${data.technical_stance}; score ${data.technical_score ?? "n/a"}; RSI ${data.rsi?.toFixed(1) ?? "n/a"}\nNews sentiment: ${data.news_sentiment}; news count ${data.news_count}\nSmart money: ${data.smart_money}\nRisk flags: ${data.risk_flags.length ? data.risk_flags.join(", ") : "none"}\n\nWrite a concise Indonesian analyst note in 5 bullets: setup, valuation, technicals, catalysts/smart-money, and risk. End with one stance: Watch / Accumulate / Hold / Avoid. Do not present it as financial advice.`;
    const text = await callAIWithCache(data.symbol, "intelligence", "You are a disciplined Indonesian equity analyst. Be concise, evidence-based, and avoid hype.", prompt);
    return { text };
  });

export const getDividendNote = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      symbol: z.string(), name: z.string(), sector: z.string(), price: z.number(),
      dividend_yield: z.number().nullable(), dividend_per_share: z.number().nullable(),
      payout_ratio: z.number().nullable(), frequency: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `Dividend analysis for ${data.symbol} — ${data.name}:\nSector: ${data.sector}\nPrice: ${data.price}\nDividend yield: ${data.dividend_yield ?? "n/a"}%\nDividend per share: ${data.dividend_per_share ? `IDR ${data.dividend_per_share}` : "n/a"}\nPayout ratio: ${data.payout_ratio ?? "n/a"}%\nFrequency: ${data.frequency}\n\nWrite a 4-bullet dividend analyst note covering: (1) yield attractiveness vs market, (2) payout sustainability (is the company earning enough to maintain this dividend?), (3) growth trajectory (is dividend growing or shrinking over time?), (4) overall stance: Accumulate / Hold / Avoid dividend.`;
    const text = await callAIWithCache(data.symbol, "dividend", "You are a dividend-focused equity analyst. Be concise, evidence-based, focus on sustainability and yield safety.", prompt);
    return { text };
  });

// ── News AI Functions (with structured JSON output) ───────────────────────────

const NewsSentimentSchema = z.object({
  sentiment: z.enum(["bullish", "bearish", "neutral"]),
  confidence: z.number().min(0).max(100),
  key_factors: z.array(z.string()),
  summary: z.string(),
});

export const getNewsSentiment = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      title: z.string(),
      description: z.string(),
      tickers: z.array(z.string()).max(10).optional(),
      articleUrl: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `Analyze the sentiment of this financial news article.\n\nTitle: ${data.title}\nDescription: ${data.description}\nTickers mentioned: ${data.tickers?.join(", ") ?? "none"}\n\nRespond ONLY with valid JSON:\n{\n  "sentiment": "bullish" | "bearish" | "neutral",\n  "confidence": number (0-100),\n  "key_factors": ["factor 1", "factor 2"],\n  "summary": "1-sentence Indonesian summary"\n}`;

    const { data: parsed, source } = await callAIJson(
      "You are a financial sentiment analyst. Analyze news articles and respond with valid JSON only. Output in Indonesian for the summary field.",
      prompt,
      NewsSentimentSchema,
    );

    if (parsed) {
      return {
        sentiment: parsed.sentiment,
        confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
        keyFactors: parsed.key_factors ?? [],
        summary: parsed.summary ?? "",
        _source: source,
      };
    }

    // Keyword-based fallback
    const combined = `${data.title} ${data.description}`.toLowerCase();
    const bullish = ["surge", "beat", "upgrade", "rally", "soar", "record", "profit", "gain", "naik", "untung", "laba"].filter((w) => combined.includes(w)).length;
    const bearish = ["fall", "drop", "miss", "downgrade", "plunge", "loss", "turun", "rugi", "lemah"].filter((w) => combined.includes(w)).length;
    const s = bullish - bearish;

    return {
      sentiment: s > 0 ? "bullish" : s < 0 ? "bearish" : "neutral",
      confidence: Math.min(90, 40 + Math.abs(s) * 15),
      keyFactors: s > 0 ? ["Kata kunci bullish terdeteksi"] : s < 0 ? ["Kata kunci bearish terdeteksi"] : [],
      summary: "Analisis sentimen tidak tersedia.",
      _source: "fallback",
    };
  });

const NewsIntelligenceSchema = z.object({
  theme: z.string(),
  overall_sentiment: z.enum(["bullish", "bearish", "neutral"]),
  key_insight: z.string(),
  article_count: z.number().optional(),
  tickers_mentioned: z.array(z.string()).optional(),
});

export const getNewsIntelligenceNote = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      articles: z.array(
        z.object({ title: z.string(), description: z.string(), tickers: z.array(z.string()) }),
      ).max(20),
      sector: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (!data.articles.length) {
      return {
        note: "Tidak ada berita untuk dianalisis.",
        theme: "N/A",
        sentiment: "neutral" as const,
        articleCount: 0,
        tickersMentioned: [],
        _source: "fallback" as const,
      };
    }

// Build article summary for context
    const articleSummary = data.articles
      .map((a, i) => i + 1 + '. ' + a.tickers.join('/') + ': ' + a.title + ' - ' + a.description.slice(0, 150))
      .join(' | ');

    const prompt = 'Articles: ' + articleSummary + '. Respond ONLY with valid JSON (no markdown): {"theme":"2-3 words","overall_sentiment":"bullish|neutral|bearish","key_insight":"1 sentence in Indonesian","article_count":' + data.articles.length + ',"tickers_mentioned":["LIST"]}';

    const { data: parsed, source } = await callAIJson(
      "You are an Indonesian equity research analyst. Respond with valid JSON only. Be concise and data-driven.",
      prompt,
      NewsIntelligenceSchema,
    );

    if (parsed) {
      return {
        note: parsed.key_insight ?? "",
        theme: parsed.theme ?? data.sector ?? "Market News",
        sentiment: parsed.overall_sentiment ?? "neutral",
        articleCount: parsed.article_count ?? data.articles.length,
        tickersMentioned: parsed.tickers_mentioned ?? [],
        _source: source,
      };
    }

    return {
      note: "Intelligence note unavailable.",
      theme: data.sector ?? "Market News",
      sentiment: "neutral" as const,
      articleCount: data.articles.length,
      tickersMentioned: [],
      _source: "fallback" as const,
    };
  });