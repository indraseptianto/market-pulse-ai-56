import type {
  Shareholder,
  ShareholderType,
  FreeFloatRecord,
  Management,
  DividendRecord,
  QuarterlyFinancial,
  OwnershipAnalytics,
  OwnershipRecord,
} from "./ownershipTypes";

// ── Name normalization ────────────────────────────────────────────────────────
const ENTITY_ALIASES: Record<string, string> = {
  "pt barito pacific tbk": "PT Barito Pacific Tbk",
  "pt barito pacific": "PT Barito Pacific Tbk",
  "barito pacific": "PT Barito Pacific Tbk",
  "pt danantara asset management": "PT Danantara Asset Management (Persero)",
  "pt danantara aset management": "PT Danantara Asset Management (Persero)",
  "danantara": "PT Danantara Asset Management (Persero)",
  "government of the republic of indonesia": "Government of Indonesia",
  "goverment of the republic of indonesia": "Government of Indonesia",
  "republic of indonesia": "Government of Indonesia",
  "public (each below 5%)": "Public Float",
  "public": "Public Float",
};

export function normalizeName(name: string): string {
  const lower = name.toLowerCase().trim();
  return ENTITY_ALIASES[lower] ?? name.trim();
}

// ── Shareholder type detection ────────────────────────────────────────────────
const GOVERNMENT_KEYWORDS = ["danantara", "persero", "government", "goverment", "republic of indonesia", "indonesia investment authority", "dwiwarna"];
const FOREIGN_KEYWORDS = ["pte ltd", "pte. ltd", "co., ltd", "co. ltd", "llc", "inc.", "corp.", "limited", "bv", "b.v.", "ag", "plc"];
const TREASURY_KEYWORDS = ["treasury stock", "treasury share", "saham treasuri"];
const PUBLIC_KEYWORDS = ["public (each below 5%)", "public float", "public"];
const INSTITUTIONAL_KEYWORDS = ["pt ", "tbk", "fund", "investment", "capital", "asset", "securities", "bank", "insurance", "pension", "dana", "reksa"];

function detectShareholderType(name: string): ShareholderType {
  const lower = name.toLowerCase();
  if (TREASURY_KEYWORDS.some((k) => lower.includes(k))) return "treasury";
  if (PUBLIC_KEYWORDS.some((k) => lower === k || lower.startsWith(k))) return "public";
  if (GOVERNMENT_KEYWORDS.some((k) => lower.includes(k))) return "government";
  if (FOREIGN_KEYWORDS.some((k) => lower.includes(k))) return "foreign";
  if (INSTITUTIONAL_KEYWORDS.some((k) => lower.includes(k))) return "institutional";
  return "insider"; // individual person
}

function isInsiderName(name: string, managements: Management[]): boolean {
  const lower = name.toLowerCase();
  return managements.some((m) => m.name.toLowerCase() === lower);
}

// ── Parse shares string: "67.729.950.000 (Shares)" → 67729950000 ─────────────
function parseShares(raw: string): number {
  return parseInt(raw.replace(/\./g, "").replace(/,/g, "").replace(/[^0-9]/g, ""), 10) || 0;
}

// ── Parse percentage: "54,94%" or "54.94%" → 54.94 ───────────────────────────
function parsePct(raw: string): number {
  return parseFloat(raw.replace(",", ".").replace("%", "").trim()) || 0;
}

// ── Parse number with unit: "21.108.433 M" → { value, currency, unit } ───────
function parseFinancialValue(raw: string): { value: number | null; currency: string; unit: string } {
  const cleaned = raw.trim();
  if (!cleaned || cleaned === "—" || cleaned === "-") return { value: null, currency: "IDR", unit: "" };

  let currency = "IDR";
  let unit = "";
  let numStr = cleaned;

  if (cleaned.includes("USD")) { currency = "USD"; numStr = cleaned.replace("USD", "").trim(); }
  if (cleaned.endsWith(" M")) { unit = "M"; numStr = cleaned.slice(0, -2).trim(); }
  if (cleaned.endsWith(" Jt")) { unit = "Jt"; numStr = cleaned.slice(0, -3).trim(); }
  if (cleaned.endsWith(" Juta")) { unit = "Jt"; numStr = cleaned.slice(0, -5).trim(); }

  // Remove thousand separators (dots in Indonesian format)
  const value = parseFloat(numStr.replace(/\./g, "").replace(",", ".")) || null;
  return { value, currency, unit };
}

// ── Parse free float text block ───────────────────────────────────────────────
export function parseFreeFloat(raw: string): FreeFloatRecord[] {
  const records: FreeFloatRecord[] = [];
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Pattern: "42.59 %\t714.851 (+33.548)\t31 Mar 2026"
    const match = line.match(/^([\d.]+)\s*%\s+([0-9.]+)\s*([+-][0-9.]+)?\s+(.+)$/);
    if (match) {
      const pct = parseFloat(match[1]);
      const shareholders = parseInt(match[2].replace(/\./g, ""), 10);
      const change = match[3] ? parseInt(match[3].replace(/\./g, ""), 10) : null;
      const period = match[4].trim();
      if (!isNaN(pct)) {
        records.push({ percentage: pct, numberOfShareholders: shareholders, shareholderChange: change, period });
      }
    }
  }
  return records;
}

