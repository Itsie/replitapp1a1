import { useState, useMemo, useCallback, memo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Lock, X, GripVertical, Calendar, Plus } from "lucide-react";
import { format, addDays, subDays, startOfWeek, getWeek, isPast, parseISO, differenceInHours, isToday as isTodayFn } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { DndContext, DragEndEvent, DragStartEvent, useDraggable, useDroppable, DragOverlay, useSensor, useSensors, PointerSensor, DragOverEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

type Department = "TEAMSPORT" | "TEXTILVEREDELUNG" | "STICKEREI" | "DRUCK" | "SONSTIGES";
type ZoomLevel = 60 | 30 | 15;

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
const WORKING_HOURS_END = 20 * 60; // 20:00 in minutes (1200) - includes overtime
const ROW_HEIGHT = 28; // px - constant

// Snap logic based on zoom (min 15 minutes)
function getSnapMinutes(zoom: ZoomLevel): number {
  if (zoom === 60) return 15;
  if (zoom === 30) return 15;
  return 15; // Always snap to 15 min minimum
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

// Check if due date is within 48 hours
function isDueDateUrgent(dueDate: string | null): boolean {
  if (!dueDate) return false;
  try {
    const due = parseISO(dueDate);
    const hoursUntil = differenceInHours(due, new Date());
    return hoursUntil > 0 && hoursUntil <= 48;
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

// Calculate slot geometry - CORRECTED for exact positioning
function getSlotGeometry(startMin: number, lengthMin: number, minutesPerRow: number) {
  const pixelsPerMinute = ROW_HEIGHT / minutesPerRow;
  const topPx = (startMin - WORKING_HOURS_START) * pixelsPerMinute;
  const heightPx = lengthMin * pixelsPerMinute;
  return { topPx, heightPx };
}

// Get current time in minutes from midnight
function getCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
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
  const isUrgent = isDueDateUrgent(order.dueDate);

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
            </div>
            <p className="text-sm text-muted-foreground truncate mt-1">
              {order.title}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {order.customer}
            </p>
            {dueDateStr && (
              <div className="mt-2">
                <Badge 
                  variant={isOverdue ? "destructive" : isUrgent ? "default" : "outline"}
                  className="text-xs flex items-center gap-1"
                  title={`Fälligkeitsdatum: ${order.dueDate}`}
                >
                  <Calendar className="h-3 w-3" />
                  Fällig: {dueDateStr}
                </Badge>
              </div>
            )}
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

  const topPx = rowIndex * ROW_HEIGHT;

  return (
    <div
      ref={setNodeRef}
      className={`absolute left-0 right-0 border-b ${isOver ? "bg-primary/10" : ""}`}
      style={{ 
        top: `${topPx}px`,
        height: `${ROW_HEIGHT}px`,
      }}
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
  const isUrgent = slot.order?.dueDate ? isDueDateUrgent(slot.order.dueDate) : false;

  if (slot.blocked) {
    return (
      <div
        className="absolute left-0 right-0 bg-red-50 dark:bg-red-900/20 border-2 border-dashed border-red-300 dark:border-red-700 rounded p-1"
        style={{
          top: `${topPx}px`,
          height: `${heightPx}px`,
          minHeight: "24px",
        }}
        onMouseEnter={() => setShowDelete(true)}
        onMouseLeave={() => setShowDelete(false)}
        data-testid={`slot-${slot.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
            <Lock className="h-3 w-3 flex-shrink-0 text-red-600 dark:text-red-400" />
            <span className="truncate font-medium text-red-600 dark:text-red-400">Blocker</span>
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
        {slot.note && <p className="text-xs mt-1 truncate text-red-600 dark:text-red-400">{slot.note}</p>}
        <p className="text-xs text-muted-foreground mt-1">
          {formatTime(slot.startMin)} - {formatTime(slot.startMin + slot.lengthMin)}
        </p>
      </div>
    );
  }

  return (
    <div
      className="absolute left-0 right-0 bg-card border rounded p-1 hover-elevate"
      style={{
        top: `${topPx}px`,
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
                variant={isOverdue ? "destructive" : isUrgent ? "default" : "outline"}
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
  const [showOnlyThisWeek, setShowOnlyThisWeek] = useState(false);
  
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

  // Blocker dialog
  const [blockerDialog, setBlockerDialog] = useState<{
    open: boolean;
    day: number;
    startMin: number;
  }>({ open: false, day: 0, startMin: 420 });

  const [blockerForm, setBlockerForm] = useState<{
    startMin: number;
    lengthMin: number;
    note: string;
  }>({
    startMin: 420,
    lengthMin: 60,
    note: "",
  });

  const { toast } = useToast();
  const gridContainerRef = useRef<HTMLDivElement>(null);

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
  // Grid rows are droppable cells - last row should allow slots to extend to WORKING_HOURS_END
  const gridRows = useMemo(() => {
    const minutesPerRow = zoom;
    const rows: number[] = [];
    for (let min = WORKING_HOURS_START; min < WORKING_HOURS_END; min += minutesPerRow) {
      rows.push(min);
    }
    return rows;
  }, [zoom]);

  // Calculate total container height to accommodate slots extending to end of working hours
  const totalDayHeight = useMemo(() => {
    const totalMinutes = WORKING_HOURS_END - WORKING_HOURS_START;
    const pixelsPerMinute = ROW_HEIGHT / zoom;
    return Math.ceil(totalMinutes * pixelsPerMinute);
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

  // Week end date for filtering
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  // Filter out scheduled orders AND sort by due date
  const availableOrders = useMemo(() => {
    const scheduledOrderIds = new Set(
      timeSlotData.filter(slot => slot.orderId).map(slot => slot.orderId)
    );
    let unscheduled = allFetchedOrders.filter(order => !scheduledOrderIds.has(order.id));
    
    // Apply "only this week" filter if enabled
    if (showOnlyThisWeek) {
      unscheduled = unscheduled.filter(order => {
        if (!order.dueDate) return false;
        const dueDate = parseISO(order.dueDate);
        return dueDate >= weekStart && dueDate <= weekEnd;
      });
    }
    
    // Sort by due date: earliest first, nulls last
    return unscheduled.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [allFetchedOrders, timeSlotData, showOnlyThisWeek, weekStart, weekEnd]);

  // Helper function to check for slot collisions
  const checkSlotCollision = useCallback((
    date: string,
    startMin: number,
    lengthMin: number,
    excludeSlotId?: string
  ): { hasCollision: boolean; collidingSlot?: TimeSlot } => {
    const endMin = startMin + lengthMin;
    
    const conflictingSlot = timeSlotData.find(slot => {
      if (excludeSlotId && slot.id === excludeSlotId) return false;
      if (format(new Date(slot.date), "yyyy-MM-dd") !== date) return false;
      
      const slotEndMin = slot.startMin + slot.lengthMin;
      
      // Check for overlap: (start1 < end2) && (start2 < end1)
      const overlaps = (startMin < slotEndMin) && (slot.startMin < endMin);
      return overlaps;
    });
    
    return {
      hasCollision: !!conflictingSlot,
      collidingSlot: conflictingSlot,
    };
  }, [timeSlotData]);

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

  // Create blocker mutation
  const createBlockerMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/timeslots", data);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/timeslots", selectedDepartment, weekStartStr] });
      toast({ title: "Blocker erstellt" });
      setBlockerDialog({ open: false, day: 0, startMin: 420 });
      setBlockerForm({ startMin: 420, lengthMin: 60, note: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Erstellen des Blockers",
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
      // Snap the preview ghost to grid
      const snap = getSnapMinutes(zoom);
      const snappedStartMin = snapToGrid(startMin, snap);
      setDragOverCell({ day, startMin: snappedStartMin });
    } else {
      setDragOverCell(null);
    }
  }, [zoom]);

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
      
      // Snap to grid (minimum 15 minutes)
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

    // Check for collisions
    const { hasCollision, collidingSlot } = checkSlotCollision(
      dateStr,
      createSlotForm.startMin,
      createSlotForm.lengthMin
    );

    if (hasCollision) {
      const slotType = collidingSlot?.blocked ? "Blocker" : "Termin";
      const timeRange = collidingSlot 
        ? `${formatTime(collidingSlot.startMin)} - ${formatTime(collidingSlot.startMin + collidingSlot.lengthMin)}`
        : "";
      
      toast({
        title: "Zeitkonflikt",
        description: `Es existiert bereits ein ${slotType} zur Zeit ${timeRange}. Bitte wählen Sie eine andere Zeit.`,
        variant: "destructive",
      });
      return;
    }

    createSlotMutation.mutate({
      workCenterId: selectedWorkCenter.id,
      date: dateStr,
      startMin: createSlotForm.startMin,
      lengthMin: createSlotForm.lengthMin,
      orderId: createSlotDialog.order.id,
      blocked: false,
      note: createSlotForm.note || null,
    });
  }, [createSlotDialog, createSlotForm, selectedWorkCenter, weekDates, createSlotMutation, checkSlotCollision, toast]);

  const handleCreateBlocker = useCallback(() => {
    if (!selectedWorkCenter) return;

    const dayDate = weekDates[blockerDialog.day];
    const dateStr = format(dayDate, "yyyy-MM-dd");

    // Check for collisions
    const { hasCollision, collidingSlot } = checkSlotCollision(
      dateStr,
      blockerForm.startMin,
      blockerForm.lengthMin
    );

    if (hasCollision) {
      const slotType = collidingSlot?.blocked ? "Blocker" : "Termin";
      const timeRange = collidingSlot 
        ? `${formatTime(collidingSlot.startMin)} - ${formatTime(collidingSlot.startMin + collidingSlot.lengthMin)}`
        : "";
      
      toast({
        title: "Zeitkonflikt",
        description: `Es existiert bereits ein ${slotType} zur Zeit ${timeRange}. Blocker kann nicht erstellt werden.`,
        variant: "destructive",
      });
      return;
    }

    createBlockerMutation.mutate({
      workCenterId: selectedWorkCenter.id,
      date: dateStr,
      startMin: blockerForm.startMin,
      lengthMin: blockerForm.lengthMin,
      orderId: null,
      blocked: true,
      note: blockerForm.note || null,
    });
  }, [blockerDialog, blockerForm, selectedWorkCenter, weekDates, createBlockerMutation, checkSlotCollision, toast]);

  const handleDeleteSlot = useCallback((slotId: string) => {
    if (confirm("Termin wirklich löschen?")) {
      deleteSlotMutation.mutate(slotId);
    }
  }, [deleteSlotMutation]);

  // Week navigation
  const handlePreviousWeek = () => setWeekStart(prev => subDays(prev, 7));
  const handleNextWeek = () => setWeekStart(prev => addDays(prev, 7));
  
  // Heute button: jump to current week AND scroll to current time
  const handleToday = useCallback(() => {
    const now = new Date();
    const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
    setWeekStart(currentWeek);
    
    // Scroll to current time after a short delay (to allow week change to render)
    setTimeout(() => {
      if (!gridContainerRef.current) return;
      
      const currentTimeMin = getCurrentTimeMinutes();
      
      // Only scroll if within working hours
      if (currentTimeMin >= WORKING_HOURS_START && currentTimeMin <= WORKING_HOURS_END) {
        const pixelsPerMinute = ROW_HEIGHT / zoom;
        const scrollToPosition = (currentTimeMin - WORKING_HOURS_START) * pixelsPerMinute;
        
        // Scroll to position with some offset (10% from top of viewport)
        const offset = gridContainerRef.current.clientHeight * 0.1;
        gridContainerRef.current.scrollTop = Math.max(0, scrollToPosition - offset);
      }
    }, 100);
  }, [zoom]);

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
        <div className="flex items-center justify-between gap-4 p-4 border-b flex-wrap">
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
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedWorkCenter && (
              <Badge variant="outline" data-testid="badge-capacity">
                Kapazität: {selectedWorkCenter.concurrentCapacity} parallel
              </Badge>
            )}

            {/* Add Blocker Button */}
            {selectedDepartment && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = weekDates.findIndex(d => isTodayFn(d));
                  setBlockerDialog({ open: true, day: today >= 0 ? today : 0, startMin: 420 });
                  setBlockerForm({ startMin: 420, lengthMin: 60, note: "" });
                }}
                data-testid="button-add-blocker"
              >
                <Plus className="h-4 w-4 mr-2" />
                Blocker
              </Button>
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
            <div className="flex-1 overflow-auto" ref={gridContainerRef}>
              <div className="min-w-full">
                <div className="flex border">
                  {/* Time Column */}
                  <div className="flex flex-col border-r bg-muted sticky left-0 z-10" style={{ width: "80px" }}>
                    <div className="border-b p-2 text-sm font-medium" style={{ minHeight: "56px" }}>Zeit</div>
                    <div className="relative" style={{ minHeight: `${totalDayHeight}px` }}>
                      {gridRows.map((timeMin, idx) => (
                        <div key={idx} className="border-b p-2 text-xs text-muted-foreground" style={{ height: `${ROW_HEIGHT}px` }}>
                          {formatTime(timeMin)}
                        </div>
                      ))}
                    </div>
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
                      <div className="flex-1 relative" style={{ minHeight: `${totalDayHeight}px` }}>
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
                            className="absolute left-0 right-0 bg-primary/20 border border-primary border-dashed rounded pointer-events-none"
                            style={{
                              top: `${getSlotGeometry(dragOverCell.startMin, 60, zoom).topPx}px`,
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
              <div className="p-4 border-b space-y-3">
                <div>
                  <h2 className="font-semibold" data-testid="text-order-pool-title">
                    Aufträge bereit
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {availableOrders.length} Aufträge (sortiert nach Fälligkeit)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="filter-this-week"
                    checked={showOnlyThisWeek}
                    onCheckedChange={(checked) => setShowOnlyThisWeek(checked === true)}
                    data-testid="checkbox-filter-week"
                  />
                  <Label
                    htmlFor="filter-this-week"
                    className="text-sm cursor-pointer"
                  >
                    Nur fällige Woche
                  </Label>
                </div>
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
            <DialogDescription>
              Planen Sie einen Produktionstermin für den ausgewählten Auftrag.
            </DialogDescription>
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

      {/* Create Blocker Dialog */}
      <Dialog
        open={blockerDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setBlockerDialog({ open: false, day: 0, startMin: 420 });
            setBlockerForm({ startMin: 420, lengthMin: 60, note: "" });
          }
        }}
      >
        <DialogContent data-testid="dialog-create-blocker">
          <DialogHeader>
            <DialogTitle>Blocker erstellen</DialogTitle>
            <DialogDescription>
              Erstellen Sie einen Blocker, um einen Zeitraum zu sperren.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="blockerDay">Tag</Label>
              <Select
                value={blockerDialog.day.toString()}
                onValueChange={(val) => setBlockerDialog({ ...blockerDialog, day: parseInt(val) })}
              >
                <SelectTrigger id="blockerDay" data-testid="select-blocker-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weekDates.map((date, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>
                      {DAY_LABELS[idx]}, {format(date, "dd.MM.yyyy", { locale: de })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="blockerStartTime">Startzeit</Label>
              <Select
                value={blockerForm.startMin.toString()}
                onValueChange={(val) => setBlockerForm({ ...blockerForm, startMin: parseInt(val) })}
              >
                <SelectTrigger id="blockerStartTime" data-testid="select-blocker-start-time">
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
              <Label htmlFor="blockerDuration">Dauer</Label>
              <Select
                value={blockerForm.lengthMin.toString()}
                onValueChange={(val) => setBlockerForm({ ...blockerForm, lengthMin: parseInt(val) })}
              >
                <SelectTrigger id="blockerDuration" data-testid="select-blocker-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 Min</SelectItem>
                  <SelectItem value="60">60 Min</SelectItem>
                  <SelectItem value="90">90 Min</SelectItem>
                  <SelectItem value="120">120 Min</SelectItem>
                  <SelectItem value="180">180 Min</SelectItem>
                  <SelectItem value="240">240 Min</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="blockerNote">Grund / Notiz</Label>
              <Textarea
                id="blockerNote"
                value={blockerForm.note}
                onChange={(e) => setBlockerForm({ ...blockerForm, note: e.target.value })}
                placeholder="z.B. Wartung, Meeting, etc."
                rows={2}
                data-testid="textarea-blocker-note"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBlockerDialog({ open: false, day: 0, startMin: 420 });
                setBlockerForm({ startMin: 420, lengthMin: 60, note: "" });
              }}
              data-testid="button-blocker-cancel"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleCreateBlocker}
              disabled={createBlockerMutation.isPending}
              data-testid="button-blocker-create"
            >
              {createBlockerMutation.isPending ? "Erstelle..." : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drag Overlay */}
      <DragOverlay>
        {dragState.type === "order" && dragState.order && (
          <div className="bg-card border rounded-md p-3 shadow-lg opacity-90 max-w-xs">
            <div className="text-sm font-medium">
              {dragState.order.displayOrderNumber || dragState.order.id}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {dragState.order.title}
            </div>
            {dragState.order.dueDate && (
              <div className="text-xs text-muted-foreground mt-1">
                Fällig: {formatDueDate(dragState.order.dueDate)}
              </div>
            )}
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
