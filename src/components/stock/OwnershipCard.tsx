import { useState, useMemo } from "react";
import { GlassCard } from "@/components/common/GlassCard";
import { fmtCompact, fmtNum, fmtPrice } from "@/lib/formatters";
import {
  Users,
  Building2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileText,
  BarChart2,
  Link2,
  ScrollText,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { InvestorTrade } from "@/lib/datasectors.functions";

// ── Ownership structure extracted from equities v2 payload ───────────────────
interface OwnershipData {
  institutionalOwnership: number | null;
  mutualFundOwnership: number | null;
  insiderOwnership: number | null;
  publicFloat: number | null;
  sharesOutstanding: number | null;
  topHolders: { name: string; shares: number | null; pct: number | null; type: string }[];
}

function safeNum(v: unknown): number | null {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && v !== "") { const n = Number(v); if (isFinite(n)) return n; }
  return null;
}

// Deep-search any nested object for a key, returning first match
function deepFind(obj: unknown, ...keys: string[]): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    if (k in o && o[k] !== null && o[k] !== undefined) return o[k];
  }
  // One level deeper
  for (const v of Object.values(o)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const found = deepFind(v, ...keys);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

// Find first array in nested object matching key names
function deepFindArray(obj: unknown, ...keys: string[]): Record<string, unknown>[] {
  if (!obj || typeof obj !== "object") return [];
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    if (Array.isArray(o[k])) return o[k] as Record<string, unknown>[];
  }
  for (const v of Object.values(o)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const found = deepFindArray(v, ...keys);
      if (found.length > 0) return found;
    }
  }
  return [];
}

export function extractOwnership(payload: Record<string, unknown> | null): OwnershipData {
  if (!payload) return { institutionalOwnership: null, mutualFundOwnership: null, insiderOwnership: null, publicFloat: null, sharesOutstanding: null, topHolders: [] };

  // DataSectors v2/equities returns: { success, symbol, secId, data: { ... } }
  // The actual data is nested under payload.data
  const root = (payload.data ?? payload) as Record<string, unknown>;

  const institutional = safeNum(deepFind(root,
    "institutionalOwnership", "institutional_ownership", "institutionalOwnershipPct",
    "institutionalHoldingsPct", "institutional"
  ));
  const mutualFund = safeNum(deepFind(root,
    "mutualFundOwnership", "mutual_fund_ownership", "mutualFundHoldingsPct",
    "mutualFund", "fundOwnership"
  ));
  const insider = safeNum(deepFind(root,
    "insiderOwnership", "insider_ownership", "insiderHoldingsPct",
    "insiderPct", "insider"
  ));
  const publicFloat = safeNum(deepFind(root,
    "publicFloat", "public_float", "freeFloat", "free_float",
    "floatShares", "publicOwnership"
  ));
  const sharesOut = safeNum(deepFind(root,
    "sharesOutstanding", "shares_outstanding", "totalShares",
    "outstandingShares", "shareCount"
  ));

  // Top holders — try multiple possible array key names
  const holdersRaw = deepFindArray(root,
    "topHolders", "top_holders", "institutionalHolders",
    "topInstitutionalHolders", "holders", "shareholders",
    "majorShareholders", "topShareholders"
  );

  const topHolders = holdersRaw.slice(0, 10).map((h) => ({
    name: String(h.name ?? h.holderName ?? h.investor ?? h.shareholder ?? h.entity ?? ""),
    shares: safeNum(h.shares ?? h.sharesHeld ?? h.position ?? h.sharesOwned ?? h.quantity),
    pct: safeNum(h.pct ?? h.percentage ?? h.ownershipPct ?? h.pctHeld ?? h.percentOwned ?? h.ownership),
    type: String(h.type ?? h.holderType ?? h.investorType ?? "institution"),
  }));

  return { institutionalOwnership: institutional, mutualFundOwnership: mutualFund, insiderOwnership: insider, publicFloat, sharesOutstanding: sharesOut, topHolders };
}