// ── Parse shareholder table text ──────────────────────────────────────────────
export function parseShareholders(raw: string, managements: Management[]): Shareholder[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const holders: Shareholder[] = [];

  for (const line of lines) {
    // Pattern: "PT Dwimuria Investama Andalan\t67.729.950.000 (Shares)\t846.624.375.000 (IDR)\t54,94%"
    const parts = line.split("\t");
    if (parts.length < 3) continue;

    const name = parts[0].trim();
    if (name === "Shareholder Name" || name === "Treasury Stock" && parts.length < 3) continue;

    const sharesRaw = parts[1] ?? "";
    const pctRaw = parts[parts.length - 1] ?? "";

    if (!pctRaw.includes("%")) continue;

    const shares = parseShares(sharesRaw);
    const percentage = parsePct(pctRaw);
    const paidUpRaw = parts.length >= 4 ? parts[2] : "";
    const paidUpCapital = paidUpRaw ? parseShares(paidUpRaw) : null;

    const type = detectShareholderType(name);
    const normalizedName = normalizeName(name);

    holders.push({
      name,
      normalizedName,
      shares,
      paidUpCapital,
      percentage,
      type,
      isInsider: type === "insider" || isInsiderName(name, managements),
      isGovernment: type === "government",
      isTreasury: type === "treasury",
      isPublic: type === "public",
    });
  }

  return holders.sort((a, b) => b.percentage - a.percentage);
}

// ── Parse management text ─────────────────────────────────────────────────────
export function parseManagements(raw: string): Management[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const mgmt: Management[] = [];

  for (let i = 0; i < lines.length - 1; i += 2) {
    const name = lines[i];
    const role = lines[i + 1] ?? "";
    if (!name || !role) continue;

    mgmt.push({
      name,
      role,
      isCommissioner: role.toLowerCase().includes("commissioner"),
      isDirector: role.toLowerCase().includes("director"),
      isAuditCommittee: role.toLowerCase().includes("audit"),
      isIndependent: role.toLowerCase().includes("independent"),
    });
  }
  return mgmt;
}

// ── Parse dividend text ───────────────────────────────────────────────────────
export function parseDividends(raw: string): DividendRecord[] {
  if (!raw || raw.includes("No data found")) return [];
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const divs: DividendRecord[] = [];

  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    const [year, dpsRaw, payDate, type] = parts;
    if (year === "Fiscal Year") continue;

    const dpsMatch = dpsRaw.match(/([\d.,]+)\s*\((\w+)\)/);
    if (!dpsMatch) continue;

    divs.push({
      fiscalYear: year.trim(),
      dividendPerShare: parseFloat(dpsMatch[1].replace(",", ".")),
      currency: dpsMatch[2],
      paymentDate: payDate.trim(),
      type: (type?.trim() as DividendRecord["type"]) ?? "Final",
    });
  }
  return divs;
}

// ── Parse financial data text ─────────────────────────────────────────────────
export function parseFinancials(raw: string): QuarterlyFinancial[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const financials: QuarterlyFinancial[] = [];

  for (const line of lines) {
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const period = parts[0].trim();
    if (!period.match(/Q[1-4]/i)) continue;

    const col1 = parseFinancialValue(parts[1] ?? "");
    const col2 = parseFinancialValue(parts[2] ?? "");

    // Detect if it's a bank (Net Interest Income) or regular company (Revenue)
    const isBank = raw.includes("Net Interest Income");

    financials.push({
      period,
      revenue: isBank ? null : col1.value,
      netInterestIncome: isBank ? col1.value : null,
      netProfit: col2.value,
      currency: col1.currency,
      unit: col1.unit,
    });
  }
  return financials;
}

