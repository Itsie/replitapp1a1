import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Settings() {
  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Einstellungen</h1>
        <p className="text-muted-foreground mt-1">
          Systemeinstellungen und Konfiguration
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Einstellungen</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground" data-testid="text-settings-placeholder">
            Die Einstellungsansicht wird in einer zukünftigen Version implementiert.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
