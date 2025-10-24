import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Check, AlertTriangle, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type { OrderWithRelations, WorkflowState, OrderSource } from "@shared/schema";
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
      
      // Check if it's a 412 error (missing required assets)
      if (error.status === 412 || message.includes("Required print asset missing")) {
        setSubmitError("Benötigte Druckdaten fehlen. Bitte fügen Sie mindestens ein erforderliches Druckdatum hinzu.");
        setConfirmSubmitOpen(false);
        setActiveTab("assets"); // Switch to assets tab
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
      <Card>
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
  
  const getSourceBadgeVariant = (source: OrderSource) => {
    return source === "JTL" ? "default" : "secondary";
  };
  
  const getWorkflowBadgeVariant = (workflow: WorkflowState) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ENTWURF: "outline",
      NEU: "default",
      PRUEFUNG: "secondary",
      FUER_PROD: "default",
      IN_PROD: "default",
      WARTET_FEHLTEILE: "destructive",
      FERTIG: "secondary",
      ZUR_ABRECHNUNG: "outline",
      ABGERECHNET: "outline",
    };
    return variants[workflow] || "outline";
  };
  
  const canSubmit = order.workflow !== "FUER_PROD" && order.workflow !== "IN_PROD" && order.workflow !== "FERTIG";
  const hasRequiredAssets = order.printAssets.some(asset => asset.required);
  const hasPositions = order.positions && order.positions.length > 0;
  const canSubmitOrder = hasRequiredAssets && hasPositions;
  const hasShippingAddress = order.shipStreet || order.shipZip || order.shipCity || order.shipCountry;
  
  return (
    <>
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation("/orders")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-title">{order.title}</h1>
          <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground flex-wrap">
            {order.displayOrderNumber && (
              <>
                <span className="font-mono" data-testid="text-display-order-number">
                  {order.displayOrderNumber}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => copyToClipboard(order.displayOrderNumber!)}
                      data-testid="button-copy-order-number"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Auftragsnummer kopieren</p>
                  </TooltipContent>
                </Tooltip>
                <span>•</span>
              </>
            )}
            <span>{order.department}</span>
            <span>•</span>
            <span>{order.workflow}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canSubmit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    onClick={() => setConfirmSubmitOpen(true)}
                    disabled={!canSubmitOrder || submitMutation.isPending}
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
                      : "Benötigte Druckdaten fehlen"}
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          )}
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
          <TabsTrigger value="positions" data-testid="tab-positions">Positionen</TabsTrigger>
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
          
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Customer Card */}
              <Card>
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
              <Card>
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
                <Card>
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
            
            {/* Right Column */}
            <div className="space-y-4">
              {/* Order Details Card */}
              <Card>
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
                      <Badge variant={getSourceBadgeVariant(order.source)} data-testid="badge-source">
                        {order.source}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">WORKFLOW</Label>
                    <div>
                      <Badge variant={getWorkflowBadgeVariant(order.workflow)} data-testid="badge-workflow">
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
              <Card>
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
          </div>
        </TabsContent>

        <TabsContent value="positions">
          <PositionsTab orderId={orderId!} order={order} />
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
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground" data-testid="text-history-placeholder">
                Historie-Ansicht wird in einer zukünftigen Version implementiert.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
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
    </>
  );
}

