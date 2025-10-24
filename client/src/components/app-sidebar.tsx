import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  FileText,
  CalendarClock,
  Activity,
  Receipt,
  Boxes,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  title: string;
  url: string;
  icon: typeof FileText;
}

const navigationSections: NavSection[] = [
  {
    label: "Verwaltung",
    items: [
      {
        title: "Aufträge",
        url: "/orders",
        icon: FileText,
      },
    ],
  },
  {
    label: "Produktion",
    items: [
      {
        title: "Planung",
        url: "/planning",
        icon: CalendarClock,
      },
      {
        title: "Produktion heute",
        url: "/production/today",
        icon: Activity,
      },
    ],
  },
  {
    label: "Abwicklung",
    items: [
      {
        title: "Abrechnung",
        url: "/billing",
        icon: Receipt,
      },
      {
        title: "Lager",
        url: "/warehouse",
        icon: Boxes,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        title: "Einstellungen",
        url: "/settings",
        icon: Settings,
      },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("nav_collapsed");
    return saved === "true";
  });

  // Extract pathname without query string for matching
  const pathname = location.split("?")[0];

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem("nav_collapsed", String(collapsed));
  }, [collapsed]);

  const isActive = (url: string) => {
    return (
      pathname === url ||
      pathname.startsWith(url + "/") ||
      (pathname === "/" && url === "/orders")
    );
  };

  return (
    <div
      className={`flex h-screen shrink-0 flex-col border-r bg-muted/40 transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Branding */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        {!collapsed && (
          <>
            <div className="text-lg font-semibold tracking-tight">1aShirt</div>
            <span className="text-xs text-muted-foreground">Produktion</span>
          </>
        )}
        {collapsed && (
          <div className="text-lg font-semibold tracking-tight">1a</div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navigationSections.map((section, sectionIndex) => (
          <div key={section.label}>
            {sectionIndex > 0 && <div className="my-2 border-t" />}
            
            {!collapsed && (
              <div className="px-4 pt-4 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                {section.label}
              </div>
            )}

            {section.items.map((item) => {
              const active = isActive(item.url);
              const Icon = item.icon;

              const navItem = (
                <Link href={item.url} key={`link-${item.url}`}>
                  <a
                    className={`relative mx-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-muted/70 text-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    data-testid={`nav-${item.url}`}
                  >
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r bg-primary" />
                    )}
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.title}</span>}
                  </a>
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={`tooltip-${item.url}`}>
                    <TooltipTrigger asChild>{navItem}</TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{item.title}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return <div key={`nav-${item.url}`}>{navItem}</div>;
            })}
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t p-2">
        {collapsed ? (
          <Button
            variant="ghost"
            size="icon"
            className="w-full"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Sidebar ausklappen"
            data-testid="button-sidebar-collapse"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Sidebar einklappen"
            data-testid="button-sidebar-collapse"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            <span className="text-xs">Einklappen</span>
          </Button>
        )}
      </div>
    </div>
  );
}
