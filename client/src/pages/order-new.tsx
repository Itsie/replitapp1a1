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

export default function OrderNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [useAlternateShipping, setUseAlternateShipping] = useState(false);
  const [positions, setPositions] = useState<LocalPosition[]>([]);
  
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
      // Step 1: Create the order
      const orderRes = await apiRequest("POST", "/api/orders", data);
      if (!orderRes.ok) {
        const errorText = await orderRes.text();
        throw new Error(errorText || "Auftrag konnte nicht erstellt werden");
      }
      const order = await orderRes.json();

      // Step 2: Create positions if any
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
    
    createMutation.mutate(data);
  };

  const isFormValid = form.formState.isValid && positions.length > 0;
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-[1600px] 2xl:max-w-[1920px] mx-auto px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => setLocation("/orders")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>
          <h1 className="text-3xl font-bold tracking-tight mt-4">Neuer Auftrag</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-24">
        <div className="max-w-[1600px] 2xl:max-w-[1920px] mx-auto px-6 py-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Two-column grid */}
              <div className="grid lg:grid-cols-12 gap-4">
                {/* Left Column - Customer Info */}
                <div className="lg:col-span-8 space-y-4">
                  {/* Kunde Card */}
                  <Card className="rounded-2xl border-muted/60 hover:shadow-sm">
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
                              <FormLabel>E-Mail</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-customerEmail"
                                  type="email"
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
                          name="customerPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Telefon</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-customerPhone"
                                  type="tel"
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Rechnungsadresse Card */}
                  <Card className="rounded-2xl border-muted/60 hover:shadow-sm">
                    <CardHeader>
                      <CardTitle>Rechnungsadresse</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="billStreet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Straße & Hausnummer</FormLabel>
                            <FormControl>
                              <Input
                                data-testid="input-billStreet"
                                placeholder="Musterstraße 123"
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
                          name="billZip"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>PLZ</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-billZip"
                                  placeholder="12345"
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
                          name="billCity"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel>Stadt</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-billCity"
                                  placeholder="Musterstadt"
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

                  {/* Lieferadresse Card (optional) */}
                  <Card className="rounded-2xl border-muted/60 hover:shadow-sm">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Lieferadresse</CardTitle>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="useAlternateShipping"
                            checked={useAlternateShipping}
                            onCheckedChange={(checked) => setUseAlternateShipping(checked as boolean)}
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

                {/* Right Column - Order Data */}
                <div className="lg:col-span-4 space-y-4">
                  <Card className="rounded-2xl border-muted/60 hover:shadow-sm">
                    <CardHeader>
                      <CardTitle>Auftragsdaten</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Titel*</FormLabel>
                            <FormControl>
                              <Input
                                data-testid="input-title"
                                placeholder="z.B. Trikots FC Musterstadt"
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
                            <FormLabel>Kundenname*</FormLabel>
                            <FormControl>
                              <Input
                                data-testid="input-customer"
                                placeholder="FC Musterstadt"
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
                            <FormLabel>Abteilung*</FormLabel>
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
                                onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
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
                                placeholder="z.B. Lager A"
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
                </div>

                {/* Full Width - Positions */}
                <div className="lg:col-span-12">
                  <PositionsEditor
                    positions={positions}
                    onChange={setPositions}
                  />
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background z-10">
        <div className="max-w-[1600px] 2xl:max-w-[1920px] mx-auto px-6 py-4 flex justify-end gap-2">
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
  );
}
