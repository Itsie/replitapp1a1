import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProductionToday() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Produktion heute</h1>
        <p className="text-muted-foreground mt-1">
          Heutige Produktionsaufträge und Fortschritt
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Produktion heute</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground" data-testid="text-production-placeholder">
            Die Produktionsansicht wird in einer zukünftigen Version implementiert.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
