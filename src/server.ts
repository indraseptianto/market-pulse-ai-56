import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

// ── Types ─────────────────────────────────────────────────────────────────────

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

// ── Env helpers ───────────────────────────────────────────────────────────────

function envString(env: unknown, key: string): string | undefined {
  if (env && typeof env === "object" && key in env) {
    const value = (env as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const processEnv = (
    globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  const value = processEnv?.[key];
  return value?.trim() || undefined;
}

// ── Rate Limiter (in-memory, per-instance) ───────────────────────────────────
// WARNING: On Vercel serverless, each cold start = fresh instance.
// This rate limiter is effective ONLY within a single warm Lambda.
// For cross-instance rate limiting, use Upstash Redis or Vercel KV.

const RATE_LIMIT_WINDOW_MS = 60_000; // 1-minute window
const RATE_LIMIT_MAX = 20; // 20 AI chat requests per minute per IP

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count, resetIn: entry.resetAt - now };
}

// ── IP extraction (with basic spoofing protection) ──────────────────────────

const TRUSTED_PROXIES = new Set(["127.0.0.1", "::1"]);

function getClientIp(request: Request): string {
  // Only trust x-forwarded-for from known proxies
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    // Only use if from a trusted proxy, otherwise use x-real-ip or fall back
    const realIp = request.headers.get("x-real-ip");
    if (realIp && TRUSTED_PROXIES.has(realIp)) return first;
  }
  // Fall back to CF-Connecting-IP or request's remote address
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ── JSON helper ──────────────────────────────────────────────────────────────

function jsonResponse(
  body: unknown,
  options: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

// ── Message sanitiser ─────────────────────────────────────────────────────────

function sanitizeMessages(body: unknown): ChatMessage[] {
  if (!body || typeof body !== "object") return [];
  const raw = (body as { messages?: unknown }).messages;
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter((item): item is ChatMessage => {
      if (!item || typeof item !== "object") return false;
      const role = (item as ChatMessage).role;
      const content = (item as ChatMessage).content;
      return ["user", "assistant"].includes(role) && typeof content === "string" && content.trim().length > 0;
    })
    .slice(-12)
    .map((item) => ({ role: item.role, content: item.content.slice(0, 3000) }));
}

// ── Unified chat handler (stock-chat + /api/chat) ───────────────────────────

async function handleChat(
  request: Request,
  env: unknown,
  options: {
    path: string;
    baseUrlKey: string;
    apiKeyKey: string;
    modelKey: string;
    systemPrompt?: string;
    rateLimitEnabled?: boolean;
  },
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  // Rate limit (skippable for internal / authenticated routes)
  if (options.rateLimitEnabled !== false) {
    const clientIp = getClientIp(request);
    const { allowed, remaining, resetIn } = checkRateLimit(clientIp);
    if (!allowed) {
      return jsonResponse(
        {
          error: `Rate limit exceeded. Try again in ${Math.ceil(resetIn / 1000)}s.`,
          retryAfter: Math.ceil(resetIn / 1000),
          limit: RATE_LIMIT_MAX,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(resetIn / 1000)),
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(resetIn / 1000)),
          },
        },
      );
    }
  }

  const baseUrl = envString(env, options.baseUrlKey) ?? process.env[options.baseUrlKey];
  if (!baseUrl) {
    return jsonResponse({ error: `${options.baseUrlKey} tidak dikonfigurasi.` }, { status: 500 });
  }

  const apiKey = envString(env, options.apiKeyKey) ?? process.env[options.apiKeyKey];
  if (!apiKey) {
    return jsonResponse({ error: `${options.apiKeyKey} belum dikonfigurasi.` }, { status: 500 });
  }

  const model = envString(env, options.modelKey) ?? process.env[options.modelKey];
  if (!model) {
    return jsonResponse({ error: `${options.modelKey} tidak dikonfigurasi.` }, { status: 500 });
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Payload JSON tidak valid." }, { status: 400 });
  }

  // Support both { messages: [] } (StockChatbot) and { system, message } (external callers)
  const raw = body as Record<string, unknown>;
  const messages: ChatMessage[] = [];

  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }

  // { messages: [{role, content}] } — StockChatbot format
  const msgArr = raw.messages as unknown[] | undefined;
  if (Array.isArray(msgArr)) {
    for (const item of msgArr as unknown[]) {
      if (item && typeof item === "object") {
        const role = (item as ChatMessage).role;
        const content = (item as ChatMessage).content;
        if (["user", "assistant", "system"].includes(role) && typeof content === "string" && content.trim()) {
          messages.push({ role, content: content.slice(0, 3000) });
        }
      }
    }
  } else {
    // { system, message } — external caller format (crypto dashboard)
    if (typeof raw.system === "string" && raw.system.trim() && !options.systemPrompt) {
      messages.push({ role: "system", content: raw.system });
    }
    if (typeof raw.message === "string" && raw.message.trim()) {
      messages.push({ role: "user", content: raw.message.slice(0, 3000) });
    }
  }

  if (!messages.length) {
    return jsonResponse({ error: "Pesan kosong." }, { status: 400 });
  }

  // Call upstream AI — OpenAI-compatible /chat/completions endpoint
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.slice(-12),
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });
  } catch (err) {
    return jsonResponse(
      { error: `Gagal connect ke AI provider: ${err instanceof Error ? err.message : "Network error"}` },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const detail = await upstream.text();
    return jsonResponse(
      { error: detail || `Provider error ${upstream.status}` },
      { status: upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502 },
    );
  }

  const data = (await upstream.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (data.error) {
    return jsonResponse({ error: data.error.message ?? "Model error" }, { status: 502 });
  }

  const reply = data.choices?.[0]?.message?.content?.trim();
  return jsonResponse(
    { reply: reply || "Model tidak mengembalikan jawaban." },
    {
      headers: options.rateLimitEnabled !== false ? {
        "X-RateLimit-Remaining": String(checkRateLimit(getClientIp(request)).remaining),
        "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
      } : {},
    },
  );
}

// ── Chat routes ───────────────────────────────────────────────────────────────

async function handleStockChat(request: Request, env: unknown): Promise<Response> {
  return handleChat(request, env, {
    path: "/api/stock-chat",
    baseUrlKey: "STOCK_CHAT_BASE_URL",
    apiKeyKey: "STOCK_CHAT_API_KEY",
    modelKey: "STOCK_CHAT_MODEL",
    rateLimitEnabled: true,
  });
}

async function handleGenericChat(request: Request, env: unknown): Promise<Response> {
  return handleChat(request, env, {
    path: "/api/chat",
    baseUrlKey: "OPENAI_API_BASE_URL",
    apiKeyKey: "OPENAI_API_KEY",
    modelKey: "OPENAI_MODEL",
    // No rate limit for external callers (crypto dashboard), they have their own
    rateLimitEnabled: false,
  });
}

// ── SSR Entry ─────────────────────────────────────────────────────────────────

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      // Custom API routes
      if (url.pathname === "/api/stock-chat") {
        return await handleStockChat(request, env);
      }
      if (url.pathname === "/api/chat") {
        return await handleGenericChat(request, env);
      }

      // TanStack Start SSR
      const entry = await getServerEntry();
      return entry.fetch(request, env, ctx);
    } catch (err) {
      const captured = consumeLastCapturedError();
      if (import.meta.env.DEV) {
        console.error("[server]", captured ?? err);
      }
      return brandedErrorResponse();
    }
  },
} satisfies ServerEntry;