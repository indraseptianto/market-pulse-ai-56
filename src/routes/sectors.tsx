import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { SectorHeatmap } from "@/components/sectors/SectorHeatmap";
import { SectorRotationTable } from "@/components/sectors/SectorRotationTable";
import { DataSourceBadge } from "@/components/shared/DataSourceBadge";
import { changeClass } from "@/lib/formatters";

export const Route = createFileRoute("/sectors")({
  head: () => ({
    meta: [
      { title: "Sector Analysis — Stratum" },
      { name: "description", content: "Pantau performa sektor IDX: heatmap, rotation tracker, dan comparison." },
    ],
  }),
  component: SectorsPage,
});

const MOCK_SECTORS = [
  { name: "Financials",       avgChangePct: 2.34,  totalMarketCap: 4.2e15, stockCount: 45, topStock: "BBCA", topChange: 3.2 },
  { name: "Basic Materials",  avgChangePct: 1.87,  totalMarketCap: 2.8e15,  stockCount: 38, topStock: "INTP", topChange: 4.1 },
  { name: "Consumer Goods",   avgChangePct: 1.12,  totalMarketCap: 2.1e15,  stockCount: 52, topStock: "UNVR", topChange: 2.8 },
  { name: "Energy",           avgChangePct: 0.78,  totalMarketCap: 1.5e15,  stockCount: 22, topStock: "PGAS", topChange: 1.5 },
  { name: "Healthcare",       avgChangePct: 0.45,  totalMarketCap: 8.9e14,  stockCount: 31, topStock: "KLBF", topChange: 1.2 },
  { name: "Industrials",      avgChangePct: -0.23, totalMarketCap: 1.9e15,  stockCount: 48, topStock: "UNTR", topChange: 1.8 },
  { name: "Properties",       avgChangePct: -0.67, totalMarketCap: 1.2e15,  stockCount: 42, topStock: "BSDE", topChange: 0.9 },
  { name: "Infrastructure",  avgChangePct: -1.12, totalMarketCap: 1.4e15,  stockCount: 29, topStock: "TLKM", topChange: -0.3 },
  { name: "Technology",      avgChangePct: 3.45,  totalMarketCap: 4.5e14,  stockCount: 18, topStock: "GOTO", topChange: 5.2 },
  { name: "Transportation",   avgChangePct: -2.34,  totalMarketCap: 6.8e14,  stockCount: 24, topStock: "CUAN", topChange: -4.1 },
  { name: "Consumer Services",avgChangePct: 1.78,  totalMarketCap: 1.1e15,  stockCount: 35, topStock: "MAPI", topChange: 3.1 },
  { name: "Utilities",       avgChangePct: 0.12,  totalMarketCap: 5.6e14,  stockCount: 15, topStock: "ITMG", topChange: 0.8 },
];

function buildRotationData() {
  return MOCK_SECTORS.map((s) => ({
    name: s.name,
    change1d: s.avgChangePct,
    change1w: s.avgChangePct * (1 + (Math.random() - 0.5) * 0.5),
    change1m: s.avgChangePct * (1 + Math.random() * 1.5),
    change3m: s.avgChangePct * (1 + Math.random() * 3),
    change6m: s.avgChangePct * (1 + Math.random() * 5),
    change1y: s.avgChangePct * (1 + Math.random() * 8),
    momentumScore: Math.round(50 + (s.avgChangePct * 10) + (Math.random() * 20)),
  }));
}

type SortKey = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "score";

export function SectorsPage() {
  const navigate = useNavigate();
  const [timeframe] = useState("1D");
  const [sortBy, setSortBy] = useState<SortKey>("1D");
  const rotationData = useMemo(() => buildRotationData(), []);

  const handleSectorClick = (name: string) => {
    navigate({ to: "/sectors/$sectorName", params: { sectorName: encodeURIComponent(name) } });
  };

  const bestSector = [...rotationData].sort((a, b) => b.change1d - a.change1d)[0];
  const worstSector = [...rotationData].sort((a, b) => a.change1d - b.change1d)[0];

  return (
    <PageTransition>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sector Analysis</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Pantau performa dan rotasi sektor IDX. <DataSourceBadge source="ds" />
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <GlassCard className="p-4">
            <p className="text-[11px] text-muted-foreground mb-1">🏆 Best Sector Today</p>
            <p className="text-lg font-bold text-green-400">{bestSector?.name}</p>
            <p className={`text-sm font-mono ${changeClass(bestSector?.change1d ?? 0)}`}>
              {bestSector ? `${(bestSector.change1d) >= 0 ? "+" : ""}${bestSector.change1d.toFixed(2)}%` : "—"}
            </p>
          </GlassCard>
          <GlassCard className="p-4">
            <p className="text-[11px] text-muted-foreground mb-1">📉 Weakest Sector Today</p>
            <p className="text-lg font-bold text-red-400">{worstSector?.name}</p>
            <p className={`text-sm font-mono ${changeClass(worstSector?.change1d ?? 0)}`}>
              {worstSector ? `${(worstSector.change1d) >= 0 ? "+" : ""}${worstSector.change1d.toFixed(2)}%` : "—"}
            </p>
          </GlassCard>
        </div>

        <SectorHeatmap data={MOCK_SECTORS} timeframe={timeframe} onSectorClick={handleSectorClick} />
        <SectorRotationTable data={rotationData} sortBy={sortBy} onSortChange={setSortBy} />
      </div>
    </PageTransition>
  );
}