function PositionsTab({ orderId, order }: { orderId: string; order: OrderWithRelations }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [localPositions, setLocalPositions] = useState<any[]>([]);

  const { data: positions = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/orders/${orderId}/positions`],
  });

  // Update local state when positions change
  useState(() => {
    if (positions.length > 0) {
      setLocalPositions(positions);
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/positions`, [data]);
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
    mutationFn: async ({ posId, data }: { posId: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/positions/${posId}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}/positions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      toast({
        title: "Position aktualisiert",
        description: "Die Position wurde erfolgreich aktualisiert.",
      });
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
    mutationFn: async (posId: number) => {
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
      id: -Date.now(), // temporary ID
      articleName: "",
      articleNumber: null,
      qty: 1,
      unit: "Stk",
      unitPriceNet: 0,
      vatRate: 19,
      procurement: "NONE",
      supplierNote: null,
      lineNet: 0,
      lineVat: 0,
      lineGross: 0,
    };
    setLocalPositions([...positions, newPos]);
    setEditingId(newPos.id);
  };

  const savePosition = (pos: any) => {
    if (pos.id < 0) {
      // New position
      const { id, lineNet, lineVat, lineGross, ...data } = pos;
      createMutation.mutate(data);
    } else {
      // Update existing
      const { id, lineNet, lineVat, lineGross, orderId, ...data } = pos;
      updateMutation.mutate({ posId: id, data });
    }
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
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">Lade Positionen...</p>
        </CardContent>
      </Card>
    );
  }

  const displayPositions = localPositions.length > 0 ? localPositions : positions;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Positionen</CardTitle>
          <Button
            onClick={addPosition}
            size="sm"
            data-testid="button-add-position"
          >
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
              {displayPositions.map((pos: any, index: number) => (
                <PositionRow
                  key={pos.id}
                  position={pos}
                  isEditing={editingId === pos.id}
                  onEdit={() => setEditingId(pos.id)}
                  onSave={savePosition}
                  onDelete={() => pos.id > 0 && deleteMutation.mutate(pos.id)}
                  onCancel={() => {
                    if (pos.id < 0) {
                      setLocalPositions(positions);
                    }
                    setEditingId(null);
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {displayPositions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Summen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <Label>Gesamt Netto:</Label>
              <span className="font-medium" data-testid="text-total-net">
                {formatCurrency(order.totalNet)}
              </span>
            </div>
            <div className="flex justify-between">
              <Label>Gesamt MwSt:</Label>
              <span className="font-medium" data-testid="text-total-vat">
                {formatCurrency(order.totalVat)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <Label className="text-lg">Gesamt Brutto:</Label>
              <span className="text-lg font-bold" data-testid="text-total-gross">
                {formatCurrency(order.totalGross)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
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

  if (!isEditing) {
    return (
      <div
        className="border rounded-md p-3 hover-elevate"
        data-testid={`position-${position.id}`}
      >
        <div className="grid grid-cols-12 gap-2 text-sm">
          <div className="col-span-1">
            <Label className="text-xs text-muted-foreground">Art.-Nr</Label>
            <p>{position.articleNumber || "—"}</p>
          </div>
          <div className="col-span-3">
            <Label className="text-xs text-muted-foreground">Artikelname</Label>
            <p className="font-medium">{position.articleName}</p>
          </div>
          <div className="col-span-1">
            <Label className="text-xs text-muted-foreground">Menge</Label>
            <p>{position.qty}</p>
          </div>
          <div className="col-span-1">
            <Label className="text-xs text-muted-foreground">Einheit</Label>
            <p>{position.unit}</p>
          </div>
          <div className="col-span-1">
            <Label className="text-xs text-muted-foreground">Preis</Label>
            <p>{formatCurrency(position.unitPriceNet)}</p>
          </div>
          <div className="col-span-1">
            <Label className="text-xs text-muted-foreground">MwSt</Label>
            <p>{position.vatRate}%</p>
          </div>
          <div className="col-span-1">
            <Label className="text-xs text-muted-foreground">Netto</Label>
            <p className="font-medium">{formatCurrency(position.lineNet)}</p>
          </div>
          <div className="col-span-1">
            <Label className="text-xs text-muted-foreground">Brutto</Label>
            <p className="font-medium">{formatCurrency(position.lineGross)}</p>
          </div>
          <div className="col-span-2 flex items-end gap-1">
            <Button variant="outline" size="sm" onClick={onEdit} data-testid={`button-edit-${position.id}`}>
              Bearbeiten
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} data-testid={`button-delete-${position.id}`}>
              Löschen
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-md p-3 bg-muted/50" data-testid={`position-edit-${position.id}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Art.-Nr</Label>
            <Input
              value={editedPos.articleNumber || ""}
              onChange={(e) => setEditedPos({ ...editedPos, articleNumber: e.target.value || null })}
              placeholder="Art.-Nr"
              data-testid={`input-edit-articleNumber-${position.id}`}
            />
          </div>
          <div>
            <Label className="text-xs">Artikelname *</Label>
            <Input
              value={editedPos.articleName}
              onChange={(e) => setEditedPos({ ...editedPos, articleName: e.target.value })}
              placeholder="Artikelname"
              required
              data-testid={`input-edit-articleName-${position.id}`}
            />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <Label className="text-xs">Menge</Label>
            <Input
              type="number"
              value={editedPos.qty}
              onChange={(e) => setEditedPos({ ...editedPos, qty: parseFloat(e.target.value) || 0 })}
              min="0.01"
              step="0.01"
              data-testid={`input-edit-qty-${position.id}`}
            />
          </div>
          <div>
            <Label className="text-xs">Einheit</Label>
            <Input
              value={editedPos.unit}
              onChange={(e) => setEditedPos({ ...editedPos, unit: e.target.value })}
              data-testid={`input-edit-unit-${position.id}`}
            />
          </div>
          <div>
            <Label className="text-xs">Preis/Netto</Label>
            <Input
              type="number"
              value={editedPos.unitPriceNet}
              onChange={(e) => setEditedPos({ ...editedPos, unitPriceNet: parseFloat(e.target.value) || 0 })}
              min="0"
              step="0.01"
              data-testid={`input-edit-unitPriceNet-${position.id}`}
            />
          </div>
          <div>
            <Label className="text-xs">MwSt %</Label>
            <Select
              value={editedPos.vatRate.toString()}
              onValueChange={(value) => setEditedPos({ ...editedPos, vatRate: parseInt(value) })}
            >
              <SelectTrigger data-testid={`select-edit-vatRate-${position.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0%</SelectItem>
                <SelectItem value="7">7%</SelectItem>
                <SelectItem value="19">19%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            data-testid={`button-cancel-edit-${position.id}`}
          >
            Abbrechen
          </Button>
          <Button
            size="sm"
            onClick={() => onSave(editedPos)}
            disabled={!editedPos.articleName}
            data-testid={`button-save-edit-${position.id}`}
          >
            Speichern
          </Button>
        </div>
      </div>
    </div>
  );
}

function SizeTableTab({ order, setSizeDialogOpen }: { order: OrderWithRelations; setSizeDialogOpen: (open: boolean) => void }) {
  if (!order.sizeTable) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <span className="text-2xl">📏</span>
          </div>
          <h3 className="text-lg font-semibold mb-2">Keine Größentabelle vorhanden</h3>
          <p className="text-sm text-muted-foreground mb-4" data-testid="text-no-sizetable">
            Legen Sie eine Größentabelle an, um Größen und Mengen zu definieren.
          </p>
          <Button onClick={() => setSizeDialogOpen(true)} data-testid="button-create-sizetable">
            Größentabelle anlegen
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Größentabelle</CardTitle>
        <Button onClick={() => setSizeDialogOpen(true)} variant="outline" data-testid="button-edit-sizetable">
          Bearbeiten
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">SCHEMA</Label>
          <p data-testid="text-scheme">{order.sizeTable.scheme}</p>
        </div>
        {order.sizeTable.comment && (
          <div>
            <Label className="text-xs text-muted-foreground">KOMMENTAR</Label>
            <p data-testid="text-comment">{order.sizeTable.comment}</p>
          </div>
        )}
        <div>
          <Label className="text-xs text-muted-foreground">DATEN</Label>
          <pre className="bg-muted p-4 rounded-md text-xs overflow-auto" data-testid="text-rows">
            {JSON.stringify(order.sizeTable.rows, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

function PrintAssetsTab({ order, setAssetDialogOpen }: { order: OrderWithRelations; setAssetDialogOpen: (open: boolean) => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Druckdaten</CardTitle>
        <Button onClick={() => setAssetDialogOpen(true)} data-testid="button-add-asset">
          Druckdaten hinzufügen
        </Button>
      </CardHeader>
      <CardContent>
        {order.printAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <span className="text-2xl">🖼️</span>
            </div>
            <h3 className="text-lg font-semibold mb-2">Keine Druckdaten vorhanden</h3>
            <p className="text-sm text-muted-foreground mb-4" data-testid="text-no-assets">
              Fügen Sie Druckdaten hinzu, um Logos, Grafiken oder andere Assets zu verwalten.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {order.printAssets.map((asset) => (
              <div
                key={asset.id}
                data-testid={`asset-${asset.id}`}
                className="flex items-center justify-between p-3 border rounded-md hover-elevate"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium" data-testid={`text-label-${asset.id}`}>{asset.label}</p>
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:underline truncate block"
                    data-testid={`link-url-${asset.id}`}
                  >
                    {asset.url}
                  </a>
                </div>
                {asset.required && (
                  <Badge variant="secondary" data-testid={`badge-required-${asset.id}`}>Erforderlich</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SizeTableDialog({ orderId, open, onOpenChange }: { orderId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [scheme, setScheme] = useState("ALPHA");
  const [rows, setRows] = useState('[{"size":"M","qty":10,"name":"","number":""}]');
  const [comment, setComment] = useState("");
  
  const sizeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/size`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      toast({
        title: "Größentabelle gespeichert",
        description: "Die Größentabelle wurde erfolgreich gespeichert.",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Die Größentabelle konnte nicht gespeichert werden.",
        variant: "destructive",
      });
    },
  });
  
  const handleSubmit = () => {
    try {
      const parsedRows = JSON.parse(rows);
      sizeMutation.mutate({ scheme, rows: parsedRows, comment: comment || null });
    } catch (e) {
      toast({
        title: "Fehler",
        description: "Ungültiges JSON-Format",
        variant: "destructive",
      });
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-sizetable">
        <DialogHeader>
          <DialogTitle>Größentabelle anlegen</DialogTitle>
          <DialogDescription>
            Definieren Sie Größen und Mengen für diesen Auftrag.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Schema</Label>
            <Select value={scheme} onValueChange={setScheme}>
              <SelectTrigger data-testid="select-scheme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALPHA">ALPHA (XS, S, M, L, XL)</SelectItem>
                <SelectItem value="NUMERIC">NUMERIC (40, 42, 44...)</SelectItem>
                <SelectItem value="CUSTOM">CUSTOM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Daten (JSON)</Label>
            <Textarea
              data-testid="textarea-rows"
              value={rows}
              onChange={(e) => setRows(e.target.value)}
              rows={10}
              className="font-mono text-xs"
              placeholder='[{"size":"M","qty":10,"name":"Mustermann","number":"10"}]'
            />
          </div>
          
          <div>
            <Label>Kommentar (optional)</Label>
            <Input
              data-testid="input-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Zusätzliche Informationen..."
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-sizetable">
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={sizeMutation.isPending} data-testid="button-save-sizetable">
              {sizeMutation.isPending ? "Wird gespeichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </div>
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
