import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Plus, Lock } from "lucide-react";
import { format, addDays, subDays, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

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

interface SlotFormData {
  workCenterId: string;
  date: string;
  startMin: number;
  lengthMin: number;
  orderId: string | null;
  blocked: boolean;
  note: string | null;
}

export default function PlanningPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<Department | "">("");
  const [slotDialog, setSlotDialog] = useState<{
    open: boolean;
    data: SlotFormData | null;
  }>({
    open: false,
    data: null,
  });
  const { toast } = useToast();

  // Calculate date for API
  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // Fetch work centers
  const { data: workCenters = [] } = useQuery<WorkCenter[]>({
    queryKey: ["/api/workcenters", selectedDepartment],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedDepartment) params.append("department", selectedDepartment);
      params.append("active", "true");
      const url = `/api/workcenters${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch work centers");
      return res.json();
    },
  });

  // Fetch calendar data (single day)
  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ["/api/calendar", dateStr, selectedDepartment],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateStr,
        endDate: dateStr,
      });
      if (selectedDepartment) params.append("department", selectedDepartment);
      const url = `/api/calendar?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch calendar");
      return res.json();
    },
  });

  // Fetch orders ready for production
  const { data: fuerProdOrders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders", "FUER_PROD", selectedDepartment],
    queryFn: async () => {
      const params = new URLSearchParams({ workflow: "FUER_PROD" });
      if (selectedDepartment) params.append("department", selectedDepartment);
      const url = `/api/orders?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
  });

  // Create time slot mutation
  const createSlotMutation = useMutation({
    mutationFn: async (data: SlotFormData) => {
      const res = await fetch("/api/timeslots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create slot");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/calendar"] });
      queryClient.refetchQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Termin erstellt" });
      setSlotDialog({ open: false, data: null });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler beim Erstellen",
        description: error.message || "Ein Fehler ist aufgetreten",
        variant: "destructive",
      });
    },
  });

  // Group time slots by work center
  const slotsByWorkCenter = useMemo(() => {
    const grouped = new Map<string, TimeSlot[]>();
    timeSlots.forEach((slot) => {
      const wcId = slot.workCenterId;
      if (!grouped.has(wcId)) grouped.set(wcId, []);
      grouped.get(wcId)!.push(slot);
    });
    return grouped;
  }, [timeSlots]);

  // Time conversion helpers
  const minToTime = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  };

  // Working hours: 07:00-18:00 (420-1080 minutes)
  const workingHours = Array.from({ length: 12 }, (_, i) => 420 + i * 60); // 07:00, 08:00, ..., 18:00

  // Open dialog to create slot
  const handleCreateSlot = (workCenterId: string, startMin: number) => {
    setSlotDialog({
      open: true,
      data: {
        workCenterId,
        date: dateStr,
        startMin,
        lengthMin: 60,
        orderId: null,
        blocked: false,
        note: null,
      },
    });
  };

  // Handle form submission
  const handleSubmitSlot = () => {
    if (!slotDialog.data) return;
    createSlotMutation.mutate(slotDialog.data);
  };

  // Calculate slot position and height
  const getSlotStyle = (slot: TimeSlot) => {
    const startPixel = ((slot.startMin - 420) / 60) * 80; // 80px per hour
    const heightPixel = (slot.lengthMin / 60) * 80;
    return {
      top: `${startPixel}px`,
      height: `${heightPixel}px`,
    };
  };

  // Assign lanes to slots based on overlaps and capacity
  const assignLanes = (slots: TimeSlot[], capacity: number) => {
    const sorted = [...slots].sort((a, b) => a.startMin - b.startMin);
    const lanes: TimeSlot[][] = Array.from({ length: capacity }, () => []);

    sorted.forEach((slot) => {
      const slotEnd = slot.startMin + slot.lengthMin;
      
      // If blocked, it occupies all lanes
      if (slot.blocked) {
        lanes.forEach((lane) => lane.push(slot));
        return;
      }

      // Find first available lane
      let assignedLane = -1;
      for (let i = 0; i < capacity; i++) {
        const overlaps = lanes[i].some((existing) => {
          const existingEnd = existing.startMin + existing.lengthMin;
          return !(slotEnd <= existing.startMin || slot.startMin >= existingEnd);
        });
        if (!overlaps) {
          assignedLane = i;
          break;
        }
      }

      if (assignedLane !== -1) {
        lanes[assignedLane].push(slot);
      }
    });

    // Return lane assignments
    const assignments = new Map<string, number>();
    sorted.forEach((slot) => {
      if (slot.blocked) {
        assignments.set(slot.id, -1); // Special value for blockers
        return;
      }
      for (let i = 0; i < lanes.length; i++) {
        if (lanes[i].includes(slot)) {
          assignments.set(slot.id, i);
          break;
        }
      }
    });

    return assignments;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 p-4 border-b">
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Produktionsplanung</h1>
        
        <div className="flex items-center gap-2">
          {/* Department Filter */}
          <Select
            value={selectedDepartment}
            onValueChange={(val) => setSelectedDepartment(val as Department | "")}
          >
            <SelectTrigger className="w-48" data-testid="select-department">
              <SelectValue placeholder="Alle Bereiche" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" data-testid="option-all-departments">Alle Bereiche</SelectItem>
              <SelectItem value="TEAMSPORT">Teamsport</SelectItem>
              <SelectItem value="TEXTILVEREDELUNG">Textilveredelung</SelectItem>
              <SelectItem value="STICKEREI">Stickerei</SelectItem>
              <SelectItem value="DRUCK">Druck</SelectItem>
              <SelectItem value="SONSTIGES">Sonstiges</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              data-testid="button-prev-day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-32 text-center" data-testid="text-current-date">
              {format(selectedDate, "EEE, d. MMM yyyy", { locale: de })}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              data-testid="button-next-day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date())}
              data-testid="button-today"
            >
              Heute
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        {workCenters.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Keine Arbeitsbereiche gefunden
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {workCenters.map((wc) => {
              const slots = slotsByWorkCenter.get(wc.id) || [];
              const laneAssignments = assignLanes(slots, wc.concurrentCapacity);

              return (
                <Card key={wc.id}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
                    <CardTitle className="text-lg">{wc.name}</CardTitle>
                    <Badge variant="secondary" data-testid={`badge-capacity-${wc.id}`}>
                      {wc.concurrentCapacity} parallel
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4">
                      {/* Time Labels */}
                      <div className="flex flex-col gap-0 pt-2">
                        {workingHours.map((min) => (
                          <div key={min} className="h-20 text-xs text-muted-foreground">
                            {minToTime(min)}
                          </div>
                        ))}
                      </div>

                      {/* Lanes */}
                      <div className="flex-1 flex gap-2">
                        {Array.from({ length: wc.concurrentCapacity }, (_, laneIdx) => (
                          <div
                            key={laneIdx}
                            className="flex-1 relative border rounded-md bg-muted/20"
                            style={{ minHeight: `${12 * 80}px` }}
                          >
                            {/* Hour Grid Lines */}
                            {workingHours.slice(1).map((min, idx) => (
                              <div
                                key={min}
                                className="absolute left-0 right-0 border-t border-border/30"
                                style={{ top: `${(idx + 1) * 80}px` }}
                              />
                            ))}

                            {/* Time Slots in this lane */}
                            {slots
                              .filter((slot) => {
                                const lane = laneAssignments.get(slot.id);
                                return slot.blocked ? true : lane === laneIdx;
                              })
                              .map((slot) => {
                                const isBlocked = slot.blocked;
                                const style = getSlotStyle(slot);

                                return (
                                  <div
                                    key={slot.id}
                                    className={`absolute left-1 right-1 rounded px-2 py-1 text-xs overflow-hidden cursor-pointer hover-elevate ${
                                      isBlocked
                                        ? "bg-destructive/20 border-2 border-destructive text-destructive-foreground"
                                        : slot.orderId
                                        ? "bg-primary/80 text-primary-foreground border border-primary"
                                        : "bg-muted border border-border"
                                    }`}
                                    style={style}
                                    data-testid={`slot-${slot.id}`}
                                  >
                                    {isBlocked ? (
                                      <div className="flex items-center gap-1">
                                        <Lock className="h-3 w-3" />
                                        <span className="font-semibold">Gesperrt</span>
                                      </div>
                                    ) : slot.order ? (
                                      <>
                                        <div className="font-semibold truncate">
                                          {slot.order.displayOrderNumber || slot.order.id.slice(0, 8)}
                                        </div>
                                        <div className="truncate text-muted-foreground">
                                          {slot.order.title}
                                        </div>
                                      </>
                                    ) : (
                                      <div className="text-muted-foreground">Frei</div>
                                    )}
                                    {slot.note && (
                                      <div className="text-xs italic mt-1 truncate">{slot.note}</div>
                                    )}
                                  </div>
                                );
                              })}

                            {/* Add Slot Buttons (every hour) */}
                            {workingHours.map((min) => (
                              <Button
                                key={min}
                                variant="ghost"
                                size="sm"
                                className="absolute left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100"
                                style={{ top: `${((min - 420) / 60) * 80 + 30}px` }}
                                onClick={() => handleCreateSlot(wc.id, min)}
                                data-testid={`button-add-slot-${wc.id}-${min}-${laneIdx}`}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Slot Creation Dialog */}
      <Dialog open={slotDialog.open} onOpenChange={(open) => setSlotDialog({ open, data: null })}>
        <DialogContent data-testid="dialog-create-slot">
          <DialogHeader>
            <DialogTitle>Neuen Termin erstellen</DialogTitle>
          </DialogHeader>

          {slotDialog.data && (
            <div className="space-y-4">
              {/* Order Selection */}
              <div className="space-y-2">
                <Label htmlFor="order">Auftrag</Label>
                <Select
                  value={slotDialog.data.orderId || ""}
                  onValueChange={(val) =>
                    setSlotDialog({
                      ...slotDialog,
                      data: { ...slotDialog.data!, orderId: val || null },
                    })
                  }
                >
                  <SelectTrigger id="order" data-testid="select-order">
                    <SelectValue placeholder="Kein Auftrag (Blocker)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Kein Auftrag (Blocker)</SelectItem>
                    {fuerProdOrders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.displayOrderNumber || order.id.slice(0, 8)} - {order.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Time */}
              <div className="space-y-2">
                <Label htmlFor="startTime">Startzeit</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={minToTime(slotDialog.data.startMin)}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    const min = h * 60 + m;
                    setSlotDialog({
                      ...slotDialog,
                      data: { ...slotDialog.data!, startMin: min },
                    });
                  }}
                  data-testid="input-start-time"
                />
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label htmlFor="duration">Dauer (Minuten)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={5}
                  step={5}
                  value={slotDialog.data.lengthMin}
                  onChange={(e) =>
                    setSlotDialog({
                      ...slotDialog,
                      data: { ...slotDialog.data!, lengthMin: parseInt(e.target.value) || 60 },
                    })
                  }
                  data-testid="input-duration"
                />
              </div>

              {/* Blocked Checkbox */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="blocked"
                  checked={slotDialog.data.blocked}
                  onCheckedChange={(checked) =>
                    setSlotDialog({
                      ...slotDialog,
                      data: { ...slotDialog.data!, blocked: checked === true },
                    })
                  }
                  data-testid="checkbox-blocked"
                />
                <Label htmlFor="blocked">Komplett sperren (blockiert alle Spuren)</Label>
              </div>

              {/* Note */}
              <div className="space-y-2">
                <Label htmlFor="note">Notiz</Label>
                <Textarea
                  id="note"
                  value={slotDialog.data.note || ""}
                  onChange={(e) =>
                    setSlotDialog({
                      ...slotDialog,
                      data: { ...slotDialog.data!, note: e.target.value || null },
                    })
                  }
                  data-testid="textarea-note"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSlotDialog({ open: false, data: null })}
              data-testid="button-cancel"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSubmitSlot}
              disabled={createSlotMutation.isPending}
              data-testid="button-submit"
            >
              {createSlotMutation.isPending ? "Wird erstellt..." : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
