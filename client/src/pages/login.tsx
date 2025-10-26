import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import logoUrl from "@assets/1a-textillogo_1761317866259.png";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", credentials);
      return await res.json();
    },
    onSuccess: async () => {
      // Refetch user query and wait for it to complete before navigating
      await queryClient.refetchQueries({ queryKey: ["/api/me"] });
      toast({
        title: "Anmeldung erfolgreich",
        description: "Willkommen zurück!",
      });
      // Force hard navigation to ensure page reload
      window.location.href = "/";
    },
    onError: (error: any) => {
      toast({
        title: "Anmeldung fehlgeschlagen",
        description: error.message || "Ungültige E-Mail oder Passwort",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (loginMutation.isPending) return;
    loginMutation.mutate({ email, password });
  }, [email, password, loginMutation]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800/50 backdrop-blur-sm">
        <CardHeader className="space-y-6 text-center">
          <div className="mx-auto flex items-center justify-center">
            <img 
              src={logoUrl} 
              alt="1aShirt Logo" 
              className="h-48 w-48 object-contain"
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-slate-100">
              Willkommen bei 1aShirt
            </CardTitle>
            <CardDescription className="text-slate-400">
              Melden Sie sich an, um fortzufahren
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">
                E-Mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="ihre.email@1ashirt.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loginMutation.isPending}
                className="border-slate-600 bg-slate-900/50 text-slate-100 placeholder:text-slate-500"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">
                Passwort
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loginMutation.isPending}
                className="border-slate-600 bg-slate-900/50 text-slate-100 placeholder:text-slate-500"
                data-testid="input-password"
              />
            </div>

            {loginMutation.isError && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive" data-testid="text-error">
                <AlertCircle className="h-4 w-4" />
                <span>Ungültige E-Mail oder Passwort</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? "Anmeldung läuft..." : "Anmelden"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
                onClick={() => {
                  toast({
                    title: "Passwort vergessen",
                    description: "Diese Funktion wird in Kürze verfügbar sein. Bitte kontaktieren Sie Ihren Administrator.",
                  });
                }}
                data-testid="link-forgot-password"
              >
                Passwort vergessen?
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            Demo-Zugänge: admin@1ashirt.de, planner@1ashirt.de, worker@1ashirt.de
            <br />
            Passwort für alle: demo123
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
