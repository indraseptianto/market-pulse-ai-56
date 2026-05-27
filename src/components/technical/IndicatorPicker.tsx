import { useState, useMemo } from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Indicator {
  name: string;
  displayName: string;
  category: string;
  description?: string;
}

interface IndicatorPickerProps {
  value: string;
  onChange: (name: string) => void;
  indicators?: Indicator[];
  className?: string;
}

const CATEGORIES = [
  "Moving Average",
  "Momentum",
  "Trend",
  "Volatility",
  "Volume",
  "Other",
];

const DEFAULT_INDICATORS = [
  { name: "SMA", displayName: "Simple Moving Average", category: "Moving Average" },
  { name: "EMA", displayName: "Exponential Moving Average", category: "Moving Average" },
  { name: "RSI", displayName: "RSI", category: "Momentum" },
  { name: "MACD", displayName: "MACD", category: "Momentum" },
  { name: "BB", displayName: "Bollinger Bands", category: "Volatility" },
  { name: "ATR", displayName: "ATR", category: "Volatility" },
  { name: "STOCH", displayName: "Stochastic", category: "Momentum" },
  { name: "VWAP", displayName: "VWAP", category: "Volume" },
  { name: "ADX", displayName: "ADX", category: "Trend" },
  { name: "CCI", displayName: "CCI", category: "Momentum" },
  { name: "WILLR", displayName: "Williams %R", category: "Momentum" },
  { name: "ROC", displayName: "ROC", category: "Momentum" },
];

export function IndicatorPicker({ value, onChange, indicators, className }: IndicatorPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const list = indicators ?? DEFAULT_INDICATORS;
  const selected = list.find((i) => i.name === value);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return list.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.displayName.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    );
  }, [list, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof list>();
    for (const ind of filtered) {
      const cat = ind.category ?? "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(ind);
    }
    return map;
  }, [filtered]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn("justify-between font-mono text-sm", className)}
        >
          <span className="truncate">
            {selected ? (
              <>
                <span className="text-muted-foreground">{selected.category} ›</span>{" "}
                {selected.displayName}
              </>
            ) : (
              "Select indicator..."
            )}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search indicators..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 text-sm"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto py-1">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <p className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {category}
              </p>
              {items.map((ind) => (
                <button
                  key={ind.name}
                  onClick={() => {
                    onChange(ind.name);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-accent",
                    ind.name === value && "bg-accent"
                  )}
                >
                  <div>
                    <span className="font-mono font-medium">{ind.name}</span>
                    <span className="ml-2 text-muted-foreground">{ind.displayName}</span>
                  </div>
                  {ind.name === value && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
