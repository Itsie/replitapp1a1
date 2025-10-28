import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, X, Plus, GripVertical } from "lucide-react";
import { format, addDays, subDays, startOfWeek, parseISO, getDay, differenceInCalendarDays } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  DndContext, 
  DragEndEvent,
  DragOverEvent,
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
const WORKING_HOURS_TOTAL = WORKING_HOURS_END - WORKING_HOURS_START; // 660 min

// STABLE GEOMETRY: 1rem = 5 minutes
const MINUTES_PER_REM = 5;
const SNAP_MINUTES = 15;
const TIMELINE_HEIGHT_REM = WORKING_HOURS_TOTAL / MINUTES_PER_REM; // 132rem

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

export default function Planning() {
  const { toast } = useToast();
  const [selectedDepartment, setSelectedDepartment] = useState<Department>("TEAMSPORT");
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = getDay(today);
    const diff = day === 0 ? -6 : 1 - day;
    const monday = addDays(today, diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // Modals
  const [durationModalOpen, setDurationModalOpen] = useState(false);
  const [blockerModalOpen, setBlockerModalOpen] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<{ orderId: string; date: Date; startMin: number } | null>(null);
  const [blockerForm, setBlockerForm] = useState({ date: new Date(), startMin: 420, lengthMin: 60, note: "" });
  const [durationInput, setDurationInput] = useState("60");

  // Drag & Drop
  const [activeId, setActiveId] = useState<string | null>(null);
  const [currentPointerY, setCurrentPointerY] = useState<number | null>(null);
  const [dragOverData, setDragOverData] = useState<{ day: number; workCenterId: string } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  // Track pointer position during drag (works for mouse, touch, and pen)
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (activeId) {
        setCurrentPointerY(e.clientY);
      }
    };

    if (activeId) {
      window.addEventListener("pointermove", handlePointerMove);
      return () => window.removeEventListener("pointermove", handlePointerMove);
    }
  }, [activeId]);

  // Get workcenters for department
  const { data: workCenters = [] } = useQuery<WorkCenter[]>({
    queryKey: [`/api/workcenters?department=${selectedDepartment}`],
  });

  const departmentWorkCenter = useMemo(() => {
    return workCenters.find(wc => wc.active) || workCenters[0];
  }, [workCenters]);

  // Get available orders
  const { data: ordersResponse } = useQuery<{ orders: Order[]; totalCount: number }>({
    queryKey: [`/api/orders?department=${selectedDepartment}&workflow=FUER_PROD,WARTET_FEHLTEILE`],
  });
  const availableOrders = ordersResponse?.orders || [];

  // Get time slots for week
  const weekDates = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  const { data: timeSlots = [], refetch: refetchTimeSlots } = useQuery<TimeSlot[]>({
    queryKey: [`/api/timeslots?department=${selectedDepartment}&weekStart=${weekStartStr}`],
  });

  // Mutations
  const createSlotMutation = useMutation({
    mutationFn: async (data: {
      workCenterId: string;
      date: Date;
      startMin: number;
      lengthMin: number;
      orderId?: string;
      blocked?: boolean;
      note?: string;
    }) => {
      const dateStr = format(data.date, "yyyy-MM-dd");
      await apiRequest("POST", "/api/timeslots", {
        workCenterId: data.workCenterId,
        date: dateStr,
        startMin: data.startMin,
        lengthMin: data.lengthMin,
        orderId: data.orderId || null,
        blocked: data.blocked || false,
        note: data.note || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0]?.toString().startsWith("/api/timeslots") 
      });
      await refetchTimeSlots();
      toast({ title: "Erfolgreich", description: "Zeitslot erstellt" });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    },
  });

  const updateSlotMutation = useMutation({
    mutationFn: async (data: { id: string; date: Date; startMin: number }) => {
      const dateStr = format(data.date, "yyyy-MM-dd");
      await apiRequest("PATCH", `/api/timeslots/${data.id}`, {
        date: dateStr,
        startMin: data.startMin,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0]?.toString().startsWith("/api/timeslots") 
      });
      toast({ title: "Erfolgreich", description: "Zeitslot verschoben" });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    },
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      await apiRequest("DELETE", `/api/timeslots/${slotId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0]?.toString().startsWith("/api/timeslots") 
      });
      toast({ title: "Erfolgreich", description: "Zeitslot gelöscht" });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    },
  });

  // Drag handlers
  function handleDragOver(event: DragOverEvent) {
    const { over } = event;
    const overId = over?.id;
    const overData = over?.data?.current;
    
    console.log("[DragOver] Event:", { overId, overDataType: overData?.type });

    // Finde die Daten der Zelle, über der wir schweben
    let cellData: { day: number; workCenterId: string } | null = null;

    if (overData?.type === 'day-cell') {
      // Wir sind direkt über der Spalte
      const targetDate = overData.date as Date;
      const dayIndex = differenceInCalendarDays(targetDate, weekStart);
      if (dayIndex >= 0 && dayIndex < 5 && departmentWorkCenter) {
        cellData = { day: dayIndex, workCenterId: departmentWorkCenter.id };
      }
    } else if (overId && typeof overId === 'string' && overId.startsWith('slot-')) {
      // Wir sind über einem Slot, finde die Zelle darunter
      const slotId = overId.replace('slot-', '');
      const slot = timeSlots.find(s => s.id === slotId);
      if (slot) {
        const slotDate = parseISO(slot.date);
        const dayIndex = differenceInCalendarDays(slotDate, weekStart);
        if (dayIndex >= 0 && dayIndex < 5) {
          cellData = { day: dayIndex, workCenterId: slot.workCenterId };
        }
      }
    }

    if (cellData) {
      setDragOverData(cellData);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const pointerY = currentPointerY;
    console.log("[DragEnd] Event:", { activeId: active.id, overId: over?.id, dragOverData, pointerY });
    setActiveId(null);
    setCurrentPointerY(null);

    if (!over || !dragOverData) {
      // Kein gültiges Ziel gefunden
      console.log("[DragEnd] No valid target - over:", !!over, "dragOverData:", dragOverData);
      setDragOverData(null);
      return;
    }

    if (!departmentWorkCenter) {
      console.log("[DragEnd] No department work center");
      setDragOverData(null);
      return;
    }
    
    console.log("[DragEnd] Valid drop - targetCellData:", dragOverData, "departmentWorkCenter:", departmentWorkCenter);

    const activeData = active.data.current;
    const targetCellData = dragOverData; // Nutze die gespeicherten Daten!

    // Berechne das Zieldatum aus dragOverData
    const targetDate = addDays(weekStart, targetCellData.day);
    
    // Get the current bounding rect of the droppable element
    const dayElement = document.getElementById(`day-${format(targetDate, "yyyy-MM-dd")}-timeline`);
    
    let startMin = WORKING_HOURS_START;
    if (dayElement && pointerY !== null) {
      const rect = dayElement.getBoundingClientRect();
      const relativeY = pointerY - rect.top;
      const remFromTop = relativeY / 16; // 1rem = 16px
      const minutesFromStart = remFromTop * MINUTES_PER_REM;
      startMin = snapToGrid(WORKING_HOURS_START + minutesFromStart);
      startMin = Math.max(WORKING_HOURS_START, Math.min(WORKING_HOURS_END - 15, startMin));
    }

    // Order from pool
    if (activeData?.type === "order") {
      const orderId = activeData.orderId as string;
      setPendingDrop({ orderId, date: targetDate, startMin });
      setDurationInput("60");
      setDurationModalOpen(true);
      setDragOverData(null); // Reset
      return;
    }

    // Moving existing slot
    if (activeData?.type === "slot") {
      const slotId = activeData.slotId as string;
      updateSlotMutation.mutate({ id: slotId, date: targetDate, startMin });
      setDragOverData(null); // Reset am Ende
      return;
    }

    setDragOverData(null); // Reset am Ende
  }

  function handleDurationConfirm() {
    if (!pendingDrop || !departmentWorkCenter) return;
    const lengthMin = parseInt(durationInput, 10);
    if (isNaN(lengthMin) || lengthMin < 5) {
      toast({ title: "Fehler", description: "Bitte gültige Dauer eingeben (min. 5 Min)", variant: "destructive" });
      return;
    }

    createSlotMutation.mutate({
      workCenterId: departmentWorkCenter.id,
      date: pendingDrop.date,
      startMin: pendingDrop.startMin,
      lengthMin,
      orderId: pendingDrop.orderId,
    });

    setDurationModalOpen(false);
    setPendingDrop(null);
  }

  function handleAddBlocker() {
    if (!departmentWorkCenter) {
      toast({ title: "Fehler", description: "Kein Arbeitsplatz verfügbar", variant: "destructive" });
      return;
    }
    setBlockerForm({ date: weekDates[0], startMin: 420, lengthMin: 60, note: "" });
    setBlockerModalOpen(true);
  }

  function handleBlockerConfirm() {
    if (!departmentWorkCenter) return;
    
    if (isNaN(blockerForm.startMin) || isNaN(blockerForm.lengthMin)) {
      toast({ title: "Fehler", description: "Ungültige Zeit- oder Dauerwerte", variant: "destructive" });
      return;
    }
    
    createSlotMutation.mutate({
      workCenterId: departmentWorkCenter.id,
      date: blockerForm.date,
      startMin: blockerForm.startMin,
      lengthMin: blockerForm.lengthMin,
      blocked: true,
      note: blockerForm.note,
    });
    setBlockerModalOpen(false);
  }

  // Filter orders that are already scheduled
  const scheduledOrderIds = new Set(timeSlots.filter(s => s.orderId).map(s => s.orderId));
  const unscheduledOrders = availableOrders.filter(o => !scheduledOrderIds.has(o.id));

  // Group slots by date
  const slotsByDate = useMemo(() => {
    const map = new Map<string, TimeSlot[]>();
    timeSlots.forEach(slot => {
      const dateKey = format(parseISO(slot.date), "yyyy-MM-dd");
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(slot);
    });
    return map;
  }, [timeSlots]);

  const activeOrder = activeId && activeId.startsWith("order-") 
    ? unscheduledOrders.find(o => o.id === activeId.substring(6))
    : null;

  const activeSlot = activeId && activeId.startsWith("slot-")
    ? timeSlots.find(s => s.id === activeId.substring(5))
    : null;

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Produktionsplanung</h1>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Bereich:</Label>
              <Select value={selectedDepartment} onValueChange={(v) => setSelectedDepartment(v as Department)}>
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

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekStart(prev => subDays(prev, 7))}
                data-testid="button-prev-week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[140px] text-center">
                KW {format(weekStart, "w, yyyy")}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekStart(prev => addDays(prev, 7))}
                data-testid="button-next-week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button onClick={handleAddBlocker} variant="outline" data-testid="button-add-blocker">
              <Plus className="mr-2 h-4 w-4" />
              Blocker hinzufügen
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex gap-4 p-4">
        {/* Left: Order Pool */}
        <Card className="w-80 flex-shrink-0 flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">Verfügbare Aufträge ({unscheduledOrders.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-2">
            {unscheduledOrders.map(order => (
              <DraggableOrderCard key={order.id} order={order} />
            ))}
            {unscheduledOrders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Keine Aufträge verfügbar
              </p>
            )}
          </CardContent>
        </Card>

        {/* Right: Time Matrix */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardContent className="flex-1 overflow-auto p-0">
            <DndContext 
              sensors={sensors} 
              onDragStart={(e) => setActiveId(e.active.id as string)} 
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="flex min-w-max">
                {/* Time column */}
                <div className="w-16 flex-shrink-0 border-r bg-muted/30">
                  <div className="h-12 border-b" /> {/* Header spacer */}
                  <div className="relative" style={{ height: `${TIMELINE_HEIGHT_REM}rem` }}>
                    {Array.from({ length: 12 }, (_, i) => {
                      const hour = 7 + i;
                      const topRem = (i * 60) / MINUTES_PER_REM;
                      return (
                        <div
                          key={hour}
                          className="absolute left-0 right-0 text-xs text-muted-foreground px-1 border-t"
                          style={{ top: `${topRem}rem` }}
                        >
                          {`${hour}:00`}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Day columns */}
                {weekDates.map((date, idx) => {
                  const dateKey = format(date, "yyyy-MM-dd");
                  const slots = slotsByDate.get(dateKey) || [];
                  return (
                    <DayColumn
                      key={dateKey}
                      date={date}
                      dayLabel={DAY_LABELS[idx]}
                      slots={slots}
                      onDeleteSlot={(slotId) => deleteSlotMutation.mutate(slotId)}
                    />
                  );
                })}
              </div>

              <DragOverlay>
                {activeOrder && <OrderCardOverlay order={activeOrder} />}
                {activeSlot && <SlotOverlay slot={activeSlot} />}
              </DragOverlay>
            </DndContext>
          </CardContent>
        </Card>
      </div>

      {/* Duration Modal */}
      <Dialog open={durationModalOpen} onOpenChange={setDurationModalOpen}>
        <DialogContent data-testid="dialog-duration">
          <DialogHeader>
            <DialogTitle>Dauer festlegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="duration-input">Dauer in Minuten</Label>
              <Input
                id="duration-input"
                type="number"
                step="5"
                min="5"
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                data-testid="input-duration"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDurationModalOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleDurationConfirm} data-testid="button-confirm-duration">
              Bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocker Modal */}
      <Dialog open={blockerModalOpen} onOpenChange={setBlockerModalOpen}>
        <DialogContent data-testid="dialog-blocker">
          <DialogHeader>
            <DialogTitle>Blocker hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Datum</Label>
              <Select
                value={format(blockerForm.date, "yyyy-MM-dd")}
                onValueChange={(v) => setBlockerForm(prev => ({ ...prev, date: parseISO(v) }))}
              >
                <SelectTrigger data-testid="select-blocker-date">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weekDates.map(d => (
                    <SelectItem key={format(d, "yyyy-MM-dd")} value={format(d, "yyyy-MM-dd")}>
                      {format(d, "EEEE, dd.MM.yyyy", { locale: de })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="blocker-start">Startzeit</Label>
              <Input
                id="blocker-start"
                type="time"
                value={formatTime(blockerForm.startMin)}
                onChange={(e) => {
                  const timeValue = e.target.value;
                  if (timeValue) {
                    const [h, m] = timeValue.split(":").map(Number);
                    if (!isNaN(h) && !isNaN(m)) {
                      setBlockerForm(prev => ({ ...prev, startMin: h * 60 + m }));
                    }
                  }
                }}
                data-testid="input-blocker-start"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="blocker-length">Dauer (Minuten)</Label>
              <Input
                id="blocker-length"
                type="number"
                step="15"
                min="15"
                value={blockerForm.lengthMin}
                onChange={(e) => setBlockerForm(prev => ({ ...prev, lengthMin: parseInt(e.target.value, 10) }))}
                data-testid="input-blocker-length"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="blocker-note">Notiz (optional)</Label>
              <Textarea
                id="blocker-note"
                value={blockerForm.note}
                onChange={(e) => setBlockerForm(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Grund für Blocker..."
                data-testid="textarea-blocker-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockerModalOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleBlockerConfirm} data-testid="button-confirm-blocker">
              Hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Day Column Component
// ============================================================================
interface DayColumnProps {
  date: Date;
  dayLabel: string;
  slots: TimeSlot[];
  onDeleteSlot: (slotId: string) => void;
}

function DayColumn({ date, dayLabel, slots, onDeleteSlot }: DayColumnProps) {
  const { setNodeRef } = useDroppable({
    id: `day-${format(date, "yyyy-MM-dd")}`,
    data: { type: "day-cell", date },
  });

  return (
    <div className="flex-1 min-w-[200px] border-r">
      {/* Header */}
      <div className="h-12 border-b flex flex-col items-center justify-center bg-muted/20">
        <div className="text-xs text-muted-foreground">{dayLabel}</div>
        <div className="text-sm font-medium">{format(date, "dd.MM.")}</div>
      </div>

      {/* Time slots area */}
      <div 
        ref={setNodeRef} 
        id={`day-${format(date, "yyyy-MM-dd")}-timeline`}
        className="relative bg-card" 
        style={{ height: `${TIMELINE_HEIGHT_REM}rem` }}
      >
        {/* Hour lines */}
        {Array.from({ length: 12 }, (_, i) => {
          const topRem = (i * 60) / MINUTES_PER_REM;
          return (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-border/30"
              style={{ top: `${topRem}rem` }}
            />
          );
        })}

        {/* Slots */}
        {slots.map(slot => (
          <DraggableTimeSlot key={slot.id} slot={slot} onDelete={onDeleteSlot} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Draggable Order Card
// ============================================================================
interface DraggableOrderCardProps {
  order: Order;
}

function DraggableOrderCard({ order }: DraggableOrderCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `order-${order.id}`,
    data: { type: "order", orderId: order.id },
  });

  console.log("[DraggableOrderCard] Render:", {
    orderId: order.id,
    isDragging,
    hasListeners: !!listeners,
    hasAttributes: !!attributes
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{...style, userSelect: 'none', touchAction: 'none'}}
      className="border rounded-lg p-3 bg-card hover-elevate cursor-grab active:cursor-grabbing"
      data-testid={`order-card-${order.id}`}
      {...attributes}
      {...listeners}
      onPointerDown={() => console.log("[OrderCard] PointerDown")}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {order.displayOrderNumber || order.id.slice(0, 8)}
          </div>
          <div className="text-xs text-muted-foreground truncate">{order.title}</div>
          <div className="text-xs text-muted-foreground truncate">{order.customer}</div>
          {order.dueDate && (
            <div className="text-xs text-orange-600 mt-1">
              Fällig: {format(parseISO(order.dueDate), "dd.MM.yyyy")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderCardOverlay({ order }: { order: Order }) {
  return (
    <div className="border rounded-lg p-3 bg-card shadow-lg w-64">
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {order.displayOrderNumber || order.id.slice(0, 8)}
          </div>
          <div className="text-xs text-muted-foreground truncate">{order.title}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Draggable Time Slot
// ============================================================================
interface DraggableTimeSlotProps {
  slot: TimeSlot;
  onDelete: (slotId: string) => void;
}

function DraggableTimeSlot({ slot, onDelete }: DraggableTimeSlotProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `slot-${slot.id}`,
    data: { type: "slot", slotId: slot.id },
  });

  const slotStyle = calculateSlotStyle(slot.startMin, slot.lengthMin);
  const transformStyle = transform ? { transform: CSS.Translate.toString(transform) } : {};

  const isBlocker = slot.blocked;

  return (
    <div
      ref={setNodeRef}
      className={`absolute left-1 right-1 rounded border overflow-hidden group ${
        isBlocker 
          ? "bg-muted border-muted-foreground/50 bg-stripes" 
          : "bg-primary/10 border-primary hover-elevate"
      }`}
      style={{ ...slotStyle, ...transformStyle, opacity: isDragging ? 0.5 : 1 }}
      data-testid={`slot-${slot.id}`}
      {...listeners}
      {...attributes}
    >
      <div className="p-2 h-full flex flex-col cursor-grab active:cursor-grabbing">
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0">
            {isBlocker ? (
              <>
                <div className="text-xs font-semibold text-muted-foreground">BLOCKER</div>
                {slot.note && <div className="text-xs text-muted-foreground truncate">{slot.note}</div>}
              </>
            ) : (
              <>
                <div className="text-xs font-semibold truncate">
                  {slot.order?.displayOrderNumber || slot.orderId?.slice(0, 8)}
                </div>
                <div className="text-xs truncate">{slot.order?.title}</div>
              </>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {formatTime(slot.startMin)} - {formatTime(slot.startMin + slot.lengthMin)}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(slot.id);
            }}
            data-testid={`button-delete-slot-${slot.id}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SlotOverlay({ slot }: { slot: TimeSlot }) {
  const slotStyle = { width: "180px", height: `${slot.lengthMin / MINUTES_PER_REM}rem` };
  const isBlocker = slot.blocked;

  return (
    <div
      className={`rounded border overflow-hidden shadow-lg ${
        isBlocker 
          ? "bg-muted border-muted-foreground/50 bg-stripes" 
          : "bg-primary/10 border-primary"
      }`}
      style={slotStyle}
    >
      <div className="p-2">
        {isBlocker ? (
          <>
            <div className="text-xs font-semibold text-muted-foreground">BLOCKER</div>
            {slot.note && <div className="text-xs text-muted-foreground truncate">{slot.note}</div>}
          </>
        ) : (
          <>
            <div className="text-xs font-semibold truncate">
              {slot.order?.displayOrderNumber || slot.orderId?.slice(0, 8)}
            </div>
            <div className="text-xs truncate">{slot.order?.title}</div>
          </>
        )}
      </div>
    </div>
  );
}