// ── Pie chart colors ──────────────────────────────────────────────────────────
const PIE_COLORS = ["#38bdf8", "#10b981", "#f59e0b", "#a78bfa", "#f472b6", "#2dd4bf"];

function OwnershipPie({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number) => [`${v.toFixed(1)}%`, ""]}
          contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", fontSize: "11px" }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span style={{ fontSize: "11px", color: "#94a3b8" }}>{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Trade card (filings) ──────────────────────────────────────────────────────
function TradeCard({ trade }: { trade: InvestorTrade }) {
  const isBuy = trade.tradeType === "buy";
  return (
    <div className="rounded-xl border border-border/50 bg-background/50 p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${isBuy ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
            {isBuy ? "↑ Buy" : "↓ Sell"}
          </span>
          {trade.date && (
            <span className="text-[10px] text-muted-foreground">{trade.date.slice(0, 10)}</span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground capitalize">{trade.investorType}</span>
      </div>

      {/* Title */}
      <div className="text-xs font-semibold leading-snug">
        {trade.investorName || "—"}{" "}
        <span className="font-normal text-muted-foreground">
          {isBuy ? "buys" : "sells"} shares of
        </span>{" "}
        {trade.companyName || trade.ticker}
      </div>

      {/* Investor badge */}
      <div className="flex items-center gap-1.5">
        {trade.investorType === "institution" ? (
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-[11px] text-muted-foreground">
          {trade.investorName} · {trade.sector || "—"}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-1.5">
        <StatMini label="Jumlah Saham" value={trade.sharesTraded != null ? fmtCompact(trade.sharesTraded) : "—"} />
        <StatMini label="Nilai Transaksi" value={trade.transactionValue != null ? `Rp ${fmtCompact(trade.transactionValue)}` : "—"} />
        <StatMini label="Harga" value={trade.price != null ? fmtPrice(trade.price) : "—"} />
        <StatMini
          label="Perubahan Kepemilikan"
          value={trade.ownershipChangePct != null ? `${trade.ownershipChangePct >= 0 ? "+" : ""}${trade.ownershipChangePct.toFixed(2)}%` : "—"}
          tone={trade.ownershipChangePct != null ? (trade.ownershipChangePct >= 0 ? "gain" : "loss") : undefined}
        />
      </div>

      {/* Ownership before → after */}
      {(trade.sharesBefore != null || trade.sharesAfter != null) && (
        <div className="rounded-lg bg-accent/20 px-3 py-2">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Kepemilikan Saham</div>
          <div className="flex items-center gap-2 text-xs">
            <div>
              <div className="text-muted-foreground text-[10px]">Sebelum</div>
              <div className="font-semibold num">{trade.sharesBefore != null ? fmtCompact(trade.sharesBefore) : "—"}</div>
              {trade.ownershipBefore != null && (
                <div className="text-[10px] text-muted-foreground">({trade.ownershipBefore.toFixed(2)}%)</div>
              )}
            </div>
            <ArrowRight className={`h-3.5 w-3.5 shrink-0 ${isBuy ? "text-success" : "text-destructive"}`} />
            <div>
              <div className="text-muted-foreground text-[10px]">Sesudah</div>
              <div className="font-semibold num">{trade.sharesAfter != null ? fmtCompact(trade.sharesAfter) : "—"}</div>
              {trade.ownershipAfter != null && (
                <div className="text-[10px] text-muted-foreground">({trade.ownershipAfter.toFixed(2)}%)</div>
              )}
            </div>
          </div>
        </div>
      )}

      {trade.category && (
        <div className="text-[10px] text-muted-foreground capitalize">{trade.category}</div>
      )}
    </div>
  );
}

function StatMini({ label, value, tone }: { label: string; value: string; tone?: "gain" | "loss" }) {
  return (
    <div className="rounded-lg bg-background/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xs font-semibold num mt-0.5 ${tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : ""}`}>
        {value}
      </div>
    </div>
  );
}

// ── Helper sub-components ─────────────────────────────────────────────────────

function LoadingSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-lg bg-accent/30" />
      ))}
    </div>
  );
}

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-accent/10 px-4 py-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-background/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold num ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function FloatBar({
  institutional, mutualFund, insider, publicFloat,
}: {
  institutional: number | null;
  mutualFund: number | null;
  insider: number | null;
  publicFloat: number | null;
}) {
  const segments = [
    { label: "Institutional", value: institutional ?? 0, color: "#38bdf8" },
    { label: "Mutual Fund",   value: mutualFund ?? 0,   color: "#10b981" },
    { label: "Insider",       value: insider ?? 0,      color: "#f59e0b" },
    { label: "Public Float",  value: publicFloat ?? 0,  color: "#a78bfa" },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-2">
      <div className="flex h-5 w-full overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${s.value}%`, background: s.color }}
            title={`${s.label}: ${s.value.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[11px]">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-semibold num">{s.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompanyOwnershipDetails({ data }: { data: Record<string, unknown> }) {
  // Extract any additional ownership-related fields from the equities payload
  const fields: { label: string; value: string }[] = [];

  const tryAdd = (label: string, ...keys: string[]) => {
    for (const k of keys) {
      const v = data[k];
      if (v != null && v !== "") {
        fields.push({ label, value: String(v) });
        return;
      }
    }
  };

  tryAdd("Company Name",    "name", "companyName", "company_name");
  tryAdd("Exchange",        "exchange", "exchangeCode");
  tryAdd("Country",         "country", "countryCode");
  tryAdd("Employees",       "employees", "numberOfEmployees", "fullTimeEmployees");
  tryAdd("Website",         "website", "companyWebsite", "url");
  tryAdd("Description",     "description", "businessDescription", "companyDescription");
  tryAdd("Sector",          "sector", "sectorName");
  tryAdd("Industry",        "industry", "industryName");
  tryAdd("IPO Date",        "ipoDate", "ipo_date", "listingDate");
  tryAdd("Fiscal Year End", "fiscalYearEnd", "fiscal_year_end");

  if (fields.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Company Profile</div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.label} className="rounded-lg bg-background/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</div>
            <div className="mt-0.5 text-xs font-medium line-clamp-2">{f.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListingDisclosures({ data, symbol }: { data: Record<string, unknown> | null; symbol: string }) {
  if (!data) {
    return <InfoNote>Listing disclosure data not available for <strong>{symbol}</strong>.</InfoNote>;
  }

  const fields: { label: string; value: string; badge?: string }[] = [];

  const tryAdd = (label: string, badge?: string, ...keys: string[]) => {
    for (const k of keys) {
      const v = data[k];
      if (v != null && v !== "") {
        fields.push({ label, value: String(v), badge });
        return;
      }
    }
  };

  tryAdd("Listing Date",       undefined, "ipoDate", "ipo_date", "listingDate", "listing_date");
  tryAdd("Exchange",           undefined, "exchange", "exchangeCode", "listedExchange");
  tryAdd("Market",             undefined, "market", "marketCode", "boardType");
  tryAdd("ISIN",               undefined, "isin", "ISIN");
  tryAdd("CUSIP",              undefined, "cusip", "CUSIP");
  tryAdd("Ticker",             undefined, "ticker", "symbol");
  tryAdd("Shares Outstanding", undefined, "sharesOutstanding", "shares_outstanding", "totalShares");
  tryAdd("Market Cap",         undefined, "marketCap", "market_cap", "marketCapitalization");
  tryAdd("Par Value",          undefined, "parValue", "par_value", "nominalValue");
  tryAdd("Fiscal Year End",    undefined, "fiscalYearEnd", "fiscal_year_end");
  tryAdd("Auditor",            undefined, "auditor", "externalAuditor");
  tryAdd("Legal Counsel",      undefined, "legalCounsel", "legal_counsel");
  tryAdd("Registrar",          undefined, "registrar", "shareRegistrar");

  if (fields.length === 0) {
    return (
      <InfoNote>
        Listing disclosure data not available from DataSectors for <strong>{symbol}</strong>.
        This includes IPO date, exchange listing, ISIN, and regulatory filing information.
      </InfoNote>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Listing & Disclosure Information
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <div key={f.label} className="rounded-lg border border-border/40 bg-background/40 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</div>
            <div className="mt-0.5 text-sm font-semibold">{f.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AffiliatedCard({ trade }: { trade: InvestorTrade }) {
  const isBuy = trade.tradeType === "buy";
  return (
    <div className="rounded-xl border border-border/50 bg-background/50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${isBuy ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
          {isBuy ? "↑ Acquisition" : "↓ Divestment"}
        </span>
        <span className="text-[10px] text-muted-foreground">{trade.date?.slice(0, 10)}</span>
      </div>
      <div className="text-xs font-semibold">
        {trade.investorName} <span className="font-normal text-muted-foreground">— {trade.companyName || trade.ticker}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
        <div>
          <div className="text-muted-foreground">Shares</div>
          <div className="font-semibold num">{trade.sharesTraded != null ? fmtCompact(trade.sharesTraded) : "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Value</div>
          <div className="font-semibold num">{trade.transactionValue != null ? `Rp ${fmtCompact(trade.transactionValue)}` : "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Before</div>
          <div className="font-semibold num">{trade.ownershipBefore != null ? `${trade.ownershipBefore.toFixed(2)}%` : "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">After</div>
          <div className={`font-semibold num ${isBuy ? "text-success" : "text-destructive"}`}>
            {trade.ownershipAfter != null ? `${trade.ownershipAfter.toFixed(2)}%` : "—"}
          </div>
        </div>
      </div>
      <div className="text-[10px] capitalize text-muted-foreground">{trade.investorType} · {trade.sector || "—"}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function OwnershipCard({
  equitiesPayload,
  trades,
  tradesLoading,
  equitiesLoading,
  symbol,
}: {
  equitiesPayload: Record<string, unknown> | null;
  trades: InvestorTrade[];
  tradesLoading: boolean;
  equitiesLoading: boolean;
  symbol: string;
}) {
  type Tab = "ownership" | "shareholder" | "float" | "listing" | "affiliated" | "filings";
  const [tab, setTab] = useState<Tab>("ownership");
  const [showAllTrades, setShowAllTrades] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const ownership = useMemo(() => extractOwnership(equitiesPayload), [equitiesPayload]);

  // Extract additional data from equities payload
  const companyData = useMemo(() => {
    if (!equitiesPayload) return null;
    const root = (equitiesPayload.data ?? equitiesPayload) as Record<string, unknown>;
    return root;
  }, [equitiesPayload]);

  // Build pie data
  const pieData = useMemo(() => {
    const items: { name: string; value: number }[] = [];
    if (ownership.institutionalOwnership != null) items.push({ name: "Institutional", value: ownership.institutionalOwnership });
    if (ownership.mutualFundOwnership != null) items.push({ name: "Mutual Fund", value: ownership.mutualFundOwnership });
    if (ownership.insiderOwnership != null) items.push({ name: "Insider", value: ownership.insiderOwnership });
    const accounted = items.reduce((s, i) => s + i.value, 0);
    const publicPct = Math.max(0, 100 - accounted);
    if (publicPct > 0 || items.length === 0) items.push({ name: "Public / Float", value: publicPct > 0 ? publicPct : 100 });
    return items;
  }, [ownership]);

  const displayTrades = showAllTrades ? trades : trades.slice(0, 6);

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "ownership",   label: "Ownership",    icon: <Users className="h-3 w-3" /> },
    { id: "shareholder", label: "Shareholders",  icon: <Building2 className="h-3 w-3" /> },
    { id: "float",       label: "Free Float",    icon: <BarChart2 className="h-3 w-3" /> },
    { id: "listing",     label: "Listing",       icon: <FileText className="h-3 w-3" /> },
    { id: "affiliated",  label: "Affiliated",    icon: <Link2 className="h-3 w-3" /> },
    { id: "filings",     label: "Filings",       icon: <ScrollText className="h-3 w-3" /> },
  ];

  return (
    <GlassCard>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4 text-primary" />
          Shareholder Reports & Ownership
        </div>
        <button
          onClick={() => setShowRaw((s) => !s)}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showRaw ? "Hide" : "Debug"} raw data
        </button>
      </div>

      {/* Raw data debug panel */}
      {showRaw && equitiesPayload && (
        <div className="mb-4 max-h-48 overflow-auto rounded-lg bg-background/60 p-3 text-[10px] font-mono text-muted-foreground">
          <pre>{JSON.stringify(equitiesPayload, null, 2).slice(0, 3000)}</pre>
        </div>
      )}

      {/* Tab bar */}
      <div className="mb-4 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] transition ${
              tab === t.id
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── OWNERSHIP TAB ── */}
      {tab === "ownership" && (
        <div className="space-y-4">
          {equitiesLoading ? (
            <LoadingSkeleton rows={4} />
          ) : (
            <>
              <OwnershipPie data={pieData} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { label: "Institutional", value: ownership.institutionalOwnership != null ? `${fmtNum(ownership.institutionalOwnership)}%` : "—" },
                  { label: "Mutual Fund",   value: ownership.mutualFundOwnership != null ? `${fmtNum(ownership.mutualFundOwnership)}%` : "—" },
                  { label: "Insider",       value: ownership.insiderOwnership != null ? `${fmtNum(ownership.insiderOwnership)}%` : "—" },
                  { label: "Public Float",  value: ownership.publicFloat != null ? `${fmtNum(ownership.publicFloat)}%` : "—" },
                  { label: "Shares Out.",   value: ownership.sharesOutstanding != null ? fmtCompact(ownership.sharesOutstanding) : "—" },
                ].map((s) => (
                  <StatBox key={s.label} label={s.label} value={s.value} />
                ))}
              </div>
              {ownership.institutionalOwnership == null && ownership.topHolders.length === 0 && (
                <InfoNote>
                  Ownership data not available from DataSectors for <strong>{symbol}</strong>.
                  This is a beta endpoint — data may not be available for all IDX stocks.
                </InfoNote>
              )}
            </>
          )}
        </div>
      )}

      {/* ── SHAREHOLDER REPORTS TAB ── */}
      {tab === "shareholder" && (
        <div className="space-y-4">
          {equitiesLoading ? <LoadingSkeleton rows={5} /> : (
            <>
              {ownership.topHolders.length > 0 ? (
                <div>
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Top Institutional Holders — Shareholder Report
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/40 text-left">
                          <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground">#</th>
                          <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Holder</th>
                          <th className="pb-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Shares</th>
                          <th className="pb-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Ownership %</th>
                          <th className="pb-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ownership.topHolders.map((h, i) => (
                          <tr key={i} className="border-b border-border/20 hover:bg-accent/20 transition-colors">
                            <td className="py-2 text-muted-foreground">{i + 1}</td>
                            <td className="py-2 font-medium">{h.name || "—"}</td>
                            <td className="py-2 text-right num">{h.shares != null ? fmtCompact(h.shares) : "—"}</td>
                            <td className="py-2 text-right num">
                              {h.pct != null ? (
                                <div className="flex items-center justify-end gap-2">
                                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-accent/40">
                                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.min(100, h.pct)}%` }} />
                                  </div>
                                  <span>{fmtNum(h.pct)}%</span>
                                </div>
                              ) : "—"}
                            </td>
                            <td className="py-2 text-right capitalize text-muted-foreground">{h.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <InfoNote>
                  Shareholder report data not available from DataSectors for <strong>{symbol}</strong>.
                  The <code>/stocks/v2/equities</code> endpoint (beta) may not have this data for all IDX stocks.
                </InfoNote>
              )}

              {/* Additional company ownership info from equities payload */}
              {companyData && (
                <CompanyOwnershipDetails data={companyData} />
              )}
            </>
          )}
        </div>
      )}

      {/* ── FREE FLOAT TAB ── */}
      {tab === "float" && (
        <div className="space-y-4">
          {equitiesLoading ? <LoadingSkeleton rows={3} /> : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatBox label="Free Float %" value={ownership.publicFloat != null ? `${fmtNum(ownership.publicFloat)}%` : "—"} highlight />
                <StatBox label="Shares Outstanding" value={ownership.sharesOutstanding != null ? fmtCompact(ownership.sharesOutstanding) : "—"} />
                <StatBox
                  label="Float Shares"
                  value={ownership.publicFloat != null && ownership.sharesOutstanding != null
                    ? fmtCompact(ownership.sharesOutstanding * ownership.publicFloat / 100)
                    : "—"}
                />
                <StatBox label="Institutional %" value={ownership.institutionalOwnership != null ? `${fmtNum(ownership.institutionalOwnership)}%` : "—"} />
                <StatBox label="Insider %" value={ownership.insiderOwnership != null ? `${fmtNum(ownership.insiderOwnership)}%` : "—"} />
                <StatBox
                  label="Non-Float"
                  value={ownership.publicFloat != null ? `${fmtNum(100 - ownership.publicFloat)}%` : "—"}
                />
              </div>

              {/* Float breakdown visual */}
              {ownership.publicFloat != null && (
                <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                  <div className="mb-3 text-xs font-medium">Float Breakdown</div>
                  <FloatBar
                    institutional={ownership.institutionalOwnership}
                    mutualFund={ownership.mutualFundOwnership}
                    insider={ownership.insiderOwnership}
                    publicFloat={ownership.publicFloat}
                  />
                </div>
              )}

              {ownership.publicFloat == null && (
                <InfoNote>
                  Free float data not available from DataSectors for <strong>{symbol}</strong>.
                  Free float is derived from the ownership breakdown in the equities endpoint.
                </InfoNote>
              )}
            </>
          )}
        </div>
      )}

      {/* ── LISTING DISCLOSURES TAB ── */}
      {tab === "listing" && (
        <div className="space-y-4">
          {equitiesLoading ? <LoadingSkeleton rows={4} /> : (
            <>
              <ListingDisclosures data={companyData} symbol={symbol} />
            </>
          )}
        </div>
      )}

      {/* ── AFFILIATED TRANSACTIONS TAB ── */}
      {tab === "affiliated" && (
        <div className="space-y-4">
          {tradesLoading ? <LoadingSkeleton rows={3} /> : (
            <>
              <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Affiliated & Related Party Transactions
              </div>
              {trades.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {trades.slice(0, 8).map((t) => (
                    <AffiliatedCard key={t.id} trade={t} />
                  ))}
                </div>
              ) : (
                <InfoNote>
                  No affiliated transaction data available. This section shows insider and institutional
                  trades from the DataSectors investor activity endpoint.
                </InfoNote>
              )}
            </>
          )}
        </div>
      )}

      {/* ── FILINGS TAB ── */}
      {tab === "filings" && (
        <div className="space-y-3">
          {tradesLoading ? (
            <LoadingSkeleton rows={3} />
          ) : trades.length === 0 ? (
            <InfoNote>No recent insider or institutional filings found.</InfoNote>
          ) : (
            <>
              <div className="text-[11px] text-muted-foreground">
                Showing {displayTrades.length} of {trades.length} recent transactions
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {displayTrades.map((t) => (
                  <TradeCard key={t.id} trade={t} />
                ))}
              </div>
              {trades.length > 6 && (
                <button
                  onClick={() => setShowAllTrades((s) => !s)}
                  className="flex w-full items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAllTrades
                    ? <><ChevronUp className="h-3.5 w-3.5" /> Show less</>
                    : <><ChevronDown className="h-3.5 w-3.5" /> Show all {trades.length} filings</>}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </GlassCard>
  );
}
