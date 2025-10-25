import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Lock, X, GripVertical } from "lucide-react";
import { format, addDays, subDays, startOfWeek, getWeek } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { DndContext, DragEndEvent, useDraggable, useDroppable, DragOverlay, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
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

interface DropData {
  day: number;
  timeSlot: number; // index in timeSlots array
  startMin: number; // actual minute value
}

interface CreateSlotForm {
  startMin: number;
  lengthMin: number;
  requireParts: boolean;
  note: string;
}

const DEPARTMENT_LABELS: Record<Department, string> = {
  TEAMSPORT: "Teamsport",
  TEXTILVEREDELUNG: "Textilveredelung",
  STICKEREI: "Stickerei",
  DRUCK: "Druck",
  SONSTIGES: "Sonstiges",
};

const DAY_LABELS = ["Mo.", "Di.", "Mi.", "Do.", "Fr."];
const WORKING_HOURS_START = 7 * 60; // 07:00 in minutes
const WORKING_HOURS_END = 18 * 60; // 18:00 in minutes
const TIME_SLOT_DURATION = 5; // 5 minutes per row (as per spec)

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
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

function DraggableOrderCard({ order }: { order: Order }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `order-${order.id}`,
    data: { type: "order", order },
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="bg-card border rounded-md p-3 cursor-grab active:cursor-grabbing hover-elevate active-elevate-2"
      data-testid={`draggable-order-${order.id}`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5" />
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
        </div>
      </div>
    </div>
  );
}

function DroppableCell({ day, timeSlot, startMin }: { day: number; timeSlot: number; startMin: number }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${day}-${timeSlot}`,
    data: { type: "cell", day, timeSlot, startMin },
  });

  return (
    <div
      ref={setNodeRef}
      className={`border-b ${isOver ? "bg-primary/10" : ""}`}
      style={{ height: "40px" }}
      data-testid={`droppable-cell-${day}-${timeSlot}`}
    />
  );
}

export default function PlanningPage() {
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [createSlotDialog, setCreateSlotDialog] = useState<{
    open: boolean;
    order: Order | null;
    day: number;
    startMin: number;
  }>({ open: false, order: null, day: 0, startMin: 480 });
  const [createSlotForm, setCreateSlotForm] = useState<CreateSlotForm>({
    startMin: 480,
    lengthMin: 60,
    requireParts: false,
    note: "",
  });
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [createBlockerDialog, setCreateBlockerDialog] = useState<{
    open: boolean;
    day: number;
    startMin: number;
  }>({ open: false, day: 0, startMin: 480 });
  const [createBlockerForm, setCreateBlockerForm] = useState<{
    startMin: number;
    lengthMin: number;
    note: string;
  }>({
    startMin: 480,
    lengthMin: 120,
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

  // Time slots for rows (07:00-18:00 in 30-min increments for display)
  const timeSlots = useMemo(() => {
    const slots: number[] = [];
    for (let min = WORKING_HOURS_START; min < WORKING_HOURS_END; min += TIME_SLOT_DURATION) {
      slots.push(min);
    }
    return slots;
  }, []);

  // Format week range for query
  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  // Fetch work center for selected department
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

  // Fetch time slots for the week
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

  // Fetch orders ready for production
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
      const allOrders = await res.json();
      
      // Also fetch WARTET_FEHLTEILE orders
      const params2 = new URLSearchParams({
        department: selectedDepartment,
        workflow: "WARTET_FEHLTEILE",
      });
      const res2 = await fetch(`/api/orders?${params2.toString()}`, { credentials: "include" });
      if (!res2.ok) throw new Error("Failed to fetch orders");
      const waitingOrders = await res2.json();
      
      return [...allOrders, ...waitingOrders];
    },
  });

  // Filter out scheduled orders using useMemo to react to timeSlotData changes
  const availableOrders = useMemo(() => {
    const scheduledOrderIds = new Set(
      timeSlotData.filter(slot => slot.orderId).map(slot => slot.orderId)
    );
    return allFetchedOrders.filter(order => !scheduledOrderIds.has(order.id));
  }, [allFetchedOrders, timeSlotData]);

  // Create time slot mutation
  const createSlotMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/timeslots", data);
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/timeslots", selectedDepartment, weekStartStr] });
      queryClient.refetchQueries({ queryKey: ["/api/orders", selectedDepartment, "ready"] });
      toast({ title: "Termin erstellt" });
      setCreateSlotDialog({ open: false, order: null, day: 0, startMin: 480 });
      setCreateSlotForm({ startMin: 480, lengthMin: 60, requireParts: false, note: "" });
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || "Fehler beim Erstellen des Termins";
      toast({
        title: "Fehler",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Delete time slot mutation
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
      const message = error.response?.data?.error || "Fehler beim Löschen";
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
      console.log("[Blocker Creation] Sending payload:", data);
      const result = await apiRequest("POST", "/api/timeslots", data);
      console.log("[Blocker Creation] Success:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/timeslots", selectedDepartment, weekStartStr] });
      toast({ title: "Blocker erstellt" });
      setCreateBlockerDialog({ open: false, day: 0, startMin: 480 });
      setCreateBlockerForm({ startMin: 480, lengthMin: 120, note: "" });
    },
    onError: (error: any) => {
      console.error("[Blocker Creation] Error:", error);
      console.error("[Blocker Creation] Error response:", error.response);
      const message = error.response?.data?.error || error.message || "Fehler beim Erstellen des Blockers";
      toast({
        title: "Fehler",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOrderId(null);

    if (!over || !selectedWorkCenter) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type === "order" && overData?.type === "cell") {
      const order = activeData.order as Order;
      const { day, startMin } = overData as DropData;
      
      setCreateSlotDialog({ open: true, order, day, startMin });
      setCreateSlotForm({ startMin, lengthMin: 60, requireParts: false, note: "" });
    }
  };

  const handleDragStart = (event: any) => {
    const activeData = event.active.data.current;
    if (activeData?.type === "order") {
      setActiveOrderId(activeData.order.id);
    }
  };

  const handleCreateSlot = () => {
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
  };

  const handleDeleteSlot = (slotId: string) => {
    if (confirm("Termin wirklich löschen?")) {
      deleteSlotMutation.mutate(slotId);
    }
  };

  const handleCreateBlocker = () => {
    if (!selectedWorkCenter) {
      toast({
        title: "Fehler",
        description: "Kein Bereich ausgewählt oder Bereich nicht gefunden",
        variant: "destructive",
      });
      return;
    }

    const dayDate = weekDates[createBlockerDialog.day];
    const dateStr = format(dayDate, "yyyy-MM-dd");

    createBlockerMutation.mutate({
      workCenterId: selectedWorkCenter.id,
      date: dateStr,
      startMin: createBlockerForm.startMin,
      lengthMin: createBlockerForm.lengthMin,
      orderId: null,
      blocked: true,
      note: createBlockerForm.note || null,
    });
  };

  const handlePreviousWeek = () => {
    setWeekStart(prev => subDays(prev, 7));
  };

  const handleNextWeek = () => {
    setWeekStart(prev => addDays(prev, 7));
  };

  const handleToday = () => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  // Group time slots by day and calculate positioning
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

  const renderSlot = (slot: TimeSlot) => {
    const topPercent = ((slot.startMin - WORKING_HOURS_START) / (WORKING_HOURS_END - WORKING_HOURS_START)) * 100;
    const heightPercent = (slot.lengthMin / (WORKING_HOURS_END - WORKING_HOURS_START)) * 100;

    if (slot.blocked) {
      return (
        <div
          key={slot.id}
          className="absolute left-0 right-0 bg-red-500 text-white p-2 rounded text-xs font-medium flex items-center gap-2 z-10"
          style={{
            top: `${topPercent}%`,
            height: `${heightPercent}%`,
          }}
        >
          <Lock className="h-3 w-3" />
          <span>Gesperrt</span>
          {slot.note && <span className="text-xs opacity-90">: {slot.note}</span>}
          <button
            onClick={() => handleDeleteSlot(slot.id)}
            className="ml-auto hover:bg-red-600 rounded p-1"
            data-testid={`button-delete-slot-${slot.id}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      );
    }

    return (
      <div
        key={slot.id}
        className="absolute left-0 right-0 bg-primary text-primary-foreground p-2 rounded text-xs z-10"
        style={{
          top: `${topPercent}%`,
          height: `${heightPercent}%`,
        }}
        data-testid={`slot-${slot.id}`}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">
              {slot.order?.displayOrderNumber || slot.order?.title || "Auftrag"}
            </div>
            <div className="text-xs opacity-90 truncate">
              {formatTime(slot.startMin)} - {formatTime(slot.startMin + slot.lengthMin)}
            </div>
            {slot.order?.customer && (
              <div className="text-xs opacity-75 truncate">{slot.order.customer}</div>
            )}
          </div>
          <button
            onClick={() => handleDeleteSlot(slot.id)}
            className="hover:bg-primary/80 rounded p-1"
            data-testid={`button-delete-slot-${slot.id}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  };

  const weekNumber = getWeek(weekStart, { locale: de, weekStartsOn: 1 });

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
      <div className="flex h-full">
        {/* Main Calendar */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 p-4 border-b">
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              Produktionsplanung
            </h1>

            <div className="flex items-center gap-4">
              {/* Bereich Selection */}
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

              {/* Blocker Creation Button */}
              {selectedDepartment && (
                <Button
                  variant="default"
                  onClick={() => {
                    setCreateBlockerDialog({ open: true, day: 0, startMin: 480 });
                    setCreateBlockerForm({ startMin: 480, lengthMin: 120, note: "" });
                  }}
                  data-testid="button-add-blocker"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Blocker hinzufügen
                </Button>
              )}
            </div>
          </div>

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
                    {timeSlots.map((timeMin, rowIdx) => (
                      <div key={rowIdx} className="border-b p-2 text-xs text-muted-foreground" style={{ minHeight: "40px" }}>
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

                      {/* Day Content - relative positioned container for slots */}
                      <div className="flex-1 relative">
                        {/* Droppable cells */}
                        {timeSlots.map((timeMin, rowIdx) => (
                          <DroppableCell key={rowIdx} day={dayIdx} timeSlot={rowIdx} startMin={timeMin} />
                        ))}

                        {/* Absolute positioned slots */}
                        {slotsByDay[dayIdx].map(slot => renderSlot(slot))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Order Pool */}
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

      {/* Create Slot Dialog */}
      <Dialog
        open={createSlotDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setCreateSlotDialog({ open: false, order: null, day: 0, startMin: 480 });
            setCreateSlotForm({ startMin: 480, lengthMin: 60, requireParts: false, note: "" });
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
                    {timeSlots.map((min) => (
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

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requireParts"
                  checked={createSlotForm.requireParts}
                  onCheckedChange={(checked) =>
                    setCreateSlotForm({ ...createSlotForm, requireParts: checked as boolean })
                  }
                  data-testid="checkbox-require-parts"
                />
                <Label htmlFor="requireParts" className="text-sm cursor-pointer">
                  Start nur wenn Fehlteile vollständig
                </Label>
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
                setCreateSlotDialog({ open: false, order: null, day: 0, startMin: 480 });
                setCreateSlotForm({ startMin: 480, lengthMin: 60, requireParts: false, note: "" });
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
        open={createBlockerDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setCreateBlockerDialog({ open: false, day: 0, startMin: 480 });
            setCreateBlockerForm({ startMin: 480, lengthMin: 120, note: "" });
          }
        }}
      >
        <DialogContent data-testid="dialog-create-blocker">
          <DialogHeader>
            <DialogTitle>Blocker hinzufügen</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="blockerDay">Tag</Label>
              <Select
                value={createBlockerDialog.day.toString()}
                onValueChange={(val) => setCreateBlockerDialog({ ...createBlockerDialog, day: parseInt(val) })}
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
                value={createBlockerForm.startMin.toString()}
                onValueChange={(val) => setCreateBlockerForm({ ...createBlockerForm, startMin: parseInt(val) })}
              >
                <SelectTrigger id="blockerStartTime" data-testid="select-blocker-start-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((min) => (
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
                value={createBlockerForm.lengthMin.toString()}
                onValueChange={(val) => setCreateBlockerForm({ ...createBlockerForm, lengthMin: parseInt(val) })}
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
              <Label htmlFor="blockerNote">Notiz</Label>
              <Textarea
                id="blockerNote"
                value={createBlockerForm.note}
                onChange={(e) => setCreateBlockerForm({ ...createBlockerForm, note: e.target.value })}
                placeholder="Grund für den Blocker..."
                rows={3}
                data-testid="textarea-blocker-note"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateBlockerDialog({ open: false, day: 0, startMin: 480 });
                setCreateBlockerForm({ startMin: 480, lengthMin: 120, note: "" });
              }}
              data-testid="button-cancel-blocker"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleCreateBlocker}
              disabled={createBlockerMutation.isPending}
              data-testid="button-create-blocker"
            >
              {createBlockerMutation.isPending ? "Erstelle..." : "Blocker erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeOrderId && (
          <div className="bg-card border rounded-md p-3 shadow-lg opacity-90">
            <div className="text-sm font-medium">Auftrag wird verschoben...</div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
