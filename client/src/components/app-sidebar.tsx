import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  FileText,
  CalendarClock,
  Activity,
  AlertCircle,
  Receipt,
  Boxes,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUser, type Role } from "@/contexts/UserContext";
import logoImage from "@assets/1a-textillogo_1761317866259.png";

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  title: string;
  url: string;
  icon: typeof FileText;
  roles?: Role[]; // If undefined, visible to all roles
}

const navigationSections: NavSection[] = [
  {
    label: "Verwaltung",
    items: [
      {
        title: "Aufträge",
        url: "/orders",
        icon: FileText,
        roles: ['ADMIN', 'SALES_OPS'], // Only admin and sales can manage orders
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
        roles: ['ADMIN', 'PROD_PLAN'],
      },
      {
        title: "Produktion",
        url: "/production-today",
        icon: Activity,
        roles: ['ADMIN', 'PROD_RUN'],
      },
      {
        title: "Fehlteile",
        url: "/missing-parts",
        icon: AlertCircle,
        roles: ['ADMIN', 'PROD_PLAN'],
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
        roles: ['ADMIN', 'ACCOUNTING'],
      },
      {
        title: "Lager",
        url: "/lager",
        icon: Boxes,
        roles: ['ADMIN', 'LAGER'], // Admin and warehouse role
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        title: "Benutzerverwaltung",
        url: "/users",
        icon: Users,
        roles: ['ADMIN'], // Only admin can access user management
      },
      {
        title: "Einstellungen",
        url: "/settings",
        icon: Settings,
        roles: ['ADMIN'], // Only admin can access settings
      },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, hasRole } = useUser();
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

  // Filter navigation based on user role
  const canAccessItem = (item: NavItem): boolean => {
    if (!item.roles || item.roles.length === 0) return true; // No role restriction
    if (!user) return false; // Not logged in
    return hasRole(...item.roles);
  };

  const filteredSections = navigationSections
    .map(section => ({
      ...section,
      items: section.items.filter(canAccessItem),
    }))
    .filter(section => section.items.length > 0); // Remove empty sections

  return (
    <div
      className={`flex h-screen shrink-0 flex-col border-r bg-muted/40 transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Branding */}
      <div className="flex h-20 items-center border-b px-0.5 py-2">
        {!collapsed && (
          <img 
            src={logoImage} 
            alt="1aShirt Logo" 
            className="w-full h-auto max-h-16 object-contain brightness-0 dark:brightness-100"
          />
        )}
        {collapsed && (
          <img 
            src={logoImage} 
            alt="1a" 
            className="w-full h-auto max-h-16 object-contain brightness-0 dark:brightness-100"
          />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {filteredSections.map((section, sectionIndex) => (
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
                <Link 
                  href={item.url}
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
