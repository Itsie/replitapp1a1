import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ClipboardCopy, Receipt, Check, Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { OrderWithRelations } from "@shared/schema";
import type { Decimal } from "@prisma/client/runtime/library";

export default function Billing() {
  const { toast } = useToast();

  // Fetch open orders
  const { data: openOrders = [], isLoading: isLoadingOpen } = useQuery<OrderWithRelations[]>({
    queryKey: ['/api/accounting/orders', 'ZUR_ABRECHNUNG'],
    queryFn: async () => {
      const res = await fetch('/api/accounting/orders?status=ZUR_ABRECHNUNG', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch open orders');
      return res.json();
    },
  });

  // Fetch closed orders
  const { data: closedOrders = [], isLoading: isLoadingClosed } = useQuery<OrderWithRelations[]>({
    queryKey: ['/api/accounting/orders', 'ABGERECHNET'],
    queryFn: async () => {
      const res = await fetch('/api/accounting/orders?status=ABGERECHNET', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch closed orders');
      return res.json();
    },
  });

  // Mutation for updating order status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/status`, { status });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Status update failed");
      }
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/accounting/orders'] });
      toast({
        title: "Status aktualisiert",
        description: "Der Auftragsstatus wurde erfolgreich aktualisiert.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Status-Aktualisierung fehlgeschlagen.",
        variant: "destructive",
      });
    },
  });

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Kopiert",
        description: `${label} wurde in die Zwischenablage kopiert.`,
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Kopieren fehlgeschlagen.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number | string | Decimal | null) => {
    if (amount === null || amount === undefined) return "0,00 €";
    const num = typeof amount === "string" ? parseFloat(amount) : 
                typeof amount === "object" && "toNumber" in amount ? amount.toNumber() : amount;
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(num);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Calculate totals from positions using persisted line totals
  const calculateTotals = (positions: any[]) => {
    if (!positions || positions.length === 0) {
      return { net: 0, vat: 0, gross: 0 };
    }

    let totalNet = 0;
    let totalVat = 0;
    let totalGross = 0;

    positions.forEach((pos) => {
      // Use persisted line totals to avoid recalculation errors (e.g. zero VAT rates)
      // Convert to number to handle both Decimal objects and string values from JSON
      const lineNet = typeof pos.lineNet === 'object' && 'toNumber' in pos.lineNet 
        ? pos.lineNet.toNumber() 
        : Number(pos.lineNet || 0);
      const lineVat = typeof pos.lineVat === 'object' && 'toNumber' in pos.lineVat 
        ? pos.lineVat.toNumber() 
        : Number(pos.lineVat || 0);
      const lineGross = typeof pos.lineGross === 'object' && 'toNumber' in pos.lineGross 
        ? pos.lineGross.toNumber() 
        : Number(pos.lineGross || 0);
      
      totalNet += lineNet;
      totalVat += lineVat;
      totalGross += lineGross;
    });

    return {
      net: totalNet,
      vat: totalVat,
      gross: totalGross,
    };
  };

  // Format invoice address
  const formatInvoiceAddress = (order: OrderWithRelations) => {
    const lines = [];
    if (order.company) {
      lines.push(order.company);
    }
    if (order.contactFirstName || order.contactLastName) {
      lines.push(`${order.contactFirstName || ''} ${order.contactLastName || ''}`.trim());
    }
    if (order.billStreet) lines.push(order.billStreet);
    if (order.billZip || order.billCity) {
      lines.push(`${order.billZip || ''} ${order.billCity || ''}`.trim());
    }
    if (order.billCountry && order.billCountry !== 'DE') lines.push(order.billCountry);
    return lines.join('\n');
  };

  // Format contact info for copy/paste
  const formatContactInfo = (order: OrderWithRelations) => {
    const parts = [];
    if (order.customerEmail) parts.push(`E-Mail: ${order.customerEmail}`);
    if (order.customerPhone) parts.push(`Tel: ${order.customerPhone}`);
    return parts.join('\n');
  };

  return (
    <div className="w-full px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Receipt className="w-6 h-6 text-foreground" />
        <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
          Abrechnung
        </h1>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="open" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="open" data-testid="tab-open-orders">
            Offene Posten
            {openOrders.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {openOrders.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="closed" data-testid="tab-closed-orders">
            Abgerechnete Posten
            {closedOrders.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {closedOrders.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Open Orders */}
        <TabsContent value="open">
          <Card>
            <CardHeader>
              <CardTitle>Offene Posten</CardTitle>
            </CardHeader>
            <CardContent>
            {isLoadingOpen ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : openOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-open-orders">
                Keine offenen Posten zur Abrechnung
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {openOrders.map((order) => {
                  const totals = calculateTotals(order.positions || []);
                  const invoiceAddress = formatInvoiceAddress(order);
                  const contactInfo = formatContactInfo(order);

                  return (
                    <AccordionItem key={order.id} value={order.id} data-testid={`accordion-order-${order.id}`}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4 gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <span className="font-medium text-sm shrink-0">
                              {order.displayOrderNumber || order.id.substring(0, 8)}
                            </span>
                            <span className="text-sm truncate">{order.customer}</span>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <span className="text-sm text-muted-foreground">
                              {formatDate(order.deliveredAt)}
                            </span>
                            <span className="font-medium text-sm">
                              {formatCurrency(totals.gross)}
                            </span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4">
                        <div className="space-y-6">
                          {/* Contact Information */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="bg-gradient-to-br from-card to-muted/20">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm">Rechnungsadresse</CardTitle>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(invoiceAddress, "Rechnungsadresse")}
                                    data-testid={`button-copy-address-${order.id}`}
                                  >
                                    <ClipboardCopy className="w-4 h-4 mr-1" />
                                    Kopieren
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <pre className="text-sm whitespace-pre-wrap">{invoiceAddress}</pre>
                              </CardContent>
                            </Card>

                            {/* Contact Details */}
                            {contactInfo && (
                              <Card className="bg-gradient-to-br from-card to-muted/20">
                                <CardHeader className="pb-3">
                                  <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm">Kontaktdaten</CardTitle>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(contactInfo, "Kontaktdaten")}
                                      data-testid={`button-copy-contact-${order.id}`}
                                    >
                                      <ClipboardCopy className="w-4 h-4 mr-1" />
                                      Kopieren
                                    </Button>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="text-sm space-y-1">
                                    {order.customerEmail && <div>E-Mail: {order.customerEmail}</div>}
                                    {order.customerPhone && <div>Tel: {order.customerPhone}</div>}
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </div>

                          {/* Positions Table */}
                          <Card className="bg-gradient-to-br from-card to-muted/20">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm">Positionen</CardTitle>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(formatCurrency(totals.gross), "Brutto-Gesamtbetrag")}
                                  data-testid={`button-copy-total-${order.id}`}
                                >
                                  <ClipboardCopy className="w-4 h-4 mr-1" />
                                  Brutto kopieren
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent>
                              {order.positions && order.positions.length > 0 ? (
                                <>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Artikel</TableHead>
                                        <TableHead className="text-right">Menge</TableHead>
                                        <TableHead className="text-right">Einzelpreis</TableHead>
                                        <TableHead className="text-right">Gesamt</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {order.positions.map((pos, idx) => {
                                        const qty = typeof pos.qty === 'object' && 'toNumber' in pos.qty ? pos.qty.toNumber() : (pos.qty || 0);
                                        const price = typeof pos.unitPriceNet === 'object' && 'toNumber' in pos.unitPriceNet ? pos.unitPriceNet.toNumber() : (pos.unitPriceNet || 0);
                                        return (
                                          <TableRow key={idx} className={idx % 2 === 0 ? "" : "bg-muted/30"}>
                                            <TableCell>
                                              <div className="font-medium">{pos.articleName}</div>
                                              {pos.articleNumber && (
                                                <div className="text-xs text-muted-foreground">
                                                  Art.-Nr.: {pos.articleNumber}
                                                </div>
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              {qty} {pos.unit}
                                            </TableCell>
                                            <TableCell className="text-right">
                                              {formatCurrency(price)}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                              {formatCurrency(qty * price)}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                  <div className="mt-4 space-y-1 text-sm">
                                    <div className="flex justify-between">
                                      <span>Netto:</span>
                                      <span>{formatCurrency(totals.net)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>MwSt. (19%):</span>
                                      <span>{formatCurrency(totals.vat)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-base border-t pt-1">
                                      <span>Brutto-Gesamtbetrag:</span>
                                      <span>{formatCurrency(totals.gross)}</span>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="text-center text-muted-foreground py-4">
                                  Keine Positionen vorhanden
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          {/* Action Buttons */}
                          <div className="flex gap-3 justify-end pt-2">
                            <Button
                              variant="secondary"
                              onClick={() =>
                                updateStatusMutation.mutate({ orderId: order.id, status: "NACHKALKULATION" })
                              }
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-postcalc-${order.id}`}
                            >
                              <Calculator className="w-4 h-4 mr-2" />
                              Nachkalkulation erforderlich
                            </Button>
                            <Button
                              onClick={() =>
                                updateStatusMutation.mutate({ orderId: order.id, status: "ABGERECHNET" })
                              }
                              disabled={updateStatusMutation.isPending}
                              data-testid={`button-settle-${order.id}`}
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Als Abgerechnet markieren
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Closed Orders */}
        <TabsContent value="closed">
          <Card>
            <CardHeader>
              <CardTitle>Abgerechnete Posten</CardTitle>
            </CardHeader>
            <CardContent>
            {isLoadingClosed ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : closedOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-closed-orders">
                Keine abgerechneten Aufträge
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Auftrag</TableHead>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Ausgeliefert am</TableHead>
                      <TableHead>Abgerechnet am</TableHead>
                      <TableHead className="text-right">Gesamtbetrag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {closedOrders.map((order) => {
                      const totals = calculateTotals(order.positions || []);
                      return (
                        <TableRow key={order.id} data-testid={`row-closed-${order.id}`}>
                          <TableCell className="font-medium">
                            {order.displayOrderNumber || order.id.substring(0, 8)}
                          </TableCell>
                          <TableCell>{order.customer}</TableCell>
                          <TableCell>{formatDate(order.deliveredAt)}</TableCell>
                          <TableCell>{formatDate(order.settledAt)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(totals.gross)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
