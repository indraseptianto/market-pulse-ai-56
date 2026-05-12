import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getEquities } from "@/lib/datasectors.functions";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Star, Trash2, Bell, Plus, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { fmtPct, fmtPrice, changeClass } from "@/lib/formatters";
import { mockEquities } from "@/lib/mock-data";
import { toast } from "sonner";
import {
  useWatchlist,
  useAddToWatchlist,
  useRemoveFromWatchlist,
  useAlerts,
  useCreateAlert,
  useDeleteAlert,
  useToggleAlert,
} from "@/integrations/supabase/hooks";
import type { Alert } from "@/integrations/supabase/types";
import { useLivePrices } from "@/hooks/use-live-price";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist — Stratum" },
      { name: "description", content: "Personal watchlist with price and indicator alerts. Synced to cloud." },
    ],
  }),
  component: WatchlistPage,
});

function describeAlert(a: Alert): string {
  switch (a.type) {
    case "price_above":  return `Harga naik di atas ${a.value}`;
    case "price_below":  return `Harga turun di bawah ${a.value}`;
    case "rsi_above":    return `RSI(14) di atas ${a.value}`;
    case "rsi_below":    return `RSI(14) di bawah ${a.value}`;
    case "volume_spike": return `Volume spike > ${a.value}× rata-rata`;
    default:             return String(a.type);
  }
}

