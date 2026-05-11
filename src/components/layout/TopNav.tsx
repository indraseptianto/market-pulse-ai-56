import { SidebarTrigger } from "@/components/ui/sidebar";
import { CommandPalette } from "./CommandPalette";
import { ThemeToggle } from "./ThemeToggle";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function TopNav() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur-md md:px-4">
      {/* Left: sidebar trigger */}
      <SidebarTrigger className="shrink-0" />

      <Separator orientation="vertical" className="h-5 opacity-40" />

      {/* Live market badge */}
      <div className="hidden md:flex items-center gap-2">
        <Badge
          variant="outline"
          className="gap-1.5 border-success/40 bg-success/5 text-success text-[11px] px-2 py-0.5"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          Live
        </Badge>
        <span className="text-[11px] text-muted-foreground font-medium">
          IDX · NYSE · NASDAQ
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right: search + theme + notifications */}
      <div className="flex items-center gap-1">
        <CommandPalette />

        <Separator orientation="vertical" className="h-5 opacity-40 mx-1" />

        {/* Theme toggle */}
        <ThemeToggle />

        <Separator orientation="vertical" className="h-5 opacity-40 mx-1" />

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
