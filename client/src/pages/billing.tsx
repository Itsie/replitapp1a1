import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Billing() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Abrechnung</h1>
        <p className="text-muted-foreground mt-1">
          Rechnungsstellung und Abrechnungsverwaltung
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Abrechnung</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground" data-testid="text-billing-placeholder">
            Die Abrechnungsansicht wird in einer zukünftigen Version implementiert.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
