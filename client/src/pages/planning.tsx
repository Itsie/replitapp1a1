import { useState, useMemo, useCallback, memo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Lock, X, GripVertical, Calendar } from "lucide-react";
import { format, addDays, subDays, startOfWeek, getWeek, isPast, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { DndContext, DragEndEvent, DragStartEvent, DragMoveEvent, useDraggable, useDroppable, DragOverlay, useSensor, useSensors, PointerSensor, DragOverEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

type Department = "TEAMSPORT" | "TEXTILVEREDELUNG" | "STICKEREI" | "DRUCK" | "SONSTIGES";
type ZoomLevel = 60 | 30 | 15 | 5;

interface WorkCenter {
  id: string;
  name: string;
  department: Department;
  active: boolean;
  concurrentCapacity: number;
}

interface TimeSlot {
  id: string;
  date: string;
  startMin: number;
  lengthMin: number;
  workCenterId: string;
  orderId: string | null;
  blocked: boolean;
  note: string | null;
  status: string;
  order?: {
    id: string;
    displayOrderNumber: string | null;
    title: string;
    customer: string;
    department: Department;
    workflow: string;
    dueDate: string | null;
  } | null;
  workCenter: {
    id: string;
    name: string;
    department: Department;
    concurrentCapacity: number;
  };
}

interface Order {
  id: string;
  displayOrderNumber: string | null;
  title: string;
  customer: string;
  department: Department;
  workflow: string;
  dueDate: string | null;
}

interface DragState {
  type: "order" | "slot" | null;
  order?: Order;
  slot?: TimeSlot;
  day?: number;
  startMin?: number;
}

const DEPARTMENT_LABELS: Record<Department, string> = {
  TEAMSPORT: "Teamsport",
  TEXTILVEREDELUNG: "Textilveredelung",
  STICKEREI: "Stickerei",
  DRUCK: "Druck",
  SONSTIGES: "Sonstiges",
};

const DAY_LABELS = ["Mo.", "Di.", "Mi.", "Do.", "Fr."];
const WORKING_HOURS_START = 7 * 60; // 07:00 in minutes (420)
const WORKING_HOURS_END = 18 * 60; // 18:00 in minutes (1080)
const ROW_HEIGHT = 28; // px - constant

// Snap logic based on zoom
function getSnapMinutes(zoom: ZoomLevel): number {
  if (zoom === 60) return 30;
  if (zoom === 30) return 15;
  return zoom; // 15 or 5
}

// Round to nearest snap interval
function snapToGrid(minutes: number, snap: number): number {
  return Math.round(minutes / snap) * snap;
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function formatDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null;
  try {
    return format(parseISO(dueDate), "dd.MM.", { locale: de });
  } catch {
    return null;
  }
}

function isDueDateOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  try {
    return isPast(parseISO(dueDate));
  } catch {
    return false;
  }
}

function getDepartmentColor(dept: Department): string {
  const colors: Record<Department, string> = {
    TEAMSPORT: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    TEXTILVEREDELUNG: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    STICKEREI: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    DRUCK: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    SONSTIGES: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };
  return colors[dept] || colors.SONSTIGES;
}

// Calculate slot geometry
function getSlotGeometry(startMin: number, lengthMin: number, minutesPerRow: number) {
  const topPx = ((startMin - WORKING_HOURS_START) / minutesPerRow) * ROW_HEIGHT;
  const heightPx = (lengthMin / minutesPerRow) * ROW_HEIGHT;
  return { topPx, heightPx };
}

// Draggable Order Card with Due Date Badge
const DraggableOrderCard = memo(({ order }: { order: Order }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `order-${order.id}`,
    data: { type: "order", order },
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  const dueDateStr = formatDueDate(order.dueDate);
  const isOverdue = isDueDateOverdue(order.dueDate);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="hover-elevate active-elevate-2 cursor-grab active:cursor-grabbing"
      data-testid={`order-card-${order.id}`}
    >
      <Card className="p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">
                {order.displayOrderNumber || order.id}
              </span>
              <Badge variant="outline" className={getDepartmentColor(order.department)}>
                {DEPARTMENT_LABELS[order.department]}
              </Badge>
              {dueDateStr && (
                <Badge 
                  variant={isOverdue ? "destructive" : "outline"}
                  className="text-xs flex items-center gap-1"
                  title={`Fälligkeitsdatum: ${order.dueDate}`}
                >
                  <Calendar className="h-3 w-3" />
                  {dueDateStr}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate mt-1">
              {order.title}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {order.customer}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
});

DraggableOrderCard.displayName = "DraggableOrderCard";

// Droppable Day Column Cell
interface DroppableCellProps {
  day: number;
  rowIndex: number;
  startMin: number;
  minutesPerRow: number;
}

const DroppableCell = memo(({ day, rowIndex, startMin, minutesPerRow }: DroppableCellProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${day}-${rowIndex}`,
    data: { type: "cell", day, startMin, minutesPerRow },
  });

  return (
    <div
      ref={setNodeRef}
      className={`border-b ${isOver ? "bg-primary/10" : ""}`}
      style={{ height: `${ROW_HEIGHT}px` }}
      data-testid={`cell-${day}-${rowIndex}`}
    />
  );
});

DroppableCell.displayName = "DroppableCell";

// Rendered Slot Component
interface RenderedSlotProps {
  slot: TimeSlot;
  minutesPerRow: number;
  onDelete: (id: string) => void;
}

const RenderedSlot = memo(({ slot, minutesPerRow, onDelete }: RenderedSlotProps) => {
  const { topPx, heightPx } = getSlotGeometry(slot.startMin, slot.lengthMin, minutesPerRow);
  const [showDelete, setShowDelete] = useState(false);

  const dueDateStr = slot.order?.dueDate ? formatDueDate(slot.order.dueDate) : null;
  const isOverdue = slot.order?.dueDate ? isDueDateOverdue(slot.order.dueDate) : false;

  if (slot.blocked) {
    return (
      <div
        className="absolute left-0 right-0 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded p-2 m-1"
        style={{
          transform: `translateY(${topPx}px)`,
          height: `${heightPx}px`,
          minHeight: "24px",
        }}
        onMouseEnter={() => setShowDelete(true)}
        onMouseLeave={() => setShowDelete(false)}
        data-testid={`slot-${slot.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
            <Lock className="h-3 w-3 flex-shrink-0" />
            <span className="truncate font-medium">Blocker</span>
          </div>
          {showDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 flex-shrink-0"
              onClick={() => onDelete(slot.id)}
              data-testid={`button-delete-${slot.id}`}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        {slot.note && <p className="text-xs mt-1 truncate">{slot.note}</p>}
        <p className="text-xs text-muted-foreground mt-1">
          {formatTime(slot.startMin)} - {formatTime(slot.startMin + slot.lengthMin)}
        </p>
      </div>
    );
  }

  return (
    <div
      className="absolute left-0 right-0 bg-card border rounded p-2 m-1 hover-elevate"
      style={{
        transform: `translateY(${topPx}px)`,
        height: `${heightPx}px`,
        minHeight: "24px",
      }}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      data-testid={`slot-${slot.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium truncate">
              {slot.order?.displayOrderNumber || slot.orderId}
            </span>
            {dueDateStr && (
              <Badge 
                variant={isOverdue ? "destructive" : "outline"}
                className="text-xs px-1 py-0 flex items-center gap-1"
                title={`Fälligkeitsdatum: ${slot.order?.dueDate}`}
              >
                <Calendar className="h-3 w-3" />
                {dueDateStr}
              </Badge>
            )}
          </div>
          {slot.order && (
            <p className="text-xs text-muted-foreground truncate">{slot.order.title}</p>
          )}
        </div>
        {showDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 flex-shrink-0"
            onClick={() => onDelete(slot.id)}
            data-testid={`button-delete-${slot.id}`}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {formatTime(slot.startMin)} - {formatTime(slot.startMin + slot.lengthMin)} ({slot.lengthMin} Min)
      </p>
    </div>
  );
});

RenderedSlot.displayName = "RenderedSlot";

export default function PlanningPage() {
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [zoom, setZoom] = useState<ZoomLevel>(30);
  const [dragState, setDragState] = useState<DragState>({ type: null });
  const [dragOverCell, setDragOverCell] = useState<{ day: number; startMin: number } | null>(null);
  
  const [createSlotDialog, setCreateSlotDialog] = useState<{
    open: boolean;
    order: Order | null;
    day: number;
    startMin: number;
  }>({ open: false, order: null, day: 0, startMin: 420 });
  
  const [createSlotForm, setCreateSlotForm] = useState<{
    startMin: number;
    lengthMin: number;
    note: string;
  }>({
    startMin: 420,
    lengthMin: 60,
    note: "",
  });

  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Week dates (Monday-Friday)
  const weekDates = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const weekNumber = useMemo(() => getWeek(weekStart, { weekStartsOn: 1, locale: de }), [weekStart]);
  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  // Calculate grid rows based on zoom
  const gridRows = useMemo(() => {
    const minutesPerRow = zoom;
    const rows: number[] = [];
    for (let min = WORKING_HOURS_START; min < WORKING_HOURS_END; min += minutesPerRow) {
      rows.push(min);
    }
    return rows;
  }, [zoom]);

  // Fetch work center
  const { data: workCenters = [] } = useQuery<WorkCenter[]>({
    queryKey: ["/api/workcenters", selectedDepartment],
    enabled: !!selectedDepartment,
    queryFn: async () => {
      if (!selectedDepartment) return [];
      const params = new URLSearchParams({ department: selectedDepartment });
      const res = await fetch(`/api/workcenters?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch work centers");
      return res.json();
    },
  });

  const selectedWorkCenter = workCenters.find(wc => wc.department === selectedDepartment);

  // Fetch time slots
  const { data: timeSlotData = [] } = useQuery<TimeSlot[]>({
    queryKey: ["/api/timeslots", selectedDepartment, weekStartStr],
    enabled: !!selectedDepartment,
    queryFn: async () => {
      if (!selectedDepartment) return [];
      const params = new URLSearchParams({
        department: selectedDepartment,
        weekStart: weekStartStr,
      });
      const res = await fetch(`/api/timeslots?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch time slots");
      return res.json();
    },
  });

  // Fetch orders
  const { data: allFetchedOrders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders", selectedDepartment, "ready"],
    enabled: !!selectedDepartment,
    queryFn: async () => {
      if (!selectedDepartment) return [];
      const params = new URLSearchParams({
        department: selectedDepartment,
        workflow: "FUER_PROD",
      });
      const res = await fetch(`/api/orders?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch orders");
      const orders1 = await res.json();
      
      const params2 = new URLSearchParams({
        department: selectedDepartment,
        workflow: "WARTET_FEHLTEILE",
      });
      const res2 = await fetch(`/api/orders?${params2.toString()}`, { credentials: "include" });
      if (!res2.ok) throw new Error("Failed to fetch orders");
      const orders2 = await res2.json();
      
      return [...orders1, ...orders2];
    },
  });

  // Filter out scheduled orders
  const availableOrders = useMemo(() => {
    const scheduledOrderIds = new Set(
      timeSlotData.filter(slot => slot.orderId).map(slot => slot.orderId)
    );
    return allFetchedOrders.filter(order => !scheduledOrderIds.has(order.id));
  }, [allFetchedOrders, timeSlotData]);

  // Create slot mutation
  const createSlotMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/timeslots", data);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/timeslots", selectedDepartment, weekStartStr] });
      queryClient.refetchQueries({ queryKey: ["/api/orders", selectedDepartment, "ready"] });
      toast({ title: "Termin erstellt" });
      setCreateSlotDialog({ open: false, order: null, day: 0, startMin: 420 });
      setCreateSlotForm({ startMin: 420, lengthMin: 60, note: "" });
    },
    onError: (error: any) => {
      const message = error.message || "Fehler beim Erstellen des Termins";
      toast({
        title: "Fehler",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Delete slot mutation
  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      return apiRequest("DELETE", `/api/timeslots/${slotId}`);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/timeslots", selectedDepartment, weekStartStr] });
      queryClient.refetchQueries({ queryKey: ["/api/orders", selectedDepartment, "ready"] });
      toast({ title: "Termin gelöscht" });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Löschen",
        variant: "destructive",
      });
    },
  });

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "order") {
      setDragState({ type: "order", order: data.order });
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const over = event.over;
    if (over && over.data.current?.type === "cell") {
      const { day, startMin } = over.data.current;
      setDragOverCell({ day, startMin });
    } else {
      setDragOverCell(null);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setDragState({ type: null });
    setDragOverCell(null);

    if (!over || !selectedWorkCenter) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === "order" && overData?.type === "cell") {
      const order = activeData.order as Order;
      const { day, startMin, minutesPerRow } = overData;
      
      // Snap to grid
      const snap = getSnapMinutes(zoom);
      const snappedStartMin = snapToGrid(startMin, snap);
      
      setCreateSlotDialog({ open: true, order, day, startMin: snappedStartMin });
      setCreateSlotForm({ startMin: snappedStartMin, lengthMin: 60, note: "" });
    }
  }, [selectedWorkCenter, zoom]);

  const handleCreateSlot = useCallback(() => {
    if (!createSlotDialog.order || !selectedWorkCenter) return;

    const dayDate = weekDates[createSlotDialog.day];
    const dateStr = format(dayDate, "yyyy-MM-dd");

    createSlotMutation.mutate({
      workCenterId: selectedWorkCenter.id,
      date: dateStr,
      startMin: createSlotForm.startMin,
      lengthMin: createSlotForm.lengthMin,
      orderId: createSlotDialog.order.id,
      blocked: false,
      note: createSlotForm.note || null,
    });
  }, [createSlotDialog, createSlotForm, selectedWorkCenter, weekDates, createSlotMutation]);

  const handleDeleteSlot = useCallback((slotId: string) => {
    if (confirm("Termin wirklich löschen?")) {
      deleteSlotMutation.mutate(slotId);
    }
  }, [deleteSlotMutation]);

  // Week navigation
  const handlePreviousWeek = () => setWeekStart(prev => subDays(prev, 7));
  const handleNextWeek = () => setWeekStart(prev => addDays(prev, 7));
  const handleToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Group slots by day
  const slotsByDay = useMemo(() => {
    const result: TimeSlot[][] = [[], [], [], [], []];
    timeSlotData.forEach(slot => {
      const slotDate = new Date(slot.date);
      const dayIndex = weekDates.findIndex(d => 
        format(d, "yyyy-MM-dd") === format(slotDate, "yyyy-MM-dd")
      );
      if (dayIndex >= 0 && dayIndex < 5) {
        result[dayIndex].push(slot);
      }
    });
    return result;
  }, [timeSlotData, weekDates]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 p-4 border-b">
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Produktionsplanung
          </h1>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Department Selection */}
            <div className="flex items-center gap-2">
              <Label>Bereich:</Label>
              <Select
                value={selectedDepartment || "NONE"}
                onValueChange={(val) => setSelectedDepartment(val === "NONE" ? null : val as Department)}
              >
                <SelectTrigger className="w-48" data-testid="select-department">
                  <SelectValue placeholder="Bereich wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Bereich wählen</SelectItem>
                  <SelectItem value="TEAMSPORT">Teamsport</SelectItem>
                  <SelectItem value="TEXTILVEREDELUNG">Textilveredelung</SelectItem>
                  <SelectItem value="STICKEREI">Stickerei</SelectItem>
                  <SelectItem value="DRUCK">Druck</SelectItem>
                  <SelectItem value="SONSTIGES">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Zoom Selection */}
            {selectedDepartment && (
              <div className="flex items-center gap-2">
                <Label>Zoom:</Label>
                <Select
                  value={zoom.toString()}
                  onValueChange={(val) => setZoom(parseInt(val) as ZoomLevel)}
                >
                  <SelectTrigger className="w-32" data-testid="select-zoom">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">60 Min</SelectItem>
                    <SelectItem value="30">30 Min</SelectItem>
                    <SelectItem value="15">15 Min</SelectItem>
                    <SelectItem value="5">5 Min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedWorkCenter && (
              <Badge variant="outline" data-testid="badge-capacity">
                Kapazität: {selectedWorkCenter.concurrentCapacity} parallel
              </Badge>
            )}

            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousWeek}
                data-testid="button-prev-week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium min-w-[120px] text-center" data-testid="text-week-display">
                KW {weekNumber}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextWeek}
                data-testid="button-next-week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={handleToday} data-testid="button-today">
                Heute
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Calendar Grid */}
          {!selectedDepartment ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Bitte wählen Sie einen Bereich aus
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              <div className="inline-block min-w-full">
                <div className="flex border">
                  {/* Time Column */}
                  <div className="flex flex-col border-r bg-muted" style={{ width: "80px" }}>
                    <div className="border-b p-2 text-sm font-medium" style={{ minHeight: "56px" }}>Zeit</div>
                    {gridRows.map((timeMin, idx) => (
                      <div key={idx} className="border-b p-2 text-xs text-muted-foreground" style={{ height: `${ROW_HEIGHT}px` }}>
                        {formatTime(timeMin)}
                      </div>
                    ))}
                  </div>

                  {/* Day Columns */}
                  {[0, 1, 2, 3, 4].map((dayIdx) => (
                    <div key={dayIdx} className="flex-1 flex flex-col border-r min-w-[150px]">
                      {/* Day Header */}
                      <div
                        className="border-b bg-muted p-2 text-sm font-medium text-center"
                        style={{ minHeight: "56px" }}
                        data-testid={`header-day-${dayIdx}`}
                      >
                        <div>{DAY_LABELS[dayIdx]}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(weekDates[dayIdx], "dd.MM.", { locale: de })}
                        </div>
                      </div>

                      {/* Day Content */}
                      <div className="flex-1 relative">
                        {/* Droppable cells */}
                        {gridRows.map((timeMin, rowIdx) => (
                          <DroppableCell
                            key={rowIdx}
                            day={dayIdx}
                            rowIndex={rowIdx}
                            startMin={timeMin}
                            minutesPerRow={zoom}
                          />
                        ))}

                        {/* Render slots */}
                        {slotsByDay[dayIdx].map(slot => (
                          <RenderedSlot
                            key={slot.id}
                            slot={slot}
                            minutesPerRow={zoom}
                            onDelete={handleDeleteSlot}
                          />
                        ))}

                        {/* Drag preview ghost */}
                        {dragOverCell && dragOverCell.day === dayIdx && dragState.type === "order" && (
                          <div
                            className="absolute left-0 right-0 bg-primary/20 border border-primary border-dashed rounded m-1 pointer-events-none"
                            style={{
                              transform: `translateY(${getSlotGeometry(dragOverCell.startMin, 60, zoom).topPx}px)`,
                              height: `${getSlotGeometry(dragOverCell.startMin, 60, zoom).heightPx}px`,
                            }}
                          >
                            <div className="text-xs p-1">
                              {formatTime(dragOverCell.startMin)} - {formatTime(dragOverCell.startMin + 60)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Order Pool */}
          {selectedDepartment && (
            <div className="w-80 border-l flex flex-col overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="font-semibold" data-testid="text-order-pool-title">
                  Aufträge bereit
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {availableOrders.length} Aufträge
                </p>
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-2">
                {availableOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Keine Aufträge verfügbar
                  </p>
                ) : (
                  availableOrders.map((order) => (
                    <DraggableOrderCard key={order.id} order={order} />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Slot Dialog */}
      <Dialog
        open={createSlotDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setCreateSlotDialog({ open: false, order: null, day: 0, startMin: 420 });
            setCreateSlotForm({ startMin: 420, lengthMin: 60, note: "" });
          }
        }}
      >
        <DialogContent data-testid="dialog-create-slot">
          <DialogHeader>
            <DialogTitle>Neuen Termin erstellen</DialogTitle>
          </DialogHeader>
          
          {createSlotDialog.order && (
            <div className="space-y-4">
              <div>
                <Label>Auftrag</Label>
                <div className="mt-1 p-2 bg-muted rounded text-sm">
                  {createSlotDialog.order.displayOrderNumber || createSlotDialog.order.id} - {createSlotDialog.order.title}
                </div>
              </div>

              <div>
                <Label>Tag</Label>
                <div className="mt-1 p-2 bg-muted rounded text-sm">
                  {DAY_LABELS[createSlotDialog.day]}, {format(weekDates[createSlotDialog.day], "dd.MM.yyyy", { locale: de })}
                </div>
              </div>

              <div>
                <Label htmlFor="startTime">Startzeit</Label>
                <Select
                  value={createSlotForm.startMin.toString()}
                  onValueChange={(val) => setCreateSlotForm({ ...createSlotForm, startMin: parseInt(val) })}
                >
                  <SelectTrigger id="startTime" data-testid="select-start-time">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gridRows.map((min) => (
                      <SelectItem key={min} value={min.toString()}>
                        {formatTime(min)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="duration">Dauer</Label>
                <Select
                  value={createSlotForm.lengthMin.toString()}
                  onValueChange={(val) => setCreateSlotForm({ ...createSlotForm, lengthMin: parseInt(val) })}
                >
                  <SelectTrigger id="duration" data-testid="select-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 Min</SelectItem>
                    <SelectItem value="45">45 Min</SelectItem>
                    <SelectItem value="60">60 Min</SelectItem>
                    <SelectItem value="90">90 Min</SelectItem>
                    <SelectItem value="120">120 Min</SelectItem>
                    <SelectItem value="180">180 Min</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="note">Notiz (optional)</Label>
                <Textarea
                  id="note"
                  value={createSlotForm.note}
                  onChange={(e) => setCreateSlotForm({ ...createSlotForm, note: e.target.value })}
                  placeholder="Zusätzliche Informationen..."
                  rows={2}
                  data-testid="textarea-note"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateSlotDialog({ open: false, order: null, day: 0, startMin: 420 });
                setCreateSlotForm({ startMin: 420, lengthMin: 60, note: "" });
              }}
              data-testid="button-cancel"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleCreateSlot}
              disabled={createSlotMutation.isPending}
              data-testid="button-create"
            >
              {createSlotMutation.isPending ? "Erstelle..." : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drag Overlay */}
      <DragOverlay>
        {dragState.type === "order" && dragState.order && (
          <div className="bg-card border rounded-md p-3 shadow-lg opacity-90">
            <div className="text-sm font-medium">
              {dragState.order.displayOrderNumber || dragState.order.id}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {dragState.order.title}
            </div>
            {dragOverCell && (
              <div className="text-xs text-primary mt-2 font-medium">
                📍 {formatTime(dragOverCell.startMin)} - {formatTime(dragOverCell.startMin + 60)} (60 Min)
              </div>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
