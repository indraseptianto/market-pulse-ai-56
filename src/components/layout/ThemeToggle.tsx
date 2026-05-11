import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEMES: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "dark",   label: "Dark",   icon: <Moon    className="h-3.5 w-3.5" /> },
  { value: "light",  label: "Light",  icon: <Sun     className="h-3.5 w-3.5" /> },
  { value: "system", label: "System", icon: <Monitor className="h-3.5 w-3.5" /> },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const current = THEMES.find((t) => t.value === theme) ?? THEMES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Toggle theme"
        >
          {current.icon}
          <span className="hidden sm:inline">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => setTheme(t.value)}
            className="flex items-center gap-2 cursor-pointer"
          >
            {t.icon}
            <span>{t.label}</span>
            {theme === t.value && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
