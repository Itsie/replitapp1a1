import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OrderWithRelations, Department, OrderSource, WorkflowState } from "@shared/schema";
import { useDebounce } from "@/hooks/use-debounce";
import { 
  WORKFLOW_LABELS, 
  getWorkflowBadgeClass,
  getSourceBadgeClass,
  SOURCE_LABELS 
} from "@shared/schema";

export default function OrdersList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [department, setDepartment] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [workflow, setWorkflow] = useState<string>("");
  
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (department) params.set("department", department);
    if (source) params.set("source", source);
    if (workflow) params.set("workflow", workflow);
    const queryString = params.toString();
    return queryString ? `?${queryString}` : "";
  };
  
  const { data: orders = [], isLoading } = useQuery<OrderWithRelations[]>({
    queryKey: [`/api/orders${buildQueryString()}`],
  });
  
  const formatDate = (date: string | Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("de-DE");
  };
  
  
  return (
    <div className="w-full">
      <div className="w-full px-4 md:px-6 py-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">Aufträge</h1>
            <p className="text-sm text-muted-foreground mt-1">Verwaltung aller Produktionsaufträge</p>
          </div>
          <Link href="/orders/new">
            <Button data-testid="button-create-order">
              <Plus className="h-4 w-4 mr-2" />
              Neuer Auftrag
            </Button>
          </Link>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="input-search"
              placeholder="Suche nach Titel, Kunde oder ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={department || "ALL"} onValueChange={(val) => setDepartment(val === "ALL" ? "" : val)}>
            <SelectTrigger data-testid="select-department" className="w-full sm:w-48">
              <SelectValue placeholder="Abteilung" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alle Abteilungen</SelectItem>
              <SelectItem value="TEAMSPORT">Teamsport</SelectItem>
              <SelectItem value="TEXTILVEREDELUNG">Textilveredelung</SelectItem>
              <SelectItem value="STICKEREI">Stickerei</SelectItem>
              <SelectItem value="DRUCK">Druck</SelectItem>
              <SelectItem value="SONSTIGES">Sonstiges</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={source || "ALL"} onValueChange={(val) => setSource(val === "ALL" ? "" : val)}>
            <SelectTrigger data-testid="select-source" className="w-full sm:w-40">
              <SelectValue placeholder="Quelle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alle Quellen</SelectItem>
              <SelectItem value="JTL">JTL</SelectItem>
              <SelectItem value="INTERNAL">Intern</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={workflow || "ALL"} onValueChange={(val) => setWorkflow(val === "ALL" ? "" : val)}>
            <SelectTrigger data-testid="select-workflow" className="w-full sm:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alle Status</SelectItem>
              <SelectItem value="ENTWURF">Entwurf</SelectItem>
              <SelectItem value="NEU">Neu</SelectItem>
              <SelectItem value="PRUEFUNG">Prüfung</SelectItem>
              <SelectItem value="FUER_PROD">Für Produktion</SelectItem>
              <SelectItem value="IN_PROD">In Produktion</SelectItem>
              <SelectItem value="WARTET_FEHLTEILE">Wartet Fehlteile</SelectItem>
              <SelectItem value="FERTIG">Fertig</SelectItem>
              <SelectItem value="ZUR_ABRECHNUNG">Zur Abrechnung</SelectItem>
              <SelectItem value="ABGERECHNET">Abgerechnet</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded" />
                    <div className="h-3 bg-muted rounded w-5/6" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground" data-testid="text-no-orders">
                Keine Aufträge gefunden. Erstellen Sie einen neuen Auftrag.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <Card data-testid={`card-order-${order.id}`} className="hover-elevate cursor-pointer">
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate" data-testid={`text-title-${order.id}`}>
                        {order.title}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate" data-testid={`text-customer-${order.id}`}>
                        {order.customer}
                      </p>
                    </div>
                    <Badge className={getSourceBadgeClass(order.source)} data-testid={`badge-source-${order.id}`}>
                      {SOURCE_LABELS[order.source]}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" data-testid={`badge-department-${order.id}`}>
                        {order.department}
                      </Badge>
                      <Badge className={getWorkflowBadgeClass(order.workflow)} data-testid={`badge-workflow-${order.id}`}>
                        {WORKFLOW_LABELS[order.workflow]}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span data-testid={`text-duedate-${order.id}`}>
                        Fällig: {formatDate(order.dueDate)}
                      </span>
                      {order.sizeTable && (
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-sizetable-${order.id}`}>
                          Größentabelle
                        </Badge>
                      )}
                    </div>
                    
                    {order.printAssets.length > 0 && (
                      <div className="text-xs text-muted-foreground" data-testid={`text-assets-${order.id}`}>
                        {order.printAssets.length} Druckdaten
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
