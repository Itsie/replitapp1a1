import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Warehouse() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Lager</h1>
        <p className="text-muted-foreground mt-1">
          Lagerverwaltung und Bestandsübersicht
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Lager</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground" data-testid="text-warehouse-placeholder">
            Die Lageransicht wird in einer zukünftigen Version implementiert.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
