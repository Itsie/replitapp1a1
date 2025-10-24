import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Search, Plus, Eye, ArrowUpDown, ArrowUp, ArrowDown, LayoutGrid, Table as TableIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import type { OrderWithRelations, OrderSource, WorkflowState } from "@shared/schema";
import { useDebounce } from "@/hooks/use-debounce";

type ViewMode = 'table' | 'cards';

export default function OrdersList() {
  const [location, setLocation] = useLocation();
  
  // View mode with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('orders_viewMode');
    return (saved === 'table' || saved === 'cards') ? saved : 'table';
  });
  
  useEffect(() => {
    localStorage.setItem('orders_viewMode', viewMode);
  }, [viewMode]);
  
  // Read initial search query from URL
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get("q") || "";
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [department, setDepartment] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [workflow, setWorkflow] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([]);
  
  // Update search query when URL changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") || "";
    if (q !== searchQuery) {
      setSearchQuery(q);
    }
  }, [location]);
  
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
    return new Date(date).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
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
        <div className="font-medium min-w-[200px]">{row.original.title}</div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "customer",
      header: "Kunde",
      cell: ({ row }) => (
        <div className="min-w-[150px]">{row.original.customer}</div>
      ),
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
      enableSorting: true,
    },
    {
      accessorKey: "dueDate",
      header: "Fälligkeit",
      cell: ({ row }) => (
        <div className="min-w-[100px]">{formatDate(row.original.dueDate)}</div>
      ),
      enableSorting: true,
    },
    {
      id: "sizeTable",
      header: "Größentabelle",
      cell: ({ row }) => (
        <div className="text-center">{row.original.sizeTable ? "✓" : "—"}</div>
      ),
    },
    {
      id: "assets",
      header: "Druckdaten",
      cell: ({ row }) => (
        <div className="text-center">{row.original.printAssets.length || "—"}</div>
      ),
    },
    {
      id: "actions",
      header: "Aktionen",
      cell: ({ row }) => (
        <Link href={`/orders/${row.original.id}`}>
          <Button variant="ghost" size="sm" data-testid={`button-view-${row.original.id}`}>
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        </Link>
      ),
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
  
  // Get sorted data for both views
  const sortedOrders = table.getRowModel().rows.map(row => row.original);
  
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Aufträge</h1>
          <p className="text-muted-foreground mt-1">
            Verwaltung aller Produktionsaufträge
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-lg p-1 gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  data-testid="button-view-table"
                  className="h-8 px-3"
                >
                  <TableIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Tabellenansicht</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('cards')}
                  data-testid="button-view-cards"
                  className="h-8 px-3"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Kartenansicht</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <Link href="/orders/new">
            <Button data-testid="button-create-order">
              <Plus className="h-4 w-4 mr-2" />
              Neuer Auftrag
            </Button>
          </Link>
        </div>
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
      
      {/* Conditional rendering based on view mode */}
      {viewMode === 'table' && (
        <div className="border rounded-lg overflow-hidden">
          <div className="relative overflow-x-auto max-h-[calc(100vh-280px)]">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="sticky top-0 bg-background z-10 border-b">
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button
                            type="button"
                            className="flex items-center gap-2 font-medium hover:text-foreground transition-colors"
                            onClick={header.column.getToggleSortingHandler()}
                            aria-label={`Sort by ${header.column.columnDef.header}`}
                            aria-sort={
                              header.column.getIsSorted() === "asc"
                                ? "ascending"
                                : header.column.getIsSorted() === "desc"
                                ? "descending"
                                : "none"
                            }
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {header.column.getIsSorted() === "asc" ? (
                              <ArrowUp className="h-4 w-4" />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ArrowDown className="h-4 w-4" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4 opacity-50" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(8)].map((_, i) => (
                    <TableRow key={i}>
                      {columns.map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                          <Search className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">Keine Aufträge gefunden</h3>
                        <p className="text-sm text-muted-foreground mb-4" data-testid="text-no-orders">
                          {searchQuery || department || source || workflow
                            ? "Keine Aufträge entsprechen den Filterkriterien."
                            : "Erstellen Sie einen neuen Auftrag, um loszulegen."}
                        </p>
                        <Link href="/orders/new">
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Neuer Auftrag
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-testid={`row-order-${row.original.id}`}
                      className="cursor-pointer hover-elevate"
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('button, a')) return;
                        setLocation(`/orders/${row.original.id}`);
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      
      {viewMode === 'cards' && (
        <>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <div className="flex gap-2 mb-3">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-4 w-1/3" />
                </Card>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Keine Aufträge gefunden</h3>
              <p className="text-sm text-muted-foreground mb-4" data-testid="text-no-orders">
                {searchQuery || department || source || workflow
                  ? "Keine Aufträge entsprechen den Filterkriterien."
                  : "Erstellen Sie einen neuen Auftrag, um loszulegen."}
              </p>
              <Link href="/orders/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Neuer Auftrag
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedOrders.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <Card 
                    className="p-4 flex flex-col justify-between border-muted/60 hover:shadow-md transition cursor-pointer hover-elevate"
                    data-testid={`card-order-${order.id}`}
                  >
                    <div>
                      <h3 className="font-medium text-base truncate mb-1">{order.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">{order.customer}</p>
                    </div>
                    
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">{order.department}</Badge>
                      <Badge variant={getSourceBadgeVariant(order.source)}>
                        {order.source}
                      </Badge>
                      <Badge variant={getWorkflowBadgeVariant(order.workflow)}>
                        {order.workflow}
                      </Badge>
                    </div>
                    
                    <div className="mt-3 text-xs text-muted-foreground">
                      {order.dueDate ? (
                        <>Fällig: {formatDate(order.dueDate)}</>
                      ) : (
                        <>Kein Lieferdatum</>
                      )}
                    </div>
                    
                    {(order.sizeTable || order.printAssets.length > 0) && (
                      <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                        {order.sizeTable && <span>✓ Größentabelle</span>}
                        {order.printAssets.length > 0 && (
                          <span>✓ {order.printAssets.length} Druckdaten</span>
                        )}
                      </div>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
