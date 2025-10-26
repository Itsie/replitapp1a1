import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, Check, Calendar, Eye } from "lucide-react";
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

export default function Billing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"ZUR_ABRECHNUNG" | "ABGERECHNET">("ZUR_ABRECHNUNG");
  const [searchQuery, setSearchQuery] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");

  const { data: orders = [], isLoading } = useQuery<OrderWithRelations[]>({
    queryKey: ["/api/accounting/orders", { status: activeTab, q: searchQuery, dueFrom, dueTo }],
  });

  const settleMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("POST", `/api/accounting/orders/${orderId}/settle`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Settlement failed");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/orders"] });
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
    <>
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
                              data-testid={`button-view-${order.id}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ansehen
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => settleMutation.mutate(order.id)}
                              disabled={settleMutation.isPending}
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
    </>
  );
}
