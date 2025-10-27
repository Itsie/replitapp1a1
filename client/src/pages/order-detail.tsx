import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Check, AlertTriangle, Copy, Plus, ExternalLink, Pencil, Trash2, Save, X, Download, Upload, FileIcon, Link as LinkIcon, Calendar, Trash, Eye, FileText, Edit, Building2, XCircle, Package } from "lucide-react";
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
import type { OrderWithRelations, SizeTableResponse, SizeTableRow, OrderAsset, WarehouseGroupWithRelations, WarehousePlaceWithRelations } from "@shared/schema";
import { 
  WORKFLOW_LABELS, 
  DEPARTMENT_LABELS,
  SOURCE_LABELS,
  getWorkflowBadgeClass, 
  getDepartmentBadgeClass,
  getSourceBadgeClass,
  getOrderHints 
} from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SizeTableEditor } from "@/components/size-table-editor";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AttachmentsTab } from "@/components/attachments-tab";
import { Decimal } from "@prisma/client/runtime/library";

export default function OrderDetail() {
  const [, params] = useRoute("/orders/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const orderId = params?.id;
  
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false);
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [deliverDialogOpen, setDeliverDialogOpen] = useState(false);
  const [deliverQty, setDeliverQty] = useState("");
  const [deliverNote, setDeliverNote] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  
  const { data: order, isLoading } = useQuery<OrderWithRelations>({
    queryKey: [`/api/orders/${orderId}`],
    enabled: !!orderId,
  });
  
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}`, data);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Update failed");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Gespeichert",
        description: "Der Auftrag wurde erfolgreich aktualisiert.",
      });
      setIsEditing(false);
      setEditForm({});
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Aktualisierung fehlgeschlagen.",
        variant: "destructive",
      });
    },
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

  const deliverMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/deliver`, {
        deliveredAt: new Date().toISOString(),
        deliveredQty: deliverQty ? parseInt(deliverQty) : undefined,
        deliveredNote: deliverNote || undefined,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Delivery failed");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Auftrag ausgegeben",
        description: "Der Auftrag wurde zur Abrechnung weitergeleitet.",
      });
      setDeliverDialogOpen(false);
      setDeliverQty("");
      setDeliverNote("");
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Ausgabe fehlgeschlagen.",
        variant: "destructive",
      });
    },
  });
  
  const handleEdit = () => {
    if (!order) return;
    setEditForm({
      company: order.company || "",
      contactFirstName: order.contactFirstName || "",
      contactLastName: order.contactLastName || "",
      customerEmail: order.customerEmail || "",
      customerPhone: order.customerPhone || "",
      billStreet: order.billStreet || "",
      billZip: order.billZip || "",
      billCity: order.billCity || "",
      billCountry: order.billCountry || "DE",
      shipStreet: order.shipStreet || "",
      shipZip: order.shipZip || "",
      shipCity: order.shipCity || "",
      shipCountry: order.shipCountry || "",
      title: order.title,
      customer: order.customer,
      department: order.department,
      dueDate: order.dueDate ? new Date(order.dueDate).toISOString().split('T')[0] : "",
      location: order.location || "",
      locationPlaceId: (order as any).locationPlaceId || "",
      notes: order.notes || "",
    });
    setIsEditing(true);
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({});
  };
  
  const handleSaveEdit = () => {
    const updateData: any = {};
    
    // Helper to compare dates
    const getCurrentDueDateStr = order?.dueDate ? new Date(order.dueDate).toISOString().split('T')[0] : "";
    
    // Only include changed fields
    if (editForm.company !== undefined && editForm.company !== order?.company) updateData.company = editForm.company || null;
    if (editForm.contactFirstName !== undefined && editForm.contactFirstName !== order?.contactFirstName) updateData.contactFirstName = editForm.contactFirstName || null;
    if (editForm.contactLastName !== undefined && editForm.contactLastName !== order?.contactLastName) updateData.contactLastName = editForm.contactLastName || null;
    if (editForm.customerEmail !== order?.customerEmail) updateData.customerEmail = editForm.customerEmail;
    if (editForm.customerPhone !== order?.customerPhone) updateData.customerPhone = editForm.customerPhone;
    if (editForm.billStreet !== order?.billStreet) updateData.billStreet = editForm.billStreet;
    if (editForm.billZip !== order?.billZip) updateData.billZip = editForm.billZip;
    if (editForm.billCity !== order?.billCity) updateData.billCity = editForm.billCity;
    if (editForm.billCountry !== order?.billCountry) updateData.billCountry = editForm.billCountry;
    if (editForm.shipStreet !== undefined && editForm.shipStreet !== order?.shipStreet) updateData.shipStreet = editForm.shipStreet || null;
    if (editForm.shipZip !== undefined && editForm.shipZip !== order?.shipZip) updateData.shipZip = editForm.shipZip || null;
    if (editForm.shipCity !== undefined && editForm.shipCity !== order?.shipCity) updateData.shipCity = editForm.shipCity || null;
    if (editForm.shipCountry !== undefined && editForm.shipCountry !== order?.shipCountry) updateData.shipCountry = editForm.shipCountry || null;
    if (editForm.title !== order?.title) updateData.title = editForm.title;
    
    // Auto-generate customer display name from company OR firstName + lastName
    const newCustomer = editForm.company 
      ? editForm.company 
      : (editForm.contactFirstName && editForm.contactLastName)
        ? `${editForm.contactFirstName} ${editForm.contactLastName}`
        : "Unbekannt";
    if (newCustomer !== order?.customer) updateData.customer = newCustomer;
    
    if (editForm.department !== order?.department) updateData.department = editForm.department;
    
    // Handle dueDate properly: convert YYYY-MM-DD to ISO datetime string
    if (editForm.dueDate !== getCurrentDueDateStr) {
      if (editForm.dueDate && editForm.dueDate.trim()) {
        // Create date at noon UTC to avoid timezone issues
        const date = new Date(editForm.dueDate + 'T12:00:00.000Z');
        updateData.dueDate = date.toISOString();
      } else {
        updateData.dueDate = null;
      }
    }
    
    if (editForm.location !== undefined && editForm.location !== order?.location) updateData.location = editForm.location || null;
    if (editForm.locationPlaceId !== undefined && editForm.locationPlaceId !== (order as any)?.locationPlaceId) updateData.locationPlaceId = editForm.locationPlaceId || null;
    if (editForm.notes !== undefined && editForm.notes !== order?.notes) updateData.notes = editForm.notes || null;
    
    updateMutation.mutate(updateData);
  };
  
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


  // Get hints for the order (order is guaranteed to be defined here after the checks above)
  const hints = getOrderHints(order!);

  const hasShippingAddress = !!(order!.shipStreet || order!.shipZip || order!.shipCity || order!.shipCountry);
  const hasPositions = (order.positions?.length || 0) > 0;
  // Check both printAssets (legacy) and orderAssets (current) for required assets
  const hasRequiredAssets = (order.printAssets && order.printAssets.some(a => a.required)) || 
                            (order.orderAssets && order.orderAssets.some(a => a.required));
  const hasSizeTable = !!order.sizeTable;
  const isTeamsport = order.department === "TEAMSPORT";
  const canSubmitOrder = hasPositions && hasRequiredAssets && (!isTeamsport || hasSizeTable);
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b">
        <div className="w-full">
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
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span 
                  className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${getWorkflowBadgeClass(order.workflow)}`} 
                  data-testid="badge-workflow"
                  title={`Status: ${WORKFLOW_LABELS[order.workflow]}`}
                >
                  {WORKFLOW_LABELS[order.workflow]}
                </span>
                
                <span className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${getSourceBadgeClass(order.source)}`} data-testid="badge-source">
                  {SOURCE_LABELS[order.source]}
                </span>
                
                <span className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${getDepartmentBadgeClass(order.department)}`} data-testid="badge-department">
                  {DEPARTMENT_LABELS[order.department]}
                </span>
              </div>
              
              {hints.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {hints.map((hint, index) => (
                    <span key={index} className="text-sm text-muted-foreground">{hint}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {/* Edit Button - Only for INTERNAL orders or JTL orders with limited editing */}
              {order.source === "INTERNAL" && order.workflow !== "IN_PROD" && (
                <Button
                  variant="outline"
                  onClick={handleEdit}
                  data-testid="button-edit-order"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Auftrag bearbeiten
                </Button>
              )}
              
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

              {/* Deliver Button - Only for FERTIG or FUER_PROD orders */}
              {(order.workflow === "FERTIG" || order.workflow === "FUER_PROD") && (
                <Button
                  onClick={() => setDeliverDialogOpen(true)}
                  data-testid="button-deliver"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Ausgegeben
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList data-testid="tabs-list">
              <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
              <TabsTrigger value="sizes" data-testid="tab-sizes">Größen</TabsTrigger>
              <TabsTrigger value="assets" data-testid="tab-assets">Druckdaten / Anhänge</TabsTrigger>
              <TabsTrigger value="storage" data-testid="tab-storage">Lager</TabsTrigger>
              <TabsTrigger value="history" data-testid="tab-history">Historie</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details">
              {submitError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-4">
                {/* Combined Card with 3 Gradients */}
                <Card className="rounded-2xl border-muted/60">
                  <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap space-y-0">
                    <CardTitle>Auftrag & Adressen</CardTitle>
                    <div className="flex gap-2">
                      {order.customerEmail && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          data-testid="button-email"
                        >
                          <a href={`mailto:${order.customerEmail}`}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            E-Mail
                          </a>
                        </Button>
                      )}
                      {order.customerPhone && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          data-testid="button-phone"
                        >
                          <a href={`tel:${order.customerPhone}`}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Anrufen
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("assets")}
                        data-testid="button-open-assets"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Druckdaten
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      {/* Billing Address with Blue/Primary Gradient */}
                      <div className="rounded-xl p-4 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border border-primary/10">
                        <Label className="text-xs text-muted-foreground mb-2 block">RECHNUNGSADRESSE</Label>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">FIRMA</Label>
                            <p className="font-medium" data-testid="text-company">{order.company || "—"}</p>
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
                            <Label className="text-xs text-muted-foreground">ADRESSE</Label>
                            <div className="space-y-1">
                              <p data-testid="text-bill-street">{order.billStreet || "—"}</p>
                              <p data-testid="text-bill-city">
                                {order.billZip && order.billCity ? `${order.billZip} ${order.billCity}` : "—"}
                              </p>
                              <p data-testid="text-bill-country">{order.billCountry || "—"}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Shipping Address with Green/Emerald Gradient or Same-as-billing */}
                      {hasShippingAddress ? (
                        <div className="rounded-xl p-4 bg-gradient-to-br from-green-500/5 via-emerald-500/3 to-transparent border border-green-500/10">
                          <Label className="text-xs text-muted-foreground mb-2 block">LIEFERADRESSE</Label>
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">FIRMA</Label>
                              <p className="font-medium">{order.company || "—"}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">ANSPRECHPARTNER</Label>
                              <p>
                                {order.contactFirstName && order.contactLastName
                                  ? `${order.contactFirstName} ${order.contactLastName}`
                                  : "—"}
                              </p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">ADRESSE</Label>
                              <div className="space-y-1">
                                <p data-testid="text-ship-street">{order.shipStreet || "—"}</p>
                                <p data-testid="text-ship-city">
                                  {order.shipZip && order.shipCity ? `${order.shipZip} ${order.shipCity}` : "—"}
                                </p>
                                <p data-testid="text-ship-country">{order.shipCountry || "—"}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl p-4 bg-gradient-to-br from-muted/30 to-transparent border border-muted/20 flex items-center justify-center">
                          <p className="text-sm text-muted-foreground italic">Gleiche wie Rechnungsadresse</p>
                        </div>
                      )}
                      
                      {/* Order Details with Amber/Orange Gradient */}
                      <div className="rounded-xl p-4 bg-gradient-to-br from-amber-500/5 via-orange-500/3 to-transparent border border-amber-500/10">
                        <Label className="text-xs text-muted-foreground mb-2 block">AUFTRAG</Label>
                        <div className="space-y-3">
                          <div className="col-span-2">
                            <Label className="text-xs text-muted-foreground">AUFTRAGSNUMMER</Label>
                            <p className="font-medium font-mono" data-testid="text-order-number">{order.displayOrderNumber}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">ABTEILUNG</Label>
                              <div>
                                <span className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${getDepartmentBadgeClass(order.department)}`} data-testid="badge-department">
                                  {DEPARTMENT_LABELS[order.department]}
                                </span>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">QUELLE</Label>
                              <div>
                                <span className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${getSourceBadgeClass(order.source)}`} data-testid="badge-source-detail">
                                  {SOURCE_LABELS[order.source]}
                                </span>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">WORKFLOW</Label>
                              <div>
                                <span className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${getWorkflowBadgeClass(order.workflow)}`} data-testid="badge-workflow-detail">
                                  {WORKFLOW_LABELS[order.workflow]}
                                </span>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">FÄLLIG AM</Label>
                              <p data-testid="text-duedate">{formatDate(order.dueDate)}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">STANDORT</Label>
                              <p data-testid="text-location">{order.location || "—"}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">ERSTELLT</Label>
                              <p data-testid="text-created">{formatDate(order.createdAt)}</p>
                            </div>
                          </div>
                          {order.notes && (
                            <div className="pt-1">
                              <Label className="text-xs text-muted-foreground">NOTIZEN</Label>
                              <p className="text-sm whitespace-pre-wrap" data-testid="text-notes">{order.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Positions */}
                <PositionsSection orderId={orderId!} order={order} />
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
              <AttachmentsTab orderId={orderId!} />
            </TabsContent>
            
            <TabsContent value="storage">
              <StorageTab orderId={orderId!} />
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
      
      <OrderEditDialog
        order={order}
        isOpen={isEditing}
        onClose={handleCancelEdit}
        onSave={handleSaveEdit}
        editForm={editForm}
        setEditForm={setEditForm}
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

      <Dialog open={deliverDialogOpen} onOpenChange={setDeliverDialogOpen}>
        <DialogContent data-testid="dialog-deliver">
          <DialogHeader>
            <DialogTitle>Auftrag ausgeben</DialogTitle>
            <DialogDescription>
              Markieren Sie den Auftrag als ausgegeben. Der Workflow wird zu "Zur Abrechnung" geändert.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="deliverQty">Ausgegebene Menge (optional)</Label>
              <Input
                id="deliverQty"
                type="number"
                value={deliverQty}
                onChange={(e) => setDeliverQty(e.target.value)}
                placeholder="z.B. 50"
                data-testid="input-deliver-qty"
              />
            </div>
            <div>
              <Label htmlFor="deliverNote">Notiz (optional)</Label>
              <Textarea
                id="deliverNote"
                value={deliverNote}
                onChange={(e) => setDeliverNote(e.target.value)}
                placeholder="Zusätzliche Anmerkungen zur Ausgabe..."
                rows={3}
                data-testid="input-deliver-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeliverDialogOpen(false)}
              data-testid="button-cancel-deliver"
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => deliverMutation.mutate()}
              disabled={deliverMutation.isPending}
              data-testid="button-confirm-deliver"
            >
              {deliverMutation.isPending ? "Wird ausgegeben..." : "Ausgeben"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    // Convert string values to numbers for backend validation
    const convertedData = {
      articleName: pos.articleName,
      articleNumber: pos.articleNumber || null,
      qty: Number(pos.qty),
      unit: pos.unit,
      unitPriceNet: Number(pos.unitPriceNet),
      vatRate: Number(pos.vatRate),
      procurement: pos.procurement,
      supplierNote: pos.supplierNote || null,
    };
    
    if (pos.isNew) {
      createMutation.mutate(convertedData);
    } else {
      updateMutation.mutate({ posId: pos.id, data: convertedData });
    }
  };

  const cancelEdit = (pos: any) => {
    if (pos.isNew) {
      setLocalPositions(localPositions.filter(p => p.id !== pos.id));
    }
    setEditingId(null);
  };

  const formatCurrency = (amount: number | Decimal | undefined | null) => {
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
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/30 rounded-md text-xs font-medium text-muted-foreground">
                <div className="col-span-2">Art.-Nr.</div>
                <div className="col-span-3">Artikelname</div>
                <div className="col-span-1 text-right">Menge</div>
                <div className="col-span-1">Einheit</div>
                <div className="col-span-2 text-right">Einzelpreis</div>
                <div className="col-span-1 text-center">MwSt%</div>
                <div className="col-span-1">Beschaffung</div>
                <div className="col-span-1 text-right">Aktionen</div>
              </div>
              
              {/* Position Rows */}
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
  const [priceMode, setPriceMode] = useState<"netto" | "brutto">("netto");

  const formatCurrency = (amount: number | Decimal | undefined | null) => {
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
  
  const updatePriceField = (value: string) => {
    const price = Number(value) || 0;
    const vatRate = Number(editedPos.vatRate) || 0;
    
    let netPrice: number;
    if (priceMode === "brutto") {
      // Brutto → Netto umrechnen
      netPrice = price / (1 + vatRate / 100);
    } else {
      netPrice = price;
    }
    
    updateField("unitPriceNet", netPrice);
  };

  if (isEditing) {
    const unitPriceNet = Number(editedPos.unitPriceNet) || 0;
    const vatRate = Number(editedPos.vatRate) || 0;
    const displayPrice = priceMode === "brutto" 
      ? unitPriceNet * (1 + vatRate / 100)
      : unitPriceNet;
      
    return (
      <div className="border rounded-md p-3 space-y-3" data-testid={`position-row-edit-${position.id}`}>
        {/* Brutto/Netto Switch */}
        <div className="flex items-center gap-4 pb-2 border-b">
          <Label className="text-xs text-muted-foreground">PREISEINGABE:</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={priceMode === "netto" ? "default" : "outline"}
              size="sm"
              onClick={() => setPriceMode("netto")}
              data-testid="button-price-netto"
            >
              Netto
            </Button>
            <Button
              type="button"
              variant={priceMode === "brutto" ? "default" : "outline"}
              size="sm"
              onClick={() => setPriceMode("brutto")}
              data-testid="button-price-brutto"
            >
              Brutto
            </Button>
          </div>
        </div>
        
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
            <Label className="text-xs">Einzelpreis ({priceMode === "brutto" ? "Brutto" : "Netto"})</Label>
            <Input
              type="number"
              value={displayPrice.toFixed(2)}
              onChange={(e) => updatePriceField(e.target.value)}
              min="0"
              step="0.01"
              data-testid="input-unitPrice"
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                data-testid="button-edit-position"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bearbeiten</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                disabled={position.isNew}
                data-testid="button-delete-position"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Löschen</TooltipContent>
          </Tooltip>
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
  const { toast } = useToast();

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

  const rows = sizeTable.rowsJson as SizeTableRow[];
  const scheme = sizeTable.scheme;

  // Calculate countsBySize
  const countsBySize: Record<string, number> = {};
  rows.forEach(row => {
    countsBySize[row.size] = (countsBySize[row.size] || 0) + 1;
  });

  const handleExportCSV = async () => {
    try {
      const res = await fetch(`/api/orders/${order.id}/size/export.csv`);
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order-${order.id}-sizetable.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "CSV exportiert",
        description: "Die Größentabelle wurde erfolgreich exportiert.",
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Export fehlgeschlagen.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-muted/60">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div className="flex-1">
            <CardTitle>Größentabelle</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Schema: {scheme}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(countsBySize)
                .sort(([a], [b]) => a.localeCompare(b, 'de', { numeric: true }))
                .map(([size, count]) => (
                  <Badge key={size} variant="secondary" data-testid={`badge-size-${size}`}>
                    {size}: {count}
                  </Badge>
                ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              CSV exportieren
            </Button>
            <Button
              variant="outline"
              onClick={() => setSizeDialogOpen(true)}
              data-testid="button-edit-sizetable"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Bearbeiten
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2 border-r w-16">#</th>
                    <th className="text-left p-2 border-r">Größe</th>
                    <th className="text-left p-2 border-r">Nummer</th>
                    <th className="text-left p-2">Name</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index} className="border-t" data-testid={`sizetable-row-${index}`}>
                      <td className="p-2 border-r text-muted-foreground">{index + 1}</td>
                      <td className="p-2 border-r font-medium">{row.size}</td>
                      <td className="p-2 border-r">{row.number}</td>
                      <td className="p-2">{row.name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t bg-muted/50 sticky bottom-0">
                  <tr>
                    <td className="p-2 font-semibold" colSpan={2}>Gesamt</td>
                    <td className="p-2 font-bold" colSpan={2} data-testid="text-sizetable-total">
                      {rows.length} Einträge
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
  const { toast } = useToast();
  const { data: order } = useQuery<OrderWithRelations>({
    queryKey: [`/api/orders/${orderId}`],
    enabled: !!orderId,
  });

  const sizeTableMutation = useMutation({
    mutationFn: async (data: { scheme: string; rows: SizeTableRow[]; comment: string | null; allowDuplicates: boolean }) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/size`, data);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save size table");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      toast({
        title: "Gespeichert",
        description: "Größentabelle wurde erfolgreich gespeichert.",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Speichern fehlgeschlagen.",
        variant: "destructive",
      });
    },
  });

  const handleSave = async (data: { scheme: string; rows: SizeTableRow[]; comment: string | null; allowDuplicates: boolean }) => {
    await sizeTableMutation.mutateAsync(data);
  };

  const initialData = order?.sizeTable ? {
    scheme: order.sizeTable.scheme,
    rows: order.sizeTable.rowsJson as SizeTableRow[],
    comment: order.sizeTable.comment,
  } : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-sizetable">
        <DialogHeader>
          <DialogTitle>Größentabelle {order?.sizeTable ? "bearbeiten" : "erstellen"}</DialogTitle>
          <DialogDescription>
            Erfassen Sie Größen, Nummern und Namen für diesen Auftrag.
          </DialogDescription>
        </DialogHeader>
        <SizeTableEditor
          initialData={initialData}
          onSave={handleSave}
          onCancel={() => onOpenChange(false)}
        />
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

function OrderEditDialog({ order, isOpen, onClose, onSave, editForm, setEditForm }: { 
  order: OrderWithRelations; 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: () => void;
  editForm: any;
  setEditForm: (form: any) => void;
}) {
  const hasShippingAddress = !!(editForm.shipStreet || editForm.shipZip || editForm.shipCity || editForm.shipCountry);
  
  // Fetch all warehouse places for location selection
  const { data: warehousePlaces = [] } = useQuery<WarehousePlaceWithRelations[]>({
    queryKey: ["/api/warehouse/places"],
    queryFn: async () => {
      const res = await fetch("/api/warehouse/places");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen,
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-order">
        <DialogHeader>
          <DialogTitle>Auftrag bearbeiten</DialogTitle>
          <DialogDescription>
            Ändern Sie die Auftragsdaten. Interne Aufträge können vollständig bearbeitet werden.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Kundendaten</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Firma</Label>
                <Input
                  value={editForm.company || ""}
                  onChange={(e) => setEditForm({...editForm, company: e.target.value})}
                  placeholder="Firmenname"
                  data-testid="input-edit-company"
                />
              </div>
              <div>
                <Label>Vorname</Label>
                <Input
                  value={editForm.contactFirstName || ""}
                  onChange={(e) => setEditForm({...editForm, contactFirstName: e.target.value})}
                  placeholder="Vorname"
                  data-testid="input-edit-firstName"
                />
              </div>
              <div>
                <Label>Nachname</Label>
                <Input
                  value={editForm.contactLastName || ""}
                  onChange={(e) => setEditForm({...editForm, contactLastName: e.target.value})}
                  placeholder="Nachname"
                  data-testid="input-edit-lastName"
                />
              </div>
              <div>
                <Label>E-Mail *</Label>
                <Input
                  type="email"
                  value={editForm.customerEmail || ""}
                  onChange={(e) => setEditForm({...editForm, customerEmail: e.target.value})}
                  placeholder="kunde@example.com"
                  data-testid="input-edit-email"
                />
              </div>
              <div>
                <Label>Telefon *</Label>
                <Input
                  type="tel"
                  value={editForm.customerPhone || ""}
                  onChange={(e) => setEditForm({...editForm, customerPhone: e.target.value})}
                  placeholder="+49 123 456789"
                  data-testid="input-edit-phone"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Rechnungsadresse</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3">
                <Label>Straße & Hausnummer *</Label>
                <Input
                  value={editForm.billStreet || ""}
                  onChange={(e) => setEditForm({...editForm, billStreet: e.target.value})}
                  placeholder="Musterstraße 123"
                  data-testid="input-edit-billStreet"
                />
              </div>
              <div>
                <Label>PLZ *</Label>
                <Input
                  value={editForm.billZip || ""}
                  onChange={(e) => setEditForm({...editForm, billZip: e.target.value})}
                  placeholder="10115"
                  data-testid="input-edit-billZip"
                />
              </div>
              <div className="col-span-2">
                <Label>Stadt *</Label>
                <Input
                  value={editForm.billCity || ""}
                  onChange={(e) => setEditForm({...editForm, billCity: e.target.value})}
                  placeholder="Berlin"
                  data-testid="input-edit-billCity"
                />
              </div>
              <div className="col-span-3">
                <Label>Land</Label>
                <Select 
                  value={editForm.billCountry || "DE"} 
                  onValueChange={(value) => setEditForm({...editForm, billCountry: value})}
                >
                  <SelectTrigger data-testid="select-edit-billCountry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DE">Deutschland</SelectItem>
                    <SelectItem value="AT">Österreich</SelectItem>
                    <SelectItem value="CH">Schweiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Lieferadresse</h3>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="hasShipping"
                  checked={hasShippingAddress}
                  onCheckedChange={(checked) => {
                    if (!checked) {
                      setEditForm({
                        ...editForm,
                        shipStreet: "",
                        shipZip: "",
                        shipCity: "",
                        shipCountry: ""
                      });
                    } else {
                      setEditForm({
                        ...editForm,
                        shipCountry: "DE"
                      });
                    }
                  }}
                />
                <Label htmlFor="hasShipping" className="cursor-pointer text-sm">
                  Abweichende Lieferadresse
                </Label>
              </div>
            </div>
            
            {hasShippingAddress && (
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-3">
                  <Label>Straße & Hausnummer</Label>
                  <Input
                    value={editForm.shipStreet || ""}
                    onChange={(e) => setEditForm({...editForm, shipStreet: e.target.value})}
                    placeholder="Lieferstraße 456"
                    data-testid="input-edit-shipStreet"
                  />
                </div>
                <div>
                  <Label>PLZ</Label>
                  <Input
                    value={editForm.shipZip || ""}
                    onChange={(e) => setEditForm({...editForm, shipZip: e.target.value})}
                    placeholder="67890"
                    data-testid="input-edit-shipZip"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Stadt</Label>
                  <Input
                    value={editForm.shipCity || ""}
                    onChange={(e) => setEditForm({...editForm, shipCity: e.target.value})}
                    placeholder="Lieferstadt"
                    data-testid="input-edit-shipCity"
                  />
                </div>
                <div className="col-span-3">
                  <Label>Land</Label>
                  <Select 
                    value={editForm.shipCountry || "DE"} 
                    onValueChange={(value) => setEditForm({...editForm, shipCountry: value})}
                  >
                    <SelectTrigger data-testid="select-edit-shipCountry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DE">Deutschland</SelectItem>
                      <SelectItem value="AT">Österreich</SelectItem>
                      <SelectItem value="CH">Schweiz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Auftragsdaten</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Titel *</Label>
                <Input
                  value={editForm.title || ""}
                  onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                  placeholder="z.B. FC Bayern München Trikots 2024"
                  data-testid="input-edit-title"
                />
              </div>
              <div>
                <Label>Abteilung *</Label>
                <Select 
                  value={editForm.department || "TEAMSPORT"} 
                  onValueChange={(value) => setEditForm({...editForm, department: value})}
                >
                  <SelectTrigger data-testid="select-edit-department">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEAMSPORT">Teamsport</SelectItem>
                    <SelectItem value="TEXTILVEREDELUNG">Textilveredelung</SelectItem>
                    <SelectItem value="STICKEREI">Stickerei</SelectItem>
                    <SelectItem value="DRUCK">Druck</SelectItem>
                    <SelectItem value="SONSTIGES">Sonstiges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fälligkeitsdatum</Label>
                <Input
                  type="date"
                  value={editForm.dueDate || ""}
                  onChange={(e) => setEditForm({...editForm, dueDate: e.target.value})}
                  data-testid="input-edit-dueDate"
                />
              </div>
              <div>
                <Label>Lagerplatz</Label>
                <Select
                  value={editForm.locationPlaceId || "NONE"}
                  onValueChange={(value) => setEditForm({...editForm, locationPlaceId: value === "NONE" ? null : value})}
                >
                  <SelectTrigger data-testid="select-edit-locationPlace">
                    <SelectValue placeholder="Bitte wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Kein Lagerplatz</SelectItem>
                    {warehousePlaces.map((place) => (
                      <SelectItem key={place.id} value={place.id}>
                        {place.group.name} - {place.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Notizen</Label>
                <Textarea
                  value={editForm.notes || ""}
                  onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                  placeholder="Zusätzliche Anmerkungen..."
                  rows={3}
                  data-testid="input-edit-notes"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-edit">
            Abbrechen
          </Button>
          <Button onClick={onSave} data-testid="button-save-edit">
            <Save className="h-4 w-4 mr-2" />
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StorageTab({ orderId }: { orderId: string }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");

  // Fetch order to get current warehouse assignment
  const { data: order, isLoading: orderLoading } = useQuery<OrderWithRelations>({
    queryKey: [`/api/orders/${orderId}`],
  });

  // Fetch warehouse groups
  const { data: groups, isLoading: groupsLoading } = useQuery<WarehouseGroupWithRelations[]>({
    queryKey: ["/api/warehouse/groups"],
  });

  // Fetch places for selected group
  const { data: places = [], isLoading: placesLoading } = useQuery<WarehousePlaceWithRelations[]>({
    queryKey: ["/api/warehouse/places", selectedGroupId],
    queryFn: async () => {
      if (!selectedGroupId) return [];
      const res = await fetch(`/api/warehouse/places?groupId=${selectedGroupId}`);
      if (!res.ok) throw new Error("Failed to fetch places");
      return res.json();
    },
    enabled: !!selectedGroupId,
  });

  // Get free places from selected group
  const freePlaces = places.filter(p => p.occupiedByOrderId === null);

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: async (placeId: string) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/warehouse-place`, {
        placeId,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to assign place");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/places"] });
      toast({
        title: "Lagerplatz zugewiesen",
        description: "Der Auftrag wurde erfolgreich einem Lagerplatz zugewiesen.",
      });
      setDialogOpen(false);
      setSelectedGroupId("");
      setSelectedPlaceId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Unassign mutation
  const unassignMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/warehouse-place`, {
        placeId: null,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to unassign place");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/places"] });
      toast({
        title: "Zuordnung entfernt",
        description: "Die Lagerplatz-Zuordnung wurde entfernt.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAssign = () => {
    if (!selectedPlaceId) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Lagerplatz aus.",
        variant: "destructive",
      });
      return;
    }
    assignMutation.mutate(selectedPlaceId);
  };

  const handleUnassign = () => {
    unassignMutation.mutate();
  };

  // Find current warehouse assignment with group info
  const currentWarehouseData = groups?.reduce<{ place: any; group: any } | null>((acc, group) => {
    const place = group.places.find(p => p.occupiedByOrderId === orderId);
    return place ? { place, group } : acc;
  }, null);
  const currentWarehousePlace = currentWarehouseData?.place;

  if (orderLoading || groupsLoading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-12">
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap space-y-0">
          <CardTitle>Lagerplatz-Zuordnung</CardTitle>
          {currentWarehousePlace ? (
            <Button
              variant="outline"
              onClick={() => setDialogOpen(true)}
              data-testid="button-change-warehouse"
            >
              <Edit className="h-4 w-4 mr-2" />
              Ändern
            </Button>
          ) : (
            <Button
              onClick={() => setDialogOpen(true)}
              data-testid="button-assign-warehouse"
            >
              <Plus className="h-4 w-4 mr-2" />
              Lagerplatz zuweisen
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {currentWarehousePlace ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Bereich</span>
                    <Badge variant="secondary">{currentWarehouseData?.group.name}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Lagerplatz</span>
                    <span className="font-medium">{currentWarehousePlace.name}</span>
                  </div>
                  {currentWarehouseData?.group.description && (
                    <div className="pt-2 text-xs text-muted-foreground border-t">
                      {currentWarehouseData.group.description}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation(`/lager/${currentWarehousePlace.groupId}`)}
                  data-testid="button-view-warehouse-group"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Bereich ansehen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnassign}
                  disabled={unassignMutation.isPending}
                  data-testid="button-remove-warehouse"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Zuordnung entfernen
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-warehouse">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Kein Lagerplatz zugewiesen</p>
              <p className="text-sm mt-1">Weisen Sie einen freien Lagerplatz zu</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-assign-warehouse">
          <DialogHeader>
            <DialogTitle>Lagerplatz zuweisen</DialogTitle>
            <DialogDescription>
              Wählen Sie einen Bereich und einen freien Lagerplatz aus
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="groupId">Lagerbereich</Label>
              <Select 
                value={selectedGroupId} 
                onValueChange={(value) => {
                  setSelectedGroupId(value);
                  setSelectedPlaceId("");
                }}
              >
                <SelectTrigger id="groupId" data-testid="select-group">
                  <SelectValue placeholder="Bereich auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {!groups || groups.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      Keine Bereiche vorhanden
                    </SelectItem>
                  ) : (
                    groups.map((group) => (
                      <SelectItem key={group.id} value={group.id} data-testid={`group-option-${group.id}`}>
                        {group.name}
                        {group.description && ` - ${group.description}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {selectedGroupId && (
              <div>
                <Label htmlFor="placeId">Lagerplatz</Label>
                {placesLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={selectedPlaceId} onValueChange={setSelectedPlaceId}>
                    <SelectTrigger id="placeId" data-testid="select-place">
                      <SelectValue placeholder="Lagerplatz auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {freePlaces.length === 0 ? (
                        <SelectItem value="_none" disabled>
                          Keine freien Lagerplätze
                        </SelectItem>
                      ) : (
                        freePlaces.map((place) => (
                          <SelectItem key={place.id} value={place.id} data-testid={`place-option-${place.id}`}>
                            {place.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setSelectedGroupId("");
                setSelectedPlaceId("");
              }}
              data-testid="button-cancel-warehouse"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedPlaceId || assignMutation.isPending}
              data-testid="button-save-warehouse"
            >
              {assignMutation.isPending ? "Wird zugewiesen..." : "Zuweisen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
