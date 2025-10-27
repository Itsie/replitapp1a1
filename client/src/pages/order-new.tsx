import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { insertOrderSchema, type InsertOrder } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PositionsEditor } from "@/components/positions-editor";

type LocalPosition = {
  id?: number;
  articleName: string;
  articleNumber: string | null;
  qty: number;
  unit: string;
  unitPriceNet: number;
  vatRate: number;
  procurement: string;
  supplierNote: string | null;
  lineNet?: number;
  lineVat?: number;
  lineGross?: number;
};

type WarehousePlace = {
  id: string;
  name: string;
  group: { id: string; name: string };
};

export default function OrderNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [useAlternateShipping, setUseAlternateShipping] = useState(false);
  const [positions, setPositions] = useState<LocalPosition[]>([]);
  
  // Fetch all warehouse places for location selection
  const { data: warehousePlaces = [] } = useQuery<WarehousePlace[]>({
    queryKey: ["/api/warehouse/places"],
    queryFn: async () => {
      const res = await fetch("/api/warehouse/places");
      if (!res.ok) return [];
      return res.json();
    },
  });
  
  const form = useForm<InsertOrder>({
    resolver: zodResolver(insertOrderSchema),
    mode: "onChange",
    defaultValues: {
      title: "",
      customer: "", // Will be auto-generated
      department: "TEAMSPORT",
      dueDate: null,
      notes: null,
      location: null,
      locationPlaceId: null,
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
      shipCountry: null,
    },
  });
  
  const createMutation = useMutation({
    mutationFn: async (data: InsertOrder) => {
      const orderRes = await apiRequest("POST", "/api/orders", data);
      if (!orderRes.ok) {
        const errorText = await orderRes.text();
        throw new Error(errorText || "Auftrag konnte nicht erstellt werden");
      }
      const order = await orderRes.json();

      if (positions.length > 0) {
        const positionsToCreate = positions.map(p => ({
          articleName: p.articleName,
          articleNumber: p.articleNumber,
          qty: p.qty,
          unit: p.unit,
          unitPriceNet: p.unitPriceNet,
          vatRate: p.vatRate,
          procurement: p.procurement,
          supplierNote: p.supplierNote,
        }));

        const posRes = await apiRequest("POST", `/api/orders/${order.id}/positions`, positionsToCreate);
        if (!posRes.ok) {
          const errorText = await posRes.text();
          toast({
            title: "Warnung",
            description: `Auftrag wurde erstellt, aber Positionen konnten nicht gespeichert werden: ${errorText}`,
            variant: "destructive",
          });
          return order;
        }
      }

      return order;
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
    if (!useAlternateShipping) {
      data.shipStreet = null;
      data.shipZip = null;
      data.shipCity = null;
      data.shipCountry = null;
    }
    
    // Auto-generate customer display name from company OR firstName + lastName
    if (data.company) {
      data.customer = data.company;
    } else if (data.contactFirstName && data.contactLastName) {
      data.customer = `${data.contactFirstName} ${data.contactLastName}`;
    } else {
      // This should not happen due to form validation, but fallback just in case
      data.customer = "Unbekannt";
    }
    
    // Convert "NONE" to null for locationPlaceId
    if (data.locationPlaceId === "NONE") {
      data.locationPlaceId = null;
    }
    
    createMutation.mutate(data);
  };

  // Check if form is valid by checking if there are no errors
  const hasNoFormErrors = Object.keys(form.formState.errors).length === 0;
  const isFormValid = hasNoFormErrors && positions.length > 0;
  
  // Collect missing required fields
  const getMissingFields = () => {
    const missing: string[] = [];
    const errors = form.formState.errors;
    
    if (errors.title) missing.push("Titel");
    if (errors.company) missing.push("Firma ODER Vor- und Nachname");
    if (errors.customerEmail) missing.push("E-Mail");
    if (errors.customerPhone) missing.push("Telefon");
    if (errors.billStreet) missing.push("Rechnungsadresse: Straße");
    if (errors.billZip) missing.push("Rechnungsadresse: PLZ");
    if (errors.billCity) missing.push("Rechnungsadresse: Stadt");
    
    if (positions.length === 0) missing.push("Mindestens eine Position");
    
    return missing;
  };
  
  const missingFields = getMissingFields();
  const showValidationHint = !isFormValid && (form.formState.isSubmitted || Object.keys(form.formState.touchedFields).length > 0);
  
  return (
    <div className="min-h-screen flex flex-col w-full">
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
          <h1 className="text-3xl font-bold tracking-tight mt-4">Neuer Auftrag</h1>
          <p className="text-muted-foreground mt-1">Erstellen Sie einen neuen internen Produktionsauftrag</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="w-full">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 space-y-6">
                  <Card className="rounded-2xl">
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
                                  data-testid="input-contactFirstName"
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
                                  data-testid="input-contactLastName"
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
                                  data-testid="input-customerEmail"
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
                                  data-testid="input-customerPhone"
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

                  <Card className="rounded-2xl">
                    <CardHeader>
                      <CardTitle>Rechnungsadresse</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="billStreet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Straße & Hausnummer *</FormLabel>
                            <FormControl>
                              <Input
                                data-testid="input-billStreet"
                                placeholder="Musterstraße 123"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="billZip"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>PLZ *</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-billZip"
                                  placeholder="10115"
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
                            <FormItem className="col-span-2">
                              <FormLabel>Stadt *</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-billCity"
                                  placeholder="Berlin"
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
                            <Select onValueChange={field.onChange} value={field.value || "DE"}>
                              <FormControl>
                                <SelectTrigger data-testid="select-billCountry">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="DE">Deutschland</SelectItem>
                                <SelectItem value="AT">Österreich</SelectItem>
                                <SelectItem value="CH">Schweiz</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Lieferadresse</CardTitle>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="useAlternateShipping"
                            checked={useAlternateShipping}
                            onCheckedChange={(checked) => {
                              const isChecked = checked as boolean;
                              setUseAlternateShipping(isChecked);
                              // Set default country when enabling alternate shipping
                              if (isChecked) {
                                form.setValue('shipCountry', 'DE');
                              } else {
                                // Clear all shipping fields when disabling
                                form.setValue('shipStreet', null);
                                form.setValue('shipZip', null);
                                form.setValue('shipCity', null);
                                form.setValue('shipCountry', null);
                              }
                            }}
                            data-testid="checkbox-alternate-shipping"
                          />
                          <label
                            htmlFor="useAlternateShipping"
                            className="text-sm font-normal cursor-pointer"
                          >
                            Abweichende Lieferadresse
                          </label>
                        </div>
                      </div>
                    </CardHeader>
                    {useAlternateShipping && (
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="shipStreet"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Straße & Hausnummer</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-shipStreet"
                                  placeholder="Lieferstraße 456"
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="grid grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="shipZip"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>PLZ</FormLabel>
                                <FormControl>
                                  <Input
                                    data-testid="input-shipZip"
                                    placeholder="67890"
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
                              <FormItem className="col-span-2">
                                <FormLabel>Stadt</FormLabel>
                                <FormControl>
                                  <Input
                                    data-testid="input-shipCity"
                                    placeholder="Lieferstadt"
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
                              <Select onValueChange={field.onChange} value={field.value || "DE"}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-shipCountry">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="DE">Deutschland</SelectItem>
                                  <SelectItem value="AT">Österreich</SelectItem>
                                  <SelectItem value="CH">Schweiz</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    )}
                  </Card>
                </div>

                <div className="lg:col-span-4 space-y-6">
                  <Card className="rounded-2xl">
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
                        name="department"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Abteilung *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
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
                                data-testid="input-dueDate"
                                type="date"
                                {...field}
                                value={field.value ? new Date(field.value).toISOString().split('T')[0] : ""}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    // Convert to ISO datetime string
                                    const date = new Date(e.target.value);
                                    date.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
                                    field.onChange(date.toISOString());
                                  } else {
                                    field.onChange(null);
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="locationPlaceId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lagerplatz</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-locationPlace">
                                  <SelectValue placeholder="Bitte wählen..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="NONE">Kein Lagerplatz</SelectItem>
                                {warehousePlaces.map((place) => (
                                  <SelectItem key={place.id} value={place.id}>
                                    {place.group.name} - {place.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Wählen Sie einen Lagerplatz aus, wo dieser Auftrag gelagert werden soll.
                            </FormDescription>
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
                </div>

                <div className="lg:col-span-12">
                  <PositionsEditor
                    positions={positions}
                    onChange={setPositions}
                  />
                </div>

                <div className="lg:col-span-12">
                  <div className="border-t pt-6 mt-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        {showValidationHint && missingFields.length > 0 && (
                          <div className="flex items-center gap-2 text-destructive text-sm">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span className="font-medium">
                              Noch {missingFields.length} Pflichtfeld{missingFields.length > 1 ? 'er' : ''} fehlt: {missingFields.join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 shrink-0">
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
                          disabled={!isFormValid || createMutation.isPending}
                          onClick={form.handleSubmit(onSubmit)}
                          data-testid="button-create"
                        >
                          {createMutation.isPending ? "Wird erstellt..." : "Auftrag erstellen"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
