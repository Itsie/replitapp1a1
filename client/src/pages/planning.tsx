import { useState, useMemo, memo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, GripVertical, Calendar, X } from "lucide-react";
import { format, addDays, subDays, startOfWeek, parseISO, isPast, differenceInHours } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  DndContext, 
  DragEndEvent, 
  useDraggable, 
  useDroppable, 
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

type Department = "TEAMSPORT" | "TEXTILVEREDELUNG" | "STICKEREI" | "DRUCK" | "SONSTIGES";

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

const DEPARTMENT_LABELS: Record<Department, string> = {
  TEAMSPORT: "Teamsport",
  TEXTILVEREDELUNG: "Textilveredelung",
  STICKEREI: "Stickerei",
  DRUCK: "Druck",
  SONSTIGES: "Sonstiges",
};

const DAY_LABELS = ["Mo.", "Di.", "Mi.", "Do.", "Fr."];
const WORKING_HOURS_START = 7 * 60; // 07:00 = 420 min
const WORKING_HOURS_END = 18 * 60; // 18:00 = 1080 min

// ============================================================================
// STABLE GEOMETRY: 1rem = 5 minutes
// ============================================================================
const MINUTES_PER_REM = 5;
const SNAP_MINUTES = 15;

function calculateSlotStyle(startMin: number, lengthMin: number) {
  const topRem = (startMin - WORKING_HOURS_START) / MINUTES_PER_REM;
  const heightRem = lengthMin / MINUTES_PER_REM;
  return {
    top: `${topRem}rem`,
    height: `${heightRem}rem`,
  };
}

