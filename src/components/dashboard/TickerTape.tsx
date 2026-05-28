import type { Equity } from "@/lib/mock-data";
import { fmtPct, changeClass } from "@/lib/formatters";

export function TickerTape({ equities = [] }: { equities?: Equity[] }) {
  const items = equities.slice(0, 24).filter(Boolean);
  const doubled = [...items, ...items];
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="relative flex">
        <div className="flex animate-ticker whitespace-nowrap py-2.5">
          {doubled.map((e, i) => (
            <div
              key={`${e.symbol}-${i}`}
              className="flex items-center gap-2 px-5 text-sm"
            >
              <span className="font-mono font-semibold">{e.symbol}</span>
              <span className="num text-muted-foreground">
                {e.price.toLocaleString()}
              </span>
              <span className={`num text-xs ${changeClass(e.change_pct)}`}>
                {fmtPct(e.change_pct)}
              </span>
              <span className="text-border">·</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
