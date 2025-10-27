import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Package, Building2, Edit, Trash2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

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

export default function Lager() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<WarehouseGroup | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  // Fetch groups with places
  const { data: groups = [], isLoading } = useQuery<WarehouseGroup[]>({
    queryKey: ["/api/warehouse/groups"],
  });

  // Create group mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string | null }) => {
      const res = await apiRequest("POST", "/api/warehouse/groups", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create group");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/groups"] });
      toast({
        title: "Bereich erstellt",
        description: "Der Lagerbereich wurde erfolgreich erstellt.",
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

  // Update group mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description: string | null } }) => {
      const res = await apiRequest("PATCH", `/api/warehouse/groups/${id}`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update group");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/groups"] });
      toast({
        title: "Bereich aktualisiert",
        description: "Der Lagerbereich wurde erfolgreich aktualisiert.",
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

  // Delete group mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/warehouse/groups/${id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete group");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/groups"] });
      toast({
        title: "Bereich gelöscht",
        description: "Der Lagerbereich wurde erfolgreich gelöscht.",
      });
      setDeleteDialogOpen(false);
      setDeletingGroupId(null);
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
    setFormDescription("");
    setEditingGroup(null);
  };

  const handleAddClick = () => {
    resetForm();
    setAddDialogOpen(true);
  };

  const handleEditClick = (group: WarehouseGroup) => {
    setEditingGroup(group);
    setFormName(group.name);
    setFormDescription(group.description || "");
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (groupId: string) => {
    setDeletingGroupId(groupId);
    setDeleteDialogOpen(true);
  };

  const handleAddSubmit = () => {
    createMutation.mutate({
      name: formName,
      description: formDescription || null,
    });
  };

  const handleEditSubmit = () => {
    if (!editingGroup) return;
    updateMutation.mutate({
      id: editingGroup.id,
      data: {
        name: formName,
        description: formDescription || null,
      },
    });
  };

  const handleDeleteConfirm = () => {
    if (!deletingGroupId) return;
    deleteMutation.mutate(deletingGroupId);
  };

  const calculateStats = (places: WarehousePlace[]) => {
    const total = places.length;
    const occupied = places.filter(p => p.occupiedByOrderId !== null).length;
    const free = total - occupied;
    return { total, occupied, free };
  };

  if (isLoading) {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Lager</h1>
          <p className="text-muted-foreground mt-1">Lagerverwaltung nach Bereichen</p>
        </div>
        <div className="text-muted-foreground">Lade Bereiche...</div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-lager-title">Lager</h1>
            <p className="text-muted-foreground mt-1">Lagerverwaltung nach Bereichen</p>
          </div>
          <Button onClick={handleAddClick} data-testid="button-add-group">
            <Plus className="h-4 w-4 mr-2" />
            Bereich hinzufügen
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground" data-testid="text-no-groups">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Noch keine Lagerbereiche angelegt</p>
              <p className="text-sm mt-2">Erstellen Sie einen Bereich, um Lagerplätze zu verwalten</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const stats = calculateStats(group.places);
            return (
              <Card
                key={group.id}
                className="hover-elevate active-elevate-2 cursor-pointer"
                onClick={() => setLocation(`/lager/${group.id}`)}
                data-testid={`card-group-${group.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="h-5 w-5 flex-shrink-0" />
                        <span className="truncate">{group.name}</span>
                      </CardTitle>
                      {group.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {group.description}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Plätze gesamt</span>
                      <Badge variant="secondary">{stats.total}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Belegt</span>
                      <Badge variant={stats.occupied > 0 ? "default" : "secondary"}>
                        {stats.occupied}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Frei</span>
                      <Badge variant={stats.free > 0 ? "outline" : "secondary"}>
                        {stats.free}
                      </Badge>
                    </div>
                    <div className="pt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(group)}
                        className="flex-1"
                        data-testid={`button-edit-group-${group.id}`}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Bearbeiten
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(group.id)}
                        data-testid={`button-delete-group-${group.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent data-testid="dialog-add-group">
          <DialogHeader>
            <DialogTitle>Bereich hinzufügen</DialogTitle>
            <DialogDescription>
              Erstellen Sie einen neuen Lagerbereich für organisierte Plätze
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Bereichsname *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="z.B. Verkauf, Produktion, Versand"
                data-testid="input-group-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Beschreibung (optional)</Label>
              <Input
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="z.B. Fertige Aufträge zur Abholung"
                data-testid="input-group-description"
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
              data-testid="button-submit-add-group"
            >
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-group">
          <DialogHeader>
            <DialogTitle>Bereich bearbeiten</DialogTitle>
            <DialogDescription>
              Aktualisieren Sie die Eigenschaften des Lagerbereichs
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Bereichsname *</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                data-testid="input-edit-group-name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Beschreibung (optional)</Label>
              <Input
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                data-testid="input-edit-group-description"
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
              data-testid="button-submit-edit-group"
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-group">
          <AlertDialogHeader>
            <AlertDialogTitle>Bereich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Alle Lagerplätze in diesem Bereich werden ebenfalls gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-group"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
