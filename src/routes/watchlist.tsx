import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getEquities } from "@/lib/datasectors.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Star, Trash2, Bell, Plus } from "lucide-react";
import { fmtPct, fmtPrice, changeClass } from "@/lib/formatters";
import { mockEquities } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist — Stratum" },
      { name: "description", content: "Personal watchlist with price and indicator alerts." },
    ],
  }),
  component: WatchlistPage,
});

interface Alert {
  id: string;
  symbol: string;
  type: "price_above" | "price_below" | "rsi_above" | "rsi_below" | "volume_spike";
  value: number;
  createdAt: number;
}

function WatchlistPage() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [draft, setDraft] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setSymbols(JSON.parse(localStorage.getItem("stratum:watchlist") || '["BBCA","BBRI","TLKM","ASII"]'));
      setAlerts(JSON.parse(localStorage.getItem("stratum:alerts") || "[]"));
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem("stratum:watchlist", JSON.stringify(symbols));
  }, [symbols, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem("stratum:alerts", JSON.stringify(alerts));
  }, [alerts, hydrated]);

  const fn = useServerFn(getEquities);
  const universe = useQuery({
    queryKey: ["equities", "watchlist"],
    queryFn: () => fn({ data: { limit: 200 } }),
    staleTime: 60_000,
  });
  const all = universe.data?.data ?? mockEquities;
  const rows = useMemo(
    () => symbols.map((s) => all.find((e) => e.symbol === s.toUpperCase())).filter(Boolean),
    [symbols, all],
  );

  const add = (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    if (symbols.includes(s)) return toast.info(`${s} already in watchlist`);
    setSymbols([...symbols, s]);
    toast.success(`${s} added`);
    setDraft("");
  };
  const remove = (s: string) => setSymbols(symbols.filter((x) => x !== s));

  const addAlert = (symbol: string, type: Alert["type"], value: number) => {
    setAlerts([
      ...alerts,
      { id: crypto.randomUUID(), symbol, type, value, createdAt: Date.now() },
    ]);
    toast.success(`Alert added for ${symbol}`);
  };
  const removeAlert = (id: string) => setAlerts(alerts.filter((a) => a.id !== id));

  return (
    <PageTransition>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Watchlist & Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Track tickers and set price, RSI, MACD or volume alerts. Stored locally on this device.
          </p>
        </div>

        <GlassCard>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              add(draft);
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add ticker (e.g. BMRI)"
              className="font-mono uppercase"
            />
            <Button type="submit" size="sm">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </form>
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-background/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5">Symbol</th>
                  <th className="px-4 py-2.5 text-right">Price</th>
                  <th className="px-4 py-2.5 text-right">Change</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!hydrated ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      Loading watchlist…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      <Star className="mx-auto mb-2 h-6 w-6" />
                      Your watchlist is empty. Add a ticker above.
                    </td>
                  </tr>
                ) : (
                  rows.map((e) => (
                    <tr key={e!.symbol} className="border-b border-border/30 hover:bg-accent/20">
                      <td className="px-4 py-2.5">
                        <Link to="/stocks/$symbol" params={{ symbol: e!.symbol }} className="block">
                          <div className="font-mono text-sm font-semibold">{e!.symbol}</div>
                          <div className="truncate text-xs text-muted-foreground max-w-[220px]">{e!.name}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right num">{fmtPrice(e!.price)}</td>
                      <td className={`px-4 py-2.5 text-right num ${changeClass(e!.change_pct)}`}>{fmtPct(e!.change_pct)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addAlert(e!.symbol, "price_above", +(e!.price * 1.05).toFixed(2))}
                            title="Alert +5%"
                          >
                            <Bell className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(e!.symbol)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4" /> Active Alerts
          </div>
          {!hydrated || alerts.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No alerts yet. Click the bell on a row to add a +5% price alert, or use quick-add below.
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs text-primary">{a.symbol}</span>
                    <span className="text-sm">{describeAlert(a)}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeAlert(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <QuickAlert onAdd={addAlert} symbols={symbols} />
        </GlassCard>
      </div>
    </PageTransition>
  );
}

function describeAlert(a: Alert): string {
  switch (a.type) {
    case "price_above":
      return `Price crosses above ${a.value}`;
    case "price_below":
      return `Price crosses below ${a.value}`;
    case "rsi_above":
      return `RSI(14) crosses above ${a.value}`;
    case "rsi_below":
      return `RSI(14) crosses below ${a.value}`;
    case "volume_spike":
      return `Volume spike > ${a.value}× avg`;
  }
}

function QuickAlert({
  onAdd,
  symbols,
}: {
  onAdd: (s: string, t: Alert["type"], v: number) => void;
  symbols: string[];
}) {
  const [sym, setSym] = useState(symbols[0] ?? "BBCA");
  const [type, setType] = useState<Alert["type"]>("price_above");
  const [val, setVal] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = Number(val);
        if (!sym || !Number.isFinite(v)) return;
        onAdd(sym.toUpperCase(), type, v);
        setVal("");
      }}
      className="mt-4 grid gap-2 border-t border-border/40 pt-4 md:grid-cols-[1fr_1fr_1fr_auto]"
    >
      <Input value={sym} onChange={(e) => setSym(e.target.value)} placeholder="Symbol" className="font-mono uppercase" />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as Alert["type"])}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="price_above">Price above</option>
        <option value="price_below">Price below</option>
        <option value="rsi_above">RSI above</option>
        <option value="rsi_below">RSI below</option>
        <option value="volume_spike">Volume spike (×)</option>
      </select>
      <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Threshold" type="number" />
      <Button type="submit" size="sm">
        Add alert
      </Button>
    </form>
  );
}