function snapToGrid(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
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

// ============================================================================
// Draggable Order Card
// ============================================================================
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

// ============================================================================
// Draggable Time Slot
// ============================================================================
const DraggableTimeSlot = memo(({ 
  slot, 
  onDelete 
}: { 
  slot: TimeSlot; 
  onDelete: (slotId: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `slot-${slot.id}`,
    data: { type: "slot", slot },
  });

  const style = {
    ...calculateSlotStyle(slot.startMin, slot.lengthMin),
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
    position: "absolute" as const,
    left: 0,
    right: 0,
  };

  const isBlocked = slot.blocked;
  const order = slot.order;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded border px-2 py-1 text-xs cursor-grab active:cursor-grabbing overflow-hidden ${
        isBlocked 
          ? "bg-gray-200 dark:bg-gray-700 border-gray-400 dark:border-gray-600" 
          : "bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700"
      }`}
      data-testid={`slot-${slot.id}`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">
            {isBlocked ? "Blocker" : order?.displayOrderNumber || order?.title || "Unbekannt"}
          </div>
          {!isBlocked && order && (
            <>
              <div className="text-muted-foreground truncate text-[10px]">
                {order.title}
              </div>
              <div className="text-muted-foreground truncate text-[10px]">
                {order.customer}
              </div>
            </>
          )}
          <div className="text-muted-foreground text-[10px] mt-0.5">
            {formatTime(slot.startMin)} - {formatTime(slot.startMin + slot.lengthMin)}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(slot.id);
          }}
          className="flex-shrink-0 text-muted-foreground hover:text-destructive"
          data-testid={`button-delete-slot-${slot.id}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
});

DraggableTimeSlot.displayName = "DraggableTimeSlot";

// ============================================================================
// Droppable Calendar Cell (Day Column)
// ============================================================================
const DroppableCalendarCell = memo(({ 
  day, 
  workCenterId, 
  slots 
}: { 
  day: number; 
  workCenterId: string; 
  slots: TimeSlot[];
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${day}-${workCenterId}`,
    data: { day, workCenterId },
  });

  const totalHeightRem = (WORKING_HOURS_END - WORKING_HOURS_START) / MINUTES_PER_REM;

  return (
    <div
      ref={setNodeRef}
      className={`relative border-r border-b border-border ${
        isOver ? "bg-primary/10" : ""
      }`}
      style={{ minHeight: `${totalHeightRem}rem` }}
      data-testid={`drop-zone-${day}-${workCenterId}`}
    >
      {/* Grid lines every 60 minutes */}
      {Array.from({ length: Math.floor((WORKING_HOURS_END - WORKING_HOURS_START) / 60) }).map((_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-border/30"
          style={{ top: `${(i * 60) / MINUTES_PER_REM}rem` }}
        />
      ))}
    </div>
  );
});

DroppableCalendarCell.displayName = "DroppableCalendarCell";

// ============================================================================
// Main Planning Component
// ============================================================================
export default function Planning() {
  const { toast } = useToast();
  const [selectedDepartment, setSelectedDepartment] = useState<Department>("TEAMSPORT");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showOnlyThisWeek, setShowOnlyThisWeek] = useState(false);
  const [draggedItem, setDraggedItem] = useState<{ type: "order" | "slot"; data: Order | TimeSlot } | null>(null);
  
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch work centers
  const { data: workCenters = [] } = useQuery<WorkCenter[]>({
    queryKey: ["/api/workcenters", selectedDepartment],
    queryFn: async () => {
      const res = await fetch(`/api/workcenters?department=${selectedDepartment}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch work centers");
      const all = await res.json();
      return all.filter((wc: WorkCenter) => wc.active);
    },
  });

  // Fetch time slots
  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ["/api/timeslots", selectedDepartment, weekStartStr],
    queryFn: async () => {
      const params = new URLSearchParams({
        department: selectedDepartment,
        weekStart: weekStartStr,
      });
      const res = await fetch(`/api/timeslots?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch time slots");
      return res.json();
    },
  });

  // Fetch available orders
  const { data: allOrders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders", selectedDepartment, "ready"],
    enabled: !!selectedDepartment,
    queryFn: async () => {
      const params1 = new URLSearchParams({
        department: selectedDepartment,
        workflow: "FUER_PROD",
      });
      const res1 = await fetch(`/api/orders?${params1.toString()}`, { credentials: "include" });
      if (!res1.ok) throw new Error("Failed to fetch orders");
      const orders1 = await res1.json();
      
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

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  // Filter available orders (not scheduled)
  const availableOrders = useMemo(() => {
    const scheduledOrderIds = new Set(
      timeSlots.filter(slot => slot.orderId).map(slot => slot.orderId)
    );
    let unscheduled = allOrders.filter(order => !scheduledOrderIds.has(order.id));
    
    if (showOnlyThisWeek) {
      unscheduled = unscheduled.filter(order => {
        if (!order.dueDate) return false;
        const dueDate = parseISO(order.dueDate);
        return dueDate >= weekStart && dueDate <= weekEnd;
      });
    }
    
    return unscheduled.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [allOrders, timeSlots, showOnlyThisWeek, weekStart, weekEnd]);

  // Create slot mutation
  const createSlotMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/timeslots", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timeslots", selectedDepartment, weekStartStr] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders", selectedDepartment, "ready"] });
      toast({ title: "Termin erstellt" });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Erstellen",
        variant: "destructive",
      });
    },
  });

  // Update slot mutation
  const updateSlotMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => 
      apiRequest("PATCH", `/api/timeslots/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timeslots", selectedDepartment, weekStartStr] });
      toast({ title: "Termin verschoben" });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Fehler beim Verschieben",
        variant: "destructive",
      });
    },
  });

  // Delete slot mutation
  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => apiRequest("DELETE", `/api/timeslots/${slotId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timeslots", selectedDepartment, weekStartStr] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders", selectedDepartment, "ready"] });
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

  // ============================================================================
  // SIMPLIFIED DRAG & DROP LOGIC
  // ============================================================================
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setDraggedItem(null);
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData || !overData) {
      setDraggedItem(null);
      return;
    }

    const { day, workCenterId } = overData;
    const targetDate = format(addDays(weekStart, day), "yyyy-MM-dd");

    // Dragging an ORDER from pool
    if (activeData.type === "order") {
      const order = activeData.order as Order;
      
      // Find the selected work center
      const workCenter = workCenters.find(wc => wc.id === workCenterId);
      if (!workCenter) {
        toast({ title: "Fehler", description: "WorkCenter nicht gefunden", variant: "destructive" });
        setDraggedItem(null);
        return;
      }

      // Create new slot at 08:00 with 60 min length
      const startMin = 8 * 60; // 08:00
      const lengthMin = 60;

      createSlotMutation.mutate({
        date: targetDate,
        startMin,
        lengthMin,
        workCenterId,
        orderId: order.id,
        blocked: false,
        note: null,
      });
    }
    
    // Dragging a SLOT
    else if (activeData.type === "slot") {
      const slot = activeData.slot as TimeSlot;

      // Update the slot's position
      updateSlotMutation.mutate({
        id: slot.id,
        data: {
          date: targetDate,
          workCenterId,
          startMin: slot.startMin, // Keep same start time for now
        },
      });
    }

    setDraggedItem(null);
  };

  const handleDeleteSlot = (slotId: string) => {
    if (window.confirm("Termin wirklich löschen?")) {
      deleteSlotMutation.mutate(slotId);
    }
  };

  // Group slots by day and work center
  const slotsByDayAndWC = useMemo(() => {
    const map = new Map<string, TimeSlot[]>();
    
    timeSlots.forEach(slot => {
      const slotDate = format(new Date(slot.date), "yyyy-MM-dd");
      const dayIndex = Math.floor(
        (new Date(slotDate).getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (dayIndex >= 0 && dayIndex < 5) {
        const key = `${dayIndex}-${slot.workCenterId}`;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(slot);
      }
    });
    
    return map;
  }, [timeSlots, weekStart]);

  const totalHeightRem = (WORKING_HOURS_END - WORKING_HOURS_START) / MINUTES_PER_REM;

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
      onDragStart={(e) => {
        const data = e.active.data.current;
        if (data?.type === "order") {
          setDraggedItem({ type: "order", data: data.order });
        } else if (data?.type === "slot") {
          setDraggedItem({ type: "slot", data: data.slot });
        }
      }}
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" data-testid="heading-planning">Produktionsplanung</h1>
          
          <div className="flex items-center gap-3">
            <Select value={selectedDepartment} onValueChange={(val) => setSelectedDepartment(val as Department)}>
              <SelectTrigger className="w-48" data-testid="select-department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(subDays(weekStart, 7))}
            data-testid="button-prev-week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium" data-testid="text-week-range">
            KW {format(weekStart, "w", { locale: de })} • {format(weekStart, "dd.MM.", { locale: de })} - {format(addDays(weekStart, 4), "dd.MM.yyyy", { locale: de })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            data-testid="button-next-week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-[300px_1fr] gap-4">
          {/* Left: Order Pool */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold" data-testid="heading-order-pool">
                Aufträge ({availableOrders.length})
              </h2>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="filter-week"
                  checked={showOnlyThisWeek}
                  onCheckedChange={(checked) => setShowOnlyThisWeek(!!checked)}
                  data-testid="checkbox-filter-week"
                />
                <Label htmlFor="filter-week" className="text-xs cursor-pointer">
                  Nur diese Woche
                </Label>
              </div>
            </div>

            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "70vh" }}>
              {availableOrders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Keine planbaren Aufträge
                </p>
              )}
              {availableOrders.map(order => (
                <DraggableOrderCard key={order.id} order={order} />
              ))}
            </div>
          </Card>

          {/* Right: Calendar Grid */}
          <Card className="p-4 overflow-auto">
            <div className="grid grid-cols-[120px_repeat(5,1fr)] gap-0 border border-border">
              {/* Header Row */}
              <div className="border-r border-b border-border bg-muted/50 p-2 font-medium text-sm sticky top-0 z-10">
                Arbeitsstelle
              </div>
              {DAY_LABELS.map((label, i) => {
                const dayDate = addDays(weekStart, i);
                return (
                  <div
                    key={i}
                    className="border-r border-b border-border bg-muted/50 p-2 text-center font-medium text-sm sticky top-0 z-10"
                    data-testid={`header-day-${i}`}
                  >
                    <div>{label}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(dayDate, "dd.MM.")}
                    </div>
                  </div>
                );
              })}

              {/* Work Center Rows */}
              {workCenters.map(wc => (
                <div key={wc.id} className="contents">
                  <div className="border-r border-b border-border p-2 text-sm font-medium bg-muted/30">
                    {wc.name}
                  </div>
                  {[0, 1, 2, 3, 4].map(day => {
                    const key = `${day}-${wc.id}`;
                    const slots = slotsByDayAndWC.get(key) || [];
                    
                    return (
                      <div key={day} className="relative">
                        <DroppableCalendarCell
                          day={day}
                          workCenterId={wc.id}
                          slots={slots}
                        />
                        {slots.map(slot => (
                          <DraggableTimeSlot
                            key={slot.id}
                            slot={slot}
                            onDelete={handleDeleteSlot}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Time Labels (Left Side) */}
            <div className="mt-4 flex gap-2 text-xs text-muted-foreground">
              <div className="w-20">07:00</div>
              <div className="w-20">08:00</div>
              <div className="w-20">09:00</div>
              <div className="w-20">10:00</div>
              <div className="w-20">11:00</div>
              <div className="w-20">12:00</div>
              <div className="w-20">13:00</div>
              <div className="w-20">14:00</div>
              <div className="w-20">15:00</div>
              <div className="w-20">16:00</div>
              <div className="w-20">17:00</div>
              <div className="w-20">18:00</div>
            </div>
          </Card>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {draggedItem?.type === "order" && (
          <DraggableOrderCard order={draggedItem.data as Order} />
        )}
        {draggedItem?.type === "slot" && (
          <Card className="p-2 text-xs opacity-80">
            <div className="font-medium">
              {(draggedItem.data as TimeSlot).order?.displayOrderNumber || "Slot"}
            </div>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  );
}
