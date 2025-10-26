import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { UserProvider } from "@/contexts/UserContext";
import { AppLayout } from "@/components/app-layout";
import NotFound from "@/pages/not-found";
import OrdersList from "@/pages/orders-list-improved";
import OrderNew from "@/pages/order-new";
import OrderDetail from "@/pages/order-detail";
import Planning from "@/pages/planning";
import ProductionToday from "@/pages/production-today";
import Billing from "@/pages/billing";
import Warehouse from "@/pages/warehouse";
import Settings from "@/pages/settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={OrdersList} />
      <Route path="/orders" component={OrdersList} />
      <Route path="/orders/new" component={OrderNew} />
      <Route path="/orders/:id" component={OrderDetail} />
      <Route path="/planning" component={Planning} />
      <Route path="/production/today" component={ProductionToday} />
      <Route path="/billing" component={Billing} />
      <Route path="/warehouse" component={Warehouse} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="1ashirt-ui-theme">
        <UserProvider>
          <TooltipProvider>
            <AppLayout>
              <Router />
            </AppLayout>
            <Toaster />
          </TooltipProvider>
        </UserProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
