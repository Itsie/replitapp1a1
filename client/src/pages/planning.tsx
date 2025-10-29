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
import { format, addDays, subDays, parseISO, getDay, differenceInCalendarDays } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { WorkflowState } from "@prisma/client";
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
import { ProductionSlotModal } from "@/components/production-slot-modal";

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
  startedAt: Date | null;
  stoppedAt: Date | null;
  actualDurationMin: number | null;
  missingPartsNote: string | null;
  order?: {
    id: string;
    displayOrderNumber: string | null;
    title: string;
    customer: string;
    department: Department;
    workflow: WorkflowState;
    dueDate: string | null;
    notes?: string | null;
    printAssets?: Array<{
      id: string;
      label: string;
      url: string;
      required: boolean;
    }>;
    orderAssets?: Array<{
      id: string;
      label: string;
      url: string;
      required: boolean;
    }>;
    sizeTable?: {
      scheme: string;
      rowsJson: any[];
      comment: string | null;
    } | null;
    positions?: Array<{
      id: string;
      articleName: string;
      articleNumber: string | null;
      qty: number;
      unit: string;
      unitPriceNet: number;
    }>;
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
  workflow: WorkflowState;
  dueDate: string | null;
  notes: string | null;
  printAssets?: Array<{
    id: string;
    label: string;
    url: string;
    required: boolean;
  }>;
  orderAssets?: Array<{
    id: string;
    label: string;
    url: string;
    required: boolean;
  }>;
  sizeTable?: {
    scheme: string;
    rowsJson: any[];
    comment: string | null;
  } | null;
  positions?: Array<{
    id: string;
    articleName: string;
    articleNumber: string | null;
    qty: number;
    unit: string;
    unitPriceNet: number;
  }>;
}

const DEPARTMENT_LABELS: Record<DepartmentFilter, string> = {
  TEAMSPORT_TEXTIL: "Teamsport / Textil",
  TEAMSPORT: "Teamsport",
  TEXTILVEREDELUNG: "Textilveredelung",
  STICKEREI: "Stickerei",
  DRUCK: "Druck",
  SONSTIGES: "Sonstiges",
};

const DEPARTMENT_COLORS: Record<Department, string> = {
  TEAMSPORT: "border-blue-500",
  TEXTILVEREDELUNG: "border-purple-500",
  STICKEREI: "border-green-500",
  DRUCK: "border-orange-500",
  SONSTIGES: "border-gray-500",
};

const DAY_LABELS = ["Mo.", "Di.", "Mi.", "Do.", "Fr."];
const WORKING_HOURS_START = 7 * 60; // 07:00 = 420 min
const WORKING_HOURS_END = 18 * 60; // 18:00 = 1080 min
const WORKING_HOURS_TOTAL = WORKING_HOURS_END - WORKING_HOURS_START; // 660 min

// Grid configuration: 15-minute intervals
const GRID_INTERVAL_MIN = 15;
const GRID_ROWS = WORKING_HOURS_TOTAL / GRID_INTERVAL_MIN; // 44 rows

