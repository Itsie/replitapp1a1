import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  Search, 
  Plus, 
  Eye, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  LayoutGrid, 
  Table as TableIcon,
  Settings2,
  Download,
  ChevronDown,
  Check,
  Calendar,
  AlertCircle,
  FileX,
  Package,
  X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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
  VisibilityState,
} from "@tanstack/react-table";
import type { OrderWithRelations, OrderSource, WorkflowState } from "@shared/schema";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";

type ViewMode = 'table' | 'cards';
type DensityMode = 'comfort' | 'compact';
type QuickFilter = 'dueToday' | 'overdue' | 'noAssets' | 'noSize';

const MAX_ROWS = 500;

export default function OrdersList() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  // View mode with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('orders_viewMode');
    return (saved === 'table' || saved === 'cards') ? saved : 'table';
  });
  
  // Density mode
  const [density, setDensity] = useState<DensityMode>(() => {
    const saved = localStorage.getItem('orders_density');
    return (saved === 'comfort' || saved === 'compact') ? saved : 'comfort';
  });
  
  // Column visibility with localStorage
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const saved = localStorage.getItem('orders_columns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  });
  
  // Row selection
  const [rowSelection, setRowSelection] = useState({});
  
  // Sorting with localStorage
  const [sorting, setSorting] = useState<SortingState>(() => {
    const saved = localStorage.getItem('orders_sort');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });
  
  // Quick filters
  const [activeQuickFilters, setActiveQuickFilters] = useState<Set<QuickFilter>>(new Set());
  
  // Read initial search query from URL
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get("q") || "";
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [department, setDepartment] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [workflow, setWorkflow] = useState<string>("");
  
  // Persist preferences
  useEffect(() => {
    localStorage.setItem('orders_viewMode', viewMode);
  }, [viewMode]);
  
  useEffect(() => {
    localStorage.setItem('orders_density', density);
  }, [density]);
  
  useEffect(() => {
    localStorage.setItem('orders_columns', JSON.stringify(columnVisibility));
  }, [columnVisibility]);
  
  useEffect(() => {
    localStorage.setItem('orders_sort', JSON.stringify(sorting));
  }, [sorting]);
  
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
  
  const { data: ordersRaw = [], isLoading } = useQuery<OrderWithRelations[]>({
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
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };
  
  const getDueDateStatus = (dueDate: string | Date | null): { label: string; variant: "default" | "destructive" | "secondary" } => {
    if (!dueDate) return { label: "—", variant: "secondary" };
    
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { label: formatDate(dueDate), variant: "destructive" };
    } else if (diffDays === 0) {
      return { label: "Heute", variant: "default" };
    } else {
      return { label: formatDate(dueDate), variant: "secondary" };
    }
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
  
  const toggleQuickFilter = (filter: QuickFilter) => {
    setActiveQuickFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filter)) {
        newSet.delete(filter);
      } else {
        newSet.add(filter);
      }
      return newSet;
    });
  };
  
  const clearQuickFilters = () => {
    setActiveQuickFilters(new Set());
  };
  
  // Apply quick filters client-side
  const filteredOrders = useMemo(() => {
    let filtered = [...ordersRaw];
    
    if (activeQuickFilters.has('dueToday')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter(order => {
        if (!order.dueDate) return false;
        const due = new Date(order.dueDate);
        due.setHours(0, 0, 0, 0);
        return due.getTime() === today.getTime();
      });
    }
    
    if (activeQuickFilters.has('overdue')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter(order => {
        if (!order.dueDate) return false;
        const due = new Date(order.dueDate);
        due.setHours(0, 0, 0, 0);
        return due.getTime() < today.getTime();
      });
    }
    
    if (activeQuickFilters.has('noAssets')) {
      filtered = filtered.filter(order => {
        const requiredAssets = order.printAssets.filter(a => a.required);
        return requiredAssets.length === 0;
      });
    }
    
    if (activeQuickFilters.has('noSize')) {
      filtered = filtered.filter(order => !order.sizeTable);
    }
    
    return filtered;
  }, [ordersRaw, activeQuickFilters]);
  
  // Apply 500-row cap
  const orders = filteredOrders.slice(0, MAX_ROWS);
  const isRowLimitReached = filteredOrders.length > MAX_ROWS;
  
  const columns: ColumnDef<OrderWithRelations>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Alle auswählen"
          data-testid="checkbox-select-all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Zeile auswählen"
          data-testid={`checkbox-select-${row.original.id}`}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "displayOrderNumber",
      header: "Auftragsnr.",
      cell: ({ row }) => (
        <div className="font-mono text-sm min-w-[120px]">
          {row.original.displayOrderNumber || "—"}
        </div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "title",
      header: "Titel",
      cell: ({ row }) => (
        <div className="font-medium min-w-[180px]">{row.original.title}</div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "customer",
      header: "Kunde",
      cell: ({ row }) => {
        const name = row.original.company || 
          `${row.original.contactFirstName || ''} ${row.original.contactLastName || ''}`.trim() ||
          row.original.customer;
        return <div className="min-w-[140px]">{name}</div>;
      },
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
      cell: ({ row }) => {
        const { label, variant } = getDueDateStatus(row.original.dueDate);
        return (
          <Badge variant={variant} className="min-w-[100px] justify-center">
            {label}
          </Badge>
        );
      },
      enableSorting: true,
    },
    {
      id: "sizeTable",
      header: "Größe",
      cell: ({ row }) => (
        <div className="text-center min-w-[60px]">
          {row.original.sizeTable ? (
            <Check className="h-4 w-4 text-green-600 inline" />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      id: "assets",
      header: "Druckdaten",
      cell: ({ row }) => {
        const requiredAssets = row.original.printAssets.filter(a => a.required);
        return (
          <div className="text-center min-w-[80px]">
            {requiredAssets.length > 0 ? (
              <Badge variant="secondary">{requiredAssets.length}</Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        );
      },
    },
    {
      id: "procurement",
      header: "Beschaffung",
      cell: () => (
        <Tooltip>
          <TooltipTrigger>
            <span className="text-muted-foreground">—</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Feature noch nicht verfügbar</p>
          </TooltipContent>
        </Tooltip>
      ),
    },
    {
      accessorKey: "totalGross",
      header: "Gesamt (Brutto)",
      cell: ({ row }) => {
        const total = row.original.totalGross;
        if (total === null || total === undefined) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="text-right font-medium min-w-[100px]">
            {formatCurrency(Number(total))}
          </div>
        );
      },
      enableSorting: true,
    },
    {
      id: "actions",
      header: "Aktionen",
      cell: ({ row }) => (
        <Link href={`/orders/${row.original.id}`}>
          <Button variant="ghost" size="icon" data-testid={`button-view-${row.original.id}`}>
            <Eye className="h-4 w-4" />
          </Button>
        </Link>
      ),
      enableHiding: false,
    },
  ];
  
  const table = useReactTable({
    data: orders,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  
  // Get sorted data for card view
  const sortedOrders = table.getRowModel().rows.map(row => row.original);
  
  const selectedCount = Object.keys(rowSelection).length;
  
  // CSV Export function using TanStack Table API
  const exportToCSV = (selectedOnly: boolean = false) => {
    const dataToExport = selectedOnly 
      ? table.getSelectedRowModel().rows.map(row => row.original)
      : orders;
    
    if (dataToExport.length === 0) {
      toast({
        title: "Keine Daten",
        description: "Es sind keine Aufträge zum Exportieren vorhanden.",
        variant: "destructive",
      });
      return;
    }
    
    // CSV headers
    const headers = [
      "Auftragsnummer",
      "Titel",
      "Kunde",
      "Abteilung",
      "Quelle",
      "Status",
      "Fälligkeit",
      "Größentabelle",
      "Druckdaten",
      "Gesamt (Brutto)",
    ];
    
    const csvRows = [
      headers.join(";"),
      ...dataToExport.map(order => [
        order.displayOrderNumber || "",
        `"${order.title.replace(/"/g, '""')}"`,
        `"${order.customer.replace(/"/g, '""')}"`,
        order.department,
        order.source,
        order.workflow,
        order.dueDate ? formatDate(order.dueDate) : "",
        order.sizeTable ? "Ja" : "Nein",
        order.printAssets.filter(a => a.required).length.toString(),
        order.totalGross ? Number(order.totalGross).toFixed(2).replace('.', ',') : "",
      ].join(";"))
    ];
    
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `auftraege_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export erfolgreich",
      description: `${dataToExport.length} Aufträge wurden exportiert.`,
    });
  };
  
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
          {/* Density Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-density">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ansicht</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDensity('comfort')} data-testid="menu-density-comfort">
                <Check className={`h-4 w-4 mr-2 ${density === 'comfort' ? 'opacity-100' : 'opacity-0'}`} />
                Komfort
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDensity('compact')} data-testid="menu-density-compact">
                <Check className={`h-4 w-4 mr-2 ${density === 'compact' ? 'opacity-100' : 'opacity-0'}`} />
                Kompakt
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* Column Visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-columns">
                <Settings2 className="h-4 w-4 mr-2" />
                Spalten
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Sichtbare Spalten</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter(column => column.getCanHide())
                .map(column => {
                  const header = typeof column.columnDef.header === 'string' 
                    ? column.columnDef.header 
                    : column.id;
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      data-testid={`menu-column-${column.id}`}
                    >
                      {header}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* CSV Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-export">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportToCSV(false)} data-testid="menu-export-all">
                <Download className="h-4 w-4 mr-2" />
                Alle exportieren
              </DropdownMenuItem>
              {selectedCount > 0 && (
                <DropdownMenuItem onClick={() => exportToCSV(true)} data-testid="menu-export-selected">
                  <Download className="h-4 w-4 mr-2" />
                  {selectedCount} Ausgewählte exportieren
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
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
      
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
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
      
      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant={activeQuickFilters.has('dueToday') ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleQuickFilter('dueToday')}
          data-testid="filter-due-today"
          className="gap-2"
        >
          <Calendar className="h-4 w-4" />
          Heute fällig
        </Button>
        <Button
          variant={activeQuickFilters.has('overdue') ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => toggleQuickFilter('overdue')}
          data-testid="filter-overdue"
          className="gap-2"
        >
          <AlertCircle className="h-4 w-4" />
          Überfällig
        </Button>
        <Button
          variant={activeQuickFilters.has('noAssets') ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleQuickFilter('noAssets')}
          data-testid="filter-no-assets"
          className="gap-2"
        >
          <FileX className="h-4 w-4" />
          Ohne Druckdaten
        </Button>
        <Button
          variant={activeQuickFilters.has('noSize') ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleQuickFilter('noSize')}
          data-testid="filter-no-size"
          className="gap-2"
        >
          <Package className="h-4 w-4" />
          Ohne Größentabelle
        </Button>
        {activeQuickFilters.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearQuickFilters}
            data-testid="filter-clear"
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Filter zurücksetzen
          </Button>
        )}
      </div>
      
      {/* Selection Counter */}
      {selectedCount > 0 && viewMode === 'table' && (
        <div className="flex items-center justify-between p-3 mb-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground" data-testid="text-selection-count">
            {selectedCount} {selectedCount === 1 ? 'Auftrag' : 'Aufträge'} ausgewählt
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(true)}
              data-testid="button-batch-export"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportieren
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const selectedOrders = table.getSelectedRowModel().rows.map(row => row.original);
                selectedOrders.slice(0, 10).forEach((order, i) => {
                  setTimeout(() => {
                    window.open(`/orders/${order.id}`, '_blank');
                  }, i * 100);
                });
                if (selectedOrders.length > 10) {
                  toast({
                    title: "Limit erreicht",
                    description: "Maximal 10 Aufträge können gleichzeitig geöffnet werden.",
                  });
                }
              }}
              data-testid="button-batch-open"
            >
              <Eye className="h-4 w-4 mr-2" />
              Öffnen (max. 10)
            </Button>
          </div>
        </div>
      )}
      
      {/* Row limit notice */}
      {isRowLimitReached && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200" data-testid="text-row-limit">
            Ansicht aus Performance-Gründen auf {MAX_ROWS} Einträge begrenzt. Nutzen Sie Filter, um die Ergebnisse einzugrenzen.
          </p>
        </div>
      )}
      
      {/* Conditional rendering based on view mode */}
      {viewMode === 'table' && (
        <div className="border rounded-2xl overflow-hidden">
          <div className="relative overflow-x-auto max-h-[calc(100vh-400px)]">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead 
                        key={header.id} 
                        className="sticky top-0 bg-background z-10 border-b"
                      >
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
                          {searchQuery || department || source || workflow || activeQuickFilters.size > 0
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
                      className={`cursor-pointer hover-elevate ${
                        density === 'compact' ? 'h-10' : 'h-12'
                      }`}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('button, a, input[type="checkbox"]')) return;
                        setLocation(`/orders/${row.original.id}`);
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell 
                          key={cell.id}
                          className={density === 'compact' ? 'px-2 py-1' : 'px-3 py-2'}
                        >
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
                {searchQuery || department || source || workflow || activeQuickFilters.size > 0
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
              {sortedOrders.map((order) => {
                const { label: dueLabel, variant: dueVariant } = getDueDateStatus(order.dueDate);
                const requiredAssets = order.printAssets.filter(a => a.required);
                
                return (
                  <Link key={order.id} href={`/orders/${order.id}`}>
                    <Card 
                      className="p-4 flex flex-col justify-between border-muted/60 hover:shadow-md transition cursor-pointer hover-elevate"
                      data-testid={`card-order-${order.id}`}
                    >
                      <div>
                        {order.displayOrderNumber && (
                          <div className="font-mono text-xs text-muted-foreground mb-1">
                            {order.displayOrderNumber}
                          </div>
                        )}
                        <h3 className="font-medium text-base truncate mb-1">{order.title}</h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {order.company || 
                            `${order.contactFirstName || ''} ${order.contactLastName || ''}`.trim() ||
                            order.customer}
                        </p>
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
                      
                      <div className="mt-3">
                        <Badge variant={dueVariant} className="text-xs">
                          {dueLabel === "Heute" ? "Heute fällig" : dueLabel}
                        </Badge>
                      </div>
                      
                      {(order.sizeTable || requiredAssets.length > 0) && (
                        <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                          {order.sizeTable && (
                            <span className="flex items-center gap-1">
                              <Check className="h-3 w-3 text-green-600" />
                              Größe
                            </span>
                          )}
                          {requiredAssets.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Check className="h-3 w-3 text-green-600" />
                              {requiredAssets.length} Asset{requiredAssets.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
