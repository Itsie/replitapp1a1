import { Link, useLocation } from "wouter";
import {
  Package,
  Calendar,
  Factory,
  FileText,
  Warehouse,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Aufträge",
    url: "/orders",
    icon: Package,
  },
  {
    title: "Planung",
    url: "/planning",
    icon: Calendar,
  },
  {
    title: "Produktion heute",
    url: "/production/today",
    icon: Factory,
  },
  {
    title: "Abrechnung",
    url: "/billing",
    icon: FileText,
  },
  {
    title: "Lager",
    url: "/warehouse",
    icon: Warehouse,
  },
  {
    title: "Einstellungen",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  
  // Extract pathname without query string for matching
  const pathname = location.split('?')[0];

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                // Check if current pathname matches the nav item
                // Special case: "/" should highlight /orders
                const isActive = 
                  pathname === item.url || 
                  pathname.startsWith(item.url + "/") ||
                  (pathname === "/" && item.url === "/orders");
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} data-testid={`nav-${item.url}`}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
