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
import { ThemeToggle } from "./theme-toggle";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center px-6">
          <div className="mr-4 flex items-center">
            <a href="/" className="mr-6 flex items-center space-x-2">
              <span className="font-bold text-lg" data-testid="text-app-title">1aShirt</span>
            </a>
          </div>
          
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              <div className="relative hidden md:block">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Suche..."
                  className="w-full md:w-[300px] lg:w-[400px] pl-8"
                  data-testid="input-global-search"
                />
              </div>
            </div>
            
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
        </div>
      </header>
      
      <main className="container max-w-7xl mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  );
}
