import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AppSidebar } from "./app-sidebar";
import { ThemeToggle } from "./theme-toggle";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  
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
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem data-testid="menu-profile">Profil</DropdownMenuItem>
                  <DropdownMenuItem data-testid="menu-settings">Einstellungen</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem data-testid="menu-logout">Abmelden</DropdownMenuItem>
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
