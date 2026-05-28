// Server-only DataSectors API helpers.
// NOTE: Caching is handled by React Query's staleTime/gcTime — NOT in this file.
// The in-memory ResponseCache was removed because it resets on every serverless cold start,
// making it useless on Vercel/Vercel Edge. React Query's client-side cache is the correct
// place for caching since it lives in the browser and survives across API calls.
// If you need server-side caching, use Vercel KV, Upstash Redis, or a dedicated cache service.

const BASE_URL = "https://api.datasectors.com/api";

export function allowMockFallback(): boolean {
  if (process.env.ENABLE_MOCK_DATA === "true") return true;
  return process.env.NODE_ENV !== "production" && process.env.VERCEL_ENV !== "production";
}

export interface FetchOptions {
  method?: "GET" | "POST";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  retries?: number;
  timeoutMs?: number;
}

export async function dsFetch<T = unknown>(
  path: string,
  opts: FetchOptions = {},
): Promise<{ data: T | null; error: string | null }> {
  const apiKey = process.env.DATASECTORS_API_KEY;
  if (!apiKey) return { data: null, error: "DATASECTORS_API_KEY not configured" };

  const url = new URL(BASE_URL + path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const maxRetries = opts.retries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 10_000;

  let lastError = "Unknown error";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const timerPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Request timeout")), timeoutMs);
    });

    try {
      const racePromise = fetch(url.toString(), {
        method: opts.method ?? "GET",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });

      const res = await Promise.race([racePromise, timerPromise]);
      clearTimeout(timer!);

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        if (res.status >= 500 && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
          continue;
        }
        return { data: null, error: lastError };
      }
      const json = (await res.json()) as T;
      return { data: json, error: null };
    } catch (err) {
      clearTimeout(timer!);
      lastError = err instanceof Error ? err.message : "Request failed";
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
        continue;
      }
    }
  }
  return { data: null, error: lastError };
}

// Try to extract a list from common API response shapes.
export function unwrapList<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Record<string, unknown>;
  for (const key of ["data", "results", "items", "equities", "stocks"]) {
    const v = obj[key];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
}

// Backwards compatibility — maps to dsFetch. React Query handles caching.
export async function dsFetchCached<T = unknown>(
  path: string,
  opts: FetchOptions & { cacheTtlMs?: number; cacheKey?: string } = {},
): Promise<{ data: T | null; error: string | null; fromCache?: boolean }> {
  const result = await dsFetch<T>(path, opts);
  return { ...result, fromCache: false };
}