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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import type { OrderWithRelations, OrderSource, WorkflowState, Department } from "@shared/schema";
import { 
  WORKFLOW_LABELS, 
  DEPARTMENT_LABELS,
  SOURCE_LABELS,
  VIRTUAL_WORKFLOW_LABELS,
  getWorkflowBadgeClass, 
  getDepartmentBadgeClass,
  getSourceBadgeClass,
  getOrderHints 
} from "@shared/schema";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

type ViewMode = 'table' | 'cards';
type DensityMode = 'comfort' | 'compact';
type QuickFilter = 'dueToday' | 'overdue' | 'noAssets' | 'noSize';

const MAX_ROWS = 500;

// Intelligent Status Badge Component
function OrderStatusBadge({ order }: { order: OrderWithRelations }) {
  const hints = getOrderHints(order);

  let statusKey: string = order.workflow;
  let statusLabel = WORKFLOW_LABELS[order.workflow];

  // Logik für "intelligente" Status
  if (order.workflow === 'NEU') {
    if (!order.positions || order.positions.length === 0) {
      statusKey = 'NEU_FEHLENDE_POSITIONEN';
      statusLabel = VIRTUAL_WORKFLOW_LABELS.NEU_FEHLENDE_POSITIONEN;
    } else if (hints.includes("Größentabelle fehlt")) {
      statusKey = 'NEU_FEHLENDE_GROESSE';
      statusLabel = VIRTUAL_WORKFLOW_LABELS.NEU_FEHLENDE_GROESSE;
    } else if (hints.includes("Druckdaten fehlen")) {
      statusKey = 'NEU_FEHLENDE_DRUCKDATEN';
      statusLabel = VIRTUAL_WORKFLOW_LABELS.NEU_FEHLENDE_DRUCKDATEN;
    } else {
      // Alles ist da, bereit für den "Submit"-Button
      statusKey = 'NEU_BEREIT_ZUR_FREIGABE';
      statusLabel = VIRTUAL_WORKFLOW_LABELS.NEU_BEREIT_ZUR_FREIGABE;
    }
  } else if (order.workflow === 'FUER_PROD') {
    // FUER_PROD bedeutet "Bereit zur Planung", es sei denn, es GIBT Slots
    if (order.timeSlots && order.timeSlots.length > 0) {
      statusKey = 'FUER_PROD_EINGEPLANT';
      statusLabel = VIRTUAL_WORKFLOW_LABELS.FUER_PROD_EINGEPLANT;
    }
    // Sonst bleibt es "Bereit zur Planung" (Standard-Label für FUER_PROD)
  }

  const badgeClass = getWorkflowBadgeClass(statusKey);

  return (
    <span 
      className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${badgeClass}`} 
      data-testid="badge-status"
      title={`Status: ${statusLabel}`}
    >
      {statusLabel}
    </span>
  );
}

export default function OrdersList() {
  const isMobile = useIsMobile();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  
  // View mode with localStorage persistence
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('orders_viewMode');
    // 1. Gespeicherte Auswahl des Benutzers verwenden
    if (saved === 'table' || saved === 'cards') {
      return saved;
    }
    // 2. Wenn nichts gespeichert ist, Standard basierend auf Bildschirmgröße wählen
    return isMobile ? 'cards' : 'table';
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
  
  // Filter panel state
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  
  // Read initial search query from URL
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get("q") || "";
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [department, setDepartment] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [workflow, setWorkflow] = useState<string>("");
  
  // Hide "Abgerechnet" orders by default
  const [hideAbgerechnet, setHideAbgerechnet] = useState<boolean>(() => {
    const saved = localStorage.getItem('orders_hideAbgerechnet');
    return saved === null ? true : saved === 'true';
  });
  
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
  
  useEffect(() => {
    localStorage.setItem('orders_hideAbgerechnet', hideAbgerechnet.toString());
  }, [hideAbgerechnet]);
  
  // Update search query when URL changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") || "";
    if (q !== searchQuery) {
      setSearchQuery(q);
    }
  }, [location]);
  
  const debouncedSearch = useDebounce(searchQuery, 250);
  
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
    
    // Hide ABGERECHNET orders if enabled
    if (hideAbgerechnet) {
      filtered = filtered.filter(order => order.workflow !== 'ABGERECHNET');
    }
    
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
  }, [ordersRaw, activeQuickFilters, hideAbgerechnet]);
  
  // Apply 500-row cap and sorting
  const isRowLimitReached = filteredOrders.length > MAX_ROWS;
  
  // Apply sorting and row limit (works for both table and card view)
  const sortedAndLimitedOrders = useMemo(() => {
    // First limit to MAX_ROWS
    const limited = filteredOrders.slice(0, MAX_ROWS);
    
    // Then apply sorting if needed
    if (sorting.length === 0) return limited;
    
    const sorted = [...limited];
    const sort = sorting[0];
    
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sort.id) {
        case 'title':
          aValue = a.title;
          bValue = b.title;
          break;
        case 'workflow':
          aValue = a.workflow;
          bValue = b.workflow;
          break;
        case 'dueDate':
          aValue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          bValue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          break;
        case 'totalGross':
          aValue = Number(a.totalGross) || 0;
          bValue = Number(b.totalGross) || 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sort.desc ? 1 : -1;
      if (aValue > bValue) return sort.desc ? -1 : 1;
      return 0;
    });
    
    return sorted;
  }, [filteredOrders, sorting]);
  
  // Aliases for clarity in the code
  const orders = sortedAndLimitedOrders;
  const sortedOrders = sortedAndLimitedOrders;
  
  // Cell class constants for consistent alignment
  const cellBase = "px-3 py-2 whitespace-nowrap";
  const cellRight = `${cellBase} text-right tabular-nums`;
  
  // Memoize columns for performance optimization
  const columns: ColumnDef<OrderWithRelations>[] = useMemo(() => [
    {
      accessorKey: "title",
      header: () => <div className="px-3 py-2 w-64">Titel</div>,
      cell: ({ row }) => (
        <div className={`${cellBase} font-medium w-64 truncate`} title={row.original.title}>
          {row.original.title}
        </div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "customer",
      header: () => <div className="px-3 py-2 w-56">Kunde</div>,
      cell: ({ row }) => {
        const name = row.original.company || 
          `${row.original.contactFirstName || ''} ${row.original.contactLastName || ''}`.trim() ||
          row.original.customer;
        return <div className={`${cellBase} w-56 truncate`} title={name}>{name}</div>;
      },
    },
    {
      accessorKey: "department",
      header: () => <div className="px-3 py-2 w-44">Abteilung</div>,
      cell: ({ row }) => {
        const dep = row.original.department;
        return (
          <div className={`${cellBase} w-44`}>
            <span className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${getDepartmentBadgeClass(dep)}`}>
              {DEPARTMENT_LABELS[dep] ?? dep}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "source",
      header: () => <div className="px-3 py-2 w-28">Quelle</div>,
      cell: ({ row }) => {
        const src = row.original.source;
        return (
          <div className={`${cellBase} w-28`}>
            <span className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${getSourceBadgeClass(src)}`}>
              {SOURCE_LABELS[src] ?? src}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "workflow",
      header: () => <div className="px-3 py-2 w-48">Status</div>,
      cell: ({ row }) => (
        <div className={`${cellBase} w-48`}>
          <OrderStatusBadge order={row.original} />
        </div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "dueDate",
      header: () => <div className="px-3 py-2 text-right w-36">Fälligkeit</div>,
      cell: ({ row }) => {
        const { label, variant } = getDueDateStatus(row.original.dueDate);
        return (
          <div className={`${cellRight} w-36`}>
            <Badge variant={variant} className="min-w-[6.5rem] justify-center tabular-nums">
              {label}
            </Badge>
          </div>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: "totalGross",
      header: () => <div className="px-3 py-2 text-right w-40">Gesamt (Brutto)</div>,
      cell: ({ row }) => {
        const total = row.original.totalGross;
        if (total === null || total === undefined) {
          return <div className={`${cellRight} w-40`}>—</div>;
        }
        return (
          <div className={`${cellRight} font-medium w-40`}>
            {formatCurrency(Number(total))}
          </div>
        );
      },
      enableSorting: true,
    },
    {
      id: "actions",
      header: () => <div className="px-3 py-2 w-24">Aktionen</div>,
      cell: ({ row }) => (
        <div className={`${cellBase} w-24`}>
          <Link href={`/orders/${row.original.id}`}>
            <Button variant="ghost" size="icon" data-testid={`button-view-${row.original.id}`}>
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ),
      enableHiding: false,
    },
  ], []);
  
  const table = useReactTable({
    data: orders,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    enableRowSelection: false,
    enableMultiRowSelection: false,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  
  // CSV Export function
  const exportToCSV = () => {
    const dataToExport = orders;
    
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
      ...dataToExport.map(order => {
        const sourceLabel = order.source === "INTERNAL" ? "Intern" : order.source;
        return [
          order.displayOrderNumber || "",
          `"${order.title.replace(/"/g, '""')}"`,
          `"${order.customer.replace(/"/g, '""')}"`,
          order.department,
          sourceLabel,
          order.workflow,
          order.dueDate ? formatDate(order.dueDate) : "",
          order.sizeTable ? "Ja" : "Nein",
          order.printAssets.filter(a => a.required).length.toString(),
          order.totalGross ? Number(order.totalGross).toFixed(2).replace('.', ',') : "",
        ].join(";");
      })
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
  
  // Memoize column list for dropdown to prevent re-renders
  const hidableColumns = useMemo(() => {
    return columns
      .filter(col => col.enableHiding !== false)
      .map(col => {
        const id = ('accessorKey' in col && col.accessorKey) ? col.accessorKey as string : ('id' in col ? col.id as string : '');
        const header = typeof col.header === 'string' ? col.header : id;
        return { id, header };
      });
  }, [columns]);

  return (
    <div className="w-full px-4 md:px-6">
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
              {hidableColumns.map(({ id, header }) => {
                const column = table.getColumn(id);
                if (!column) return null;
                return (
                  <DropdownMenuCheckboxItem
                    key={id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    data-testid={`menu-column-${id}`}
                  >
                    {header}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* CSV Export */}
          <Button variant="outline" size="sm" onClick={exportToCSV} data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
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
      
      {/* Search Bar - Always Visible */}
      <div className="flex gap-2 mb-4">
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
        
        {/* Filter Toggle Button */}
        <Button
          variant="outline"
          size="default"
          onClick={() => setFilterPanelOpen(!filterPanelOpen)}
          data-testid="button-toggle-filters"
          className="gap-2"
        >
          <Settings2 className="h-4 w-4" />
          Filter
          {(department || source || workflow) && (
            <Badge variant="secondary" className="ml-1 px-1.5">
              {[department, source, workflow].filter(Boolean).length}
            </Badge>
          )}
        </Button>
      </div>
      
      {/* Collapsible Filter Panel */}
      {filterPanelOpen && (
        <div className="flex flex-col sm:flex-row gap-4 mb-4 p-4 border rounded-lg bg-muted/30">
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
      )}
      
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
        
        <div className="ml-auto flex items-center gap-2">
          <Switch
            id="hide-abgerechnet"
            checked={!hideAbgerechnet}
            onCheckedChange={(checked) => setHideAbgerechnet(!checked)}
            data-testid="switch-show-abgerechnet"
          />
          <Label htmlFor="hide-abgerechnet" className="cursor-pointer text-sm">
            Abgerechnete anzeigen
          </Label>
        </div>
      </div>
      
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
            <Table className="w-full border-collapse">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead 
                        key={header.id} 
                        className="sticky top-0 bg-background z-10 border-b p-0"
                      >
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <button
                            type="button"
                            className="w-full flex items-center gap-2 font-medium hover:text-foreground transition-colors"
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
                        <TableCell key={j} className="p-0">
                          <div className="px-3 py-2">
                            <Skeleton className="h-4 w-full" />
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-64 text-center p-0">
                      <div className="flex flex-col items-center justify-center px-3 py-2">
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
                          className="p-0"
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
                        <span className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${getDepartmentBadgeClass(order.department)}`}>
                          {DEPARTMENT_LABELS[order.department] ?? order.department}
                        </span>
                        <span className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${getSourceBadgeClass(order.source)}`}>
                          {SOURCE_LABELS[order.source] ?? order.source}
                        </span>
                      </div>
                      
                      <div className="mt-2">
                        <OrderStatusBadge order={order} />
                      </div>
                      
                      <div className="mt-3">
                        <Badge variant={dueVariant} className="text-xs">
                          {dueLabel === "Heute" ? "Heute fällig" : dueLabel}
                        </Badge>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
