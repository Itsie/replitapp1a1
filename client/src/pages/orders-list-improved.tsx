import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Search, Plus, Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type { OrderWithRelations, OrderSource, WorkflowState } from "@shared/schema";
import { useDebounce } from "@/hooks/use-debounce";

export default function OrdersList() {
  const [, setLocation] = useLocation();
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
      </div>
      
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
                      // Don't navigate if clicking on the action button or link
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
    </>
  );
}
