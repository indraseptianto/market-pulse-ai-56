import { OWNERSHIP_DATABASE, OWNERSHIP_MAP } from "./ownershipData";
import type { OwnershipRecord, OwnershipFilter } from "./ownershipTypes";

// ── Cache ─────────────────────────────────────────────────────────────────────
const _cache = new Map<string, OwnershipRecord>();

// ── Lookup ────────────────────────────────────────────────────────────────────
export function getOwnershipBySymbol(symbol: string): OwnershipRecord | null {
  const key = symbol.toUpperCase();
  if (_cache.has(key)) return _cache.get(key)!;
  const record = OWNERSHIP_MAP.get(key) ?? null;
  if (record) _cache.set(key, record);
  return record;
}

export function hasOwnershipData(symbol: string): boolean {
  return OWNERSHIP_MAP.has(symbol.toUpperCase());
}

export function getAllSymbols(): string[] {
  return OWNERSHIP_DATABASE.map((r) => r.symbol);
}

// ── Filter ────────────────────────────────────────────────────────────────────
export function filterOwnership(filter: OwnershipFilter): OwnershipRecord[] {
  return OWNERSHIP_DATABASE.filter((r) => {
    const a = r.analytics;
    if (filter.minFreeFloat != null && (r.currentFreeFloat ?? 0) < filter.minFreeFloat) return false;
    if (filter.maxFreeFloat != null && (r.currentFreeFloat ?? 100) > filter.maxFreeFloat) return false;
    if (filter.minTransparencyScore != null && a.transparencyScore < filter.minTransparencyScore) return false;
    if (filter.maxConcentration != null && a.top1Concentration > filter.maxConcentration) return false;
    if (filter.ownershipType != null && a.ownershipType !== filter.ownershipType) return false;
    if (filter.concentrationRisk != null && a.concentrationRisk !== filter.concentrationRisk) return false;
    if (filter.isGovernmentControlled != null && a.isGovernmentControlled !== filter.isGovernmentControlled) return false;
    if (filter.isFamilyControlled != null && a.isFamilyControlled !== filter.isFamilyControlled) return false;
    if (filter.isRetailFriendly != null && a.isRetailFriendly !== filter.isRetailFriendly) return false;
    if (filter.hasHighInsiderOwnership != null && a.hasHighInsiderOwnership !== filter.hasHighInsiderOwnership) return false;
    return true;
  });
}

// ── Preset filters ────────────────────────────────────────────────────────────
export const OWNERSHIP_PRESETS = {
  highFreeFloat: (): OwnershipRecord[] => filterOwnership({ minFreeFloat: 40 }),
  lowFreeFloat: (): OwnershipRecord[] => filterOwnership({ maxFreeFloat: 15 }),
  governmentControlled: (): OwnershipRecord[] => filterOwnership({ isGovernmentControlled: true }),
  familyControlled: (): OwnershipRecord[] => filterOwnership({ isFamilyControlled: true }),
  retailFriendly: (): OwnershipRecord[] => filterOwnership({ isRetailFriendly: true }),
  highTransparency: (): OwnershipRecord[] => filterOwnership({ minTransparencyScore: 65 }),
  highConcentrationRisk: (): OwnershipRecord[] =>
    OWNERSHIP_DATABASE.filter((r) =>
      r.analytics.concentrationRisk === "HIGH" || r.analytics.concentrationRisk === "VERY_HIGH"
    ),
  smartMoney: (): OwnershipRecord[] =>
    OWNERSHIP_DATABASE.filter((r) => r.analytics.smartMoneyScore >= 50).sort(
      (a, b) => b.analytics.smartMoneyScore - a.analytics.smartMoneyScore
    ),
  highInsider: (): OwnershipRecord[] => filterOwnership({ hasHighInsiderOwnership: true }),
};

// ── Aggregate stats ───────────────────────────────────────────────────────────
export interface OwnershipStats {
  totalStocks: number;
  avgFreeFloat: number;
  avgTransparencyScore: number;
  avgSmartMoneyScore: number;
  governmentCount: number;
  familyCount: number;
  institutionalCount: number;
  dispersedCount: number;
  highConcentrationCount: number;
  retailFriendlyCount: number;
}

export function getOwnershipStats(): OwnershipStats {
  const db = OWNERSHIP_DATABASE;
  const n = db.length;
  if (n === 0) return {
    totalStocks: 0, avgFreeFloat: 0, avgTransparencyScore: 0, avgSmartMoneyScore: 0,
    governmentCount: 0, familyCount: 0, institutionalCount: 0, dispersedCount: 0,
    highConcentrationCount: 0, retailFriendlyCount: 0,
  };

  const sum = (fn: (r: OwnershipRecord) => number) => db.reduce((s, r) => s + fn(r), 0);
  const count = (fn: (r: OwnershipRecord) => boolean) => db.filter(fn).length;

  return {
    totalStocks: n,
    avgFreeFloat: Math.round(sum((r) => r.currentFreeFloat ?? 0) / n * 10) / 10,
    avgTransparencyScore: Math.round(sum((r) => r.analytics.transparencyScore) / n),
    avgSmartMoneyScore: Math.round(sum((r) => r.analytics.smartMoneyScore) / n),
    governmentCount: count((r) => r.analytics.isGovernmentControlled),
    familyCount: count((r) => r.analytics.isFamilyControlled),
    institutionalCount: count((r) => r.analytics.ownershipType === "INSTITUTIONAL"),
    dispersedCount: count((r) => r.analytics.ownershipType === "DISPERSED"),
    highConcentrationCount: count(
      (r) => r.analytics.concentrationRisk === "HIGH" || r.analytics.concentrationRisk === "VERY_HIGH"
    ),
    retailFriendlyCount: count((r) => r.analytics.isRetailFriendly),
  };
}

// ── Smart money signals ───────────────────────────────────────────────────────
export interface SmartMoneySignal {
  symbol: string;
  companyName: string;
  signal: "BULLISH" | "BEARISH" | "NEUTRAL" | "CAUTION";
  reason: string;
  score: number;
  freeFloat: number | null;
}

export function getSmartMoneySignals(): SmartMoneySignal[] {
  return OWNERSHIP_DATABASE.map((r) => {
    const a = r.analytics;
    let signal: SmartMoneySignal["signal"] = "NEUTRAL";
    let reason = "Balanced ownership structure";

    if (a.concentrationRisk === "VERY_HIGH" && (r.currentFreeFloat ?? 100) < 15) {
      signal = "CAUTION";
      reason = "Extremely low free float with very high concentration — liquidity risk";
    } else if (a.isGovernmentControlled && a.institutionalDominance === "HIGH") {
      signal = "BULLISH";
      reason = "Government-backed with strong institutional support";
    } else if (a.smartMoneyScore >= 60 && (r.currentFreeFloat ?? 0) >= 35) {
      signal = "BULLISH";
      reason = "High smart money score with healthy free float";
    } else if (a.concentrationRisk === "HIGH" && a.isFamilyControlled) {
      signal = "CAUTION";
      reason = "Family-controlled with high concentration — governance risk";
    } else if (a.isRetailFriendly && a.transparencyScore >= 60) {
      signal = "BULLISH";
      reason = "Retail-friendly with good transparency";
    } else if (a.hasHighInsiderOwnership && a.concentrationRisk !== "LOW") {
      signal = "BEARISH";
      reason = "High insider ownership with concentration risk";
    }

    return {
      symbol: r.symbol,
      companyName: r.companyName,
      signal,
      reason,
      score: a.smartMoneyScore,
      freeFloat: r.currentFreeFloat,
    };
  }).sort((a, b) => b.score - a.score);
}
