import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Plus, Eye, Edit, Power } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface WarehousePlace {
  id: string;
  name: string;
  capacity: number | null;
  active: boolean;
  occupied: number;
  free: number | null;
}

interface PlaceContents {
  id: string;
  qty: number;
  note: string | null;
  order: {
    id: string;
    displayOrderNumber: string | null;
    title: string;
    customer: string;
  };
}

export default function Lager() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<WarehousePlace | null>(null);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formCapacity, setFormCapacity] = useState("");
  const [formActive, setFormActive] = useState(true);

  // Fetch places
  const { data: places = [], isLoading } = useQuery<WarehousePlace[]>({
    queryKey: ["/api/warehouse/places", searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      const url = `/api/warehouse/places${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch places");
      return res.json();
    },
  });

  // Fetch place contents for side panel
  const { data: placeContents = [] } = useQuery<PlaceContents[]>({
    queryKey: ["/api/warehouse/places", selectedPlaceId, "contents"],
    queryFn: async () => {
      if (!selectedPlaceId) return [];
      const res = await fetch(`/api/warehouse/places/${selectedPlaceId}/contents`);
      if (!res.ok) throw new Error("Failed to fetch place contents");
      return res.json();
    },
    enabled: !!selectedPlaceId,
  });

  // Create place mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; capacity: number | null; active: boolean }) => {
      const res = await apiRequest("POST", "/api/warehouse/places", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create place");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/places"] });
      toast({
        title: "Lagerplatz erstellt",
        description: "Der Lagerplatz wurde erfolgreich erstellt.",
      });
      setAddDialogOpen(false);
      resetForm();
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ name: string; capacity: number | null; active: boolean }> }) => {
      const res = await apiRequest("PATCH", `/api/warehouse/places/${id}`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update place");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/places"] });
      toast({
        title: "Lagerplatz aktualisiert",
        description: "Der Lagerplatz wurde erfolgreich aktualisiert.",
      });
      setEditDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormCapacity("");
    setFormActive(true);
    setEditingPlace(null);
  };

  const handleAddClick = () => {
    resetForm();
    setAddDialogOpen(true);
  };

  const handleEditClick = (place: WarehousePlace) => {
    setEditingPlace(place);
    setFormName(place.name);
    setFormCapacity(place.capacity?.toString() || "");
    setFormActive(place.active);
    setEditDialogOpen(true);
  };

  const handleAddSubmit = () => {
    const capacity = formCapacity ? parseInt(formCapacity, 10) : null;
    createMutation.mutate({ name: formName, capacity, active: formActive });
  };

  const handleEditSubmit = () => {
    if (!editingPlace) return;
    const capacity = formCapacity ? parseInt(formCapacity, 10) : null;
    updateMutation.mutate({
      id: editingPlace.id,
      data: { name: formName, capacity, active: formActive },
    });
  };

  const selectedPlace = places.find(p => p.id === selectedPlaceId);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-lager-title">Lager</h1>
        <p className="text-muted-foreground mt-1">
          Lagerverwaltung und Bestandsübersicht
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lagerplätze</CardTitle>
            <Button onClick={handleAddClick} size="sm" data-testid="button-add-place">
              <Plus className="h-4 w-4 mr-2" />
              Lagerplatz hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Lagerplatz..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-place"
              />
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : places.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-places">
              {searchQuery ? "Keine Lagerplätze gefunden" : "Noch keine Lagerplätze angelegt"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platz</TableHead>
                  <TableHead>Kapazität</TableHead>
                  <TableHead>Belegt</TableHead>
                  <TableHead>Frei</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {places.map((place) => (
                  <TableRow key={place.id} data-testid={`row-place-${place.id}`}>
                    <TableCell className="font-medium">{place.name}</TableCell>
                    <TableCell>{place.capacity ?? "—"}</TableCell>
                    <TableCell>{place.occupied}</TableCell>
                    <TableCell>{place.free ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`text-sm ${place.active ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                        {place.active ? "Aktiv" : "Inaktiv"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPlaceId(place.id)}
                          data-testid={`button-view-${place.id}`}
                          aria-label={`Inhalt von ${place.name} ansehen`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Inhalt
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(place)}
                          data-testid={`button-edit-${place.id}`}
                          aria-label={`${place.name} bearbeiten`}
                        >
                          <Edit className="h-4 w-4" />
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

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent data-testid="dialog-add-place">
          <DialogHeader>
            <DialogTitle>Lagerplatz hinzufügen</DialogTitle>
            <DialogDescription>
              Erstellen Sie einen neuen Lagerplatz mit optionaler Kapazität.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Platzname</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="z.B. Verkauf-1"
                data-testid="input-place-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="capacity">Kapazität (optional)</Label>
              <Input
                id="capacity"
                type="number"
                value={formCapacity}
                onChange={(e) => setFormCapacity(e.target.value)}
                placeholder="z.B. 100"
                data-testid="input-place-capacity"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formActive}
                onCheckedChange={setFormActive}
                data-testid="switch-place-active"
              />
              <Label htmlFor="active">Aktiv</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleAddSubmit}
              disabled={!formName || createMutation.isPending}
              data-testid="button-submit-add"
            >
              Hinzufügen
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
              Bearbeiten Sie die Eigenschaften des Lagerplatzes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Platzname</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                data-testid="input-edit-place-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-capacity">Kapazität (optional)</Label>
              <Input
                id="edit-capacity"
                type="number"
                value={formCapacity}
                onChange={(e) => setFormCapacity(e.target.value)}
                data-testid="input-edit-place-capacity"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-active"
                checked={formActive}
                onCheckedChange={setFormActive}
                data-testid="switch-edit-place-active"
              />
              <Label htmlFor="edit-active">Aktiv</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={!formName || updateMutation.isPending}
              data-testid="button-submit-edit"
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Side Panel for Place Contents */}
      <Sheet open={!!selectedPlaceId} onOpenChange={(open) => !open && setSelectedPlaceId(null)}>
        <SheetContent data-testid="sheet-place-contents">
          <SheetHeader>
            <SheetTitle>{selectedPlace?.name || "Lagerplatz"}</SheetTitle>
            <SheetDescription>
              {selectedPlace && (
                <div className="space-y-1">
                  <div>Kapazität: {selectedPlace.capacity ?? "Unbegrenzt"}</div>
                  <div>Belegt: {selectedPlace.occupied}</div>
                  {selectedPlace.free !== null && <div>Frei: {selectedPlace.free}</div>}
                </div>
              )}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {placeContents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-contents">
                Keine Aufträge in diesem Lagerplatz
              </div>
            ) : (
              <div className="space-y-3">
                {placeContents.map((content) => (
                  <Card key={content.id} className="p-4" data-testid={`content-${content.id}`}>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm">
                          {content.order.displayOrderNumber || content.order.id.substring(0, 8)}
                        </span>
                        <span className="text-sm text-muted-foreground">{content.qty} Stk.</span>
                      </div>
                      <div className="font-medium">{content.order.title}</div>
                      <div className="text-sm text-muted-foreground">{content.order.customer}</div>
                      {content.note && (
                        <div className="text-sm text-muted-foreground italic">{content.note}</div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/orders/${content.order.id}`)}
                        className="w-full"
                        data-testid={`button-view-order-${content.order.id}`}
                      >
                        Auftrag öffnen
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
