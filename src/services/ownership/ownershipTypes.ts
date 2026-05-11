// ── Ownership Intelligence Types ─────────────────────────────────────────────

export interface Shareholder {
  name: string;
  shares: number;
  paidUpCapital: number | null;
  percentage: number;
  type: ShareholderType;
  isInsider: boolean;
  isGovernment: boolean;
  isTreasury: boolean;
  isPublic: boolean;
  normalizedName: string;
}

export type ShareholderType =
  | "government"
  | "institutional"
  | "insider"
  | "treasury"
  | "public"
  | "foreign"
  | "other";

export interface FreeFloatRecord {
  percentage: number;
  numberOfShareholders: number;
  shareholderChange: number | null;
  period: string;
}

export interface Management {
  name: string;
  role: string;
  isCommissioner: boolean;
  isDirector: boolean;
  isAuditCommittee: boolean;
  isIndependent: boolean;
}

export interface DividendRecord {
  fiscalYear: string;
  dividendPerShare: number;
  currency: string;
  paymentDate: string;
  type: "Final" | "Interim" | "Special";
}

export interface QuarterlyFinancial {
  period: string;       // e.g. "Q1/2026" or "Q1 - 2026"
  revenue: number | null;
  netProfit: number | null;
  netInterestIncome: number | null;
  currency: string;
  unit: string;         // "M" (million IDR), "Jt" (juta IDR), "USD"
}

export interface OwnershipRecord {
  symbol: string;
  companyName: string;
  idnFinancialsUrl: string;
  shareholders: Shareholder[];
  freeFloatHistory: FreeFloatRecord[];
  currentFreeFloat: number | null;
  currentShareholders: number | null;
  managements: Management[];
  dividends: DividendRecord[];
  financials: QuarterlyFinancial[];
  // Computed analytics
  analytics: OwnershipAnalytics;
}

export interface OwnershipAnalytics {
  // Concentration
  top1Concentration: number;       // % held by largest holder
  top3Concentration: number;       // % held by top 3
  top5Concentration: number;       // % held by top 5
  herfindahlIndex: number;         // HHI — 0 to 10000
  // Breakdown
  governmentPct: number;
  institutionalPct: number;
  insiderPct: number;
  publicPct: number;
  foreignPct: number;
  treasuryPct: number;
  // Counts
  totalShareholders: number;
  insiderCount: number;
  institutionalCount: number;
  // Scores
  transparencyScore: number;       // 0–100
  concentrationRisk: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  ownershipType: "GOVERNMENT" | "FAMILY" | "INSTITUTIONAL" | "DISPERSED" | "MIXED";
  // Flags
  isGovernmentControlled: boolean;
  isFamilyControlled: boolean;
  hasHighInsiderOwnership: boolean;
  hasForeignMajority: boolean;
  isRetailFriendly: boolean;
  // Smart money
  smartMoneyScore: number;         // 0–100
  institutionalDominance: "LOW" | "MEDIUM" | "HIGH";
}

// ── Screener filter types ─────────────────────────────────────────────────────
export interface OwnershipFilter {
  minFreeFloat?: number;
  maxFreeFloat?: number;
  minTransparencyScore?: number;
  maxConcentration?: number;
  ownershipType?: OwnershipRecord["analytics"]["ownershipType"];
  concentrationRisk?: OwnershipRecord["analytics"]["concentrationRisk"];
  isGovernmentControlled?: boolean;
  isFamilyControlled?: boolean;
  isRetailFriendly?: boolean;
  hasHighInsiderOwnership?: boolean;
}
