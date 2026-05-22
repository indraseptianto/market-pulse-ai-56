import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(system: string, user: string): Promise<string> {
  const openAIKey = process.env.OPENAI_API_KEY;
  if (openAIKey) {
    try {
      const res = await fetch(`${OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAIKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          temperature: 0.25,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (res.status === 429) return "AI is rate-limited. Try again shortly.";
      if (!res.ok) return `AI request failed (${res.status}).`;
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return json.choices?.[0]?.message?.content?.trim() || "No insight generated.";
    } catch (e) {
      return e instanceof Error ? `AI error: ${e.message}` : "AI error.";
    }
  }

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return "AI insights unavailable: gateway not configured.";
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (res.status === 429) return "AI is rate-limited. Try again shortly.";
    if (res.status === 402) return "AI quota exhausted. Add credits to continue.";
    if (!res.ok) return `AI request failed (${res.status}).`;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() || "No insight generated.";
  } catch (e) {
    return e instanceof Error ? `AI error: ${e.message}` : "AI error.";
  }
}

export const getMarketSummary = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      gainers: z.array(z.object({ symbol: z.string(), change_pct: z.number() })).max(10),
      losers: z.array(z.object({ symbol: z.string(), change_pct: z.number() })).max(10),
      sectors: z.array(z.object({ name: z.string(), change_pct: z.number() })).max(20),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `Today's snapshot:\nTop gainers: ${data.gainers
      .map((g) => `${g.symbol} ${g.change_pct.toFixed(2)}%`)
      .join(", ")}\nTop losers: ${data.losers
      .map((l) => `${l.symbol} ${l.change_pct.toFixed(2)}%`)
      .join(", ")}\nSectors: ${data.sectors
      .map((s) => `${s.name} ${s.change_pct.toFixed(2)}%`)
      .join(", ")}\n\nWrite a concise 3-sentence market briefing for institutional traders.`;
    const text = await callAI(
      "You are a senior market strategist. Be concise, professional, and avoid hype.",
      prompt,
    );
    return { text };
  });

export const getStockAnalysis = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      symbol: z.string(),
      name: z.string(),
      price: z.number(),
      change_pct: z.number(),
      sector: z.string(),
      pe_ratio: z.number().nullable().optional(),
      roe: z.number().nullable().optional(),
      debt_to_equity: z.number().nullable().optional(),
      dividend_yield: z.number().nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `Stock: ${data.symbol} — ${data.name}\nSector: ${data.sector}\nPrice: ${data.price} (${data.change_pct.toFixed(2)}%)\nP/E: ${data.pe_ratio ?? "n/a"}\nROE: ${data.roe ?? "n/a"}%\nD/E: ${data.debt_to_equity ?? "n/a"}\nDividend yield: ${data.dividend_yield ?? "n/a"}%\n\nWrite a concise 4-sentence analyst note: valuation, fundamentals, momentum, and an overall stance with risk score 1-10.`;
    const text = await callAI(
      "You are an equity research analyst. Be concise, balanced, and data-driven.",
      prompt,
    );
    return { text };
  });

export const getTechnicalAnalysis = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      symbol: z.string(),
      last: z.number(),
      trend: z.string(),
      stance: z.string(),
      score: z.number(),
      rsi: z.number().nullable(),
      macdCross: z.string(),
      histTurning: z.string().nullable(),
      sma20: z.number().nullable(),
      sma50: z.number().nullable(),
      sma200: z.number().nullable(),
      bbUpper: z.number().nullable(),
      bbLower: z.number().nullable(),
      atr: z.number().nullable(),
      support: z.number(),
      resistance: z.number(),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `Technical snapshot for ${data.symbol}:
Price: ${data.last}
Trend: ${data.trend} | Stance: ${data.stance} (score ${data.score}/100)
RSI(14): ${data.rsi?.toFixed(1) ?? "n/a"}
MACD: ${data.macdCross}${data.histTurning ? ` (${data.histTurning})` : ""}
SMA20/50/200: ${data.sma20?.toFixed(2) ?? "—"} / ${data.sma50?.toFixed(2) ?? "—"} / ${data.sma200?.toFixed(2) ?? "—"}
Bollinger: ${data.bbLower?.toFixed(2) ?? "—"} – ${data.bbUpper?.toFixed(2) ?? "—"}
ATR(14): ${data.atr?.toFixed(2) ?? "—"}
Support / Resistance: ${data.support.toFixed(2)} / ${data.resistance.toFixed(2)}

Write a 4-sentence trader-grade technical note covering: trend & momentum, key levels, the next likely setup (continuation vs reversal), and a probabilistic call (Buy / Hold / Sell) with risk note.`;
    const text = await callAI(
      "You are a senior technical analyst writing concise, decisive trade notes for institutional traders. No hedging filler.",
      prompt,
    );
    return { text };
  });

export const getStockIntelligenceNote = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      symbol: z.string(),
      name: z.string(),
      sector: z.string(),
      price: z.number(),
      change_pct: z.number(),
      fair_verdict: z.string(),
      fair_price: z.number().nullable(),
      upside_pct: z.number().nullable(),
      technical_stance: z.string(),
      technical_score: z.number().nullable(),
      rsi: z.number().nullable(),
      news_sentiment: z.string(),
      news_count: z.number(),
      smart_money: z.string(),
      risk_flags: z.array(z.string()).max(8),
    }),
  )
  .handler(async ({ data }) => {
    const prompt = `Stock intelligence snapshot:
Symbol: ${data.symbol} - ${data.name}
Sector: ${data.sector}
Live price: ${data.price} (${data.change_pct.toFixed(2)}%)
Fair value: ${data.fair_verdict}; fair price ${data.fair_price ?? "n/a"}; upside ${data.upside_pct ?? "n/a"}%
Technical: ${data.technical_stance}; score ${data.technical_score ?? "n/a"}; RSI ${data.rsi?.toFixed(1) ?? "n/a"}
News sentiment: ${data.news_sentiment}; news count ${data.news_count}
Smart money: ${data.smart_money}
Risk flags: ${data.risk_flags.length ? data.risk_flags.join(", ") : "none"}

Write a concise Indonesian analyst note in 5 bullets: setup, valuation, technicals, catalysts/smart-money, and risk. End with one stance: Watch / Accumulate / Hold / Avoid. Do not present it as financial advice.`;

    const text = await callAI(
      "You are a disciplined Indonesian equity analyst. Be concise, evidence-based, and avoid hype.",
      prompt,
    );
    return { text };
  });
