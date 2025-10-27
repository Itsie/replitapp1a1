import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, Check, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { OrderWithRelations } from "@shared/schema";

// Demo data for development when API returns empty
const DEMO_ORDERS: Partial<OrderWithRelations>[] = [
  {
    id: "demo-1",
    displayOrderNumber: "2024-001",
    title: "Team Trikots FC Musterhausen",
    customer: "FC Musterhausen e.V.",
    totalGross: 1250.50,
    deliveredAt: new Date("2025-01-15").toISOString(),
    deliveredQty: 25,
    workflow: "ZUR_ABRECHNUNG" as any,
  },
  {
    id: "demo-2",
    displayOrderNumber: "2024-002",
    title: "Vereinsshirts SV Beispiel",
    customer: "SV Beispiel",
    totalGross: 890.00,
    deliveredAt: new Date("2025-01-18").toISOString(),
    deliveredQty: 18,
    workflow: "ZUR_ABRECHNUNG" as any,
  },
  {
    id: "demo-3",
    displayOrderNumber: "2024-003",
    title: "Firmen Polo-Shirts",
    customer: "Musterfirma GmbH",
    totalGross: 2100.75,
    deliveredAt: new Date("2025-01-20").toISOString(),
    deliveredQty: 50,
    workflow: "ZUR_ABRECHNUNG" as any,
  },
];

export default function Billing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"ZUR_ABRECHNUNG" | "ABGERECHNET">("ZUR_ABRECHNUNG");
  const [searchQuery, setSearchQuery] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");

  const buildQueryKey = () => {
    const params = new URLSearchParams();
    if (activeTab) params.append("status", activeTab);
    if (searchQuery) params.append("q", searchQuery);
    if (dueFrom) params.append("dueFrom", dueFrom);
    if (dueTo) params.append("dueTo", dueTo);
    const queryString = params.toString();
    return queryString ? `/api/accounting/orders?${queryString}` : "/api/accounting/orders";
  };

  const { data: apiOrders = [], isLoading } = useQuery<OrderWithRelations[]>({
    queryKey: [buildQueryKey()],
  });

  // Use demo data in development if API returns empty
  const orders = useMemo(() => {
    const isDev = import.meta.env.DEV;
    if (isDev && apiOrders.length === 0 && activeTab === "ZUR_ABRECHNUNG") {
      return DEMO_ORDERS as OrderWithRelations[];
    }
    return apiOrders;
  }, [apiOrders, activeTab]);

  const settleMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // Handle demo orders differently
      if (orderId.startsWith('demo-')) {
        throw new Error("Demo-Auftrag kann nicht abgerechnet werden");
      }
      
      const res = await apiRequest("POST", `/api/accounting/orders/${orderId}/settle`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Settlement failed");
      }
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/accounting/orders');
        }
      });
      toast({
        title: "Als abgerechnet markiert",
        description: "Der Auftrag wurde erfolgreich als abgerechnet markiert.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Abrechnung fehlgeschlagen.",
        variant: "destructive",
      });
    },
  });

  // Helper to check if order is a demo order
  const isDemoOrder = (orderId: string) => orderId.startsWith('demo-');

  const formatDate = (date: string | Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number | string | null) => {
    if (amount === null) return "—";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(num);
  };

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-billing-title">Abrechnung</h1>
        <p className="text-muted-foreground mt-1">
          Rechnungsstellung und Abrechnungsverwaltung
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Aufträge zur Abrechnung</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
            <TabsList data-testid="tabs-billing">
              <TabsTrigger value="ZUR_ABRECHNUNG" data-testid="tab-open">
                Offen
              </TabsTrigger>
              <TabsTrigger value="ABGERECHNET" data-testid="tab-settled">
                Abgerechnet
              </TabsTrigger>
            </TabsList>

            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Suche nach Auftragsnummer, Kunde..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  type="date"
                  placeholder="Von"
                  value={dueFrom}
                  onChange={(e) => setDueFrom(e.target.value)}
                  className="w-[150px]"
                  data-testid="input-date-from"
                />
                <Input
                  type="date"
                  placeholder="Bis"
                  value={dueTo}
                  onChange={(e) => setDueTo(e.target.value)}
                  className="w-[150px]"
                  data-testid="input-date-to"
                />
              </div>
            </div>

            <TabsContent value="ZUR_ABRECHNUNG" className="space-y-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-open-orders">
                  Keine offenen Aufträge zur Abrechnung
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Auftragsnummer</TableHead>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Ausgegeben am</TableHead>
                      <TableHead>Menge</TableHead>
                      <TableHead className="text-right">Gesamtbetrag</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                        <TableCell className="font-mono text-sm">
                          {order.displayOrderNumber || "—"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.customer}</div>
                            <div className="text-xs text-muted-foreground">{order.title}</div>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(order.deliveredAt)}</TableCell>
                        <TableCell>
                          {order.deliveredQty ? `${order.deliveredQty} Stk.` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(order.totalGross)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLocation(`/orders/${order.id}`)}
                              aria-label={`Auftrag ${order.displayOrderNumber || order.id} ansehen`}
                              data-testid={`button-view-${order.id}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ansehen
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => settleMutation.mutate(order.id)}
                              disabled={settleMutation.isPending || isDemoOrder(order.id)}
                              aria-label={
                                isDemoOrder(order.id)
                                  ? "Demo-Auftrag kann nicht abgerechnet werden"
                                  : `Auftrag ${order.displayOrderNumber || order.id} als abgerechnet markieren`
                              }
                              title={isDemoOrder(order.id) ? "Demo-Auftrag kann nicht abgerechnet werden" : ""}
                              data-testid={`button-settle-${order.id}`}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Als abgerechnet markieren
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="ABGERECHNET" className="space-y-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-settled-orders">
                  Keine abgerechneten Aufträge
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Auftragsnummer</TableHead>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Ausgegeben am</TableHead>
                      <TableHead>Abgerechnet am</TableHead>
                      <TableHead>Menge</TableHead>
                      <TableHead className="text-right">Gesamtbetrag</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                        <TableCell className="font-mono text-sm">
                          {order.displayOrderNumber || "—"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{order.customer}</div>
                            <div className="text-xs text-muted-foreground">{order.title}</div>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(order.deliveredAt)}</TableCell>
                        <TableCell>{formatDate(order.settledAt)}</TableCell>
                        <TableCell>
                          {order.deliveredQty ? `${order.deliveredQty} Stk.` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(order.totalGross)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLocation(`/orders/${order.id}`)}
                            aria-label={`Auftrag ${order.displayOrderNumber || order.id} ansehen`}
                            data-testid={`button-view-${order.id}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ansehen
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