function WatchlistPage() {
  const [draft, setDraft] = useState("");

  // ── Supabase hooks ──────────────────────────────────────────
  const watchlistQ  = useWatchlist();
  const alertsQ     = useAlerts();
  const addMut      = useAddToWatchlist();
  const removeMut   = useRemoveFromWatchlist();
  const createAlert = useCreateAlert();
  const deleteAlert = useDeleteAlert();
  const toggleAlert = useToggleAlert();

  const symbols: string[] = watchlistQ.data ?? [];
  const alerts: Alert[]   = alertsQ.data ?? [];

  // ── Market data ─────────────────────────────────────────────
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

  // ── Live prices from chart-saham ─────────────────────────────
  const livePricesQ = useLivePrices(symbols);
  const liveMap = livePricesQ.data?.data ?? {};

  const add = async (sym: string) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    if (symbols.includes(s)) { toast.info(`${s} sudah ada di watchlist`); return; }
    try {
      await addMut.mutateAsync(s);
      toast.success(`${s} ditambahkan ke watchlist`);
      setDraft("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal menambahkan";
      if (msg.includes("Not authenticated")) {
        toast.error("Login diperlukan untuk menyimpan watchlist ke cloud");
      } else {
        toast.error(msg);
      }
    }
  };

  const remove = async (s: string) => {
    try {
      await removeMut.mutateAsync(s);
      toast.success(`${s} dihapus`);
    } catch { toast.error("Gagal menghapus"); }
  };

  const addAlertFn = async (symbol: string, type: Alert["type"], value: number) => {
    try {
      await createAlert.mutateAsync({ symbol, type, value, is_active: true });
      toast.success(`Alert ditambahkan untuk ${symbol}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal";
      if (msg.includes("Not authenticated")) toast.error("Login diperlukan untuk menyimpan alert");
      else toast.error(msg);
    }
  };

  const isLoading = watchlistQ.isLoading || alertsQ.isLoading;
  const isCloud = !watchlistQ.isError;

  return (
    <PageTransition>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Watchlist & Alerts</h1>
            <p className="text-sm text-muted-foreground">
              Pantau saham favorit dan atur alert harga, RSI, dan volume.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => livePricesQ.refetch()} disabled={livePricesQ.isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${livePricesQ.isFetching ? "animate-spin" : ""}`} />
              Refresh Harga
            </Button>
            <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${isCloud ? "border-success/30 bg-success/10 text-gain" : "border-border/40 text-muted-foreground"}`}>
              {isCloud ? <Cloud className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
              {isCloud ? "Cloud sync aktif" : "Login untuk sync"}
            </div>
          </div>
        </div>

        {/* Add ticker */}
        <GlassCard>
          <form onSubmit={(e) => { e.preventDefault(); add(draft); }} className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Tambah ticker (contoh: BMRI)"
              className="font-mono uppercase"
            />
            <Button type="submit" size="sm" disabled={addMut.isPending}>
              <Plus className="h-3.5 w-3.5" /> Tambah
            </Button>
          </form>
        </GlassCard>

        {/* Watchlist table */}
        <GlassCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-background/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5">Saham</th>
                  <th className="px-4 py-2.5 text-right">Harga</th>
                  <th className="px-4 py-2.5 text-right">Perubahan</th>
                  <th className="px-4 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">Memuat watchlist…</td></tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      <Star className="mx-auto mb-2 h-6 w-6" />
                      Watchlist kosong. Tambahkan ticker di atas.
                    </td>
                  </tr>
                ) : (
                  rows.map((e) => {
                    const lp = liveMap[e!.symbol];
                    const price = lp?.close ?? e!.price;
                    const changePct = lp?.change_pct ?? e!.change_pct;
                    const volume = lp?.volume ?? e!.volume;
                    return (
                    <tr key={e!.symbol} className="border-b border-border/30 hover:bg-accent/20">
                      <td className="px-4 py-2.5">
                        <Link to="/stocks/$symbol" params={{ symbol: e!.symbol }} className="block">
                          <div className="font-mono text-sm font-semibold">{e!.symbol}</div>
                          <div className="truncate text-xs text-muted-foreground max-w-[220px]">{e!.name}</div>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="num font-semibold">{fmtPrice(price)}</div>
                        {lp && <div className="text-[10px] text-muted-foreground">{lp.date}</div>}
                      </td>
                      <td className={`px-4 py-2.5 text-right num ${changeClass(changePct)}`}>
                        {fmtPct(changePct)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" title="Alert +5%"
                            onClick={() => addAlertFn(e!.symbol, "price_above", +(price * 1.05).toFixed(2))}>
                            <Bell className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(e!.symbol)} disabled={removeMut.isPending}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Alerts */}
        <GlassCard>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4" /> Alert Aktif
            {alerts.length > 0 && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">{alerts.filter(a => a.is_active).length} aktif</span>
            )}
          </div>
          {alerts.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Belum ada alert. Klik ikon bell pada baris saham untuk menambah alert +5%, atau gunakan form di bawah.
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full ${a.is_active ? "bg-gain animate-pulse" : "bg-muted-foreground"}`} />
                    <span className="rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs text-primary">{a.symbol}</span>
                    <span className="text-sm">{describeAlert(a)}</span>
                    {a.triggered_at && (
                      <span className="text-[10px] text-warning">Triggered {new Date(a.triggered_at).toLocaleDateString("id-ID")}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => toggleAlert.mutate({ id: a.id, is_active: !a.is_active })}
                      className={a.is_active ? "text-gain" : "text-muted-foreground"}>
                      {a.is_active ? "Aktif" : "Nonaktif"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteAlert.mutate(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <QuickAlert onAdd={addAlertFn} symbols={symbols} />
        </GlassCard>
      </div>
    </PageTransition>
  );
}

function QuickAlert({ onAdd, symbols }: { onAdd: (s: string, t: Alert["type"], v: number) => void; symbols: string[] }) {
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
      <select value={type} onChange={(e) => setType(e.target.value as Alert["type"])}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm">
        <option value="price_above">Harga di atas</option>
        <option value="price_below">Harga di bawah</option>
        <option value="rsi_above">RSI di atas</option>
        <option value="rsi_below">RSI di bawah</option>
        <option value="volume_spike">Volume spike (×)</option>
      </select>
      <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Nilai threshold" type="number" />
      <Button type="submit" size="sm">Tambah Alert</Button>
    </form>
  );
}