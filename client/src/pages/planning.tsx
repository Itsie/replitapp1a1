import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { de } from "date-fns/locale";
import { WeekCalendar } from "@/components/week-calendar";
import { AppointmentDialog, type AppointmentFormData } from "@/components/appointment-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

type Department = "TEAMSPORT" | "TEXTILVEREDELUNG" | "STICKEREI" | "DRUCK" | "SONSTIGES";
type ViewMode = "week" | "day";

interface WorkCenter {
  id: string;
  name: string;
  department: Department;
  active: boolean;
  capacityMin: number;
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
    displayOrderNumber: string;
    title: string;
    dueDate: string | null;
    workflow: string;
    department: Department;
  };
}

interface Order {
  id: string;
  displayOrderNumber: string;
  title: string;
  dueDate: string | null;
  workflow: string;
  department: Department;
}

export default function PlanningPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<Department | "">("");
  const [selectedWorkCenters, setSelectedWorkCenters] = useState<string[]>([]);
  const [appointmentDialog, setAppointmentDialog] = useState<{
    open: boolean;
    orderId: string | null;
    orderNumber: string;
    date: string;
  }>({
    open: false,
    orderId: null,
    orderNumber: "",
    date: "",
  });
  const { toast } = useToast();

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === "week") {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
      const end = endOfWeek(selectedDate, { weekStartsOn: 1 }); // Sunday
      return { start, end };
    } else {
      return { start: selectedDate, end: selectedDate };
    }
  }, [viewMode, selectedDate]);

  // Fetch work centers
  const { data: workCenters = [] } = useQuery<WorkCenter[]>({
    queryKey: ["/api/workcenters", selectedDepartment],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedDepartment) params.append("department", selectedDepartment);
      const url = `/api/workcenters${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch work centers");
      return res.json();
    },
  });

  // Fetch calendar data
  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: [
      "/api/calendar",
      format(dateRange.start, "yyyy-MM-dd"),
      format(dateRange.end, "yyyy-MM-dd"),
      selectedDepartment,
      selectedWorkCenters.join(","),
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: format(dateRange.start, "yyyy-MM-dd"),
        endDate: format(dateRange.end, "yyyy-MM-dd"),
      });
      if (selectedDepartment) params.append("department", selectedDepartment);
      if (selectedWorkCenters.length > 0) {
        selectedWorkCenters.forEach((id) => params.append("workCenterId", id));
      }
      const url = `/api/calendar?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch calendar");
      return res.json();
    },
  });

  // Fetch orders ready for production
  const { data: readyOrders = [] } = useQuery<Order[]>({
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

  // Mutation to create time slot
  const createTimeSlotMutation = useMutation({
    mutationFn: async (data: {
      date: string;
      startMin: number;
      lengthMin: number;
      workCenterId: string;
      orderId: string;
    }) => {
      const res = await apiRequest("POST", "/api/timeslots", data);
      return res.json();
    },
    onSuccess: () => {
      // Invalidate calendar and orders queries
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders", "FUER_PROD"] });
      toast({
        title: "Termin erstellt",
        description: "Der Produktionstermin wurde erfolgreich erstellt.",
      });
    },
    onError: (error: any) => {
      let errorMessage = "Ein unerwarteter Fehler ist aufgetreten.";
      
      if (error.message?.includes("409")) {
        errorMessage = "Der Termin überschneidet sich mit einem bestehenden Slot.";
      } else if (error.message?.includes("412")) {
        errorMessage = "Abteilung oder Workflow-Status stimmt nicht überein.";
      } else if (error.message?.includes("422")) {
        errorMessage = "Validierungsfehler: Bitte überprüfen Sie die Eingaben.";
      }
      
      toast({
        title: "Fehler beim Erstellen",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const navigateWeek = (direction: "prev" | "next") => {
    setSelectedDate((prev) => (direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1)));
  };

  const handleDragStart = (e: React.DragEvent, order: Order) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        orderId: order.id,
        orderNumber: order.displayOrderNumber,
      })
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, date: string, workCenterId?: string) => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData("application/json"));
    
    setAppointmentDialog({
      open: true,
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      date,
    });
  };

  const handleConfirmAppointment = (data: AppointmentFormData) => {
    if (!appointmentDialog.orderId) return;

    createTimeSlotMutation.mutate({
      date: appointmentDialog.date,
      startMin: data.startMin,
      lengthMin: data.lengthMin,
      workCenterId: data.workCenterId,
      orderId: appointmentDialog.orderId,
    });

    setAppointmentDialog({ open: false, orderId: null, orderNumber: "", date: "" });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background" data-testid="page-planning">
      {/* Left Sidebar - Filters */}
      <Card className="w-64 flex-shrink-0 m-4 p-4 space-y-4 overflow-y-auto">
        <div>
          <h2 className="text-lg font-semibold mb-4">Filter</h2>

          {/* View Mode Toggle */}
          <div className="space-y-2 mb-4">
            <label className="text-xs font-medium uppercase text-muted-foreground">
              Ansicht
            </label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={viewMode === "week" ? "default" : "outline"}
                onClick={() => setViewMode("week")}
                className="flex-1"
                data-testid="button-view-week"
              >
                Woche
              </Button>
              <Button
                size="sm"
                variant={viewMode === "day" ? "default" : "outline"}
                onClick={() => setViewMode("day")}
                className="flex-1"
                data-testid="button-view-day"
              >
                Tag
              </Button>
            </div>
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase text-muted-foreground">
              Datum
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="button-date-picker"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "PPP", { locale: de })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  locale={de}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Department Filter */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase text-muted-foreground">
              Abteilung
            </label>
            <Select
              value={selectedDepartment || undefined}
              onValueChange={(value) => setSelectedDepartment(value as Department)}
            >
              <SelectTrigger data-testid="select-department">
                <SelectValue placeholder="Alle Abteilungen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEAMSPORT">Teamsport</SelectItem>
                <SelectItem value="TEXTILVEREDELUNG">Textilveredelung</SelectItem>
                <SelectItem value="STICKEREI">Stickerei</SelectItem>
                <SelectItem value="DRUCK">Druck</SelectItem>
                <SelectItem value="SONSTIGES">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
            {selectedDepartment && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDepartment("")}
                className="w-full text-xs"
                data-testid="button-clear-department"
              >
                Filter zurücksetzen
              </Button>
            )}
          </div>

          {/* WorkCenter Filter */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase text-muted-foreground">
              Arbeitsstationen
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {workCenters.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Keine Arbeitsstationen verfügbar
                </p>
              ) : (
                workCenters.map((wc) => (
                  <label
                    key={wc.id}
                    className="flex items-center gap-2 p-2 rounded hover-elevate cursor-pointer"
                    data-testid={`checkbox-workcenter-${wc.id}`}
                  >
                    <Checkbox
                      checked={selectedWorkCenters.includes(wc.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedWorkCenters([...selectedWorkCenters, wc.id]);
                        } else {
                          setSelectedWorkCenters(selectedWorkCenters.filter((id) => id !== wc.id));
                        }
                      }}
                    />
                    <span className="text-sm flex-1">{wc.name}</span>
                    {!wc.active && (
                      <Badge variant="secondary" className="text-xs">
                        Inaktiv
                      </Badge>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between bg-background">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateWeek("prev")}
              data-testid="button-prev-week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-semibold" data-testid="text-calendar-title">
              {viewMode === "week"
                ? `KW ${format(dateRange.start, "w", { locale: de })} - ${format(dateRange.start, "dd.MM")} bis ${format(dateRange.end, "dd.MM.yyyy")}`
                : format(selectedDate, "EEEE, dd. MMMM yyyy", { locale: de })}
            </h1>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateWeek("next")}
              data-testid="button-next-week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={() => setSelectedDate(new Date())}
            data-testid="button-today"
          >
            Heute
          </Button>
        </div>

        <div className="flex-1 overflow-hidden">
          {viewMode === "week" ? (
            <WeekCalendar
              startDate={dateRange.start}
              timeSlots={timeSlots}
              workCenters={workCenters}
              selectedWorkCenters={selectedWorkCenters}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">
                Tagesansicht wird in Kürze implementiert
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Orders Ready for Production */}
      <Card className="w-80 flex-shrink-0 m-4 p-4 space-y-4 overflow-y-auto">
        <div>
          <h2 className="text-lg font-semibold mb-4">Aufträge bereit</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {readyOrders.length} Aufträge für Produktion
          </p>

          {readyOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center mt-8">
              Keine Aufträge bereit für Produktion
            </p>
          ) : (
            <div className="space-y-2">
              {readyOrders.map((order) => (
                <Card
                  key={order.id}
                  className="p-3 cursor-move hover-elevate"
                  draggable
                  onDragStart={(e) => handleDragStart(e, order)}
                  data-testid={`card-order-${order.id}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-sm font-medium">
                        {order.displayOrderNumber}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {order.department}
                      </Badge>
                    </div>
                    <p className="text-sm line-clamp-2" title={order.title}>
                      {order.title}
                    </p>
                    {order.dueDate && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarIcon className="h-3 w-3" />
                        Fällig: {format(new Date(order.dueDate), "dd.MM.yyyy")}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Appointment Dialog */}
      {appointmentDialog.orderId && (
        <AppointmentDialog
          open={appointmentDialog.open}
          onOpenChange={(open) =>
            setAppointmentDialog((prev) => ({ ...prev, open }))
          }
          onConfirm={handleConfirmAppointment}
          orderId={appointmentDialog.orderId}
          orderNumber={appointmentDialog.orderNumber}
          date={appointmentDialog.date}
          workCenters={workCenters}
          defaultWorkCenterId={selectedWorkCenters.length === 1 ? selectedWorkCenters[0] : undefined}
        />
      )}
    </div>
  );
}
