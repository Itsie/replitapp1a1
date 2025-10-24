import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import OrdersList from "@/pages/orders-list";
import OrderNew from "@/pages/order-new";
import OrderDetail from "@/pages/order-detail";

function Router() {
  return (
    <Switch>
      <Route path="/" component={OrdersList} />
      <Route path="/orders" component={OrdersList} />
      <Route path="/orders/new" component={OrderNew} />
      <Route path="/orders/:id" component={OrderDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