// ── Compute analytics ─────────────────────────────────────────────────────────
export function computeAnalytics(
  shareholders: Shareholder[],
  freeFloat: number | null,
): OwnershipAnalytics {
  const active = shareholders.filter((s) => !s.isTreasury);
  const total = active.reduce((s, h) => s + h.percentage, 0);

  // Concentration
  const sorted = [...active].sort((a, b) => b.percentage - a.percentage);
  const top1 = sorted[0]?.percentage ?? 0;
  const top3 = sorted.slice(0, 3).reduce((s, h) => s + h.percentage, 0);
  const top5 = sorted.slice(0, 5).reduce((s, h) => s + h.percentage, 0);

  // Herfindahl-Hirschman Index (0–10000)
  const hhi = active.reduce((s, h) => s + Math.pow(h.percentage, 2), 0);

  // Breakdown by type
  const govPct = active.filter((h) => h.isGovernment).reduce((s, h) => s + h.percentage, 0);
  const instPct = active.filter((h) => h.type === "institutional" && !h.isGovernment).reduce((s, h) => s + h.percentage, 0);
  const insiderPct = active.filter((h) => h.isInsider && !h.isGovernment).reduce((s, h) => s + h.percentage, 0);
  const publicPct = active.filter((h) => h.isPublic).reduce((s, h) => s + h.percentage, 0);
  const foreignPct = active.filter((h) => h.type === "foreign").reduce((s, h) => s + h.percentage, 0);
  const treasuryPct = shareholders.filter((h) => h.isTreasury).reduce((s, h) => s + h.percentage, 0);

  // Counts
  const insiderCount = active.filter((h) => h.isInsider).length;
  const instCount = active.filter((h) => h.type === "institutional" || h.isGovernment).length;

  // Concentration risk
  let concentrationRisk: OwnershipAnalytics["concentrationRisk"] = "LOW";
  if (top1 >= 75) concentrationRisk = "VERY_HIGH";
  else if (top1 >= 50) concentrationRisk = "HIGH";
  else if (top1 >= 33) concentrationRisk = "MEDIUM";

  // Ownership type
  let ownershipType: OwnershipAnalytics["ownershipType"] = "MIXED";
  if (govPct >= 50) ownershipType = "GOVERNMENT";
  else if (insiderPct >= 40 || (insiderPct + instPct >= 60 && instCount <= 3)) ownershipType = "FAMILY";
  else if (instPct >= 50) ownershipType = "INSTITUTIONAL";
  else if (publicPct >= 50) ownershipType = "DISPERSED";

  // Transparency score (0–100)
  // Higher = more transparent
  let score = 50;
  // More dispersed = more transparent
  score += Math.min(20, publicPct * 0.4);
  // Lower concentration = more transparent
  score -= Math.min(20, (top3 - 50) * 0.4);
  // More shareholders = more transparent
  score += Math.min(10, Math.log10(Math.max(1, active.length)) * 5);
  // Government controlled = slightly less transparent (bureaucracy)
  if (govPct >= 50) score -= 5;
  // Very high HHI = less transparent
  score -= Math.min(15, hhi / 500);
  // Free float bonus
  if (freeFloat != null) score += Math.min(15, freeFloat * 0.3);
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Smart money score (0–100) — higher institutional + lower insider = smarter
  const smartMoney = Math.min(100, Math.round(
    (instPct * 0.5) + (publicPct * 0.3) + (foreignPct * 0.2) - (insiderPct * 0.1)
  ));

  // Institutional dominance
  const instDom: OwnershipAnalytics["institutionalDominance"] =
    instPct + govPct >= 60 ? "HIGH" : instPct + govPct >= 30 ? "MEDIUM" : "LOW";

  return {
    top1Concentration: top1,
    top3Concentration: top3,
    top5Concentration: top5,
    herfindahlIndex: Math.round(hhi),
    governmentPct: govPct,
    institutionalPct: instPct,
    insiderPct,
    publicPct,
    foreignPct,
    treasuryPct,
    totalShareholders: active.length,
    insiderCount,
    institutionalCount: instCount,
    transparencyScore: score,
    concentrationRisk,
    ownershipType,
    isGovernmentControlled: govPct >= 50,
    isFamilyControlled: ownershipType === "FAMILY",
    hasHighInsiderOwnership: insiderPct >= 20,
    hasForeignMajority: foreignPct >= 50,
    isRetailFriendly: publicPct >= 40 && top1 < 60,
    smartMoneyScore: Math.max(0, smartMoney),
    institutionalDominance: instDom,
  };
}

// ── Extract symbol from IDNFinancials URL ─────────────────────────────────────
export function extractSymbol(url: string): string {
  const match = url.match(/idnfinancials\.com\/([a-z]+)\//i);
  return match ? match[1].toUpperCase() : "";
}

// ── Master parser: raw record → OwnershipRecord ───────────────────────────────
export function parseOwnershipRecord(raw: {
  ld_href: string;
  free_float: string;
  shareholder: string;
  managements: string;
  devidend: string;
  financial_data: string;
}): OwnershipRecord {
  const symbol = extractSymbol(raw.ld_href);

  // Extract company name from URL
  const urlParts = raw.ld_href.split("/");
  const companySlug = urlParts[urlParts.length - 1] ?? "";
  const companyName = companySlug
    .replace(/^pt-/, "PT ")
    .replace(/-tbk$/, " Tbk")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const managements = parseManagements(raw.managements);
  const shareholders = parseShareholders(raw.shareholder, managements);
  const freeFloatHistory = parseFreeFloat(raw.free_float);
  const currentFreeFloat = freeFloatHistory[0]?.percentage ?? null;
  const currentShareholders = freeFloatHistory[0]?.numberOfShareholders ?? null;
  const dividends = parseDividends(raw.devidend);
  const financials = parseFinancials(raw.financial_data);
  const analytics = computeAnalytics(shareholders, currentFreeFloat);

  return {
    symbol,
    companyName,
    idnFinancialsUrl: raw.ld_href,
    shareholders,
    freeFloatHistory,
    currentFreeFloat,
    currentShareholders,
    managements,
    dividends,
    financials,
    analytics,
  };
}
