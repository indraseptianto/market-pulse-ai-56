import { cn } from "@/lib/utils";

interface RateLimitIndicatorProps {
  used: number;
  limit: number;
  className?: string;
}

export function RateLimitIndicator({ used, limit, className }: RateLimitIndicatorProps) {
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  const isWarning = pct >= 80;
  const isDanger = pct >= 95;

  return (
    <div className={cn("flex items-center gap-1.5 text-[11px]", className)}>
      <span className="text-muted-foreground">API:</span>
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isDanger ? "bg-destructive" : isWarning ? "bg-warning" : "bg-success"
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={cn(isDanger ? "text-destructive" : isWarning ? "text-warning" : "text-muted-foreground")}>
        {used}/{limit}
      </span>
    </div>
  );
}
