import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useUser } from "@/contexts/UserContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { User, Key, AlertCircle, CheckCircle2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function ProfilePage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      await apiRequest("POST", "/api/auth/change-password", data);
    },
    onSuccess: () => {
      toast({
        title: "Passwort geändert",
        description: "Ihr Passwort wurde erfolgreich geändert.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Passwort konnte nicht geändert werden.",
        variant: "destructive",
      });
    },
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Fehler",
        description: "Die Passwörter stimmen nicht überein.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Fehler",
        description: "Das Passwort muss mindestens 6 Zeichen lang sein.",
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Laden...</div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Profil</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Ihre Kontoinformationen und Sicherheitseinstellungen
        </p>
      </div>

      <div className="space-y-6">
        {/* User Information Card */}
        <Card data-testid="card-user-info">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Benutzerinformationen</CardTitle>
            </div>
            <CardDescription>
              Ihre persönlichen Informationen und Rolle im System
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Name</Label>
                <div className="text-sm" data-testid="text-user-name">
                  {user.name}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">E-Mail</Label>
                <div className="text-sm" data-testid="text-user-email">
                  {user.email}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Rolle</Label>
                <div className="text-sm" data-testid="text-user-role">
                  {user.role}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Benutzer-ID</Label>
                <div className="text-sm text-muted-foreground font-mono">
                  {user.id}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card data-testid="card-change-password">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              <CardTitle>Passwort ändern</CardTitle>
            </div>
            <CardDescription>
              Ändern Sie Ihr Passwort, um Ihr Konto zu schützen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Aktuelles Passwort</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={changePasswordMutation.isPending}
                  data-testid="input-current-password"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="new-password">Neues Passwort</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={changePasswordMutation.isPending}
                  data-testid="input-new-password"
                />
                <p className="text-xs text-muted-foreground">
                  Mindestens 6 Zeichen
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Passwort bestätigen</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={changePasswordMutation.isPending}
                  data-testid="input-confirm-password"
                />
              </div>

              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive" data-testid="text-password-mismatch">
                  <AlertCircle className="h-4 w-4" />
                  <span>Die Passwörter stimmen nicht überein</span>
                </div>
              )}

              {newPassword && confirmPassword && newPassword === confirmPassword && newPassword.length >= 6 && (
                <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Passwörter stimmen überein</span>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  disabled={changePasswordMutation.isPending}
                  data-testid="button-cancel"
                >
                  Abbrechen
                </Button>
                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  data-testid="button-save-password"
                >
                  {changePasswordMutation.isPending ? "Wird gespeichert..." : "Passwort ändern"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
