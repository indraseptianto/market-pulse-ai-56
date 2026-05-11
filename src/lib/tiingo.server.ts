// Server-only Tiingo API wrapper.
const BASE = "https://api.tiingo.com";

export interface TiingoOptions {
  query?: Record<string, string | number | undefined>;
  timeoutMs?: number;
  retries?: number;
}

export async function tiingoFetch<T = unknown>(
  path: string,
  opts: TiingoOptions = {},
): Promise<{ data: T | null; error: string | null }> {
  const apiKey = process.env.TIINGO_API_KEY;
  if (!apiKey) return { data: null, error: "TIINGO_API_KEY not configured" };

  const url = new URL(BASE + path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const max = opts.retries ?? 1;
  let lastErr = "Unknown";
  for (let i = 0; i <= max; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        if (res.status >= 500 && i < max) continue;
        return { data: null, error: lastErr };
      }
      const json = (await res.json()) as T;
      return { data: json, error: null };
    } catch (e) {
      clearTimeout(timer);
      lastErr = e instanceof Error ? e.message : "Request failed";
    }
  }
  return { data: null, error: lastErr };
}
