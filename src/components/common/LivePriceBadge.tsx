// ── LivePriceBadge — shows live/delayed status + last update time ─────────────
import { useEffect, useState } from "react";
import { isIDXTradingHours } from "@/hooks/use-live-price";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";

interface Props {
  lastUpdated: Date | null;
  isFetching: boolean;
  onRefresh?: () => void;
  compact?: boolean;
}

function timeAgoShort(d: Date): string {
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 10) return "baru saja";
  if (secs < 60) return `${secs}d lalu`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m lalu`;
  return `${Math.floor(mins / 60)}j lalu`;
}

export function LivePriceBadge({ lastUpdated, isFetching, onRefresh, compact = false }: Props) {
  const [, tick] = useState(0);
  const isLive = isIDXTradingHours();

  // Re-render every 10s to update "X seconds ago"
  useEffect(() => {
    const id = setInterval(() => tick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {isLive ? (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
        ) : (
          <WifiOff className="h-3 w-3 text-muted-foreground" />
        )}
        <span className={`text-[10px] font-medium ${isLive ? "text-gain" : "text-muted-foreground"}`}>
          {isLive ? "Live" : "Delayed"}
        </span>
        {lastUpdated && (
          <span className="text-[10px] text-muted-foreground">
            · {timeAgoShort(lastUpdated)}
          </span>
        )}
        {onRefresh && (
          <button onClick={onRefresh} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] ${
      isLive
        ? "border-success/30 bg-success/10 text-gain"
        : "border-border/40 bg-background/40 text-muted-foreground"
    }`}>
      {isLive ? (
        <>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          <span className="font-medium">Live</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Market Tutup</span>
        </>
      )}
      {lastUpdated && (
        <span className="text-muted-foreground">· {timeAgoShort(lastUpdated)}</span>
      )}
      {onRefresh && (
        <button onClick={onRefresh} className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      )}
    </div>
  );
}
