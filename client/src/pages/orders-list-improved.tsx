import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, Plus, LayoutGrid, Table as TableIcon, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import type { OrderWithRelations, Department, OrderSource, WorkflowState } from "@shared/schema";
import { useDebounce } from "@/hooks/use-debounce";

type ViewMode = "card" | "table";

export default function OrdersList() {
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [searchQuery, setSearchQuery] = useState("");
  const [department, setDepartment] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [workflow, setWorkflow] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([]);
  
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
  
  const getSourceBadgeVariant = (source: OrderSource) => {
    return source === "JTL" ? "default" : "secondary";
  };
  
  const getWorkflowBadgeVariant = (workflow: WorkflowState) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ENTWURF: "outline",
      NEU: "default",
      PRUEFUNG: "secondary",
      FUER_PROD: "default",
      IN_PROD: "default",
      WARTET_FEHLTEILE: "destructive",
      FERTIG: "secondary",
      ZUR_ABRECHNUNG: "outline",
      ABGERECHNET: "outline",
    };
    return variants[workflow] || "outline";
  };
  
  const columns: ColumnDef<OrderWithRelations>[] = [
    {
      accessorKey: "title",
      header: "Titel",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.title}</div>
      ),
    },
    {
      accessorKey: "customer",
      header: "Kunde",
    },
    {
      accessorKey: "department",
      header: "Abteilung",
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.department}</Badge>
      ),
    },
    {
      accessorKey: "source",
      header: "Quelle",
      cell: ({ row }) => (
        <Badge variant={getSourceBadgeVariant(row.original.source)}>
          {row.original.source}
        </Badge>
      ),
    },
    {
      accessorKey: "workflow",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={getWorkflowBadgeVariant(row.original.workflow)}>
          {row.original.workflow}
        </Badge>
      ),
    },
    {
      accessorKey: "dueDate",
      header: "Fälligkeit",
      cell: ({ row }) => formatDate(row.original.dueDate),
    },
    {
      id: "sizeTable",
      header: "Größentabelle",
      cell: ({ row }) => row.original.sizeTable ? "✓" : "—",
    },
    {
      id: "assets",
      header: "Druckdaten",
      cell: ({ row }) => row.original.printAssets.length || "—",
    },
  ];
  
  const table = useReactTable({
    data: orders,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Aufträge</h1>
          <p className="text-muted-foreground mt-1">
            Verwaltung aller Produktionsaufträge
          </p>
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
        
        <div className="flex gap-1 border rounded-md p-1">
          <Button
            variant={viewMode === "card" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("card")}
            data-testid="button-view-card"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("table")}
            data-testid="button-view-table"
          >
            <TableIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {isLoading ? (
        viewMode === "card" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col, i) => (
                    <TableHead key={i}>
                      <Skeleton className="h-4 w-24" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Keine Aufträge gefunden</h3>
            <p className="text-sm text-muted-foreground mb-4" data-testid="text-no-orders">
              Erstellen Sie einen neuen Auftrag, um loszulegen.
            </p>
            <Link href="/orders/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Neuer Auftrag
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card data-testid={`card-order-${order.id}`} className="hover-elevate cursor-pointer transition-shadow">
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate" data-testid={`text-title-${order.id}`}>
                      {order.title}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate" data-testid={`text-customer-${order.id}`}>
                      {order.customer}
                    </p>
                  </div>
                  <Badge variant={getSourceBadgeVariant(order.source)} data-testid={`badge-source-${order.id}`}>
                    {order.source}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" data-testid={`badge-department-${order.id}`}>
                      {order.department}
                    </Badge>
                    <Badge variant={getWorkflowBadgeVariant(order.workflow)} data-testid={`badge-workflow-${order.id}`}>
                      {order.workflow}
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
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-testid={`row-order-${row.original.id}`}
                  className="cursor-pointer"
                  onClick={() => window.location.href = `/orders/${row.original.id}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
