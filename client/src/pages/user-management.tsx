import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, UserPlus, Shield } from "lucide-react";
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

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

const ROLES = [
  { value: 'ADMIN', label: 'Admin', description: 'Voller Zugriff' },
  { value: 'PROD_PLAN', label: 'Produktionsplanung', description: 'Planung' },
  { value: 'PROD_RUN', label: 'Produktion', description: 'Ausführung' },
  { value: 'SALES_OPS', label: 'Vertrieb', description: 'Aufträge' },
  { value: 'ACCOUNTING', label: 'Buchhaltung', description: 'Abrechnung' },
];

export default function UserManagementPage() {
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("SALES_OPS");

  // Fetch users
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: { email: string; name: string; password: string; role: string }) => {
      await apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Benutzer erstellt",
        description: "Der Benutzer wurde erfolgreich erstellt.",
      });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Benutzer konnte nicht erstellt werden.",
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ email: string; name: string; role: string; password?: string }> }) => {
      await apiRequest("PATCH", `/api/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Benutzer aktualisiert",
        description: "Der Benutzer wurde erfolgreich aktualisiert.",
      });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Benutzer konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Benutzer gelöscht",
        description: "Der Benutzer wurde erfolgreich gelöscht.",
      });
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Benutzer konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormEmail("");
    setFormName("");
    setFormPassword("");
    setFormRole("SALES_OPS");
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate({
      email: formEmail,
      name: formName,
      password: formPassword,
      role: formRole,
    });
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const updateData: any = {
      email: formEmail,
      name: formName,
      role: formRole,
    };

    // Only include password if it's been changed
    if (formPassword.trim()) {
      updateData.password = formPassword;
    }

    updateUserMutation.mutate({
      id: selectedUser.id,
      data: updateData,
    });
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setFormEmail(user.email);
    setFormName(user.name);
    setFormRole(user.role);
    setFormPassword("");
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  // Check if current user is ADMIN
  if (!currentUser || currentUser.role !== 'ADMIN') {
    return (
      <div className="w-full px-4 md:px-6 py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Zugriff verweigert</h2>
            <p className="text-muted-foreground">
              Sie haben keine Berechtigung, diese Seite zu besuchen.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Benutzerverwaltung</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Benutzer und ihre Rollen im System
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-user">
          <Plus className="mr-2 h-4 w-4" />
          Benutzer erstellen
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Benutzer</CardTitle>
          <CardDescription>
            {users?.length || 0} Benutzer im System
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Laden...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                        {ROLES.find(r => r.value === user.role)?.label || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(user)}
                          data-testid={`button-edit-${user.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(user)}
                          disabled={user.id === currentUser.id}
                          data-testid={`button-delete-${user.id}`}
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

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent data-testid="dialog-create-user">
          <form onSubmit={handleCreateUser}>
            <DialogHeader>
              <DialogTitle>
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Neuen Benutzer erstellen
                </div>
              </DialogTitle>
              <DialogDescription>
                Erstellen Sie einen neuen Benutzer mit E-Mail, Name und Rolle
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="create-email">E-Mail</Label>
                <Input
                  id="create-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                  data-testid="input-create-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-name">Name</Label>
                <Input
                  id="create-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  data-testid="input-create-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password">Passwort</Label>
                <Input
                  id="create-password"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  required
                  minLength={6}
                  data-testid="input-create-password"
                />
                <p className="text-xs text-muted-foreground">Mindestens 6 Zeichen</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-role">Rolle</Label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger id="create-role" data-testid="select-create-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div>
                          <div>{role.label}</div>
                          <div className="text-xs text-muted-foreground">{role.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-submit-create">
                {createUserMutation.isPending ? "Wird erstellt..." : "Erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-user">
          <form onSubmit={handleUpdateUser}>
            <DialogHeader>
              <DialogTitle>
                <div className="flex items-center gap-2">
                  <Edit className="h-5 w-5" />
                  Benutzer bearbeiten
                </div>
              </DialogTitle>
              <DialogDescription>
                Aktualisieren Sie Benutzerinformationen und Rolle
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">E-Mail</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                  data-testid="input-edit-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  data-testid="input-edit-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">Neues Passwort (optional)</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  minLength={6}
                  data-testid="input-edit-password"
                />
                <p className="text-xs text-muted-foreground">
                  Leer lassen, um das Passwort nicht zu ändern
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Rolle</Label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger id="edit-role" data-testid="select-edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div>
                          <div>{role.label}</div>
                          <div className="text-xs text-muted-foreground">{role.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setSelectedUser(null);
                  resetForm();
                }}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending} data-testid="button-submit-edit">
                {updateUserMutation.isPending ? "Wird gespeichert..." : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-user">
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Sind Sie sicher, dass Sie den Benutzer "{selectedUser?.name}" löschen möchten?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)}
              disabled={deleteUserMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteUserMutation.isPending ? "Wird gelöscht..." : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
