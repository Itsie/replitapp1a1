import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { insertOrderSchema, type InsertOrder } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function OrderNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<InsertOrder>({
    resolver: zodResolver(insertOrderSchema),
    defaultValues: {
      title: "",
      customer: "",
      department: "TEAMSPORT",
      dueDate: null,
      notes: null,
      location: null,
    },
  });
  
  const createMutation = useMutation({
    mutationFn: async (data: InsertOrder) => {
      const res = await apiRequest("POST", "/api/orders", data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Auftrag erstellt",
        description: "Der Auftrag wurde erfolgreich angelegt.",
      });
      setLocation(`/orders/${data.id}`);
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Der Auftrag konnte nicht erstellt werden.",
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: InsertOrder) => {
    // Normalize empty strings to null for optional fields
    const normalized = {
      ...data,
      dueDate: data.dueDate || null,
      notes: data.notes || null,
      location: data.location || null,
    };
    createMutation.mutate(normalized);
  };
  
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6 lg:p-8">
        <Button
          variant="ghost"
          onClick={() => setLocation("/orders")}
          className="mb-6"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Zurück
        </Button>
        
        <Card>
          <CardHeader>
            <CardTitle>Neuer Auftrag</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titel *</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-title"
                          placeholder="z.B. FC Bayern München Trikots 2024"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="customer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kunde *</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-customer"
                          placeholder="Name des Kunden"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Abteilung *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-department">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="TEAMSPORT">Teamsport</SelectItem>
                          <SelectItem value="TEXTILVEREDELUNG">Textilveredelung</SelectItem>
                          <SelectItem value="STICKEREI">Stickerei</SelectItem>
                          <SelectItem value="DRUCK">Druck</SelectItem>
                          <SelectItem value="SONSTIGES">Sonstiges</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fälligkeitsdatum</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-duedate"
                          type="datetime-local"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Standort</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-location"
                          placeholder="z.B. Regal A3"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notizen</FormLabel>
                      <FormControl>
                        <Textarea
                          data-testid="input-notes"
                          placeholder="Zusätzliche Anmerkungen..."
                          rows={4}
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/orders")}
                    data-testid="button-cancel"
                  >
                    Abbrechen
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-create"
                  >
                    {createMutation.isPending ? "Wird erstellt..." : "Auftrag anlegen"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
