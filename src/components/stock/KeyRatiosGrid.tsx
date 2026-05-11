import { GlassCard } from "@/components/common/GlassCard";
import { fmtNum, fmtPrice, fmtCompact } from "@/lib/formatters";

interface Ratios {
  pe_ratio?: number | null;
  pb_ratio?: number | null;
  roe?: number | null;
  roa?: number | null;
  debt_to_equity?: number | null;
  dividend_yield?: number | null;
  net_margin?: number | null;
  operating_margin?: number | null;
  revenue_growth?: number | null;
  earnings_growth?: number | null;
  eps?: number | null;
  book_value?: number | null;
  beta?: number | null;
  high_52w?: number | null;
  low_52w?: number | null;
  shares_outstanding?: number | null;
  revenue_ttm?: number | null;
  net_income_ttm?: number | null;
}

export function KeyRatiosGrid({ ratios }: { ratios: Ratios }) {
  const sections: { title: string; items: { label: string; value: string }[] }[] = [
    {
      title: "Valuation",
      items: [
        { label: "P/E Ratio", value: fmtNum(ratios.pe_ratio) },
        { label: "P/B Ratio", value: fmtNum(ratios.pb_ratio) },
        { label: "EPS", value: ratios.eps != null ? fmtPrice(ratios.eps) : "—" },
        { label: "Book Value", value: ratios.book_value != null ? fmtPrice(ratios.book_value) : "—" },
        { label: "Dividend Yield", value: `${fmtNum(ratios.dividend_yield)}%` },
      ],
    },
    {
      title: "Profitability",
      items: [
        { label: "ROE", value: `${fmtNum(ratios.roe)}%` },
        { label: "ROA", value: `${fmtNum(ratios.roa)}%` },
        { label: "Net Margin", value: `${fmtNum(ratios.net_margin)}%` },
        { label: "Op. Margin", value: `${fmtNum(ratios.operating_margin)}%` },
        { label: "Debt / Equity", value: fmtNum(ratios.debt_to_equity) },
      ],
    },
    {
      title: "Growth & Risk",
      items: [
        { label: "Revenue Growth", value: `${fmtNum(ratios.revenue_growth)}%` },
        { label: "EPS Growth", value: `${fmtNum(ratios.earnings_growth)}%` },
        { label: "Beta", value: fmtNum(ratios.beta) },
        { label: "52W High", value: ratios.high_52w != null ? fmtPrice(ratios.high_52w) : "—" },
        { label: "52W Low", value: ratios.low_52w != null ? fmtPrice(ratios.low_52w) : "—" },
      ],
    },
    {
      title: "Scale (TTM)",
      items: [
        { label: "Revenue", value: fmtCompact(ratios.revenue_ttm) },
        { label: "Net Income", value: fmtCompact(ratios.net_income_ttm) },
        { label: "Shares Out.", value: fmtCompact(ratios.shares_outstanding) },
      ],
    },
  ];

  return (
    <GlassCard>
      <div className="mb-4 text-sm font-medium">Key Ratios & Financials</div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sections.map((sec) => (
          <div key={sec.title}>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              {sec.title}
            </div>
            <div className="space-y-1.5">
              {sec.items.map((it) => (
                <div
                  key={it.label}
                  className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2"
                >
                  <span className="text-xs text-muted-foreground">{it.label}</span>
                  <span className="text-sm font-semibold num">{it.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
