import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { insertOrderSchema, type InsertOrder } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function OrderNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [useAlternateShipping, setUseAlternateShipping] = useState(false);
  
  const form = useForm<InsertOrder>({
    resolver: zodResolver(insertOrderSchema),
    defaultValues: {
      title: "",
      customer: "",
      department: "TEAMSPORT",
      dueDate: null,
      notes: null,
      location: null,
      company: null,
      contactFirstName: null,
      contactLastName: null,
      customerEmail: "",
      customerPhone: "",
      billStreet: "",
      billZip: "",
      billCity: "",
      billCountry: "DE",
      shipStreet: null,
      shipZip: null,
      shipCity: null,
      shipCountry: "DE",
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
    onError: (error: any) => {
      const message = error?.message || "Der Auftrag konnte nicht erstellt werden.";
      toast({
        title: "Fehler",
        description: message,
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: InsertOrder) => {
    // If not using alternate shipping, clear shipping fields
    if (!useAlternateShipping) {
      data.shipStreet = null;
      data.shipZip = null;
      data.shipCity = null;
      data.shipCountry = null;
    }
    
    createMutation.mutate(data);
  };
  
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
      
      <div className="max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Neuer Auftrag</h1>
          <p className="text-muted-foreground mt-1">
            Erstellen Sie einen neuen internen Produktionsauftrag
          </p>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Customer Contact Section */}
            <Card>
              <CardHeader>
                <CardTitle>Kunde</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Firma</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-company"
                            placeholder="Firmenname (oder Vor- und Nachname ausfüllen)"
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
                    name="contactFirstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vorname</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-contact-firstname"
                            placeholder="Vorname"
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
                    name="contactLastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nachname</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-contact-lastname"
                            placeholder="Nachname"
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
                    name="customerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-Mail *</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-customer-email"
                            type="email"
                            placeholder="kunde@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="customerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefon *</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-customer-phone"
                            type="tel"
                            placeholder="+49 123 456789"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Billing Address Section */}
            <Card>
              <CardHeader>
                <CardTitle>Rechnungsadresse</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="billStreet"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Straße und Hausnummer *</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-bill-street"
                          placeholder="Musterstraße 123"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="billZip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PLZ *</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-bill-zip"
                            placeholder="12345"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="billCity"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Stadt *</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-bill-city"
                            placeholder="München"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="billCountry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Land</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-bill-country"
                          placeholder="DE"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            
            {/* Shipping Address Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Lieferadresse</span>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="use-alternate-shipping"
                      checked={useAlternateShipping}
                      onCheckedChange={(checked) => {
                        const isChecked = checked === true;
                        setUseAlternateShipping(isChecked);
                        
                        // Clear shipping fields when unchecking
                        if (!isChecked) {
                          form.setValue("shipStreet", null);
                          form.setValue("shipZip", null);
                          form.setValue("shipCity", null);
                          form.setValue("shipCountry", null);
                        }
                      }}
                      data-testid="checkbox-alternate-shipping"
                    />
                    <label
                      htmlFor="use-alternate-shipping"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Abweichende Lieferadresse
                    </label>
                  </div>
                </CardTitle>
              </CardHeader>
              {useAlternateShipping && (
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="shipStreet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Straße und Hausnummer *</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-ship-street"
                            placeholder="Lieferstraße 456"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="shipZip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PLZ *</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-ship-zip"
                              placeholder="54321"
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
                      name="shipCity"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Stadt *</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-ship-city"
                              placeholder="Berlin"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="shipCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Land</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-ship-country"
                            placeholder="DE"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              )}
            </Card>
            
            {/* Order Details Section */}
            <Card>
              <CardHeader>
                <CardTitle>Auftragsdaten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                      <FormLabel>Kunde (Anzeigename) *</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-customer"
                          placeholder="Name für Auftragsübersicht"
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
              </CardContent>
            </Card>
            
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
      </div>
    </>
  );
}
