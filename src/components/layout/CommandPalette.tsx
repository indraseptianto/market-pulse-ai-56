import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Loader2 } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { searchStocks, type SearchResult } from "@/lib/datasectors.functions";

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

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const navigate = useNavigate();
  const searchFn = useServerFn(searchStocks);

  const debouncedQuery = useDebounce(inputValue.trim(), 300);

  const { data: searchData, isFetching, isError } = useQuery({
    queryKey: ["stock-search", debouncedQuery],
    queryFn: async () => {
      console.log("[CommandPalette] searching:", debouncedQuery);
      const res = await searchFn({ data: { query: debouncedQuery } });
      console.log("[CommandPalette] result:", res);
      return res;
    },
    enabled: open && debouncedQuery.length >= 1,
    staleTime: 30_000,
    retry: false,
  });

  const results: SearchResult[] = searchData?.data ?? [];

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
      navigate({ to: path });
    },
    [navigate],
  );

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) setInputValue("");
  };

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
            placeholder="Search symbols or navigate…"
            value={inputValue}
            onValueChange={setInputValue}
          />
          {isFetching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <CommandList>
          {/* Navigation shortcuts — always visible */}
          <CommandGroup heading="Navigate">
            <CommandItem onSelect={() => go("/")}>Dashboard</CommandItem>
            <CommandItem onSelect={() => go("/screener")}>Screener</CommandItem>
            <CommandItem onSelect={() => go("/settings")}>Settings</CommandItem>
          </CommandGroup>

          {/* Search states */}
          {debouncedQuery.length >= 1 && !isFetching && isError && (
            <CommandEmpty>Search unavailable. Check API key configuration.</CommandEmpty>
          )}
          {debouncedQuery.length >= 1 && !isFetching && !isError && results.length === 0 && (
            <CommandEmpty>No results for "{debouncedQuery}".</CommandEmpty>
          )}

          {results.length > 0 && (
            <CommandGroup heading={`Stocks · ${results.length} results`}>
              {results.map((r) => (
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
