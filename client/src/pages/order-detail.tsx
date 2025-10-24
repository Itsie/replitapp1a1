import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
    },
    onError: (error: any) => {
      const message = error.message || "Der Auftrag konnte nicht freigegeben werden.";
      toast({
        title: "Fehler",
        description: message,
        variant: "destructive",
      });
    },
  });
  
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
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };
  
  const canSubmit = order.workflow !== "FUER_PROD" && order.workflow !== "IN_PROD" && order.workflow !== "FERTIG";
  
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-title">{order.title}</h1>
          <p className="text-muted-foreground mt-1" data-testid="text-customer">{order.customer}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge data-testid="badge-source">{order.source}</Badge>
          <Badge variant="outline" data-testid="badge-department">{order.department}</Badge>
          <Badge data-testid="badge-workflow">{order.workflow}</Badge>
          {canSubmit && (
            <Button
              onClick={() => setConfirmSubmitOpen(true)}
              disabled={submitMutation.isPending}
              data-testid="button-submit"
            >
              <Check className="h-4 w-4 mr-2" />
              Für Produktion freigeben
            </Button>
          )}
        </div>
      </div>
      
      <Tabs defaultValue="details" className="space-y-6">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
          <TabsTrigger value="sizes" data-testid="tab-sizes">Größen</TabsTrigger>
          <TabsTrigger value="assets" data-testid="tab-assets">Druckdaten</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Historie</TabsTrigger>
        </TabsList>
        
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Auftragsdetails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">AUFTRAGSNUMMER</Label>
                  <p className="font-mono" data-testid="text-id">{order.id}</p>
                </div>
                {order.extId && (
                  <div>
                    <Label className="text-xs text-muted-foreground">EXTERNE ID</Label>
                    <p className="font-mono" data-testid="text-extid">{order.extId}</p>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">FÄLLIGKEITSDATUM</Label>
                  <p data-testid="text-duedate">{formatDate(order.dueDate)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">STANDORT</Label>
                  <p data-testid="text-location">{order.location || "—"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">QC-STATUS</Label>
                  <Badge variant="outline" data-testid="badge-qc">{order.qc}</Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">ERSTELLT</Label>
                  <p data-testid="text-created">{formatDate(order.createdAt)}</p>
                </div>
              </div>
              {order.notes && (
                <div>
                  <Label className="text-xs text-muted-foreground">NOTIZEN</Label>
                  <p className="text-sm whitespace-pre-wrap" data-testid="text-notes">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sizes">
          <SizeTableTab order={order} setSizeDialogOpen={setSizeDialogOpen} />
        </TabsContent>
        
        <TabsContent value="assets">
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
