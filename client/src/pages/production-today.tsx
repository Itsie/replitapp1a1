import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Calendar, Clock, ChevronDown, ChevronUp, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { WorkCenter, Department, WorkflowState } from "@prisma/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { addDays, subDays, startOfDay, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { ProductionSlotModal } from "@/components/production-slot-modal";

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

interface WorkCenterWithSlotCount extends WorkCenter {
  slotsTodayCount: number;
}

type ProblemReason = "FEHLTEILE" | "MASCHINE" | "SONSTIGES";

const PROBLEM_REASONS: Record<ProblemReason, string> = {
  FEHLTEILE: "Fehlteile",
  MASCHINE: "Maschine defekt",
  SONSTIGES: "Sonstiges",
};

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${mins}min`;
}

export default function ProductionToday() {
  const { toast } = useToast();
  const [selectedDepartment, setSelectedDepartment] = useState<Department | "all">("all");
  const [hideCompleted, setHideCompleted] = useState(true);
  const [collapsedSlots, setCollapsedSlots] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  
  const previousStatusesRef = useRef<Map<string, string>>(new Map());
  
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

  const departments: Department[] = ["TEAMSPORT", "TEXTILVEREDELUNG", "STICKEREI", "DRUCK", "SONSTIGES"];

  // Slot Detail Modal
  const [selectedSlot, setSelectedSlot] = useState<TimeSlotWithOrder | null>(null);

  const toggleCollapse = (slotId: string) => {
    setCollapsedSlots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slotId)) {
        newSet.delete(slotId);
      } else {
        newSet.add(slotId);
      }
      return newSet;
    });
  };

  const slotStatusSignature = JSON.stringify(slots.map(s => ({ id: s.id, status: s.status })));
  
  useEffect(() => {
    const previousStatuses = previousStatusesRef.current;
    let hasChanges = false;
    const updates: string[] = [];

    slots.forEach(slot => {
      const prevStatus = previousStatuses.get(slot.id);
      if (prevStatus !== 'DONE' && slot.status === 'DONE') {
        updates.push(slot.id);
        hasChanges = true;
      }
      previousStatuses.set(slot.id, slot.status);
    });

    const currentSlotIds = new Set(slots.map(s => s.id));
    Array.from(previousStatuses.entries()).forEach(([id]) => {
      if (!currentSlotIds.has(id)) {
        previousStatuses.delete(id);
      }
    });

    if (hasChanges && updates.length > 0) {
      setCollapsedSlots(prev => {
        const newSet = new Set(prev);
        updates.forEach(id => newSet.add(id));
        return newSet;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotStatusSignature]);

  let filteredSlots = slots.filter(s => s.orderId !== null || s.blocked === true);
  
  if (selectedDepartment !== "all") {
    filteredSlots = filteredSlots.filter(s => s.workCenter.department === selectedDepartment);
  }
  
  // Always hide BLOCKED slots (they can't be worked on and should go to missing parts)
  filteredSlots = filteredSlots.filter(s => s.status !== 'BLOCKED');
  
  if (hideCompleted) {
    filteredSlots = filteredSlots.filter(s => s.status !== 'DONE');
  }

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

      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Label htmlFor="department-filter">Bereich:</Label>
          <Select value={selectedDepartment} onValueChange={(val) => setSelectedDepartment(val as Department | "all")}>
            <SelectTrigger id="department-filter" className="w-48" data-testid="select-department-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Bereiche</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
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

      {filteredSlots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Keine zugeordneten Arbeitsschritte {isToday ? 'für heute' : 'für diesen Tag'}.
          </CardContent>
        </Card>
      ) : (
        <TimelineView
          slots={filteredSlots}
          collapsedSlots={collapsedSlots}
          onToggleCollapse={toggleCollapse}
          onViewDetails={(slot) => {
            setSelectedSlot(slot);
          }}
        />
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

interface TimelineViewProps {
  slots: TimeSlotWithOrder[];
  collapsedSlots: Set<string>;
  onToggleCollapse: (id: string) => void;
  onViewDetails: (slot: TimeSlotWithOrder) => void;
}

interface SlotWithLayout extends TimeSlotWithOrder {
  lane: number;
  totalLanes: number;
}

function calculateLanes(slots: TimeSlotWithOrder[]): SlotWithLayout[] {
  if (slots.length === 0) return [];
  
  // Sort by start time
  const sorted = [...slots].sort((a, b) => a.startMin - b.startMin);
  
  // Find overlapping clusters
  const clusters: TimeSlotWithOrder[][] = [];
  let currentCluster: TimeSlotWithOrder[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const slot = sorted[i];
    const clusterEnd = Math.max(...currentCluster.map(s => s.startMin + s.lengthMin));
    
    if (slot.startMin < clusterEnd) {
      // Overlaps with current cluster
      currentCluster.push(slot);
    } else {
      // Start new cluster
      clusters.push(currentCluster);
      currentCluster = [slot];
    }
  }
  clusters.push(currentCluster);
  
  // Assign lanes within each cluster
  const result: SlotWithLayout[] = [];
  
  for (const cluster of clusters) {
    const lanes: { endMin: number }[] = [];
    
    for (const slot of cluster) {
      const slotEnd = slot.startMin + slot.lengthMin;
      
      // Find first available lane
      let assignedLane = lanes.findIndex(lane => lane.endMin <= slot.startMin);
      
      if (assignedLane === -1) {
        assignedLane = lanes.length;
        lanes.push({ endMin: slotEnd });
      } else {
        lanes[assignedLane].endMin = slotEnd;
      }
      
      result.push({
        ...slot,
        lane: assignedLane,
        totalLanes: 0, // Will be set next
      });
    }
    
    // Set totalLanes for this cluster
    const clusterLanes = lanes.length;
    for (const slot of result.slice(-cluster.length)) {
      slot.totalLanes = clusterLanes;
    }
  }
  
  return result;
}

function TimelineView({
  slots,
  collapsedSlots,
  onToggleCollapse,
  onViewDetails,
}: TimelineViewProps) {
  const workStart = 7 * 60; // 07:00
  const workEnd = 18 * 60;   // 18:00
  const timeMarkers: number[] = [];
  
  // Time markers every 30 minutes
  for (let min = workStart; min <= workEnd; min += 30) {
    timeMarkers.push(min);
  }

  // Calculate lanes for overlapping slots
  const slotsWithLanes = calculateLanes(slots);

  return (
    <div className="border rounded-lg p-6 bg-card">
      {/* Timeline header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-3 w-1 bg-green-600 rounded" />
            <span className="text-muted-foreground">Läuft</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="h-3 w-1 bg-yellow-600 rounded" />
            <span className="text-muted-foreground">Pausiert</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="h-3 w-1 bg-red-600 rounded" />
            <span className="text-muted-foreground">Blockiert</span>
          </div>
        </div>
        <span className="text-sm text-muted-foreground">Arbeitstag: 07:00 - 18:00 Uhr</span>
      </div>

      {/* Timeline grid */}
      <div className="relative">
        {/* Time labels on left */}
        <div className="absolute left-0 top-0 bottom-0 w-16">
          {timeMarkers.map((min, idx) => {
            const isFullHour = min % 60 === 0;
            return (
              <div
                key={min}
                className="absolute left-0 right-0 flex items-center justify-end pr-2"
                style={{ top: `${idx * 40}px` }}
              >
                <span className={`text-xs font-mono ${isFullHour ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {formatTime(min)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Grid lines - full hours darker than half hours */}
        <div className="absolute left-16 right-0 top-0 bottom-0">
          {timeMarkers.map((min, idx) => {
            const isFullHour = min % 60 === 0;
            return (
              <div
                key={min}
                className={`absolute left-0 right-0 border-t ${isFullHour ? 'border-border/40' : 'border-border/20'}`}
                style={{ top: `${idx * 40}px` }}
              />
            );
          })}
        </div>

        {/* Slots content area */}
        <div className="ml-20 relative" style={{ minHeight: `${timeMarkers.length * 40}px` }}>
          {slotsWithLanes.map(slot => {
            // Calculate position based on time - 40px per 30 minutes = 80px per hour
            const pixelsPerMinute = 80 / 60;
            const topPosition = (slot.startMin - workStart) * pixelsPerMinute;
            const height = Math.max(slot.lengthMin * pixelsPerMinute, 20); // Minimum 20px (~15 min) for readability
            
            // Calculate width and left offset for lanes
            const laneWidth = 100 / slot.totalLanes;
            const leftPercent = (slot.lane * laneWidth);
            const widthPercent = laneWidth - (slot.totalLanes > 1 ? 1 : 0); // Small gap between lanes
            
            return (
              <div
                key={slot.id}
                className="absolute pr-1"
                style={{
                  top: `${topPosition}px`,
                  height: `${height}px`,
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                }}
              >
                <TimeSlotRow
                  slot={slot}
                  slotHeight={height}
                  isCollapsed={collapsedSlots.has(slot.id)}
                  onToggleCollapse={() => onToggleCollapse(slot.id)}
                  onViewDetails={() => onViewDetails(slot)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface TimeSlotRowProps {
  slot: TimeSlotWithOrder;
  slotHeight: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onViewDetails: () => void;
}

function TimeSlotRow({
  slot,
  slotHeight,
  isCollapsed,
  onToggleCollapse,
  onViewDetails,
}: TimeSlotRowProps) {
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // For very short slots (< 40 px = ~30 min), use compact display
  const isCompact = slotHeight < 40;

  useEffect(() => {
    if (slot.status === 'RUNNING') {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [slot.status]);

  let elapsedMin = 0;
  if (slot.status === 'RUNNING' && slot.startedAt) {
    const elapsedMs = currentTime - new Date(slot.startedAt).getTime();
    elapsedMin = Math.floor(elapsedMs / 60000);
  }

  const isRunning = slot.status === 'RUNNING';
  const isDone = slot.status === 'DONE';
  const isPaused = slot.status === 'PAUSED';
  const isBlocked = slot.status === 'BLOCKED';

  return (
    <div
      onClick={onViewDetails}
      className={`
        relative pl-4 py-2 pr-4 rounded-md border bg-card/50 h-full overflow-hidden flex flex-col cursor-pointer hover-elevate
        ${isDone ? 'opacity-60' : ''}
        ${isRunning ? 'border-l-4 border-l-green-600 bg-green-50/5' : ''}
        ${isBlocked ? 'border-l-4 border-l-red-600 bg-red-50/5' : ''}
        ${isPaused ? 'border-l-4 border-l-yellow-600 bg-yellow-50/5' : ''}
      `}
      data-testid={`card-slot-${slot.id}`}
    >
      <div className="flex items-start justify-between gap-2 flex-shrink-0">
        <div className="flex-1 min-w-0">
          {!isCompact ? (
            <>
              {/* Normal display for taller slots */}
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm font-mono font-semibold tracking-tight">
                  {formatTime(slot.startMin)} - {formatTime(slot.startMin + slot.lengthMin)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDuration(slot.lengthMin)}
                </span>
              </div>

              <div className="text-sm font-medium mb-0.5 truncate">
                {slot.order ? (
                  <>
                    {slot.order.displayOrderNumber && (
                      <span className="text-muted-foreground text-xs">{slot.order.displayOrderNumber} · </span>
                    )}
                    <span>{slot.order.title}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground italic">Blockiert</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {slot.order && (
                  <>
                    <span className="truncate">{slot.order.customer}</span>
                    <span>•</span>
                  </>
                )}
                <span className="truncate">{slot.workCenter.name}</span>
              </div>
            </>
          ) : (
            <>
              {/* Compact display for short slots */}
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-mono font-semibold">
                  {formatTime(slot.startMin)}
                </span>
                <span className="text-xs font-medium truncate">
                  {slot.order ? slot.order.title : 'Blockiert'}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Live timer for running slots */}
          {isRunning && !isCompact && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono bg-background/50 border">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium text-xs">{formatDuration(elapsedMin)}</span>
            </div>
          )}

          {/* Collapse toggle - only for DONE slots */}
          {!isCompact && isDone && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse();
              }}
              data-testid={`button-toggle-${slot.id}`}
              className="h-7 w-7 p-0"
            >
              {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>

      {/* Details section - always show for active slots, collapsible for DONE slots */}
      {(!isDone || !isCollapsed) && (
        <div className={`mt-2 pt-2 border-t space-y-1.5 flex-shrink-0 ${isCompact ? 'text-xs' : 'text-xs'}`}>
          {!isCompact && slot.note && (
            <div>
              <span className="text-muted-foreground">Notiz:</span> {slot.note}
            </div>
          )}

          {!isCompact && isDone && slot.actualDurationMin !== null && (
            <div>
              <span className="text-muted-foreground">Tatsächlich:</span>{' '}
              <span className="font-medium">{formatDuration(slot.actualDurationMin)}</span>
            </div>
          )}

          {/* Order Production Information */}
          {!isCompact && slot.order && (
            <>
              {/* Order Note */}
              {slot.order.notes && (
                <div className="bg-muted/30 p-2 rounded text-xs">
                  <span className="font-medium text-muted-foreground">Auftragsnotiz:</span>
                  <p className="mt-0.5">{slot.order.notes}</p>
                </div>
              )}

              {/* Print Assets */}
              {slot.order.printAssets && slot.order.printAssets.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Druckdaten ({slot.order.printAssets.length})</span>
                  </div>
                  <div className="space-y-1 pl-5">
                    {slot.order.printAssets.map((asset) => (
                      <a
                        key={asset.id}
                        href={asset.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`link-download-${asset.id}`}
                        className="flex items-center gap-2 text-xs hover-elevate active-elevate-2 p-1.5 rounded bg-card border"
                      >
                        <Download className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate flex-1">{asset.label}</span>
                        {asset.required && (
                          <span className="text-xs text-red-600">*</span>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

            </>
          )}

          {/* Action button - opens modal for all actions */}
          {slot.order && (
            <div className={`flex items-center pt-1 ${isCompact ? 'justify-center' : ''}`}>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetails();
                }}
                variant="outline"
                size="sm"
                data-testid={`button-details-${slot.id}`}
                className="h-7 text-xs"
              >
                Details & Aktionen
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
