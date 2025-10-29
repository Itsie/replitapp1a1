import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

type Department = "TEAMSPORT" | "TEXTILVEREDELUNG" | "STICKEREI" | "DRUCK" | "SONSTIGES";
type DepartmentFilter = Department | "TEAMSPORT_TEXTIL";

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

const DEPARTMENT_LABELS: Record<DepartmentFilter, string> = {
  TEAMSPORT_TEXTIL: "Teamsport / Textil",
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

// === PIXEL-BASIERTE SKALIERUNG (NEU) ===
// Skalierungsfaktor: 2 Pixel pro Minute
const PIXELS_PER_MINUTE = 2;
// Ableitung: 1rem = 16px (Browser-Standard)
const REM_PER_MINUTE = PIXELS_PER_MINUTE / 16; // 0.125 rem/min
const SNAP_MINUTES = 15;

// Gesamthöhe der Timeline in Pixeln
const TIMELINE_HEIGHT_PX = WORKING_HOURS_TOTAL * PIXELS_PER_MINUTE; // 660 * 2 = 1320px

// Layout-Offset: Abstand vom Grid-Container-Top bis zur visuellen 07:00-Linie
// Header ist h-12 (3rem = 48px)
const TIME_AXIS_START_OFFSET_PX = 48;

function calculateSlotStyle(startMin: number, lengthMin: number): React.CSSProperties {
  // Minuten seit 07:00 Uhr
  const minutesFromStart = Math.max(0, startMin - WORKING_HOURS_START);
  
  // Direkte Berechnung in Pixeln (ohne Offset - Labels werden angepasst)
  const topPx = minutesFromStart * PIXELS_PER_MINUTE;
  const heightPx = lengthMin * PIXELS_PER_MINUTE;

  return {
    // Position relativ zum DroppableDayColumn
    top: `${topPx}px`,
    height: `${heightPx}px`,
    minHeight: '2.5rem', // Mindesthöhe für Lesbarkeit
    position: 'absolute' as const,
    left: 0,
    right: 0,
    overflow: 'hidden',
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

// Calculate minutes from Y-coordinate position
function calculateMinutesFromY(
  dropClientY: number,
  droppableNode: HTMLElement | null
): number {
  if (!droppableNode) {
    console.error("Droppable node not found in calculateMinutesFromY");
    return WORKING_HOURS_START;
  }

  // Finde den Grid-Container für präzise Referenz
  const gridContainer = document.getElementById('planning-grid-container');
  const gridRect = gridContainer?.getBoundingClientRect();

  if (!gridRect) {
    console.error("Grid container not found.");
    return WORKING_HOURS_START;
  }

  // Der visuelle Start der 07:00-Linie im Viewport
  const timeAxisStartYInViewport = gridRect.top + TIME_AXIS_START_OFFSET_PX;

  // Y-Position des Drops relativ zum Start der 07:00-Linie
  const relativeY = Math.max(0, dropClientY - timeAxisStartYInViewport);

  // Umrechnung in Minuten
  const minutesOffset = relativeY / PIXELS_PER_MINUTE;
  let calculatedMin = WORKING_HOURS_START + minutesOffset;

  // Runden auf Raster
  calculatedMin = Math.round(calculatedMin / SNAP_MINUTES) * SNAP_MINUTES;

  // Clamp within working hours
  const maxStartMin = WORKING_HOURS_END - SNAP_MINUTES;
  calculatedMin = Math.max(WORKING_HOURS_START, Math.min(calculatedMin, maxStartMin));

  // Debug-Logging
  console.log(`Drop Y: ${dropClientY.toFixed(0)}, Axis Start Y: ${timeAxisStartYInViewport.toFixed(0)}, Relative Y: ${relativeY.toFixed(1)}, Offset Min: ${minutesOffset.toFixed(1)}, Calculated Min: ${calculatedMin} (${formatTime(calculatedMin)})`);

  return calculatedMin;
}

// Check for slot collisions
function checkSlotCollision(
  slotIdToIgnore: string | undefined,
  date: string,
  startMin: number,
  lengthMin: number,
  workCenterId: string,
  allSlots: TimeSlot[]
): boolean {
  const endMin = startMin + lengthMin;
  
  // Filter slots for the same work center and date
  const relevantSlots = allSlots.filter(slot => {
    if (slot.id === slotIdToIgnore) return false;
    if (slot.workCenterId !== workCenterId) return false;
    if (slot.date !== date) return false;
    return true;
  });

  // Check for overlap with any existing slot
  for (const slot of relevantSlots) {
    const slotEnd = slot.startMin + slot.lengthMin;
    
    // Check if there's any overlap
    // Overlap occurs if: new slot starts before existing ends AND new slot ends after existing starts
    if (startMin < slotEnd && endMin > slot.startMin) {
      return true; // Collision detected
    }
  }

  return false; // No collision
}

export default function Planning() {
  const { toast } = useToast();
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentFilter>("TEAMSPORT_TEXTIL");
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = getDay(today);
    const diff = day === 0 ? -6 : 1 - day;
    const monday = addDays(today, diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // Modals
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [appointmentModalData, setAppointmentModalData] = useState<{
    day: number;
    workCenterId: string;
    startMin: number;
    orderId: string;
    orderTitle: string;
  } | null>(null);
  const [blockerModalOpen, setBlockerModalOpen] = useState(false);
  const [blockerForm, setBlockerForm] = useState({ date: new Date(), startMin: 420, lengthMin: 60, note: "" });
  const [durationInput, setDurationInput] = useState("60");

  // Drag & Drop
  const [activeId, setActiveId] = useState<string | null>(null);
  const [currentPointerY, setCurrentPointerY] = useState<number | null>(null);
  const [dragOverData, setDragOverData] = useState<{ day: number; workCenterId: string } | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
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
    queryKey: ["/api/workcenters", selectedDepartment],
    queryFn: async () => {
      if (selectedDepartment === "TEAMSPORT_TEXTIL") {
        // Fetch all workcenters and filter in frontend
        const response = await fetch("/api/workcenters");
        if (!response.ok) throw new Error("Failed to fetch workcenters");
        const all: WorkCenter[] = await response.json();
        return all.filter(wc => wc.active && ['TEAMSPORT', 'TEXTILVEREDELUNG'].includes(wc.department));
      } else {
        // Fetch for single department
        const response = await fetch(`/api/workcenters?department=${selectedDepartment}`);
        if (!response.ok) throw new Error("Failed to fetch workcenters");
        return response.json();
      }
    },
  });

  const departmentWorkCenter = useMemo(() => {
    return workCenters.find(wc => wc.active) || workCenters[0];
  }, [workCenters]);

  // Get available orders
  const { data: ordersResponse } = useQuery<{ orders: Order[]; totalCount: number }>({
    queryKey: ["/api/orders", selectedDepartment],
    queryFn: async () => {
      if (selectedDepartment === "TEAMSPORT_TEXTIL") {
        // Fetch from both departments and merge
        const [teamsport, textil] = await Promise.all([
          fetch("/api/orders?department=TEAMSPORT&workflow=FUER_PROD,WARTET_FEHLTEILE").then(r => {
            if (!r.ok) throw new Error("Failed to fetch TEAMSPORT orders");
            return r.json() as Promise<{ orders: Order[]; totalCount: number }>;
          }),
          fetch("/api/orders?department=TEXTILVEREDELUNG&workflow=FUER_PROD,WARTET_FEHLTEILE").then(r => {
            if (!r.ok) throw new Error("Failed to fetch TEXTILVEREDELUNG orders");
            return r.json() as Promise<{ orders: Order[]; totalCount: number }>;
          })
        ]);
        const mergedOrders = [...teamsport.orders, ...textil.orders];
        return { orders: mergedOrders, totalCount: mergedOrders.length };
      } else {
        // Fetch for single department
        const response = await fetch(`/api/orders?department=${selectedDepartment}&workflow=FUER_PROD,WARTET_FEHLTEILE`);
        if (!response.ok) throw new Error("Failed to fetch orders");
        return response.json();
      }
    },
  });
  const availableOrders = ordersResponse?.orders || [];

  // Get time slots for week
  const weekDates = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  const { data: timeSlots = [], refetch: refetchTimeSlots } = useQuery<TimeSlot[]>({
    queryKey: ["/api/timeslots", selectedDepartment, weekStartStr],
    queryFn: async () => {
      if (selectedDepartment === "TEAMSPORT_TEXTIL") {
        // Fetch from both departments and merge
        const [teamsport, textil] = await Promise.all([
          fetch(`/api/timeslots?department=TEAMSPORT&weekStart=${weekStartStr}`).then(r => {
            if (!r.ok) throw new Error("Failed to fetch TEAMSPORT timeslots");
            return r.json() as Promise<TimeSlot[]>;
          }),
          fetch(`/api/timeslots?department=TEXTILVEREDELUNG&weekStart=${weekStartStr}`).then(r => {
            if (!r.ok) throw new Error("Failed to fetch TEXTILVEREDELUNG timeslots");
            return r.json() as Promise<TimeSlot[]>;
          })
        ]);
        return [...teamsport, ...textil];
      } else {
        // Fetch for single department
        const response = await fetch(`/api/timeslots?department=${selectedDepartment}&weekStart=${weekStartStr}`);
        if (!response.ok) throw new Error("Failed to fetch timeslots");
        return response.json();
      }
    },
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
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith("/api/timeslots");
        }
      });
      await refetchTimeSlots();
      toast({ title: "Erfolgreich", description: "Zeitslot erstellt" });
    },
    onError: (error: Error) => {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
    },
  });

  const updateSlotMutation = useMutation({
    mutationFn: async (data: { id: string; date: Date; startMin: number; workCenterId: string }) => {
      const dateStr = format(data.date, "yyyy-MM-dd");
      await apiRequest("PATCH", `/api/timeslots/${data.id}`, {
        date: dateStr,
        startMin: data.startMin,
        workCenterId: data.workCenterId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith("/api/timeslots");
        }
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
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith("/api/timeslots");
        }
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
    setActiveId(null);
    setCurrentPointerY(null);

    if (!over || !dragOverData) {
      // Kein gültiges Ziel gefunden
      setDragOverData(null);
      return;
    }

    if (!departmentWorkCenter) {
      setDragOverData(null);
      return;
    }

    const activeData = active.data.current;
    const targetCellData = dragOverData;

    // Berechne das Zieldatum aus dragOverData
    const targetDate = addDays(weekStart, targetCellData.day);
    const targetDateStr = format(targetDate, "yyyy-MM-dd");
    
    // Get the droppable element for precise position calculation
    const droppableElement = document.getElementById(`day-${targetDateStr}-timeline`);
    
    // Calculate precise start time from Y-coordinate
    const calculatedStartMin = pointerY !== null 
      ? calculateMinutesFromY(pointerY, droppableElement)
      : WORKING_HOURS_START;

    // Order from pool - open modal to get duration
    if (activeData?.type === "order") {
      const orderId = activeData.orderId as string;
      const order = availableOrders.find(o => o.id === orderId);
      
      if (order) {
        setAppointmentModalData({
          day: targetCellData.day,
          workCenterId: targetCellData.workCenterId,
          startMin: calculatedStartMin,
          orderId: order.id,
          orderTitle: order.displayOrderNumber || order.title,
        });
        setDurationInput("60");
        setAppointmentModalOpen(true);
      }
      setDragOverData(null);
      return;
    }

    // Moving existing slot - update with new position, keep duration
    if (activeData?.type === "slot") {
      const slotId = activeData.slotId as string;
      const slot = timeSlots.find(s => s.id === slotId);
      
      if (slot) {
        // Clamp start time to ensure slot doesn't overflow past working hours
        const clampedStartMin = Math.min(calculatedStartMin, WORKING_HOURS_END - slot.lengthMin);
        
        // Check for collision with the new position (keeping existing duration)
        if (checkSlotCollision(slot.id, targetDateStr, clampedStartMin, slot.lengthMin, targetCellData.workCenterId, timeSlots)) {
          toast({ 
            title: "Kollision!", 
            description: "Der Termin überschneidet sich mit einem anderen Zeitslot.", 
            variant: "destructive" 
          });
          setDragOverData(null);
          return;
        }

        // Update the slot with new position
        updateSlotMutation.mutate({ 
          id: slotId, 
          date: targetDate, 
          startMin: clampedStartMin,
          workCenterId: targetCellData.workCenterId,
        });
      }
      setDragOverData(null);
      return;
    }

    setDragOverData(null);
  }

  function handleAppointmentConfirm() {
    if (!appointmentModalData || !departmentWorkCenter) return;
    
    const lengthInput = parseInt(durationInput, 10);
    if (isNaN(lengthInput) || lengthInput < 15) {
      toast({ title: "Fehler", description: "Bitte gültige Dauer eingeben (min. 15 Min)", variant: "destructive" });
      return;
    }

    // Round to 15 minute intervals, minimum 15 minutes
    const lengthMin = Math.max(15, Math.round(lengthInput / 15) * 15);
    const targetDate = addDays(weekStart, appointmentModalData.day);
    const targetDateStr = format(targetDate, "yyyy-MM-dd");

    // Clamp start time to ensure slot doesn't overflow past working hours
    const clampedStartMin = Math.min(appointmentModalData.startMin, WORKING_HOURS_END - lengthMin);

    // Validate that the slot fits within working hours
    if (clampedStartMin + lengthMin > WORKING_HOURS_END) {
      toast({ 
        title: "Fehler", 
        description: "Der Termin würde über die Arbeitszeit hinausgehen. Bitte kürzere Dauer wählen.", 
        variant: "destructive" 
      });
      return; // Don't close modal, let user adjust
    }

    // Check for collision
    if (checkSlotCollision(
      undefined, 
      targetDateStr, 
      clampedStartMin, 
      lengthMin, 
      appointmentModalData.workCenterId, 
      timeSlots
    )) {
      toast({ 
        title: "Kollision!", 
        description: "Der Termin überschneidet sich mit einem anderen Zeitslot.", 
        variant: "destructive" 
      });
      return; // Don't close modal, let user adjust
    }

    // Create the slot
    createSlotMutation.mutate({
      workCenterId: appointmentModalData.workCenterId,
      date: targetDate,
      startMin: clampedStartMin,
      lengthMin: lengthMin,
      orderId: appointmentModalData.orderId,
      blocked: false,
    });

    setAppointmentModalOpen(false);
    setAppointmentModalData(null);
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
      <DndContext 
        sensors={sensors} 
        onDragStart={(e) => setActiveId(e.active.id as string)} 
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
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
              <div id="planning-grid-container" className="flex min-w-max">
                {/* Time column */}
                <div className="w-16 flex-shrink-0 border-r bg-muted/30">
                  <div className="h-12 border-b" /> {/* Header spacer */}
                  <div className="relative" style={{ height: `${TIMELINE_HEIGHT_PX}px` }}>
                    {Array.from({ length: 12 }, (_, i) => {
                      const hour = 7 + i;
                      const minutesFromMidnight = hour * 60;
                      const minutesFromStart = minutesFromMidnight - WORKING_HOURS_START;
                      // Verschiebe Labels um 9px nach oben, um mit Slots zu alignieren
                      const topPx = minutesFromStart * PIXELS_PER_MINUTE - 9;
                      return (
                        <div
                          key={hour}
                          className="absolute left-0 right-0 text-xs text-muted-foreground px-1 border-t"
                          style={{ top: `${topPx}px` }}
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

            </CardContent>
          </Card>
        </div>

        <DragOverlay>
          {activeOrder && <OrderCardOverlay order={activeOrder} />}
          {activeSlot && <SlotOverlay slot={activeSlot} />}
        </DragOverlay>
      </DndContext>

      {/* Appointment Modal - Only ask for duration with calculated start time */}
      {appointmentModalData && (
        <Dialog open={appointmentModalOpen} onOpenChange={setAppointmentModalOpen}>
          <DialogContent data-testid="dialog-appointment">
            <DialogHeader>
              <DialogTitle>Termin festlegen</DialogTitle>
              <DialogDescription>
                Auftrag: <span className="font-semibold">{appointmentModalData.orderTitle}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Berechnete Startzeit</Label>
                <div className="text-sm font-medium p-2 bg-muted rounded-md" data-testid="text-calculated-start-time">
                  {formatTime(appointmentModalData.startMin)} Uhr
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="appointment-duration">Dauer in Minuten</Label>
                <Input
                  id="appointment-duration"
                  type="number"
                  step="15"
                  min="15"
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  data-testid="input-appointment-duration"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setAppointmentModalOpen(false);
                  setAppointmentModalData(null);
                }}
              >
                Abbrechen
              </Button>
              <Button onClick={handleAppointmentConfirm} data-testid="button-confirm-appointment">
                Bestätigen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
        style={{ height: `${TIMELINE_HEIGHT_PX}px` }}
      >
        {/* Hour lines */}
        {Array.from({ length: 12 }, (_, i) => {
          const hour = 7 + i;
          const minutesFromMidnight = hour * 60;
          const minutesFromStart = minutesFromMidnight - WORKING_HOURS_START;
          const topPx = minutesFromStart * PIXELS_PER_MINUTE;
          return (
            <div
              key={i}
              className="absolute left-0 right-0 border-t border-border/30"
              style={{ top: `${topPx}px` }}
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
  const finalStyle = { ...slotStyle, ...transformStyle, opacity: isDragging ? 0.5 : 1 };

  const isBlocker = slot.blocked;
  
  // Calculate if slot is compact based on duration
  // < 30 min = very compact, < 45 min = compact
  const isVeryCompact = slot.lengthMin < 30;
  const isCompact = slot.lengthMin < 45;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`absolute left-1 right-1 rounded border overflow-hidden group ${
        isBlocker 
          ? "bg-muted border-muted-foreground/50 bg-stripes" 
          : "bg-primary/10 border-primary hover-elevate"
      }`}
      style={finalStyle}
      data-testid={`slot-${slot.id}`}
    >
      <div className={`${isVeryCompact ? 'p-1' : 'p-2'} h-full flex flex-col cursor-grab active:cursor-grabbing`}>
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0">
            {isVeryCompact ? (
              <>
                {/* Ultra-compact for very short slots */}
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold truncate">
                    {isBlocker ? 'BLOCKER' : (slot.order?.displayOrderNumber || slot.order?.title)}
                  </span>
                </div>
              </>
            ) : isBlocker ? (
              <>
                <div className="text-xs font-semibold text-muted-foreground">BLOCKER</div>
                {slot.note && <div className="text-xs text-muted-foreground truncate">{slot.note}</div>}
                {!isCompact && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatTime(slot.startMin)} - {formatTime(slot.startMin + slot.lengthMin)}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-col gap-0.5">
                  <div className="text-xs font-semibold truncate">
                    {slot.order?.displayOrderNumber || slot.orderId?.slice(0, 8)}
                  </div>
                  <div className="text-xs truncate">{slot.order?.title}</div>
                  {!isCompact && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatTime(slot.startMin)} - {formatTime(slot.startMin + slot.lengthMin)}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          {!isVeryCompact && (
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
          )}
        </div>
      </div>
    </div>
  );
}

function SlotOverlay({ slot }: { slot: TimeSlot }) {
  const isBlocker = slot.blocked;
  
  return (
    <div className={`border rounded-lg p-2 shadow-lg w-48 ${
      isBlocker ? "bg-muted border-muted-foreground/50" : "bg-primary/10 border-primary"
    }`}>
      <div className="text-xs font-semibold truncate">
        {isBlocker ? 'BLOCKER' : (slot.order?.displayOrderNumber || slot.order?.title)}
      </div>
      {!isBlocker && slot.order?.title && (
        <div className="text-xs text-muted-foreground truncate">{slot.order.title}</div>
      )}
      <div className="text-xs text-muted-foreground mt-1">
        {formatTime(slot.startMin)} - {formatTime(slot.startMin + slot.lengthMin)}
      </div>
    </div>
  );
}
