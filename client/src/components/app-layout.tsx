import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, User, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AppSidebar } from "./app-sidebar";
import { ThemeToggle } from "./theme-toggle";
import { useUser, setMockUser } from "@/contexts/UserContext";

const DEMO_USERS = [
  { email: 'admin@1ashirt.de', name: 'Admin User', role: 'ADMIN' },
  { email: 'planner@1ashirt.de', name: 'Planer', role: 'PROD_PLAN' },
  { email: 'worker@1ashirt.de', name: 'Produktionsmitarbeiter', role: 'PROD_RUN' },
  { email: 'sales@1ashirt.de', name: 'Vertrieb', role: 'SALES_OPS' },
  { email: 'accounting@1ashirt.de', name: 'Buchhaltung', role: 'ACCOUNTING' },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user } = useUser();
  
  // Sync search query with URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const urlQuery = urlParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  
  // Update search query when URL changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") || "";
    setSearchQuery(q);
  }, [location]);

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Navigate to orders page with or without search query
    if (searchQuery.trim()) {
      setLocation(`/orders?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      // Clear search by navigating to /orders without query params
      setLocation("/orders");
    }
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 h-14 border-b bg-background/80 backdrop-blur">
          <div className="flex h-full items-center px-6 gap-4">
            {/* Center: Global Search */}
            <form onSubmit={handleGlobalSearch} className="flex-1 flex justify-center">
              <div className="relative w-full md:w-[520px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Globale Suche..."
                  className="w-full pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-global-search"
                />
              </div>
            </form>
            
            {/* Right: Theme Toggle + User Menu */}
            <nav className="flex items-center gap-2">
              <ThemeToggle />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative" data-testid="button-user-menu">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {user ? getUserInitials(user.name) : <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {user && (
                    <>
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                          <p className="text-xs text-muted-foreground" data-testid="text-current-role">Rolle: {user.role}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Benutzer wechseln (Dev)</DropdownMenuLabel>
                  {DEMO_USERS.map((demoUser) => (
                    <DropdownMenuItem
                      key={demoUser.email}
                      onClick={() => setMockUser(demoUser.email)}
                      data-testid={`menu-switch-${demoUser.role.toLowerCase()}`}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {user?.email === demoUser.email && <Check className="h-4 w-4 shrink-0" />}
                        {user?.email !== demoUser.email && <span className="w-4 shrink-0" />}
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-sm truncate">{demoUser.name}</span>
                          <span className="text-xs text-muted-foreground">{demoUser.role}</span>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="menu-settings">Einstellungen</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>
        </header>
        
        {/* Main Content */}
        <main className="flex-1 w-full min-w-0 overflow-auto">
          <div className="w-full px-4 md:px-6 py-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
