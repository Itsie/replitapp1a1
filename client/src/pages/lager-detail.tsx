import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Plus, Package, Wand2, Edit, Trash2, User, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface WarehouseGroup {
  id: string;
  name: string;
  description: string | null;
  places: WarehousePlace[];
}

interface WarehousePlace {
  id: string;
  groupId: string;
  name: string;
  occupiedByOrderId: string | null;
  occupiedByOrder: {
    id: string;
    displayOrderNumber: string | null;
    title: string;
    customer: string;
  } | null;
}

export default function LagerDetail() {
  const params = useParams();
  const groupId = params.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<WarehousePlace | null>(null);
  const [deletingPlaceId, setDeletingPlaceId] = useState<string | null>(null);
  
  // Form state for manual add/edit
  const [formName, setFormName] = useState("");
  
  // Generator form state
  const [genPrefix, setGenPrefix] = useState("");
  const [genStart, setGenStart] = useState("1");
  const [genEnd, setGenEnd] = useState("10");
  const [genZeroPad, setGenZeroPad] = useState("2");
  const [genSeparator, setGenSeparator] = useState("-");
  const [genSuffix, setGenSuffix] = useState("");

  // Fetch group with places
  const { data: group, isLoading } = useQuery<WarehouseGroup>({
    queryKey: ["/api/warehouse/groups", groupId],
    queryFn: async () => {
      const res = await fetch(`/api/warehouse/groups/${groupId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Bereich nicht gefunden");
        throw new Error("Failed to fetch group");
      }
      return res.json();
    },
    enabled: !!groupId,
  });

  // Create place mutation
  const createMutation = useMutation({
    mutationFn: async (data: { groupId: string; name: string }) => {
      const res = await apiRequest("POST", "/api/warehouse/places", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create place");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/groups"] });
      toast({
        title: "Lagerplatz erstellt",
        description: "Der Lagerplatz wurde erfolgreich erstellt.",
      });
      setAddDialogOpen(false);
      setFormName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update place mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string } }) => {
      const res = await apiRequest("PATCH", `/api/warehouse/places/${id}`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update place");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/groups"] });
      toast({
        title: "Lagerplatz aktualisiert",
        description: "Der Lagerplatz wurde erfolgreich aktualisiert.",
      });
      setEditDialogOpen(false);
      setFormName("");
      setEditingPlace(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete place mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/warehouse/places/${id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete place");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/groups"] });
      toast({
        title: "Lagerplatz gelöscht",
        description: "Der Lagerplatz wurde erfolgreich gelöscht.",
      });
      setDeleteDialogOpen(false);
      setDeletingPlaceId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Generate places mutation
  const generateMutation = useMutation({
    mutationFn: async (data: {
      prefix: string;
      start: number;
      end: number;
      zeroPad: number;
      separator: string;
      suffix: string;
    }) => {
      const res = await apiRequest("POST", `/api/warehouse/groups/${groupId}/generate-places`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate places");
      }
      return res.json();
    },
    onSuccess: (data: { created: number; skipped: any[]; examples: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/groups"] });
      const skippedMsg = data.skipped.length > 0 
        ? ` (${data.skipped.length} übersprungen, da bereits vorhanden)` 
        : "";
      toast({
        title: "Lagerplätze generiert",
        description: `${data.created} Lagerplätze erfolgreich erstellt${skippedMsg}`,
      });
      setGenerateDialogOpen(false);
      resetGeneratorForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Unassign order from place
  const unassignMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/warehouse-place`, {
        placeId: null,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to unassign order");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/groups"] });
      toast({
        title: "Zuordnung entfernt",
        description: "Der Auftrag wurde vom Lagerplatz entfernt.",
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

  const resetGeneratorForm = () => {
    setGenPrefix("");
    setGenStart("1");
    setGenEnd("10");
    setGenZeroPad("2");
    setGenSeparator("-");
    setGenSuffix("");
  };

  const handleGenerateClick = () => {
    resetGeneratorForm();
    setGenerateDialogOpen(true);
  };

  const handleAddClick = () => {
    setFormName("");
    setAddDialogOpen(true);
  };

  const handleEditClick = (place: WarehousePlace) => {
    setEditingPlace(place);
    setFormName(place.name);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (placeId: string) => {
    setDeletingPlaceId(placeId);
    setDeleteDialogOpen(true);
  };

  const handleAddSubmit = () => {
    if (!groupId) return;
    createMutation.mutate({ groupId, name: formName });
  };

  const handleEditSubmit = () => {
    if (!editingPlace) return;
    updateMutation.mutate({
      id: editingPlace.id,
      data: { name: formName },
    });
  };

  const handleDeleteConfirm = () => {
    if (!deletingPlaceId) return;
    deleteMutation.mutate(deletingPlaceId);
  };

  const handleGenerateSubmit = () => {
    const start = parseInt(genStart, 10);
    const end = parseInt(genEnd, 10);
    const zeroPad = parseInt(genZeroPad, 10);

    if (isNaN(start) || isNaN(end) || isNaN(zeroPad)) {
      toast({
        title: "Ungültige Eingabe",
        description: "Bitte überprüfen Sie die Zahlenfelder.",
        variant: "destructive",
      });
      return;
    }

    if (start > end) {
      toast({
        title: "Ungültige Eingabe",
        description: "Start-Nummer muss kleiner oder gleich End-Nummer sein.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      prefix: genPrefix,
      start,
      end,
      zeroPad,
      separator: genSeparator,
      suffix: genSuffix,
    });
  };

  const handleUnassign = (orderId: string) => {
    unassignMutation.mutate(orderId);
  };

  // Generate preview
  const getPreview = () => {
    try {
      const start = parseInt(genStart, 10) || 1;
      const end = parseInt(genEnd, 10) || 10;
      const zeroPad = parseInt(genZeroPad, 10) || 2;
      
      const examples = [];
      for (let i = start; i <= Math.min(start + 2, end); i++) {
        const paddedNumber = i.toString().padStart(zeroPad, '0');
        examples.push(`${genPrefix.trim()}${genSeparator}${paddedNumber}${genSuffix.trim()}`.trim());
      }
      
      if (end > start + 2) {
        examples.push('...');
        const paddedNumber = end.toString().padStart(zeroPad, '0');
        examples.push(`${genPrefix.trim()}${genSeparator}${paddedNumber}${genSuffix.trim()}`.trim());
      }
      
      return examples.join(', ');
    } catch {
      return "—";
    }
  };

  if (isLoading) {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <Button variant="ghost" onClick={() => setLocation("/lager")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        <div className="mt-8 text-center text-muted-foreground">
          Bereich nicht gefunden
        </div>
      </div>
    );
  }

  const stats = {
    total: group.places.length,
    occupied: group.places.filter(p => p.occupiedByOrderId !== null).length,
    free: group.places.filter(p => p.occupiedByOrderId === null).length,
  };

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => setLocation("/lager")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück zur Übersicht
        </Button>
        
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-group-name">
              {group.name}
            </h1>
            {group.description && (
              <p className="text-muted-foreground mt-1">{group.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleGenerateClick} variant="outline" data-testid="button-generate">
              <Wand2 className="h-4 w-4 mr-2" />
              Generator
            </Button>
            <Button onClick={handleAddClick} data-testid="button-add-place">
              <Plus className="h-4 w-4 mr-2" />
              Platz hinzufügen
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Gesamt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Belegt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.occupied}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Frei</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.free}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lagerplätze</CardTitle>
        </CardHeader>
        <CardContent>
          {group.places.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-places">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Noch keine Lagerplätze angelegt</p>
              <p className="text-sm mt-2">Nutzen Sie den Generator oder fügen Sie manuell Plätze hinzu</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platzname</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Auftrag</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.places.map((place) => (
                  <TableRow key={place.id} data-testid={`row-place-${place.id}`}>
                    <TableCell className="font-medium">{place.name}</TableCell>
                    <TableCell>
                      <Badge variant={place.occupiedByOrderId ? "default" : "outline"}>
                        {place.occupiedByOrderId ? "Belegt" : "Frei"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {place.occupiedByOrder ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">
                              {place.occupiedByOrder.displayOrderNumber || place.occupiedByOrder.id.substring(0, 8)}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {place.occupiedByOrder.customer}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {place.occupiedByOrder && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLocation(`/orders/${place.occupiedByOrder!.id}`)}
                              data-testid={`button-view-order-${place.id}`}
                            >
                              <User className="h-4 w-4 mr-1" />
                              Auftrag
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnassign(place.occupiedByOrder!.id)}
                              disabled={unassignMutation.isPending}
                              data-testid={`button-unassign-${place.id}`}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(place)}
                          data-testid={`button-edit-place-${place.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(place.id)}
                          disabled={place.occupiedByOrderId !== null}
                          data-testid={`button-delete-place-${place.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generator Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-generate">
          <DialogHeader>
            <DialogTitle>Lagerplätze generieren</DialogTitle>
            <DialogDescription>
              Erstellen Sie mehrere Lagerplätze mit fortlaufender Nummerierung
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="gen-prefix">Präfix</Label>
                <Input
                  id="gen-prefix"
                  value={genPrefix}
                  onChange={(e) => setGenPrefix(e.target.value)}
                  placeholder="z.B. VK"
                  data-testid="input-gen-prefix"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gen-suffix">Suffix (optional)</Label>
                <Input
                  id="gen-suffix"
                  value={genSuffix}
                  onChange={(e) => setGenSuffix(e.target.value)}
                  placeholder="z.B. A"
                  data-testid="input-gen-suffix"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="gen-start">Start-Nummer</Label>
                <Input
                  id="gen-start"
                  type="number"
                  value={genStart}
                  onChange={(e) => setGenStart(e.target.value)}
                  data-testid="input-gen-start"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gen-end">End-Nummer</Label>
                <Input
                  id="gen-end"
                  type="number"
                  value={genEnd}
                  onChange={(e) => setGenEnd(e.target.value)}
                  data-testid="input-gen-end"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gen-zeropad">Nullen auffüllen</Label>
                <Input
                  id="gen-zeropad"
                  type="number"
                  value={genZeroPad}
                  onChange={(e) => setGenZeroPad(e.target.value)}
                  data-testid="input-gen-zeropad"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gen-separator">Trennzeichen</Label>
              <Input
                id="gen-separator"
                value={genSeparator}
                onChange={(e) => setGenSeparator(e.target.value)}
                placeholder="z.B. -"
                maxLength={3}
                data-testid="input-gen-separator"
              />
            </div>
            <div className="bg-muted p-3 rounded-md">
              <div className="text-sm text-muted-foreground mb-1">Vorschau:</div>
              <div className="font-mono text-sm" data-testid="text-gen-preview">{getPreview()}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleGenerateSubmit}
              disabled={!genPrefix || generateMutation.isPending}
              data-testid="button-submit-generate"
            >
              Generieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent data-testid="dialog-add-place">
          <DialogHeader>
            <DialogTitle>Lagerplatz hinzufügen</DialogTitle>
            <DialogDescription>
              Erstellen Sie einen einzelnen Lagerplatz manuell
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="place-name">Platzname *</Label>
              <Input
                id="place-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="z.B. VK-001"
                data-testid="input-place-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleAddSubmit}
              disabled={!formName || createMutation.isPending}
              data-testid="button-submit-add-place"
            >
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-place">
          <DialogHeader>
            <DialogTitle>Lagerplatz bearbeiten</DialogTitle>
            <DialogDescription>
              Aktualisieren Sie den Namen des Lagerplatzes
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-place-name">Platzname *</Label>
              <Input
                id="edit-place-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                data-testid="input-edit-place-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={!formName || updateMutation.isPending}
              data-testid="button-submit-edit-place"
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-place">
          <AlertDialogHeader>
            <AlertDialogTitle>Lagerplatz löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-place"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
