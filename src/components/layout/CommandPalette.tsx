import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { Search, Loader2, TrendingUp, Building2 } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

export interface SearchResult {
  id: string;
  symbol: string;
  description: string;
  exchange: string;
  type: string;
}

// ── Full IDX stock list (built-in, always works without API) ──────────────────
const ALL_STOCKS: SearchResult[] = [
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
  { id: "ANTM", symbol: "ANTM", description: "Aneka Tambang Tbk", exchange: "IDX", type: "stock" },
  { id: "BBNI", symbol: "BBNI", description: "Bank Negara Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "BSDE", symbol: "BSDE", description: "Bumi Serpong Damai Tbk", exchange: "IDX", type: "stock" },
  { id: "CPIN", symbol: "CPIN", description: "Charoen Pokphand Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "ERAA", symbol: "ERAA", description: "Erajaya Swasembada Tbk", exchange: "IDX", type: "stock" },
  { id: "EXCL", symbol: "EXCL", description: "XL Axiata Tbk", exchange: "IDX", type: "stock" },
  { id: "HMSP", symbol: "HMSP", description: "HM Sampoerna Tbk", exchange: "IDX", type: "stock" },
  { id: "INCO", symbol: "INCO", description: "Vale Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "INKP", symbol: "INKP", description: "Indah Kiat Pulp & Paper Tbk", exchange: "IDX", type: "stock" },
  { id: "ISAT", symbol: "ISAT", description: "Indosat Tbk", exchange: "IDX", type: "stock" },
  { id: "JPFA", symbol: "JPFA", description: "Japfa Comfeed Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "MAPI", symbol: "MAPI", description: "Mitra Adiperkasa Tbk", exchange: "IDX", type: "stock" },
  { id: "MEDC", symbol: "MEDC", description: "Medco Energi Internasional Tbk", exchange: "IDX", type: "stock" },
  { id: "MNCN", symbol: "MNCN", description: "Media Nusantara Citra Tbk", exchange: "IDX", type: "stock" },
  { id: "PNBN", symbol: "PNBN", description: "Bank Pan Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "PWON", symbol: "PWON", description: "Pakuwon Jati Tbk", exchange: "IDX", type: "stock" },
  { id: "SCMA", symbol: "SCMA", description: "Surya Citra Media Tbk", exchange: "IDX", type: "stock" },
  { id: "SIDO", symbol: "SIDO", description: "Industri Jamu dan Farmasi Sido Muncul Tbk", exchange: "IDX", type: "stock" },
  { id: "SMRA", symbol: "SMRA", description: "Summarecon Agung Tbk", exchange: "IDX", type: "stock" },
  { id: "TBIG", symbol: "TBIG", description: "Tower Bersama Infrastructure Tbk", exchange: "IDX", type: "stock" },
  { id: "TOWR", symbol: "TOWR", description: "Sarana Menara Nusantara Tbk", exchange: "IDX", type: "stock" },
  { id: "UNTR", symbol: "UNTR", description: "United Tractors Tbk", exchange: "IDX", type: "stock" },
  { id: "WIKA", symbol: "WIKA", description: "Wijaya Karya Tbk", exchange: "IDX", type: "stock" },
  { id: "WSKT", symbol: "WSKT", description: "Waskita Karya Tbk", exchange: "IDX", type: "stock" },
  { id: "CUAN", symbol: "CUAN", description: "Petrindo Jaya Kreasi Tbk", exchange: "IDX", type: "stock" },
  { id: "DSSA", symbol: "DSSA", description: "Dian Swastatika Sentosa Tbk", exchange: "IDX", type: "stock" },
  { id: "HRUM", symbol: "HRUM", description: "Harum Energy Tbk", exchange: "IDX", type: "stock" },
  { id: "ITMG", symbol: "ITMG", description: "Indo Tambangraya Megah Tbk", exchange: "IDX", type: "stock" },
  { id: "MIKA", symbol: "MIKA", description: "Mitra Keluarga Karyasehat Tbk", exchange: "IDX", type: "stock" },
  { id: "RAJA", symbol: "RAJA", description: "Rukun Raharja Tbk", exchange: "IDX", type: "stock" },
  { id: "ACES", symbol: "ACES", description: "Ace Hardware Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "AKRA", symbol: "AKRA", description: "AKR Corporindo Tbk", exchange: "IDX", type: "stock" },
  { id: "AMRT", symbol: "AMRT", description: "Sumber Alfaria Trijaya Tbk", exchange: "IDX", type: "stock" },
  { id: "BBTN", symbol: "BBTN", description: "Bank Tabungan Negara Tbk", exchange: "IDX", type: "stock" },
  { id: "BDMN", symbol: "BDMN", description: "Bank Danamon Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "BRPT", symbol: "BRPT", description: "Barito Pacific Tbk", exchange: "IDX", type: "stock" },
  { id: "BTPS", symbol: "BTPS", description: "Bank BTPN Syariah Tbk", exchange: "IDX", type: "stock" },
  { id: "CTRA", symbol: "CTRA", description: "Ciputra Development Tbk", exchange: "IDX", type: "stock" },
  { id: "EMTK", symbol: "EMTK", description: "Elang Mahkota Teknologi Tbk", exchange: "IDX", type: "stock" },
  { id: "GGRM", symbol: "GGRM", description: "Gudang Garam Tbk", exchange: "IDX", type: "stock" },
  { id: "HEAL", symbol: "HEAL", description: "Medikaloka Hermina Tbk", exchange: "IDX", type: "stock" },
  { id: "INTP", symbol: "INTP", description: "Indocement Tunggal Prakarsa Tbk", exchange: "IDX", type: "stock" },
  { id: "JSMR", symbol: "JSMR", description: "Jasa Marga Tbk", exchange: "IDX", type: "stock" },
  { id: "LSIP", symbol: "LSIP", description: "PP London Sumatra Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "MYOR", symbol: "MYOR", description: "Mayora Indah Tbk", exchange: "IDX", type: "stock" },
  { id: "NISP", symbol: "NISP", description: "Bank OCBC NISP Tbk", exchange: "IDX", type: "stock" },
  { id: "SRTG", symbol: "SRTG", description: "Saratoga Investama Sedaya Tbk", exchange: "IDX", type: "stock" },
  { id: "TKIM", symbol: "TKIM", description: "Pabrik Kertas Tjiwi Kimia Tbk", exchange: "IDX", type: "stock" },
  { id: "ULTJ", symbol: "ULTJ", description: "Ultra Jaya Milk Industry Tbk", exchange: "IDX", type: "stock" },
  { id: "BRIS", symbol: "BRIS", description: "Bank Syariah Indonesia Tbk", exchange: "IDX", type: "stock" },
  { id: "BUKA", symbol: "BUKA", description: "Bukalapak.com Tbk", exchange: "IDX", type: "stock" },
  { id: "TINS", symbol: "TINS", description: "Timah Tbk", exchange: "IDX", type: "stock" },
  { id: "ARNA", symbol: "ARNA", description: "Arwana Citramulia Tbk", exchange: "IDX", type: "stock" },
  { id: "BMTR", symbol: "BMTR", description: "Global Mediacom Tbk", exchange: "IDX", type: "stock" },
  { id: "PNLF", symbol: "PNLF", description: "Panin Financial Tbk", exchange: "IDX", type: "stock" },
  { id: "WIIM", symbol: "WIIM", description: "Wismilak Inti Makmur Tbk", exchange: "IDX", type: "stock" },
];

// ── Local search — case-insensitive, always instant ───────────────────────────
function localSearch(query: string): SearchResult[] {
  if (!query) return [];
  const q = query.toUpperCase().trim();
  // Exact symbol match first, then starts-with, then contains, then name match
  const exact   = ALL_STOCKS.filter(s => s.symbol === q);
  const starts  = ALL_STOCKS.filter(s => s.symbol.startsWith(q) && s.symbol !== q);
  const contains = ALL_STOCKS.filter(s => s.symbol.includes(q) && !s.symbol.startsWith(q));
  const byName  = ALL_STOCKS.filter(s =>
    !s.symbol.includes(q) && s.description.toUpperCase().includes(q)
  );
  return [...exact, ...starts, ...contains, ...byName].slice(0, 20);
}

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

const POPULAR_SYMBOLS = ["BBCA","BBRI","BMRI","TLKM","ASII","BREN","GOTO","AMMN","DCII","TPIA"];
const POPULAR = ALL_STOCKS.filter(s => POPULAR_SYMBOLS.includes(s.symbol));

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [apiResults, setApiResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const abortRef = useRef<AbortController | null>(null);

  const debouncedQuery = useDebounce(inputValue.trim(), 400);

  // Compute display results — local search is always instant
  const localResults = localSearch(inputValue.trim());
  const hasQuery = inputValue.trim().length > 0;

  // Merge: API results take priority, fill with local matches not already in API results
  const displayResults = hasQuery
    ? apiResults.length > 0
      ? [
          ...apiResults,
          ...localResults.filter(l => !apiResults.some(a => a.symbol === l.symbol)),
        ].slice(0, 20)
      : localResults
    : [];

  // Try API in background for richer results
  useEffect(() => {
    if (!open || debouncedQuery.length === 0) {
      setApiResults([]);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    const run = async () => {
      try {
        // Try server function via TanStack Start RPC
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(debouncedQuery)}`,
          { signal: controller.signal, headers: { Accept: "application/json" } }
        );
        if (res.ok) {
          const json = await res.json();
          const arr: SearchResult[] = Array.isArray(json?.data) ? json.data : [];
          if (!controller.signal.aborted && arr.length > 0) {
            setApiResults(arr);
          }
        }
      } catch {
        // silently ignore — local results already showing
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [debouncedQuery, open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback((path: string) => {
    setOpen(false);
    setInputValue("");
    setApiResults([]);
    navigate({ to: path });
  }, [navigate]);

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) { setInputValue(""); setApiResults([]); }
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
          Cari kode saham…
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

      {/* shouldFilter=false → disable cmdk's internal filter, we handle it ourselves */}
      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <div className="relative flex items-center border-b border-border/60">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          <CommandInput
            placeholder="Ketik kode saham atau nama perusahaan…"
            value={inputValue}
            onValueChange={setInputValue}
            className="pl-9"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        <CommandList>
          {/* Navigation — always visible */}
          <CommandGroup heading="Navigasi">
            {[
              { label: "Dashboard",      path: "/" },
              { label: "Screener",       path: "/screener" },
              { label: "Fair Value",     path: "/fair-value" },
              { label: "Advanced Chart", path: "/chart" },
              { label: "Settings",       path: "/settings" },
            ].map(item => (
              <CommandItem key={item.path} value={item.path} onSelect={() => go(item.path)}>
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>

          {/* Popular stocks — shown when no query */}
          {!hasQuery && (
            <CommandGroup heading="Saham Populer IDX">
              {POPULAR.map(r => (
                <CommandItem
                  key={r.id}
                  value={r.symbol}
                  onSelect={() => go(`/stocks/${r.symbol}`)}
                  className="flex items-center gap-3 py-2.5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-sm text-foreground">{r.symbol}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.description}</div>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground/50">{r.exchange}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Search results */}
          {hasQuery && displayResults.length === 0 && !loading && (
            <CommandEmpty>
              Tidak ada hasil untuk "<strong>{inputValue}</strong>".
            </CommandEmpty>
          )}

          {hasQuery && displayResults.length > 0 && (
            <CommandGroup heading={`${displayResults.length} saham ditemukan`}>
              {displayResults.map(r => (
                <CommandItem
                  key={r.symbol}
                  value={r.symbol}
                  onSelect={() => go(`/stocks/${r.symbol}`)}
                  className="flex items-center gap-3 py-2.5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/40">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-sm text-foreground">{r.symbol}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.description}</div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-0.5">
                    <span className="text-[10px] text-muted-foreground/50">{r.exchange}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-medium ${TYPE_BADGE[r.type] ?? "bg-muted text-muted-foreground"}`}>
                      {r.type}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

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
