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

const TRUSTED_PROXIES = new Set([
  "43.133.150.19", // Cloudflare / Nginx proxy
  "127.0.0.1",     // Local
]);

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Only trust first IP if from known proxy, otherwise use last hop
    const firstIp = forwarded.split(",")[0].trim();
    if (TRUSTED_PROXIES.has(firstIp) || firstIp.match(/^10\./) || firstIp.match(/^172\.(1[6-9]|2\d|3[01])\./)) {
      return firstIp.slice(0, 45);
    }
    // For untrusted X-Forwarded-For, use the rightmost (client-facing) IP
    const ips = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    const clientIp = ips[ips.length - 1];
    return clientIp.slice(0, 45);
  }
  return (request.headers.get("x-real-ip") ?? "unknown").slice(0, 45);
}

// ── JSON helper ───────────────────────────────────────────────────────────────

function jsonResponse(payload: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

// ── Message sanitization ─────────────────────────────────────────────────────

function sanitizeMessages(input: unknown): ChatMessage[] {
  if (!input || typeof input !== "object" || !("messages" in input)) return [];
  const raw = (input as { messages?: unknown }).messages;
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item): item is ChatMessage => {
      if (!item || typeof item !== "object") return false;
      const role = item.role;
      const content = item.content;
      return ["user", "assistant"].includes(role) && typeof content === "string" && content.trim().length > 0;
    })
    .slice(-12)
    .map((item) => ({ role: item.role, content: item.content.slice(0, 3000) }));
}

// ── Chat handler ─────────────────────────────────────────────────────────────

async function handleStockChat(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  // Rate limit check (in-memory, per-instance)
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

  // Get config from env — NO hardcoded fallbacks
  const baseUrl = envString(env, "STOCK_CHAT_BASE_URL") ?? process.env.STOCK_CHAT_BASE_URL;
  if (!baseUrl) {
    return jsonResponse(
      { error: "STOCK_CHAT_BASE_URL tidak dikonfigurasi. Set di environment variables." },
      { status: 500 },
    );
  }

  const apiKey = envString(env, "STOCK_CHAT_API_KEY") ?? process.env.STOCK_CHAT_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "STOCK_CHAT_API_KEY belum dikonfigurasi di server." }, { status: 500 });
  }

  const model = envString(env, "STOCK_CHAT_MODEL") ?? process.env.STOCK_CHAT_MODEL;
  if (!model) {
    return jsonResponse(
      { error: "STOCK_CHAT_MODEL tidak dikonfigurasi. Set di environment variables." },
      { status: 500 },
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Payload JSON tidak valid." }, { status: 400 });
  }

  const messages = sanitizeMessages(body);
  if (!messages.length) {
    return jsonResponse({ error: "Pesan kosong." }, { status: 400 });
  }

  // Call upstream AI
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "Anda adalah analis saham Indonesia untuk dashboard Market Pulse. Bantu user menemukan saham potensial dengan framework ringkas: thesis, katalis, risiko, data yang perlu diverifikasi, dan checklist entry/exit. Jangan berikan nasihat finansial absolut, jangan mengarang data harga/fundamental jika tidak tersedia, dan selalu sarankan verifikasi ke laporan IDX/emiten.",
          },
          ...messages,
        ],
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
    return jsonResponse({ error: detail || `Provider error ${upstream.status}` }, { status: 502 });
  }

  const data = (await upstream.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const reply = data.choices?.[0]?.message?.content?.trim();
  return jsonResponse(
    {
      reply: reply || "Model tidak mengembalikan jawaban.",
      source: "stock-chat",
    },
    {
      headers: {
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
      },
    },
  );
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
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  try {
    const payload = JSON.parse(body);
    if (!payload || Array.isArray(payload) || typeof payload !== "object") return false;

    const fields = payload as Record<string, unknown>;
    const expectedKeys = new Set(["message", "status", "unhandled"]);
    if (!Object.keys(fields).every((key) => expectedKeys.has(key))) return false;

    return (
      fields.unhandled === true &&
      fields.message === "HTTPError" &&
      (fields.status === undefined || fields.status === responseStatus)
    );
  } catch {
    return false;
  }
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

// ── Fetch handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/stock-chat") {
        return await handleStockChat(request, env);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};