function snapToGrid(minutes: number): number {
  return Math.round(minutes / GRID_INTERVAL_MIN) * GRID_INTERVAL_MIN;
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

// Calculate grid row from minutes (1-indexed for CSS grid)
function minutesToGridRow(minutes: number): number {
  const minutesFromStart = minutes - WORKING_HOURS_START;
  return Math.floor(minutesFromStart / GRID_INTERVAL_MIN) + 1;
}

// Calculate minutes from grid row (1-indexed)
function gridRowToMinutes(row: number): number {
  return WORKING_HOURS_START + (row - 1) * GRID_INTERVAL_MIN;
}

// Calculate row span for duration
function minutesToRowSpan(lengthMin: number): number {
  return Math.max(1, Math.ceil(lengthMin / GRID_INTERVAL_MIN));
}

// Calculate minutes from Y-coordinate position for drag & drop
function calculateMinutesFromY(
  dropClientY: number,
  gridContainer: HTMLElement | null
): number {
  if (!gridContainer) {
    console.error("Grid container not found");
    return WORKING_HOURS_START;
  }

  const gridRect = gridContainer.getBoundingClientRect();
  
  // Find the first day cell to determine where content rows start
  const firstDayCell = gridContainer.querySelector('[data-day-cell]') as HTMLElement;
  if (!firstDayCell) {
    console.error("Could not find day cell for reference");
    return WORKING_HOURS_START;
  }
  
  const firstCellRect = firstDayCell.getBoundingClientRect();
  
  // Calculate Y position relative to first content row
  const relativeY = dropClientY - firstCellRect.top;
  
  // Each row is 30px (from gridTemplateRows)
  const ROW_HEIGHT = 30;
  
  // Calculate which row we're in (0-indexed)
  let targetRow = Math.floor(relativeY / ROW_HEIGHT);
  
  // Clamp to valid range (0 to GRID_ROWS-1)
  targetRow = Math.max(0, Math.min(targetRow, GRID_ROWS - 1));
  
  // Convert to minutes (row 0 = 07:00, row 1 = 07:15, etc.)
  const calculatedMin = gridRowToMinutes(targetRow + 1);
  
  // Snap to grid
  const snappedMin = snapToGrid(calculatedMin);
  
  // Clamp within working hours
  const result = Math.max(WORKING_HOURS_START, Math.min(snappedMin, WORKING_HOURS_END - GRID_INTERVAL_MIN));
  
  console.log(`Drop Y: ${dropClientY.toFixed(0)}, First Cell Y: ${firstCellRect.top.toFixed(0)}, Relative Y: ${relativeY.toFixed(1)}, Target Row: ${targetRow}, Calculated Min: ${result} (${formatTime(result)})`);
  
  return result;
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
  
  const relevantSlots = allSlots.filter(slot => {
    if (slot.id === slotIdToIgnore) return false;
    if (slot.workCenterId !== workCenterId) return false;
    if (slot.date !== date) return false;
    return true;
  });

  for (const slot of relevantSlots) {
    const slotEnd = slot.startMin + slot.lengthMin;
    if (startMin < slotEnd && endMin > slot.startMin) {
      return true;
    }
  }

  return false;
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
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
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

  // Track pointer position during drag
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

  // Get workcenters
  const { data: workCenters = [] } = useQuery<WorkCenter[]>({
    queryKey: ["/api/workcenters", selectedDepartment],
    queryFn: async () => {
      if (selectedDepartment === "TEAMSPORT_TEXTIL") {
        const response = await fetch("/api/workcenters");
        if (!response.ok) throw new Error("Failed to fetch workcenters");
        const all: WorkCenter[] = await response.json();
        return all.filter(wc => wc.active && ['TEAMSPORT', 'TEXTILVEREDELUNG'].includes(wc.department));
      } else {
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
    const overData = over?.data?.current;

    let cellData: { day: number; workCenterId: string } | null = null;

    if (overData?.type === 'day-cell') {
      const targetDate = overData.date as Date;
      const dayIndex = differenceInCalendarDays(targetDate, weekStart);
      if (dayIndex >= 0 && dayIndex < 5 && departmentWorkCenter) {
        cellData = { day: dayIndex, workCenterId: departmentWorkCenter.id };
      }
    } else if (over?.id && typeof over.id === 'string' && over.id.startsWith('slot-')) {
      const slotId = over.id.replace('slot-', '');
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
    const { active } = event;
    const pointerY = currentPointerY;
    setActiveId(null);
    setCurrentPointerY(null);

    if (!dragOverData || !departmentWorkCenter) {
      setDragOverData(null);
      return;
    }

    const activeData = active.data.current;
    const targetCellData = dragOverData;
    const targetDate = addDays(weekStart, targetCellData.day);
    const targetDateStr = format(targetDate, "yyyy-MM-dd");
    
    // Get the grid container for position calculation
    const gridContainer = document.getElementById('planning-grid');
    
    // Calculate precise start time from Y-coordinate
    const calculatedStartMin = pointerY !== null 
      ? calculateMinutesFromY(pointerY, gridContainer)
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

    // Moving existing slot
    if (activeData?.type === "slot") {
      const slotId = activeData.slotId as string;
      const slot = timeSlots.find(s => s.id === slotId);
      
      if (slot) {
        const clampedStartMin = Math.min(calculatedStartMin, WORKING_HOURS_END - slot.lengthMin);
        
        if (checkSlotCollision(slot.id, targetDateStr, clampedStartMin, slot.lengthMin, targetCellData.workCenterId, timeSlots)) {
          toast({ 
            title: "Kollision!", 
            description: "Der Termin überschneidet sich mit einem anderen Zeitslot.", 
            variant: "destructive" 
          });
          setDragOverData(null);
          return;
        }

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

    const lengthMin = Math.max(15, Math.round(lengthInput / 15) * 15);
    const targetDate = addDays(weekStart, appointmentModalData.day);
    const targetDateStr = format(targetDate, "yyyy-MM-dd");
    const clampedStartMin = Math.min(appointmentModalData.startMin, WORKING_HOURS_END - lengthMin);

    if (clampedStartMin + lengthMin > WORKING_HOURS_END) {
      toast({ 
        title: "Fehler", 
        description: "Der Termin würde über die Arbeitszeit hinausgehen. Bitte kürzere Dauer wählen.", 
        variant: "destructive" 
      });
      return;
    }

    if (checkSlotCollision(undefined, targetDateStr, clampedStartMin, lengthMin, appointmentModalData.workCenterId, timeSlots)) {
      toast({ 
        title: "Kollision!", 
        description: "Der Termin überschneidet sich mit einem anderen Zeitslot.", 
        variant: "destructive" 
      });
      return;
    }

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

  // Filter unscheduled orders
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

  // Calculate utilization per day
  const utilizationByDate = useMemo(() => {
    const map = new Map<string, number>();
    weekDates.forEach(date => {
      const dateKey = format(date, "yyyy-MM-dd");
      const slots = slotsByDate.get(dateKey) || [];
      const totalMinutes = slots.reduce((sum, slot) => sum + slot.lengthMin, 0);
      const percentage = (totalMinutes / WORKING_HOURS_TOTAL) * 100;
      map.set(dateKey, percentage);
    });
    return map;
  }, [slotsByDate, weekDates]);

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
              <Select value={selectedDepartment} onValueChange={(v) => setSelectedDepartment(v as DepartmentFilter)}>
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
                <DraggableOrderCard 
                  key={order.id} 
                  order={order}
                  onOrderClick={setSelectedOrderId}
                />
              ))}
              {unscheduledOrders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Keine Aufträge verfügbar
                </p>
              )}
            </CardContent>
          </Card>

          {/* Right: Planning Grid */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardContent className="flex-1 overflow-auto p-0">
              <PlanningGrid
                weekDates={weekDates}
                slotsByDate={slotsByDate}
                utilizationByDate={utilizationByDate}
                onDeleteSlot={(slotId) => deleteSlotMutation.mutate(slotId)}
                onSlotClick={setSelectedSlotId}
              />
            </CardContent>
          </Card>
        </div>

        <DragOverlay>
          {activeOrder && <OrderCardOverlay order={activeOrder} />}
          {activeSlot && <SlotOverlay slot={activeSlot} />}
        </DragOverlay>
      </DndContext>

      {/* Appointment Modal */}
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

      {/* Production Slot Modal - for scheduled slots */}
      {selectedSlotId && (() => {
        const slot = timeSlots.find(s => s.id === selectedSlotId);
        if (!slot) return null;
        
        // Convert string dates to Date objects for modal
        const convertedSlot = {
          ...slot,
          date: typeof slot.date === 'string' ? parseISO(slot.date) : slot.date,
          order: slot.order ? {
            ...slot.order,
            dueDate: slot.order.dueDate ? (typeof slot.order.dueDate === 'string' ? parseISO(slot.order.dueDate) : slot.order.dueDate) : null,
          } : null,
        };
        
        return (
          <ProductionSlotModal
            isOpen={true}
            slot={convertedSlot as any}
            onClose={() => setSelectedSlotId(null)}
          />
        );
      })()}

      {/* Production Slot Modal - for unscheduled orders */}
      {selectedOrderId && (() => {
        const order = availableOrders.find(o => o.id === selectedOrderId);
        if (!order) return null;
        
        // Convert string dates to Date objects for modal
        const convertedOrder = {
          ...order,
          dueDate: order.dueDate ? (typeof order.dueDate === 'string' ? parseISO(order.dueDate) : order.dueDate) : null,
        };
        
        return (
          <ProductionSlotModal
            isOpen={true}
            slot={null}
            order={convertedOrder as any}
            onClose={() => setSelectedOrderId(null)}
          />
        );
      })()}
    </div>
  );
}

// ============================================================================
// Planning Grid Component (CSS Grid based)
// ============================================================================
interface PlanningGridProps {
  weekDates: Date[];
  slotsByDate: Map<string, TimeSlot[]>;
  utilizationByDate: Map<string, number>;
  onDeleteSlot: (slotId: string) => void;
  onSlotClick: (slotId: string) => void;
}

function PlanningGrid({ weekDates, slotsByDate, utilizationByDate, onDeleteSlot, onSlotClick }: PlanningGridProps) {
  return (
    <div 
      id="planning-grid"
      className="grid min-w-max relative"
      style={{
        gridTemplateColumns: '4rem repeat(5, minmax(200px, 1fr))',
        gridTemplateRows: `auto repeat(${GRID_ROWS}, 30px)`,
      }}
    >
      {/* Header Row */}
      <div className="sticky top-0 z-10 bg-muted/20 border-b border-r" />
      {weekDates.map((date, idx) => {
        const dateKey = format(date, "yyyy-MM-dd");
        const utilization = utilizationByDate.get(dateKey) || 0;
        
        return (
          <div key={dateKey} className="sticky top-0 z-10 bg-muted/20 border-b border-r p-2">
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs text-muted-foreground">{DAY_LABELS[idx]}</div>
              <div className="text-sm font-medium">{format(date, "dd.MM.")}</div>
              <UtilizationBar percentage={utilization} />
            </div>
          </div>
        );
      })}

      {/* Time labels + Grid cells */}
      {Array.from({ length: GRID_ROWS }, (_, rowIdx) => {
        const row = rowIdx + 1;
        const minutes = gridRowToMinutes(row);
        const showLabel = minutes % 60 === 0; // Show label every hour
        
        return (
          <div key={`row-${row}`} className="contents">
            {/* Time label */}
            <div
              className="border-r border-b border-border/20 text-xs text-muted-foreground px-1 flex items-center justify-end bg-muted/10"
              style={{ gridRow: row + 1 }}
            >
              {showLabel && formatTime(minutes)}
            </div>

            {/* Day cells (droppable background) */}
            {weekDates.map((date, dayIdx) => {
              const dateKey = format(date, "yyyy-MM-dd");
              return (
                <DayCell
                  key={`${dateKey}-${row}`}
                  date={date}
                  dayIdx={dayIdx}
                  row={row}
                />
              );
            })}
          </div>
        );
      })}

      {/* Render all slots as direct grid items */}
      {weekDates.map((date, dayIdx) => {
        const dateKey = format(date, "yyyy-MM-dd");
        const slots = slotsByDate.get(dateKey) || [];
        return slots.map(slot => (
          <GridSlotCard
            key={slot.id}
            slot={slot}
            dayIdx={dayIdx}
            onDelete={onDeleteSlot}
            onSlotClick={onSlotClick}
          />
        ));
      })}
    </div>
  );
}

// ============================================================================
// Utilization Bar
// ============================================================================
interface UtilizationBarProps {
  percentage: number;
}

function UtilizationBar({ percentage }: UtilizationBarProps) {
  const getColor = () => {
    if (percentage < 70) return "bg-green-500";
    if (percentage < 90) return "bg-yellow-500";
    return "bg-red-500";
  };

  const clampedPercentage = Math.min(100, percentage);

  return (
    <div className="w-full">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div 
          className={`h-full transition-all ${getColor()}`}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground text-center mt-0.5">
        {Math.round(percentage)}%
      </div>
    </div>
  );
}

// ============================================================================
// Day Cell Component (droppable background)
// ============================================================================
interface DayCellProps {
  date: Date;
  dayIdx: number;
  row: number;
}

function DayCell({ date, dayIdx, row }: DayCellProps) {
  const { setNodeRef } = useDroppable({
    id: `day-${format(date, "yyyy-MM-dd")}-row-${row}`,
    data: { type: "day-cell", date, row },
  });

  // Highlight hour boundaries
  const minutes = gridRowToMinutes(row);
  const isHourBoundary = minutes % 60 === 0;

  return (
    <div
      ref={setNodeRef}
      data-day-cell
      className={`border-r ${isHourBoundary ? 'border-b border-border/40' : 'border-b border-border/20'} bg-card hover:bg-accent/5 transition-colors`}
      style={{ 
        gridColumn: dayIdx + 2, // +2 because column 1 is time labels
        gridRow: row + 1 
      }}
    />
  );
}

// ============================================================================
// Grid Slot Card (spans multiple rows)
// ============================================================================
interface GridSlotCardProps {
  slot: TimeSlot;
  dayIdx: number;
  onDelete: (slotId: string) => void;
  onSlotClick: (slotId: string) => void;
}

function GridSlotCard({ slot, dayIdx, onDelete, onSlotClick }: GridSlotCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `slot-${slot.id}`,
    data: { type: "slot", slotId: slot.id },
    // @ts-ignore - activationConstraint is valid but not in types
    // Require dragging at least 5px before starting drag, so clicks work
    activationConstraint: {
      distance: 5,
    },
  });

  const rowStart = minutesToGridRow(slot.startMin);
  const rowSpan = minutesToRowSpan(slot.lengthMin);
  
  const transformStyle = transform ? { transform: CSS.Translate.toString(transform) } : {};
  
  const isBlocker = slot.blocked;
  const isCompact = slot.lengthMin < 45;
  const department = slot.order?.department;
  const borderColor = department ? DEPARTMENT_COLORS[department] : "border-gray-500";

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={`rounded border-l-4 ${borderColor} border-r border-t border-b overflow-hidden group m-1 z-20 ${
        isBlocker 
          ? "bg-muted border-muted-foreground/30" 
          : "bg-primary/5 border-border/50 hover-elevate"
      }`}
      style={{
        ...transformStyle,
        opacity: isDragging ? 0.5 : 1,
        gridColumn: dayIdx + 2, // +2 because column 1 is time labels
        gridRow: `${rowStart + 1} / span ${rowSpan}`,
      }}
      data-testid={`slot-${slot.id}`}
    >
      <div 
        {...listeners}
        onClick={(e) => {
          // Only open modal if not dragging
          if (!isDragging && e.detail === 1) {
            onSlotClick(slot.id);
          }
        }}
        className="p-1.5 h-full flex flex-col justify-between cursor-pointer"
      >
        {isBlocker ? (
          <div className="flex items-start justify-between gap-1">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-muted-foreground">BLOCKER</div>
              {slot.note && !isCompact && <div className="text-xs text-muted-foreground truncate mt-0.5">{slot.note}</div>}
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
        ) : (
          <>
            {/* Header: Order Number + Delete Button */}
            <div className="flex items-start justify-between gap-1">
              <div className="text-sm font-bold truncate leading-tight">
                {slot.order?.displayOrderNumber || slot.orderId?.slice(0, 8)}
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
            
            {/* Content: Customer + Time in one line for compact view */}
            {isCompact ? (
              <div className="text-xs text-muted-foreground truncate">
                {slot.order?.customer}
              </div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground truncate">
                  {slot.order?.customer}
                </div>
                <div className="text-xs text-muted-foreground/80 font-mono mt-auto">
                  {formatTime(slot.startMin)} - {formatTime(slot.startMin + slot.lengthMin)}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Draggable Order Card
// ============================================================================
interface DraggableOrderCardProps {
  order: Order;
  onOrderClick: (orderId: string) => void;
}

function DraggableOrderCard({ order, onOrderClick }: DraggableOrderCardProps) {
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
      onClick={(e) => {
        // Only open modal if not dragging (click detail = 1)
        if (!isDragging && e.detail === 1) {
          onOrderClick(order.id);
        }
      }}
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
