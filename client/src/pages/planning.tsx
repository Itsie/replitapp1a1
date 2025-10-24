import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Planning() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Planung</h1>
        <p className="text-muted-foreground mt-1">
          Produktionsplanung und Kapazitätsmanagement
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Planung</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground" data-testid="text-planning-placeholder">
            Die Planungsansicht wird in einer zukünftigen Version implementiert.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
