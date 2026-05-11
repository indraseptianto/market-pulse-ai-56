import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Filter,
  LineChart,
  Newspaper,
  Calendar,
  Bitcoin,
  DollarSign,
  Star,
  Settings as SettingsIcon,
  Sparkles,
  Activity,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const mainItems = [
  { title: "Dashboard",      url: "/",          icon: LayoutDashboard },
  { title: "Advanced Chart", url: "/chart",     icon: LineChart       },
  { title: "Screener",       url: "/screener",  icon: Filter          },
  { title: "Watchlist",      url: "/watchlist", icon: Star            },
];

const analyticsItems = [
  { title: "Technical Scanner",  url: "/technical", icon: Activity  },
  { title: "News & Sentiment",   url: "/news",      icon: Newspaper },
  { title: "Economic Calendar",  url: "/calendar",  icon: Calendar  },
];

const marketsItems = [
  { title: "Crypto", url: "/crypto", icon: Bitcoin                          },
  { title: "Forex",  url: "/forex",  icon: DollarSign, soon: true as const  },
];

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  soon?: true;
};

export function AppSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

  const renderItem = (item: NavItem) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton
        asChild
        isActive={isActive(item.url)}
        tooltip={item.title}
        className="h-9"
      >
        {item.soon ? (
          <button
            type="button"
            disabled
            className="flex w-full items-center gap-2.5 opacity-40 cursor-not-allowed"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left text-sm">{item.title}</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
              Soon
            </Badge>
          </button>
        ) : (
          <Link to={item.url} className="flex items-center gap-2.5">
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="text-sm">{item.title}</span>
          </Link>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      {/* Brand */}
      <SidebarHeader className="pb-2">
        <Link
          to="/"
          className="flex items-center gap-2.5 px-2 py-3 rounded-lg transition-colors hover:bg-accent/50 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary glow">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold tracking-tight leading-none">Stratum</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
              Stock Intelligence
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="pt-2">
        {/* Main */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest px-3 mb-1">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{mainItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Analytics */}
        <SidebarGroup className="mt-2">
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest px-3 mb-1">
            Analytics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{analyticsItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Markets */}
        <SidebarGroup className="mt-2">
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest px-3 mb-1">
            Markets
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{marketsItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      {/* Footer */}
      <SidebarFooter className="pt-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/settings")}
              tooltip="Settings"
              className="h-9"
            >
              <Link to="/settings" className="flex items-center gap-2.5">
                <SettingsIcon className="h-4 w-4 shrink-0" />
                <span className="text-sm">Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
