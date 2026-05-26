export interface OfficialIndexItem {
  code: string;
  company_name?: string | null;
  status?: string | null;
  json: string;
  excel?: string | null;
  partial?: boolean;
}

export interface OfficialIndex {
  generated_at?: string;
  count?: number;
  items?: OfficialIndexItem[];
}

export async function fetchOfficialIndex(): Promise<OfficialIndexItem[]> {
  const res = await fetch("/data/idx-official/index.json", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as OfficialIndex;
  return Array.isArray(json.items) ? json.items : [];
}

export function hasOfficialData(items: OfficialIndexItem[] | undefined, symbol: string): boolean {
  return Boolean(items?.some((item) => item.code?.toUpperCase() === symbol.toUpperCase()));
}
