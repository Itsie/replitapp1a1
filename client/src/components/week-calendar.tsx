import { useMemo } from "react";
import { format, addDays, isSameDay, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarIcon } from "lucide-react";

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
    department: string;
  };
}

interface WorkCenter {
  id: string;
  name: string;
  capacityMin: number;
}

interface WeekCalendarProps {
  startDate: Date;
  timeSlots: TimeSlot[];
  workCenters: WorkCenter[];
  selectedWorkCenters: string[];
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, date: string, workCenterId: string) => void;
}

// Helper to convert minutes (from midnight) to HH:MM format
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

// Helper to calculate position and height
function calculateSlotPosition(startMin: number, lengthMin: number) {
  const workingStart = 7 * 60; // 07:00 in minutes
  const workingEnd = 18 * 60; // 18:00 in minutes
  const totalWorkingMinutes = workingEnd - workingStart; // 660 minutes
  
  // Position from top (percentage)
  const top = ((startMin - workingStart) / totalWorkingMinutes) * 100;
  
  // Height (percentage)
  const height = (lengthMin / totalWorkingMinutes) * 100;
  
  return { top: `${Math.max(0, top)}%`, height: `${height}%` };
}

export function WeekCalendar({
  startDate,
  timeSlots,
  workCenters,
  selectedWorkCenters,
  onDragOver,
  onDrop,
}: WeekCalendarProps) {
  // Generate week days (Mon-Fri)
  const weekDays = useMemo(() => {
    const start = startOfWeek(startDate, { weekStartsOn: 1 });
    return Array.from({ length: 5 }, (_, i) => addDays(start, i));
  }, [startDate]);

  // Filter work centers if selection exists
  const displayWorkCenters = useMemo(() => {
    if (selectedWorkCenters.length === 0) return workCenters;
    return workCenters.filter((wc) => selectedWorkCenters.includes(wc.id));
  }, [workCenters, selectedWorkCenters]);

  // Group time slots by work center and date
  const slotsByWorkCenterAndDate = useMemo(() => {
    const map: Record<string, Record<string, TimeSlot[]>> = {};
    
    timeSlots.forEach((slot) => {
      if (!map[slot.workCenterId]) {
        map[slot.workCenterId] = {};
      }
      if (!map[slot.workCenterId][slot.date]) {
        map[slot.workCenterId][slot.date] = [];
      }
      map[slot.workCenterId][slot.date].push(slot);
    });
    
    return map;
  }, [timeSlots]);

  // Calculate capacity usage per work center per day
  const capacityUsage = useMemo(() => {
    const usage: Record<string, Record<string, number>> = {};
    
    Object.entries(slotsByWorkCenterAndDate).forEach(([wcId, dateSlots]) => {
      usage[wcId] = {};
      Object.entries(dateSlots).forEach(([date, slots]) => {
        usage[wcId][date] = slots.reduce((sum, slot) => sum + slot.lengthMin, 0);
      });
    });
    
    return usage;
  }, [slotsByWorkCenterAndDate]);

  if (displayWorkCenters.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <p className="text-muted-foreground text-center">
          Keine Arbeitsstationen für Anzeige verfügbar.
          <br />
          Bitte wählen Sie Arbeitsstationen im Filter aus.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header Row */}
      <div className="flex border-b sticky top-0 bg-background z-10">
        <div className="w-48 flex-shrink-0 p-2 border-r font-semibold text-sm">
          Arbeitsstation
        </div>
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className="flex-1 min-w-[150px] p-2 text-center border-r last:border-r-0"
          >
            <div className="font-semibold text-sm">
              {format(day, "EEE", { locale: de })}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(day, "dd.MM")}
            </div>
          </div>
        ))}
      </div>

      {/* Work Center Rows */}
      {displayWorkCenters.map((workCenter) => (
        <div key={workCenter.id} className="flex border-b min-h-[200px]">
          {/* Work Center Name Column */}
          <div className="w-48 flex-shrink-0 p-3 border-r bg-muted/20">
            <div className="font-medium text-sm mb-1">{workCenter.name}</div>
            <div className="text-xs text-muted-foreground">
              Kapazität: {workCenter.capacityMin} Min
            </div>
          </div>

          {/* Day Columns */}
          {weekDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const daySlots = slotsByWorkCenterAndDate[workCenter.id]?.[dateStr] || [];
            const usedMinutes = capacityUsage[workCenter.id]?.[dateStr] || 0;
            const capacityPercent = (usedMinutes / workCenter.capacityMin) * 100;

            return (
              <div
                key={day.toISOString()}
                className="flex-1 min-w-[150px] border-r last:border-r-0 relative bg-background hover:bg-muted/5"
                onDragOver={onDragOver}
                onDrop={(e) => onDrop?.(e, dateStr, workCenter.id)}
                data-testid={`day-cell-${workCenter.id}-${dateStr}`}
              >
                {/* Capacity Indicator */}
                <div className="absolute top-0 left-0 right-0 h-1">
                  <div
                    className={`h-full ${
                      capacityPercent > 100
                        ? "bg-destructive"
                        : capacityPercent > 80
                        ? "bg-orange-500"
                        : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(100, capacityPercent)}%` }}
                  />
                </div>

                {/* Time Slots */}
                <div className="relative h-full min-h-[200px] pt-2">
                  {daySlots.map((slot) => {
                    const { top, height } = calculateSlotPosition(
                      slot.startMin,
                      slot.lengthMin
                    );

                    return (
                      <div
                        key={slot.id}
                        className={`absolute left-1 right-1 rounded px-2 py-1 text-xs cursor-pointer hover-elevate ${
                          slot.blocked
                            ? "bg-muted border border-dashed border-muted-foreground"
                            : "bg-primary/10 border border-primary/20"
                        }`}
                        style={{ top, height }}
                        title={
                          slot.blocked
                            ? `Blockiert: ${slot.note || "Keine Notiz"}`
                            : `${slot.order?.displayOrderNumber} - ${slot.order?.title}\n${minutesToTime(slot.startMin)} - ${minutesToTime(slot.startMin + slot.lengthMin)}`
                        }
                        data-testid={`slot-${slot.id}`}
                      >
                        {slot.blocked ? (
                          <div className="font-medium text-muted-foreground">
                            🚫 Blockiert
                          </div>
                        ) : slot.order ? (
                          <div className="space-y-0.5">
                            <div className="font-mono font-medium text-xs">
                              {slot.order.displayOrderNumber}
                            </div>
                            <div className="text-xs line-clamp-1">
                              {slot.order.title}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              {minutesToTime(slot.startMin)} -{" "}
                              {minutesToTime(slot.startMin + slot.lengthMin)}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Capacity Badge */}
                {usedMinutes > 0 && (
                  <div className="absolute bottom-1 right-1">
                    <Badge
                      variant={capacityPercent > 100 ? "destructive" : "secondary"}
                      className="text-[10px] px-1 py-0"
                    >
                      {usedMinutes}/{workCenter.capacityMin}
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
