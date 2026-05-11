import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { GlassCard } from "@/components/common/GlassCard";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Globe, Key, Sparkles, Star, Palette } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Stratum" },
      {
        name: "description",
        content: "Manage API keys, AI preferences, notifications, watchlist and language.",
      },
    ],
  }),
  component: SettingsPage,
});

function Section({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: typeof Bell;
  title: string;
  desc: string;
  children: React.ReactNode;
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
  const [theme, setTheme] = useState("dark");
  const [lang, setLang] = useState("en");
  const [aiModel, setAiModel] = useState("gemini-flash");
  const [aiTone, setAiTone] = useState("analyst");
  const [notifPrice, setNotifPrice] = useState(true);
  const [notifNews, setNotifNews] = useState(true);
  const [notifAI, setNotifAI] = useState(false);
  const [apiKey, setApiKey] = useState("••••••••••••");
  const [watchlist, setWatchlist] = useState(["BBCA", "TLKM", "GOTO"]);
  const [newSym, setNewSym] = useState("");

  const addSymbol = () => {
    const s = newSym.trim().toUpperCase();
    if (!s || watchlist.includes(s)) return;
    setWatchlist([...watchlist, s]);
    setNewSym("");
  };

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Personalize your trading desk and AI preferences.
          </p>
        </div>

        <Section
          icon={Palette}
          title="Appearance"
          desc="Theme and language across the platform."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Theme</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark (default)</SelectItem>
                  <SelectItem value="dim">Dim</SelectItem>
                  <SelectItem value="auto">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Language</Label>
              <Select value={lang} onValueChange={setLang}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="id">Bahasa Indonesia</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <Section
          icon={Sparkles}
          title="AI Preferences"
          desc="Tune how AI summaries and analyst notes are generated."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Model</Label>
              <Select value={aiModel} onValueChange={setAiModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-flash">Gemini Flash (fast)</SelectItem>
                  <SelectItem value="gemini-pro">Gemini Pro (deep)</SelectItem>
                  <SelectItem value="gpt-mini">GPT-5 Mini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Tone</Label>
              <Select value={aiTone} onValueChange={setAiTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="analyst">Institutional analyst</SelectItem>
                  <SelectItem value="trader">Active trader</SelectItem>
                  <SelectItem value="education">Educational</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <Section
          icon={Bell}
          title="Notifications"
          desc="Choose what should ping your desk."
        >
          {[
            ["Price alerts", notifPrice, setNotifPrice],
            ["News & filings", notifNews, setNotifNews],
            ["AI signals", notifAI, setNotifAI],
          ].map(([label, v, set]) => (
            <div
              key={label as string}
              className="flex items-center justify-between rounded-lg bg-background/30 px-3 py-2"
            >
              <span className="text-sm">{label as string}</span>
              <Switch
                checked={v as boolean}
                onCheckedChange={set as (b: boolean) => void}
              />
            </div>
          ))}
        </Section>

        <Section
          icon={Star}
          title="Watchlist"
          desc="Pin symbols you want to monitor."
        >
          <div className="flex gap-2">
            <Input
              value={newSym}
              onChange={(e) => setNewSym(e.target.value.toUpperCase())}
              placeholder="Add symbol e.g. BBCA"
            />
            <Button onClick={addSymbol}>Add</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {watchlist.map((s) => (
              <button
                key={s}
                onClick={() =>
                  setWatchlist(watchlist.filter((x) => x !== s))
                }
                className="rounded-full border border-border/60 bg-accent/30 px-3 py-1 text-xs font-mono hover:border-destructive/50 hover:text-destructive"
              >
                {s} ×
              </button>
            ))}
            {watchlist.length === 0 && (
              <span className="text-xs text-muted-foreground">
                No symbols pinned yet.
              </span>
            )}
          </div>
        </Section>

        <Section
          icon={Key}
          title="API Access"
          desc="Your DataSectors API key is stored securely on the server."
        >
          <div className="space-y-2">
            <Label className="text-xs">API key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Keys never leave the server. Update via Lovable Cloud secrets.
            </p>
          </div>
        </Section>

        <Section
          icon={Globe}
          title="Markets"
          desc="Default markets shown across screens."
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {["IDX", "NYSE", "NASDAQ"].map((m) => (
              <div
                key={m}
                className="flex items-center justify-between rounded-lg bg-background/30 px-3 py-2"
              >
                <span className="text-sm font-medium">{m}</span>
                <Switch defaultChecked />
              </div>
            ))}
          </div>
        </Section>

        <div className="flex justify-end">
          <Button onClick={() => toast.success("Settings saved")}>Save changes</Button>
        </div>
      </div>
    </PageTransition>
  );
}
