import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import type { Department } from "@prisma/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { addDays, subDays, startOfDay, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { ProductionSlotModal } from "@/components/production-slot-modal";
import { ProductionSlotCard } from "@/components/production-slot-card";

interface TimeSlotWithOrder {
  id: string;
  date: Date;
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
    dueDate: Date | null;
    notes: string | null;
    printAssets?: Array<{
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

type WorkflowState = 
  | "ENTWURF"
  | "NEU"
  | "PRUEFUNG"
  | "FUER_PROD"
  | "IN_PROD"
  | "WARTET_FEHLTEILE"
  | "FERTIG"
  | "ZUR_ABRECHNUNG"
  | "ABGERECHNET";

type DepartmentFilter = Department | "TEAMSPORT_TEXTIL" | "all";

export default function ProductionToday() {
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentFilter>("all");
  const [hideCompleted, setHideCompleted] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<TimeSlotWithOrder | null>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('production_hideCompleted');
      if (stored !== null) {
        setHideCompleted(stored === 'true');
      }
    }
  }, []);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('production_hideCompleted', hideCompleted.toString());
    }
  }, [hideCompleted]);

  const queryUrl = `/api/timeslots?date=${encodeURIComponent(selectedDate.toISOString())}`;
  
  const { data: response, isLoading } = useQuery<{ slots: TimeSlotWithOrder[] }>({
    queryKey: [queryUrl],
  });

  const slots = response?.slots ?? [];

  const departmentOptions: Array<{ value: DepartmentFilter; label: string }> = [
    { value: "all", label: "Alle Bereiche" },
    { value: "TEAMSPORT_TEXTIL", label: "Teamsport + Textilveredelung" },
    { value: "TEAMSPORT", label: "Teamsport" },
    { value: "TEXTILVEREDELUNG", label: "Textilveredelung" },
    { value: "STICKEREI", label: "Stickerei" },
    { value: "DRUCK", label: "Druck" },
    { value: "SONSTIGES", label: "Sonstiges" },
  ];

  // Filter slots
  let filteredSlots = slots.filter(s => s.orderId !== null || s.blocked === true);
  
  if (selectedDepartment !== "all") {
    if (selectedDepartment === "TEAMSPORT_TEXTIL") {
      filteredSlots = filteredSlots.filter(
        s => s.workCenter.department === "TEAMSPORT" || s.workCenter.department === "TEXTILVEREDELUNG"
      );
    } else {
      filteredSlots = filteredSlots.filter(s => s.workCenter.department === selectedDepartment);
    }
  }
  
  // Always hide BLOCKED slots (they should be in missing parts view)
  filteredSlots = filteredSlots.filter(s => s.status !== 'BLOCKED');
  
  if (hideCompleted) {
    filteredSlots = filteredSlots.filter(s => s.status !== 'DONE');
  }

  // Sort by start time
  filteredSlots = [...filteredSlots].sort((a, b) => a.startMin - b.startMin);

  if (isLoading) {
    return (
      <div className="w-full px-4 md:px-6 py-8">
        <div className="text-center py-12 text-muted-foreground">Lädt...</div>
      </div>
    );
  }

  const today = startOfDay(new Date());
  const isToday = isSameDay(selectedDate, today);

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Produktion</h1>
        <p className="text-muted-foreground">
          {selectedDate.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center gap-2 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedDate(subDays(selectedDate, 1))}
          data-testid="button-previous-day"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Gestern
        </Button>
        
        <Button
          variant={isToday ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedDate(today)}
          data-testid="button-today"
        >
          Heute
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          data-testid="button-next-day"
        >
          Morgen
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-calendar-picker">
              <Calendar className="h-4 w-4 mr-2" />
              Datum wählen
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(startOfDay(date))}
              locale={de}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Label htmlFor="department-filter">Bereich:</Label>
          <Select 
            value={selectedDepartment} 
            onValueChange={(val) => setSelectedDepartment(val as DepartmentFilter)}
          >
            <SelectTrigger id="department-filter" className="w-64" data-testid="select-department-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {departmentOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Switch
            id="hide-completed"
            checked={hideCompleted}
            onCheckedChange={setHideCompleted}
            data-testid="switch-hide-completed"
          />
          <Label htmlFor="hide-completed" className="cursor-pointer">
            Erledigte ausblenden
          </Label>
        </div>
      </div>

      {/* Slot List */}
      {filteredSlots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Keine zugeordneten Arbeitsschritte {isToday ? 'für heute' : 'für diesen Tag'}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" data-testid="list-production-slots">
          {filteredSlots.map(slot => (
            <ProductionSlotCard
              key={slot.id}
              slot={slot}
              onClick={() => setSelectedSlot(slot)}
            />
          ))}
        </div>
      )}

      {/* Production Slot Modal */}
      <ProductionSlotModal
        isOpen={!!selectedSlot}
        slot={selectedSlot}
        onClose={() => setSelectedSlot(null)}
      />
    </div>
  );
}
