import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { AppLayout } from "@/components/app-layout";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import ProfilePage from "@/pages/profile";
import UserManagementPage from "@/pages/user-management";
import OrdersList from "@/pages/orders-list-improved";
import OrderNew from "@/pages/order-new";
import OrderDetail from "@/pages/order-detail";
import Planning from "@/pages/planning";
import ProductionToday from "@/pages/production-today";
import MissingPartsPage from "@/pages/missing-parts";
import Billing from "@/pages/billing";
import Lager from "@/pages/lager";
import LagerDetail from "@/pages/lager-detail";
import Settings from "@/pages/settings";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useUser();
  
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Laden...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Redirect to="/login" />;
  }
  
  return <Component {...rest} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        {(params) => (
          <AppLayout>
            <ProtectedRoute component={OrdersList} {...params} />
          </AppLayout>
        )}
      </Route>
      <Route path="/orders">
        {(params) => (
          <AppLayout>
            <ProtectedRoute component={OrdersList} {...params} />
          </AppLayout>
        )}
      </Route>
      <Route path="/orders/new">
        {(params) => (
          <AppLayout>
            <ProtectedRoute component={OrderNew} {...params} />
          </AppLayout>
        )}
      </Route>
      <Route path="/orders/:id">
        {(params) => (
          <AppLayout>
            <ProtectedRoute component={OrderDetail} {...params} />
          </AppLayout>
        )}
      </Route>
      <Route path="/planning">
        {(params) => (
          <AppLayout>
            <ProtectedRoute component={Planning} {...params} />
          </AppLayout>
        )}
      </Route>
      <Route path="/production-today">
        {(params) => (
          <AppLayout>
            <ProtectedRoute component={ProductionToday} {...params} />
          </AppLayout>
        )}
      </Route>
      <Route path="/missing-parts">
        {(params) => (
          <AppLayout>
            <ProtectedRoute component={MissingPartsPage} {...params} />
          </AppLayout>
        )}
      </Route>
      <Route path="/billing">
        {(params) => (
          <AppLayout>
            <ProtectedRoute component={Billing} {...params} />
          </AppLayout>
        )}
      </Route>
      <Route path="/lager">
        {(params) => (
          <AppLayout>
            <ProtectedRoute component={Lager} {...params} />
          </AppLayout>
        )}
      </Route>
      <Route path="/lager/:id">
        {(params) => (
          <AppLayout>
            <ProtectedRoute component={LagerDetail} {...params} />
          </AppLayout>
        )}
      </Route>
      <Route path="/settings">
        {(params) => (
          <AppLayout>
            <ProtectedRoute component={Settings} {...params} />
          </AppLayout>
        )}
      </Route>
      <Route path="/profile">
        {(params) => (
          <AppLayout>
            <ProtectedRoute component={ProfilePage} {...params} />
          </AppLayout>
        )}
      </Route>
      <Route path="/users">
        {(params) => (
          <AppLayout>
            <ProtectedRoute component={UserManagementPage} {...params} />
          </AppLayout>
        )}
      </Route>
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
            <Router />
            <Toaster />
          </TooltipProvider>
        </UserProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
