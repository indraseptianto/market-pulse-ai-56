export interface OfficialIndexItem {
  code: string;
  company_name?: string | null;
  status?: string | null;
  json: string;
  excel?: string | null;
  partial?: boolean;
  scraped_at?: string | null;
  error?: string | null;
  has_llm_fallback?: boolean;
}

export interface OfficialIndexSummary {
  universe_total?: number | null;
  processed_total?: number | null;
  remaining_total?: number | null;
  published_total?: number | null;
  status_counts?: Record<string, number>;
  sheet_status_counts?: Record<string, number>;
}

export interface OfficialIndex {
  generated_at?: string;
  count?: number;
  summary?: OfficialIndexSummary;
  items?: OfficialIndexItem[];
}

export async function fetchOfficialIndexData(): Promise<OfficialIndex> {
  const res = await fetch("/data/idx-official/index.json", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return { items: [] };
  const json = (await res.json()) as OfficialIndex;
  return { ...json, items: Array.isArray(json.items) ? json.items : [] };
}

export async function fetchOfficialIndex(): Promise<OfficialIndexItem[]> {
  const json = await fetchOfficialIndexData();
  return json.items ?? [];
}

export function hasOfficialData(items: OfficialIndexItem[] | undefined, symbol: string): boolean {
  return Boolean(items?.some((item) => item.code?.toUpperCase() === symbol.toUpperCase()));
}
