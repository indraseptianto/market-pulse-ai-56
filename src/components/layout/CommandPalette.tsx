import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, Loader2, TrendingUp } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { searchStocks } from "@/lib/datasectors.functions";

export interface SearchResult {
  id: string;
  symbol: string;
  description: string;
  exchange: string;
  type: string;
}

// Popular IDX stocks shown before user types anything
const POPULAR: SearchResult[] = [
  { id: "BBCA", symbol: "BBCA", description: "Bank Central Asia Tbk", exchange: "IDX", type: "stock" },
  { id: "BBRI", symbol: "BBRI", description: "Bank Rakyat Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "BMRI", symbol: "BMRI", description: "Bank Mandiri Tbk", exchange: "IDX", type: "stock" },
  { id: "TLKM", symbol: "TLKM", description: "Telkom Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "ASII", symbol: "ASII", description: "Astra International Tbk", exchange: "IDX", type: "stock" },
  { id: "BREN", symbol: "BREN", description: "Barito Renewables Energy Tbk", exchange: "IDX", type: "stock" },
  { id: "BYAN", symbol: "BYAN", description: "Bayan Resources Tbk", exchange: "IDX", type: "stock" },
  { id: "AMMN", symbol: "AMMN", description: "Amman Mineral Internasional Tbk", exchange: "IDX", type: "stock" },
  { id: "TPIA", symbol: "TPIA", description: "Chandra Asri Pacific Tbk", exchange: "IDX", type: "stock" },
  { id: "DCII", symbol: "DCII", description: "DCI Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "GOTO", symbol: "GOTO", description: "GoTo Gojek Tokopedia Tbk", exchange: "IDX", type: "stock" },
  { id: "UNVR", symbol: "UNVR", description: "Unilever Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "ICBP", symbol: "ICBP", description: "Indofood CBP Sukses Makmur Tbk", exchange: "IDX", type: "stock" },
  { id: "INDF", symbol: "INDF", description: "Indofood Sukses Makmur Tbk", exchange: "IDX", type: "stock" },
  { id: "KLBF", symbol: "KLBF", description: "Kalbe Farma Tbk", exchange: "IDX", type: "stock" },
  { id: "MDKA", symbol: "MDKA", description: "Merdeka Copper Gold Tbk", exchange: "IDX", type: "stock" },
  { id: "ADRO", symbol: "ADRO", description: "Adaro Energy Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "PTBA", symbol: "PTBA", description: "Bukit Asam Tbk", exchange: "IDX", type: "stock" },
  { id: "SMGR", symbol: "SMGR", description: "Semen Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "PGAS", symbol: "PGAS", description: "Perusahaan Gas Negara Tbk", exchange: "IDX", type: "stock" },
];

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const TYPE_BADGE: Record<string, string> = {
  stock: "bg-primary/15 text-primary",
  index: "bg-blue-500/15 text-blue-400",
  warrant: "bg-yellow-500/15 text-yellow-400",
  etf: "bg-purple-500/15 text-purple-400",
};

// Direct client-side search — calls DataSectors via a proxy route or directly
async function searchDirect(query: string): Promise<SearchResult[]> {
  // Filter popular list client-side — always works, no API needed
  const q = query.toUpperCase();
  return POPULAR.filter(
    (s) =>
      s.symbol.startsWith(q) ||
      s.symbol.includes(q) ||
      s.description.toUpperCase().includes(q)
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);
  const searchFn = useServerFn(searchStocks);

  const debouncedQuery = useDebounce(inputValue.trim(), 300);

  // Search effect — runs on every debounced query change
  useEffect(() => {
    if (!open) return;

    if (debouncedQuery.length === 0) {
      setResults([]);
      setError(null);
      return;
    }

    // Show instant local results immediately while API loads
    const instant = searchDirect(debouncedQuery);
    setResults(instant);
    setLoading(true);
    setError(null);

    // Cancel previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const run = async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(debouncedQuery)}`,
          { signal: controller.signal, headers: { Accept: "application/json" } }
        );

        let found: SearchResult[] = [];
        if (res.ok) {
          const json = await res.json();
          const arr = json?.data ?? [];
          if (Array.isArray(arr) && arr.length > 0) found = arr;
        }

        // If API route failed, try server function
        if (found.length === 0 && !controller.signal.aborted) {
          try {
            const sfRes = await searchFn({ data: { query: debouncedQuery } });
            if (sfRes?.data && sfRes.data.length > 0) found = sfRes.data;
          } catch {
            // ignore
          }
        }

        if (!controller.signal.aborted) {
          // Merge: API results first, then any local matches not already included
          if (found.length > 0) {
            setResults(found);
          }
          // else keep the instant local results already shown
          setLoading(false);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          // Keep local results, just stop loading
          setLoading(false);
        }
      }
    };

    run();
    return () => controller.abort();
  }, [debouncedQuery, open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      setInputValue("");
      setResults([]);
      navigate({ to: path });
    },
    [navigate],
  );

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) {
      setInputValue("");
      setResults([]);
      setError(null);
    }
  };

  // What to show in the list
  const showPopular = debouncedQuery.length === 0;
  const displayResults = showPopular ? [] : results;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden md:flex h-9 w-64 justify-between gap-2 px-3 text-muted-foreground"
      >
        <span className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5" />
          Search symbols, pages…
        </span>
        <kbd className="text-[10px] rounded bg-muted px-1.5 py-0.5">⌘K</kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="md:hidden"
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <div className="relative flex items-center">
          <CommandInput
            placeholder="Cari kode saham atau nama perusahaan…"
            value={inputValue}
            onValueChange={setInputValue}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <CommandList>
          {/* Navigation shortcuts */}
          <CommandGroup heading="Navigasi">
            <CommandItem onSelect={() => go("/")}>Dashboard</CommandItem>
            <CommandItem onSelect={() => go("/screener")}>Screener</CommandItem>
            <CommandItem onSelect={() => go("/chart")}>Advanced Chart</CommandItem>
            <CommandItem onSelect={() => go("/settings")}>Settings</CommandItem>
          </CommandGroup>

          {/* Popular stocks when no query */}
          {showPopular && (
            <CommandGroup heading="Saham Populer IDX">
              {POPULAR.slice(0, 10).map((r) => (
                <CommandItem
                  key={r.id}
                  value={`${r.symbol} ${r.description}`}
                  onSelect={() => go(`/stocks/${r.symbol}`)}
                  className="flex items-center gap-2"
                >
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-mono font-semibold w-16 shrink-0 text-foreground">
                    {r.symbol}
                  </span>
                  <span className="flex-1 truncate text-sm text-muted-foreground">
                    {r.description}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground/60">{r.exchange}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Search results */}
          {!showPopular && !loading && !error && displayResults.length === 0 && (
            <CommandEmpty>
              Tidak ada hasil untuk "{debouncedQuery}".
            </CommandEmpty>
          )}
          {!showPopular && !loading && error && (
            <CommandEmpty>Pencarian tidak tersedia saat ini.</CommandEmpty>
          )}

          {displayResults.length > 0 && (
            <CommandGroup heading={`Hasil Pencarian · ${displayResults.length} saham`}>
              {displayResults.map((r) => (
                <CommandItem
                  key={r.id || r.symbol}
                  value={`${r.symbol} ${r.description} ${r.exchange}`}
                  onSelect={() => go(`/stocks/${r.symbol}`)}
                  className="flex items-center gap-2"
                >
                  <span className="font-mono font-semibold w-20 shrink-0 text-foreground">
                    {r.symbol}
                  </span>
                  <span className="flex-1 truncate text-sm text-muted-foreground">
                    {r.description}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                    {r.exchange}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${TYPE_BADGE[r.type] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {r.type}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
