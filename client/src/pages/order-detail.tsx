import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Check, AlertTriangle, Copy, Plus, ExternalLink, Pencil, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type { OrderWithRelations } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function OrderDetail() {
  const [, params] = useRoute("/orders/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const orderId = params?.id;
  
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false);
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const { data: order, isLoading } = useQuery<OrderWithRelations>({
    queryKey: [`/api/orders/${orderId}`],
    enabled: !!orderId,
  });
  
  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/submit`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const error: any = new Error(errorData.error || "Submit failed");
        error.status = res.status;
        throw error;
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Auftrag freigegeben",
        description: "Der Auftrag wurde für die Produktion freigegeben.",
      });
      setConfirmSubmitOpen(false);
      setSubmitError(null);
    },
    onError: (error: any) => {
      const message = error.message || "Der Auftrag konnte nicht freigegeben werden.";
      
      if (error.status === 412) {
        setSubmitError(message);
        setConfirmSubmitOpen(false);
        setActiveTab("assets");
      } else {
        toast({
          title: "Fehler",
          description: message,
          variant: "destructive",
        });
      }
    },
  });
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Kopiert",
      description: "Auftragsnummer wurde in die Zwischenablage kopiert.",
    });
  };
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-10 w-48" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }
  
  if (!order) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Auftrag nicht gefunden</h3>
          <p className="text-sm text-muted-foreground mb-4" data-testid="text-not-found">
            Der angeforderte Auftrag existiert nicht oder wurde gelöscht.
          </p>
          <Button onClick={() => setLocation("/orders")}>
            Zurück zur Übersicht
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  const formatDate = (date: string | Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getWorkflowBadgeVariant = (workflow: string): "default" | "secondary" | "destructive" | "outline" => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ENTWURF: "outline",
      NEU: "default",
      PRUEFUNG: "secondary",
      FUER_PROD: "default",
      IN_PROD: "default",
      WARTET_FEHLTEILE: "destructive",
      FERTIG: "default",
      ZUR_ABRECHNUNG: "secondary",
      ABGERECHNET: "default",
    };
    return map[workflow] || "outline";
  };

  const getSourceBadgeVariant = (source: string): "default" | "secondary" => {
    return source === "JTL" ? "secondary" : "default";
  };

  const hasShippingAddress = !!(order.shipStreet || order.shipZip || order.shipCity || order.shipCountry);
  const hasPositions = (order.positions?.length || 0) > 0;
  const hasRequiredAssets = order.printAssets.some(a => a.required);
  const hasSizeTable = !!order.sizeTable;
  const isTeamsport = order.department === "TEAMSPORT";
  const canSubmitOrder = hasPositions && hasRequiredAssets && (!isTeamsport || hasSizeTable);
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-[1600px] 2xl:max-w-[1920px] mx-auto px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => setLocation("/orders")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight" data-testid="text-order-title">
                  {order.title}
                </h1>
                {order.displayOrderNumber && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(order.displayOrderNumber!)}
                    data-testid="button-copy-ordernumber"
                  >
                    <span className="font-mono text-sm">{order.displayOrderNumber}</span>
                    <Copy className="h-3 w-3 ml-2" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={getWorkflowBadgeVariant(order.workflow)} data-testid="badge-workflow">
                  {order.workflow}
                </Badge>
                <Badge variant={getSourceBadgeVariant(order.source)} data-testid="badge-source">
                  {order.source}
                </Badge>
              </div>
            </div>

            {order.workflow !== "FUER_PROD" && order.workflow !== "IN_PROD" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      onClick={() => setConfirmSubmitOpen(true)}
                      disabled={!canSubmitOrder}
                      data-testid="button-submit"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Für Produktion freigeben
                    </Button>
                  </div>
                </TooltipTrigger>
                {!canSubmitOrder && (
                  <TooltipContent>
                    <p>
                      {!hasPositions && !hasRequiredAssets
                        ? "Positionen und Druckdaten fehlen"
                        : !hasPositions
                        ? "Positionen fehlen"
                        : !hasRequiredAssets
                        ? "Benötigte Druckdaten fehlen"
                        : "Größentabelle erforderlich für TEAMSPORT"}
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1600px] 2xl:max-w-[1920px] mx-auto px-6 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList data-testid="tabs-list">
              <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
              <TabsTrigger value="sizes" data-testid="tab-sizes">Größen</TabsTrigger>
              <TabsTrigger value="assets" data-testid="tab-assets">Druckdaten</TabsTrigger>
              <TabsTrigger value="history" data-testid="tab-history">Historie</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details">
              {submitError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}
              
              <div className="grid lg:grid-cols-12 gap-4">
                {/* Left Column - Customer Info */}
                <div className="lg:col-span-8 space-y-4">
                  {/* Customer Card */}
                  <Card className="rounded-2xl border-muted/60">
                    <CardHeader>
                      <CardTitle>Kunde</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">FIRMA</Label>
                        <p data-testid="text-company">{order.company || "—"}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">ANSPRECHPARTNER</Label>
                        <p data-testid="text-contact">
                          {order.contactFirstName && order.contactLastName
                            ? `${order.contactFirstName} ${order.contactLastName}`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">E-MAIL</Label>
                        {order.customerEmail ? (
                          <a
                            href={`mailto:${order.customerEmail}`}
                            className="text-primary hover:underline"
                            data-testid="link-email"
                          >
                            {order.customerEmail}
                          </a>
                        ) : (
                          <p>—</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">TELEFON</Label>
                        {order.customerPhone ? (
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="text-primary hover:underline"
                            data-testid="link-phone"
                          >
                            {order.customerPhone}
                          </a>
                        ) : (
                          <p>—</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Billing Address Card */}
                  <Card className="rounded-2xl border-muted/60">
                    <CardHeader>
                      <CardTitle>Rechnungsadresse</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <p data-testid="text-bill-street">{order.billStreet || "—"}</p>
                      <p data-testid="text-bill-city">
                        {order.billZip && order.billCity ? `${order.billZip} ${order.billCity}` : "—"}
                      </p>
                      <p data-testid="text-bill-country">{order.billCountry || "—"}</p>
                    </CardContent>
                  </Card>
                  
                  {/* Shipping Address Card (if different) */}
                  {hasShippingAddress && (
                    <Card className="rounded-2xl border-muted/60">
                      <CardHeader>
                        <CardTitle>Lieferadresse</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        <p data-testid="text-ship-street">{order.shipStreet || "—"}</p>
                        <p data-testid="text-ship-city">
                          {order.shipZip && order.shipCity ? `${order.shipZip} ${order.shipCity}` : "—"}
                        </p>
                        <p data-testid="text-ship-country">{order.shipCountry || "—"}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
                
                {/* Right Column - Order Data */}
                <div className="lg:col-span-4 space-y-4">
                  {/* Order Details Card */}
                  <Card className="rounded-2xl border-muted/60">
                    <CardHeader>
                      <CardTitle>Auftrag</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">ABTEILUNG</Label>
                        <div>
                          <Badge variant="outline" data-testid="badge-department">{order.department}</Badge>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">QUELLE</Label>
                        <div>
                          <Badge variant={getSourceBadgeVariant(order.source)} data-testid="badge-source-detail">
                            {order.source}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">WORKFLOW</Label>
                        <div>
                          <Badge variant={getWorkflowBadgeVariant(order.workflow)} data-testid="badge-workflow-detail">
                            {order.workflow}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">FÄLLIGKEITSDATUM</Label>
                        <p data-testid="text-duedate">{formatDate(order.dueDate)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">STANDORT</Label>
                        <p data-testid="text-location">{order.location || "—"}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">ERSTELLT AM</Label>
                        <p data-testid="text-created">{formatDate(order.createdAt)}</p>
                      </div>
                      {order.notes && (
                        <div>
                          <Label className="text-xs text-muted-foreground">NOTIZEN</Label>
                          <p className="text-sm whitespace-pre-wrap" data-testid="text-notes">{order.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  {/* Attachments Card */}
                  <Card className="rounded-2xl border-muted/60">
                    <CardHeader>
                      <CardTitle>Anhänge</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">DRUCKDATEN</Label>
                        <p data-testid="text-assets-summary">
                          {order.printAssets.length === 0 ? (
                            "Keine Druckdaten vorhanden"
                          ) : (
                            <>
                              {order.printAssets.filter(a => a.required).length} erforderlich / {" "}
                              {order.printAssets.filter(a => !a.required).length} optional
                            </>
                          )}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">GRÖẞENTABELLE</Label>
                        <p data-testid="text-sizetable-summary">
                          {order.sizeTable ? "Vorhanden" : "Nicht vorhanden"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab("assets")}
                        className="w-full"
                        data-testid="button-open-assets"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Druckdaten öffnen
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Full Width - Positions */}
                <div className="lg:col-span-12">
                  <PositionsSection orderId={orderId!} order={order} />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="sizes">
              <SizeTableTab order={order} setSizeDialogOpen={setSizeDialogOpen} />
            </TabsContent>
            
            <TabsContent value="assets">
              {submitError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}
              <PrintAssetsTab order={order} setAssetDialogOpen={setAssetDialogOpen} />
            </TabsContent>
            
            <TabsContent value="history">
              <Card className="rounded-2xl">
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground" data-testid="text-history-placeholder">
                    Historie-Ansicht wird in einer zukünftigen Version implementiert.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      <SizeTableDialog
        orderId={orderId!}
        open={sizeDialogOpen}
        onOpenChange={setSizeDialogOpen}
      />
      
      <PrintAssetDialog
        orderId={orderId!}
        open={assetDialogOpen}
        onOpenChange={setAssetDialogOpen}
      />
      
      <AlertDialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auftrag für Produktion freigeben?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion markiert den Auftrag als produktionsbereit. 
              Stellen Sie sicher, dass alle erforderlichen Druckdaten vorhanden sind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-submit">Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              data-testid="button-confirm-submit"
            >
              {submitMutation.isPending ? "Wird freigegeben..." : "Freigeben"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PositionsSection({ orderId, order }: { orderId: string; order: OrderWithRelations }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localPositions, setLocalPositions] = useState<any[]>([]);

  const { data: positions = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/orders/${orderId}/positions`],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/positions`, [data]);
      if (!res.ok) throw new Error("Create failed");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}/positions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      toast({
        title: "Position erstellt",
        description: "Die Position wurde erfolgreich erstellt.",
      });
      setEditingId(null);
      setLocalPositions([]);
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Die Position konnte nicht erstellt werden.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ posId, data }: { posId: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/positions/${posId}`, data);
      if (!res.ok) throw new Error("Update failed");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}/positions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      toast({
        title: "Position aktualisiert",
        description: "Die Position wurde erfolgreich aktualisiert.",
      });
      setEditingId(null);
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Die Position konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (posId: string) => {
      const res = await apiRequest("DELETE", `/api/orders/${orderId}/positions/${posId}`);
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}/positions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      toast({
        title: "Position gelöscht",
        description: "Die Position wurde erfolgreich gelöscht.",
      });
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Die Position konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    },
  });

  const addPosition = () => {
    const newPos = {
      id: `temp-${Date.now()}`,
      articleName: "",
      articleNumber: "",
      qty: 1,
      unit: "Stk",
      unitPriceNet: 0,
      vatRate: 19,
      procurement: "NONE",
      supplierNote: "",
      lineNet: 0,
      lineVat: 0,
      lineGross: 0,
      isNew: true,
    };
    setLocalPositions([...localPositions, newPos]);
    setEditingId(newPos.id);
  };

  const savePosition = (pos: any) => {
    if (pos.isNew) {
      const { id, isNew, lineNet, lineVat, lineGross, ...data } = pos;
      createMutation.mutate(data);
    } else {
      const { id, lineNet, lineVat, lineGross, orderId: _, createdAt, updatedAt, ...data } = pos;
      updateMutation.mutate({ posId: id, data });
    }
  };

  const cancelEdit = (pos: any) => {
    if (pos.isNew) {
      setLocalPositions(localPositions.filter(p => p.id !== pos.id));
    }
    setEditingId(null);
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null) return "—";
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(Number(amount));
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">Lade Positionen...</p>
        </CardContent>
      </Card>
    );
  }

  const displayPositions = [...positions, ...localPositions];

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-muted/60">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Positionen</CardTitle>
          <Button
            onClick={addPosition}
            size="sm"
            data-testid="button-add-position"
          >
            <Plus className="h-4 w-4 mr-2" />
            Position hinzufügen
          </Button>
        </CardHeader>
        <CardContent>
          {displayPositions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-positions">
              Keine Positionen vorhanden. Fügen Sie eine Position hinzu.
            </div>
          ) : (
            <div className="space-y-2">
              {displayPositions.map((pos: any) => (
                <PositionRow
                  key={pos.id}
                  position={pos}
                  isEditing={editingId === pos.id}
                  onEdit={() => setEditingId(pos.id)}
                  onSave={savePosition}
                  onDelete={() => !pos.isNew && deleteMutation.mutate(pos.id)}
                  onCancel={() => cancelEdit(pos)}
                />
              ))}
            </div>
          )}
        </CardContent>
        {displayPositions.length > 0 && (
          <CardFooter className="flex justify-end border-t pt-4">
            <div className="space-y-2 min-w-[300px]">
              <div className="flex justify-between text-sm">
                <Label>Gesamt Netto:</Label>
                <span className="font-medium" data-testid="text-total-net">
                  {formatCurrency(order.totalNet)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <Label>Gesamt MwSt:</Label>
                <span className="font-medium" data-testid="text-total-vat">
                  {formatCurrency(order.totalVat)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <Label className="text-base font-semibold">Gesamt Brutto:</Label>
                <span className="text-base font-bold" data-testid="text-total-gross">
                  {formatCurrency(order.totalGross)}
                </span>
              </div>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

function PositionRow({
  position,
  isEditing,
  onEdit,
  onSave,
  onDelete,
  onCancel,
}: {
  position: any;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (pos: any) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [editedPos, setEditedPos] = useState(position);

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null) return "—";
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(Number(amount));
  };

  const updateField = (field: string, value: any) => {
    const updated = { ...editedPos, [field]: value };
    
    // Recalculate line totals
    const qty = Number(updated.qty) || 0;
    const unitPrice = Number(updated.unitPriceNet) || 0;
    const vatRate = Number(updated.vatRate) || 0;
    
    updated.lineNet = qty * unitPrice;
    updated.lineVat = updated.lineNet * (vatRate / 100);
    updated.lineGross = updated.lineNet + updated.lineVat;
    
    setEditedPos(updated);
  };

  if (isEditing) {
    return (
      <div className="border rounded-md p-3 space-y-3" data-testid={`position-row-edit-${position.id}`}>
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-2">
            <Label className="text-xs">Art.-Nr.</Label>
            <Input
              value={editedPos.articleNumber || ""}
              onChange={(e) => updateField("articleNumber", e.target.value)}
              placeholder="Art.-Nr."
              data-testid="input-articleNumber"
            />
          </div>
          <div className="col-span-3">
            <Label className="text-xs">Artikelname*</Label>
            <Input
              value={editedPos.articleName}
              onChange={(e) => updateField("articleName", e.target.value)}
              placeholder="Artikelname"
              data-testid="input-articleName"
            />
          </div>
          <div className="col-span-1">
            <Label className="text-xs">Menge</Label>
            <Input
              type="number"
              value={editedPos.qty}
              onChange={(e) => updateField("qty", e.target.value)}
              min="0.01"
              step="0.01"
              data-testid="input-qty"
            />
          </div>
          <div className="col-span-1">
            <Label className="text-xs">Einheit</Label>
            <Input
              value={editedPos.unit}
              onChange={(e) => updateField("unit", e.target.value)}
              data-testid="input-unit"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Einzelpreis</Label>
            <Input
              type="number"
              value={editedPos.unitPriceNet}
              onChange={(e) => updateField("unitPriceNet", e.target.value)}
              min="0"
              step="0.01"
              data-testid="input-unitPriceNet"
            />
          </div>
          <div className="col-span-1">
            <Label className="text-xs">MwSt %</Label>
            <Select
              value={String(editedPos.vatRate)}
              onValueChange={(val) => updateField("vatRate", parseInt(val))}
            >
              <SelectTrigger data-testid="select-vatRate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0%</SelectItem>
                <SelectItem value="7">7%</SelectItem>
                <SelectItem value="19">19%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Beschaffung</Label>
            <Select
              value={editedPos.procurement}
              onValueChange={(val) => updateField("procurement", val)}
            >
              <SelectTrigger data-testid="select-procurement">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Keine</SelectItem>
                <SelectItem value="ORDERED">Bestellt</SelectItem>
                <SelectItem value="IN_STOCK">Lager</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-6">
            <Label className="text-xs">Notiz</Label>
            <Input
              value={editedPos.supplierNote || ""}
              onChange={(e) => updateField("supplierNote", e.target.value)}
              placeholder="Lieferantennotiz"
              data-testid="input-supplierNote"
            />
          </div>
          <div className="col-span-6 flex items-end gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              data-testid="button-cancel-edit"
            >
              <X className="h-4 w-4 mr-1" />
              Abbrechen
            </Button>
            <Button
              size="sm"
              onClick={() => onSave(editedPos)}
              disabled={!editedPos.articleName}
              data-testid="button-save-edit"
            >
              <Save className="h-4 w-4 mr-1" />
              Speichern
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-md p-3 hover-elevate" data-testid={`position-row-${position.id}`}>
      <div className="grid grid-cols-12 gap-2 items-center text-sm">
        <div className="col-span-2 font-mono text-xs text-muted-foreground">
          {position.articleNumber || "—"}
        </div>
        <div className="col-span-3 font-medium">{position.articleName}</div>
        <div className="col-span-1 text-right">{position.qty}</div>
        <div className="col-span-1">{position.unit}</div>
        <div className="col-span-2 text-right">{formatCurrency(position.unitPriceNet)}</div>
        <div className="col-span-1 text-center">{position.vatRate}%</div>
        <div className="col-span-1">
          <Badge variant="outline" className="text-xs">
            {position.procurement === "NONE" ? "—" : position.procurement}
          </Badge>
        </div>
        <div className="col-span-1 flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            data-testid="button-edit-position"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={position.isNew}
            data-testid="button-delete-position"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {position.supplierNote && (
        <div className="mt-2 text-xs text-muted-foreground pl-2 border-l-2">
          {position.supplierNote}
        </div>
      )}
      <div className="mt-2 pt-2 border-t flex justify-between text-xs">
        <span className="text-muted-foreground">Summe:</span>
        <div className="flex gap-4">
          <span>Netto: {formatCurrency(position.lineNet)}</span>
          <span>MwSt: {formatCurrency(position.lineVat)}</span>
          <span className="font-semibold">Brutto: {formatCurrency(position.lineGross)}</span>
        </div>
      </div>
    </div>
  );
}

function SizeTableTab({ order, setSizeDialogOpen }: { order: OrderWithRelations; setSizeDialogOpen: (open: boolean) => void }) {
  const sizeTable = order.sizeTable;

  if (!sizeTable) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground mb-4" data-testid="text-no-sizetable">
            Keine Größentabelle vorhanden.
          </p>
          <Button onClick={() => setSizeDialogOpen(true)} data-testid="button-add-sizetable">
            <Plus className="h-4 w-4 mr-2" />
            Größentabelle erstellen
          </Button>
        </CardContent>
      </Card>
    );
  }

  const rows = sizeTable.rowsJson as any[];
  const scheme = sizeTable.scheme;

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-muted/60">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Größentabelle</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Schema: {scheme}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setSizeDialogOpen(true)}
            data-testid="button-edit-sizetable"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Bearbeiten
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2 border-r">Größe</th>
                  <th className="text-right p-2">Anzahl</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any, index: number) => (
                  <tr key={index} className="border-t" data-testid={`sizetable-row-${index}`}>
                    <td className="p-2 border-r font-medium">{row.size}</td>
                    <td className="p-2 text-right">{row.number}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/50">
                <tr>
                  <td className="p-2 font-semibold">Gesamt</td>
                  <td className="p-2 text-right font-bold" data-testid="text-sizetable-total">
                    {rows.reduce((sum, row) => sum + (Number(row.number) || 0), 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {sizeTable.comment && (
            <div className="mt-4 p-3 bg-muted/50 rounded-md">
              <Label className="text-xs text-muted-foreground">KOMMENTAR</Label>
              <p className="text-sm mt-1">{sizeTable.comment}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PrintAssetsTab({ order, setAssetDialogOpen }: { order: OrderWithRelations; setAssetDialogOpen: (open: boolean) => void }) {
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-muted/60">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Druckdaten</CardTitle>
          <Button
            onClick={() => setAssetDialogOpen(true)}
            size="sm"
            data-testid="button-add-asset"
          >
            <Plus className="h-4 w-4 mr-2" />
            Druckdaten hinzufügen
          </Button>
        </CardHeader>
        <CardContent>
          {order.printAssets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-assets">
              Keine Druckdaten vorhanden. Fügen Sie Druckdaten hinzu.
            </div>
          ) : (
            <div className="space-y-2">
              {order.printAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                  data-testid={`asset-${asset.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{asset.label}</span>
                      {asset.required && (
                        <Badge variant="destructive" className="text-xs">
                          Erforderlich
                        </Badge>
                      )}
                    </div>
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                      data-testid={`link-asset-${asset.id}`}
                    >
                      <ExternalLink className="h-3 w-3" />
                      {asset.url}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SizeTableDialog({ orderId, open, onOpenChange }: { orderId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-sizetable">
        <DialogHeader>
          <DialogTitle>Größentabelle</DialogTitle>
          <DialogDescription>
            Funktionalität wird in einer späteren Version implementiert.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

function PrintAssetDialog({ orderId, open, onOpenChange }: { orderId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [required, setRequired] = useState(true);

  const assetMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/assets`, data);
      if (!res.ok) throw new Error("Failed to add asset");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      toast({
        title: "Druckdaten hinzugefügt",
        description: "Die Druckdaten wurden erfolgreich hinzugefügt.",
      });
      setLabel("");
      setUrl("");
      setRequired(true);
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Die Druckdaten konnten nicht hinzugefügt werden.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!label || !url) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Felder aus.",
        variant: "destructive",
      });
      return;
    }
    assetMutation.mutate({ label, url, required });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-asset">
        <DialogHeader>
          <DialogTitle>Druckdaten hinzufügen</DialogTitle>
          <DialogDescription>
            Fügen Sie Logos, Grafiken oder andere Assets für diesen Auftrag hinzu.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Bezeichnung</Label>
            <Input
              data-testid="input-asset-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="z.B. Logo Vorderseite"
            />
          </div>
          
          <div>
            <Label>URL</Label>
            <Input
              data-testid="input-asset-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Checkbox
              id="required"
              checked={required}
              onCheckedChange={(checked) => setRequired(checked === true)}
              data-testid="checkbox-required"
            />
            <Label htmlFor="required" className="cursor-pointer">
              Erforderlich für Freigabe
            </Label>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-asset">
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={assetMutation.isPending} data-testid="button-save-asset">
              {assetMutation.isPending ? "Wird hinzugefügt..." : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
