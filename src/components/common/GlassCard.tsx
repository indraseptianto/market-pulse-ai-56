import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function GlassCard({
  children,
  className,
  ...props
}: { children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass rounded-2xl p-5 transition-all hover:border-primary/30",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
