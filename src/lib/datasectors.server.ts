// Server-only DataSectors API helpers.
const BASE_URL = "https://api.datasectors.com/api";

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
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url.toString(), {
        method: opts.method ?? "GET",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
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
      clearTimeout(timer);
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
