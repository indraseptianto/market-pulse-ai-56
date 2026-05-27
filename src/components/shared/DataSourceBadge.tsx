import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DataSource = "ds" | "client" | "mock" | "tiingo";

interface DataSourceBadgeProps {
  source: DataSource;
  className?: string;
}

const SOURCE_CONFIG: Record<DataSource, { label: string; className: string }> = {
  ds: { label: "DS", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  client: { label: "Client", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  mock: { label: "Mock", className: "bg-muted text-muted-foreground border-border" },
  tiingo: { label: "Tiingo", className: "bg-green-500/15 text-green-400 border-green-500/30" },
};

export function DataSourceBadge({ source, className }: DataSourceBadgeProps) {
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.mock;
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", config.className, className)}>
      {config.label}
    </Badge>
  );
}
