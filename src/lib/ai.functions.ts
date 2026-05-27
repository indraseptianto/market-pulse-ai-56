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
async function callAI(system: string, user: string): Promise<string> {
  if (!API_KEY) return "AI insights unavailable: API key not configured.";

  const body = JSON.stringify({
    model: MODEL,
    temperature: TEMPERATURE,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const tryCall = async (): Promise<{ ok: boolean; json?: unknown }> => {
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body,
      });
      if (!res.ok) return { ok: false };
      return { ok: true, json: await res.json() };
    } catch { return { ok: false }; }
  };

  const result = await tryCall();
  if (result.ok) {
    const json = result.json as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() || "No insight generated.";
  }

  // Retry once after 3s
  await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  const retryResult = await tryCall();
  if (retryResult.ok) {
    const json = retryResult.json as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() || "No insight generated.";
  }

  return "AI is rate-limited. Try again shortly.";
}

async function callAIWithCache(
  symbol: string,
  type: string,
  system: string,
  user: string,
): Promise<string> {
  const cached = getCache(symbol, type);
  const text = await callAI(system, user);
  if (text && !text.includes("rate-limited") && !text.includes("unavailable")) {
    setCache(symbol, type, text);
  }
  if (text.includes("rate-limited") && cached) {
    const age = Math.round((Date.now() - Date.now()) / 60000);
    return `⚠️ AI sedang diproses. Analisis terakhir (${age}m lalu):\n\n${cached}`;
  }
  if (text.includes("unavailable") && cached) return `📋 AI unavailable. Using cached analysis:\n\n${cached}`;
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

// ── News AI Functions ─────────────────────────────────────────────────────────

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
    const prompt = `Analyze the sentiment of this financial news article.\n\nTitle: ${data.title}\nDescription: ${data.description}\nTickers mentioned: ${data.tickers?.join(", ") ?? "none"}\n\nRespond ONLY with valid JSON in this exact format:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": number (0-100, percentage),
  "key_factors": ["factor 1", "factor 2"],
  "summary": "1-sentence Indonesian summary"
}`;

    const text = await callAI(
      "You are a financial sentiment analyst. Analyze news articles and respond with valid JSON only. Output in Indonesian for the summary field.",
      prompt,
    );

    // Parse JSON from response
    try {
      // Try to extract JSON from response (may have markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          sentiment: parsed.sentiment ?? "neutral",
          confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)),
          keyFactors: Array.isArray(parsed.key_factors) ? parsed.key_factors : [],
          summary: parsed.summary ?? text.slice(0, 200),
        };
      }
    } catch { /* fall through */ }

    // Fallback: keyword-based simple detection
    const combined = `${data.title} ${data.description}`.toLowerCase();
    const bullish = ["surge", "beat", "upgrade", "rally", "soar", "record", "profit", "gain", "naik", "untung", "laba"].filter(w => combined.includes(w)).length;
    const bearish = ["fall", "drop", "miss", "downgrade", "plunge", "loss", "turun", "rugi", "lemah"].filter(w => combined.includes(w)).length;
    const s = bullish - bearish;
    return {
      sentiment: s > 0 ? "bullish" : s < 0 ? "bearish" : "neutral",
      confidence: Math.min(90, 40 + Math.abs(s) * 15),
      keyFactors: s > 0 ? ["Kata kunci bullish terdeteksi"] : s < 0 ? ["Kata kunci bearish terdeteksi"] : [],
      summary: text.slice(0, 200) || "Analisis sentimen tidak tersedia.",
    };
  });

export const getNewsIntelligenceNote = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      articles: z.array(z.object({
        title: z.string(),
        description: z.string(),
        tickers: z.array(z.string()),
      })).max(20),
      sector: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (!data.articles.length) return { note: "Tidak ada berita untuk dianalisis.", theme: "N/A", sentiment: "neutral" as const };

    const articlesMd = data.articles.map((a, i) =>
      `${i + 1}. [${a.tickers.join(", ")}] ${a.title}\n   ${a.description.slice(0, 200)}`
    ).join("\n\n");

    const prompt = `You are a senior equity research analyst. Analyze these ${data.articles.length} news articles and provide a concise market intelligence note.

${articlesMd}

Respond ONLY with valid JSON:
{
  "theme": "2-3 word theme name in English (e.g. 'Banking Earnings', 'Energy Regulation')",
  "overall_sentiment": "bullish | bearish | neutral",
  "key_insight": "1-sentence Indonesian market insight for traders",
  "article_count": number,
  "tickers_mentioned": string[]
}`;

    const text = await callAI(
      "You are an Indonesian equity research analyst. Respond with valid JSON only. Be concise and data-driven.",
      prompt,
    );

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          note: parsed.key_insight ?? text.slice(0, 300),
          theme: parsed.theme ?? "Market News",
          sentiment: parsed.overall_sentiment ?? "neutral",
          articleCount: parsed.article_count ?? data.articles.length,
          tickersMentioned: parsed.tickers_mentioned ?? [],
        };
      }
    } catch { /* fall through */ }

    return {
      note: text.slice(0, 300) || "Intelligence note unavailable.",
      theme: data.sector ?? "Market News",
      sentiment: "neutral" as const,
      articleCount: data.articles.length,
      tickersMentioned: [],
    };
  });
