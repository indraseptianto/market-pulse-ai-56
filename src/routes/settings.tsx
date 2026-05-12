import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Bell, Globe, Key, Sparkles, Star, Palette, Save, Loader2, Cloud } from "lucide-react";
import { toast } from "sonner";
import { useUserSettings, useSaveUserSettings, useWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from "@/integrations/supabase/hooks";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Stratum" },
      { name: "description", content: "Personalize your trading desk and AI preferences." },
    ],
  }),
  component: SettingsPage,
});

function Section({ icon: Icon, title, desc, children }: {
  icon: typeof Bell; title: string; desc: string; children: React.ReactNode;
}) {
  return (
    <GlassCard className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      <div className="space-y-3 pl-12">{children}</div>
    </GlassCard>
  );
}

function SettingsPage() {
  // ── Supabase hooks ──────────────────────────────────────────
  const settingsQ  = useUserSettings();
  const saveMut    = useSaveUserSettings();
  const watchlistQ = useWatchlist();
  const addWL      = useAddToWatchlist();
  const removeWL   = useRemoveFromWatchlist();

  // ── Local form state (initialised from Supabase) ────────────
  const [theme,      setTheme]      = useState("dark");
  const [lang,       setLang]       = useState("id");
  const [aiModel,    setAiModel]    = useState("gemini-flash");
  const [aiTone,     setAiTone]     = useState("analyst");
  const [notifPrice, setNotifPrice] = useState(true);
  const [notifNews,  setNotifNews]  = useState(true);
  const [notifAI,    setNotifAI]    = useState(false);
  const [markets,    setMarkets]    = useState<string[]>(["IDX","NYSE","NASDAQ"]);
  const [newSym,     setNewSym]     = useState("");
  const [hydrated,   setHydrated]   = useState(false);

  // Populate form from Supabase once loaded
  useEffect(() => {
    const s = settingsQ.data;
    if (!s || hydrated) return;
    setTheme(s.theme);
    setLang(s.language);
    setAiModel(s.ai_model);
    setAiTone(s.ai_tone);
    setNotifPrice(s.notif_price);
    setNotifNews(s.notif_news);
    setNotifAI(s.notif_ai);
    setMarkets(s.enabled_markets);
    setHydrated(true);
  }, [settingsQ.data, hydrated]);

  const watchlistSymbols: string[] = watchlistQ.data ?? [];

  const toggleMarket = (m: string) =>
    setMarkets(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  const save = async () => {
    try {
      await saveMut.mutateAsync({
        theme: theme as "dark" | "light" | "system",
        language: lang,
        ai_model: aiModel,
        ai_tone: aiTone as "analyst" | "casual" | "technical" | "conservative",
        notif_price: notifPrice,
        notif_news: notifNews,
        notif_ai: notifAI,
        enabled_markets: markets,
      });
      toast.success("Pengaturan disimpan ke cloud");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal menyimpan";
      if (msg.includes("Not authenticated")) {
        toast.error("Login diperlukan untuk menyimpan pengaturan");
      } else {
        toast.error(msg);
      }
    }
  };

  const addSymbol = async () => {
    const s = newSym.trim().toUpperCase();
    if (!s) return;
    try {
      await addWL.mutateAsync(s);
      toast.success(`${s} ditambahkan ke watchlist`);
      setNewSym("");
    } catch { toast.error("Gagal menambahkan"); }
  };

  const removeSymbol = async (s: string) => {
    try {
      await removeWL.mutateAsync(s);
    } catch { toast.error("Gagal menghapus"); }
  };

  const isSaving = saveMut.isPending;
  const isCloudConnected = !settingsQ.isError;

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Personalisasi tampilan dan preferensi AI Anda.</p>
          </div>
          <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${isCloudConnected ? "border-success/30 bg-success/10 text-gain" : "border-border/40 text-muted-foreground"}`}>
            <Cloud className="h-3 w-3" />
            {isCloudConnected ? "Cloud sync" : "Login untuk sync"}
          </div>
        </div>

        {/* Appearance */}
        <Section icon={Palette} title="Tampilan" desc="Tema dan bahasa di seluruh platform.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Tema</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark (default)</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Bahasa</Label>
              <Select value={lang} onValueChange={setLang}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="id">Bahasa Indonesia</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        {/* AI */}
        <Section icon={Sparkles} title="Preferensi AI" desc="Atur bagaimana AI menghasilkan ringkasan dan analisis.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Model</Label>
              <Select value={aiModel} onValueChange={setAiModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-flash">Gemini Flash (cepat)</SelectItem>
                  <SelectItem value="gemini-pro">Gemini Pro (mendalam)</SelectItem>
                  <SelectItem value="gpt-mini">GPT-5 Mini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Gaya Analisis</Label>
              <Select value={aiTone} onValueChange={setAiTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="analyst">Analis Institusional</SelectItem>
                  <SelectItem value="casual">Santai</SelectItem>
                  <SelectItem value="technical">Teknikal</SelectItem>
                  <SelectItem value="conservative">Konservatif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        {/* Notifications */}
        <Section icon={Bell} title="Notifikasi" desc="Pilih notifikasi yang ingin Anda terima.">
          {([
            ["Alert harga", notifPrice, setNotifPrice],
            ["Berita & filing", notifNews, setNotifNews],
            ["Sinyal AI", notifAI, setNotifAI],
          ] as [string, boolean, (v: boolean) => void][]).map(([label, v, set]) => (
            <div key={label} className="flex items-center justify-between rounded-lg bg-background/30 px-3 py-2">
              <span className="text-sm">{label}</span>
              <Switch checked={v} onCheckedChange={set} />
            </div>
          ))}
        </Section>

        {/* Watchlist */}
        <Section icon={Star} title="Watchlist" desc="Saham yang ingin Anda pantau. Disinkronkan ke cloud.">
          <div className="flex gap-2">
            <Input value={newSym} onChange={e => setNewSym(e.target.value.toUpperCase())} placeholder="Tambah simbol (contoh: BBCA)" />
            <Button onClick={addSymbol} disabled={addWL.isPending}>Tambah</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {watchlistQ.isLoading ? (
              <span className="text-xs text-muted-foreground">Memuat...</span>
            ) : watchlistSymbols.length === 0 ? (
              <span className="text-xs text-muted-foreground">Belum ada simbol.</span>
            ) : (
              watchlistSymbols.map(s => (
                <button key={s} onClick={() => removeSymbol(s)}
                  className="rounded-full border border-border/60 bg-accent/30 px-3 py-1 text-xs font-mono hover:border-destructive/50 hover:text-destructive">
                  {s} ×
                </button>
              ))
            )}
          </div>
        </Section>

        {/* API Key */}
        <Section icon={Key} title="API Access" desc="API key DataSectors disimpan aman di server.">
          <div className="space-y-2">
            <Label className="text-xs">API Key</Label>
            <Input type="password" value="••••••••••••••••" readOnly className="font-mono" />
            <p className="text-[11px] text-muted-foreground">
              Key tidak pernah meninggalkan server. Update melalui environment variables.
            </p>
          </div>
        </Section>

        {/* Markets */}
        <Section icon={Globe} title="Pasar" desc="Pasar default yang ditampilkan di seluruh layar.">
          <div className="grid gap-2 sm:grid-cols-3">
            {["IDX","NYSE","NASDAQ"].map(m => (
              <div key={m} className="flex items-center justify-between rounded-lg bg-background/30 px-3 py-2">
                <span className="text-sm font-medium">{m}</span>
                <Switch checked={markets.includes(m)} onCheckedChange={() => toggleMarket(m)} />
              </div>
            ))}
          </div>
        </Section>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {settingsQ.data ? `Terakhir disimpan: ${new Date(settingsQ.data.updated_at).toLocaleString("id-ID")}` : "Belum pernah disimpan"}
          </p>
          <Button onClick={save} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}