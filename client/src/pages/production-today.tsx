import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Play, Pause, Square, AlertCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WorkCenter, Department, WorkflowState } from "@prisma/client";
import { WORKFLOW_LABELS } from "@shared/schema";

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: response, isLoading } = useQuery<{ slots: TimeSlotWithOrder[] }>({
    queryKey: ['/api/timeslots', { date: today.toISOString() }],
  });

  const slots = response?.slots ?? [];

  const departments: Department[] = ["TEAMSPORT", "TEXTILVEREDELUNG", "STICKEREI", "DRUCK", "SONSTIGES"];

  const [problemDialogOpen, setProblemDialogOpen] = useState(false);
  const [problemSlotId, setProblemSlotId] = useState<string | null>(null);
  const [problemNote, setProblemNote] = useState("");
  const [problemReason, setProblemReason] = useState<ProblemReason>("FEHLTEILE");
  const [updateWorkflow, setUpdateWorkflow] = useState(true);

  const startMutation = useMutation({
    mutationFn: async (slotId: string) => {
      await apiRequest('POST', `/api/timeslots/${slotId}/start`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      toast({
        title: "Erfolgreich",
        description: "Arbeitsschritt gestartet",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message || "Arbeitsschritt konnte nicht gestartet werden",
        variant: "destructive",
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (slotId: string) => {
      await apiRequest('POST', `/api/timeslots/${slotId}/pause`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      toast({
        title: "Erfolgreich",
        description: "Arbeitsschritt pausiert",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message || "Arbeitsschritt konnte nicht pausiert werden",
        variant: "destructive",
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async (slotId: string) => {
      await apiRequest('POST', `/api/timeslots/${slotId}/stop`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      toast({
        title: "Erfolgreich",
        description: "Arbeitsschritt beendet",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message || "Arbeitsschritt konnte nicht beendet werden",
        variant: "destructive",
      });
    },
  });

  const problemMutation = useMutation({
    mutationFn: async ({ slotId, note, escalate }: { slotId: string; note: string; escalate: boolean }) => {
      await apiRequest('POST', `/api/timeslots/${slotId}/missing-parts`, {
        note,
        escalateWorkflow: escalate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/timeslots'] });
      setProblemDialogOpen(false);
      setProblemSlotId(null);
      setProblemNote("");
      setProblemReason("FEHLTEILE");
      setUpdateWorkflow(true);
      toast({
        title: "Erfolgreich",
        description: "Problem wurde gemeldet",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message || "Problem konnte nicht gemeldet werden",
        variant: "destructive",
      });
    },
  });

  const handleStart = (slotId: string) => {
    startMutation.mutate(slotId);
  };

  const handlePause = (slotId: string) => {
    pauseMutation.mutate(slotId);
  };

  const handleStop = (slotId: string) => {
    stopMutation.mutate(slotId);
  };

  const handleOpenProblemDialog = (slotId: string) => {
    setProblemSlotId(slotId);
    setProblemDialogOpen(true);
  };

  const handleSubmitProblem = () => {
    if (!problemSlotId || !problemNote.trim()) return;
    problemMutation.mutate({
      slotId: problemSlotId,
      note: problemNote,
      escalate: updateWorkflow,
    });
  };

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
  
  if (hideCompleted) {
    filteredSlots = filteredSlots.filter(s => s.status !== 'DONE');
  }

  filteredSlots = [...filteredSlots].sort((a, b) => a.startMin - b.startMin);

  if (isLoading) {
    return (
      <div className="container max-w-7xl py-8">
        <div className="text-center py-12 text-muted-foreground">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-[1600px] px-4 md:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Produktion heute</h1>
        <p className="text-muted-foreground">
          {today.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
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
            Keine zugeordneten Arbeitsschritte für heute.
          </CardContent>
        </Card>
      ) : (
        <TimelineView
          slots={filteredSlots}
          collapsedSlots={collapsedSlots}
          onToggleCollapse={toggleCollapse}
          onStart={handleStart}
          onPause={handlePause}
          onStop={handleStop}
          onProblem={handleOpenProblemDialog}
          isStarting={startMutation.isPending}
          isPausing={pauseMutation.isPending}
          isStopping={stopMutation.isPending}
        />
      )}

      <Dialog open={problemDialogOpen} onOpenChange={setProblemDialogOpen}>
        <DialogContent data-testid="dialog-problem">
          <DialogHeader>
            <DialogTitle>Problem melden</DialogTitle>
            <DialogDescription>
              Melden Sie ein Problem für diesen Arbeitsschritt
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Grund *</Label>
              <RadioGroup value={problemReason} onValueChange={(val) => setProblemReason(val as ProblemReason)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="FEHLTEILE" id="reason-fehlteile" data-testid="radio-reason-fehlteile" />
                  <Label htmlFor="reason-fehlteile" className="cursor-pointer">Fehlteile</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="MASCHINE" id="reason-maschine" data-testid="radio-reason-maschine" />
                  <Label htmlFor="reason-maschine" className="cursor-pointer">Maschine defekt</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="SONSTIGES" id="reason-sonstiges" data-testid="radio-reason-sonstiges" />
                  <Label htmlFor="reason-sonstiges" className="cursor-pointer">Sonstiges</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="problem-note">Notiz *</Label>
              <Textarea
                id="problem-note"
                value={problemNote}
                onChange={(e) => setProblemNote(e.target.value)}
                placeholder="Beschreiben Sie das Problem..."
                rows={4}
                data-testid="textarea-problem-note"
              />
            </div>

            {problemReason === "FEHLTEILE" && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="update-workflow"
                  checked={updateWorkflow}
                  onChange={(e) => setUpdateWorkflow(e.target.checked)}
                  className="rounded"
                  data-testid="checkbox-update-workflow"
                />
                <Label htmlFor="update-workflow" className="cursor-pointer">
                  Auftrag auf "Wartet auf Fehlteile" setzen
                </Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setProblemDialogOpen(false);
                setProblemSlotId(null);
                setProblemNote("");
                setProblemReason("FEHLTEILE");
                setUpdateWorkflow(true);
              }}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSubmitProblem}
              disabled={!problemNote.trim() || problemMutation.isPending}
              data-testid="button-submit-problem"
            >
              {problemMutation.isPending ? "Wird gemeldet..." : "Problem melden"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface TimelineViewProps {
  slots: TimeSlotWithOrder[];
  collapsedSlots: Set<string>;
  onToggleCollapse: (id: string) => void;
  onStart: (id: string) => void;
  onPause: (id: string) => void;
  onStop: (id: string) => void;
  onProblem: (id: string) => void;
  isStarting?: boolean;
  isPausing?: boolean;
  isStopping?: boolean;
}

function TimelineView({
  slots,
  collapsedSlots,
  onToggleCollapse,
  onStart,
  onPause,
  onStop,
  onProblem,
  isStarting = false,
  isPausing = false,
  isStopping = false,
}: TimelineViewProps) {
  const workStart = 7 * 60; // 07:00
  const workEnd = 18 * 60;   // 18:00
  const timeMarkers: number[] = [];
  
  for (let min = workStart; min <= workEnd; min += 30) {
    timeMarkers.push(min);
  }

  return (
    <div className="space-y-6">
      {/* Day boundaries */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground border-b pb-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-muted-foreground" />
          <span className="font-medium">Arbeitstag: 07:00 - 18:00</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Time markers */}
        <div className="absolute left-0 top-0 bottom-0 w-20 border-r border-border/50">
          {timeMarkers.map((min, idx) => (
            <div
              key={min}
              className="absolute left-0 right-0 flex items-center justify-end pr-3"
              style={{ top: `${(idx / (timeMarkers.length - 1)) * 100}%` }}
            >
              <span className="text-xs text-muted-foreground font-mono">
                {formatTime(min)}
              </span>
            </div>
          ))}
        </div>

        {/* Slots */}
        <div className="ml-24 space-y-2 min-h-[600px]">
          {slots.map(slot => (
            <TimeSlotRow
              key={slot.id}
              slot={slot}
              isCollapsed={collapsedSlots.has(slot.id)}
              onToggleCollapse={() => onToggleCollapse(slot.id)}
              onStart={onStart}
              onPause={onPause}
              onStop={onStop}
              onProblem={onProblem}
              isStarting={isStarting}
              isPausing={isPausing}
              isStopping={isStopping}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface TimeSlotRowProps {
  slot: TimeSlotWithOrder;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onStart: (id: string) => void;
  onPause: (id: string) => void;
  onStop: (id: string) => void;
  onProblem: (id: string) => void;
  isStarting?: boolean;
  isPausing?: boolean;
  isStopping?: boolean;
}

function TimeSlotRow({
  slot,
  isCollapsed,
  onToggleCollapse,
  onStart,
  onPause,
  onStop,
  onProblem,
  isStarting = false,
  isPausing = false,
  isStopping = false,
}: TimeSlotRowProps) {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showActions, setShowActions] = useState(false);

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
    <Card
      className={`
        ${isDone ? 'opacity-70' : ''}
        ${isRunning ? 'border-l-4 border-l-green-600' : ''}
        ${isBlocked ? 'border-l-4 border-l-red-600' : ''}
        ${isPaused ? 'border-l-4 border-l-yellow-600' : ''}
      `}
      data-testid={`card-slot-${slot.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {/* Time */}
              <span className="text-sm font-mono text-muted-foreground">
                {formatTime(slot.startMin)} - {formatTime(slot.startMin + slot.lengthMin)}
              </span>
              
              {/* Duration indicator */}
              <span className="text-xs text-muted-foreground">
                ({formatDuration(slot.lengthMin)})
              </span>

              {/* Status indicator - subtle */}
              {isRunning && (
                <Badge variant="secondary" className="text-xs">
                  Läuft
                </Badge>
              )}
              {isPaused && (
                <Badge variant="secondary" className="text-xs">
                  Pausiert
                </Badge>
              )}
              {isDone && (
                <Badge variant="secondary" className="text-xs">
                  Fertig
                </Badge>
              )}
            </div>

            {/* Order info */}
            <CardTitle className="text-base font-medium mb-1">
              {slot.order ? (
                <span>
                  {slot.order.displayOrderNumber && (
                    <span className="text-muted-foreground">{slot.order.displayOrderNumber} · </span>
                  )}
                  {slot.order.title}
                </span>
              ) : (
                <span className="text-muted-foreground italic">Blockiert</span>
              )}
            </CardTitle>

            {slot.order && (
              <div className="text-sm text-muted-foreground">
                {slot.order.customer}
              </div>
            )}

            {/* Work center - subtle */}
            <div className="text-xs text-muted-foreground mt-2">
              {slot.workCenter.name}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live timer for running slots */}
            {isRunning && (
              <div className="flex items-center gap-2 px-2 py-1 rounded bg-muted">
                <Clock className="h-3 w-3" />
                <span className="font-mono text-sm font-medium">
                  {formatDuration(elapsedMin)}
                </span>
              </div>
            )}

            {/* Action menu toggle */}
            {!isDone && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowActions(!showActions)}
                data-testid={`button-actions-${slot.id}`}
              >
                {showActions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}

            {isDone && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                data-testid={`button-toggle-${slot.id}`}
              >
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Expanded content */}
      {((!isDone && showActions) || (isDone && !isCollapsed)) && (
        <CardContent className="space-y-3 pt-0">
          {/* Additional info */}
          {slot.note && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Notiz:</span> {slot.note}
            </div>
          )}

          {slot.missingPartsNote && (
            <div className="p-2 rounded bg-muted text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" />
                <div>
                  <div className="font-medium mb-0.5">Problem:</div>
                  <div className="text-muted-foreground">{slot.missingPartsNote}</div>
                </div>
              </div>
            </div>
          )}

          {isDone && slot.actualDurationMin !== null && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Tatsächliche Dauer:</span> {formatDuration(slot.actualDurationMin)}
            </div>
          )}

          {/* Action buttons - only when expanded */}
          {!isDone && (
            <div className="flex items-center gap-2 pt-2">
              {slot.status === 'PLANNED' && (
                <Button
                  onClick={() => onStart(slot.id)}
                  variant="default"
                  size="sm"
                  disabled={isStarting}
                  data-testid={`button-start-${slot.id}`}
                >
                  <Play className="mr-2 h-4 w-4" />
                  {isStarting ? "Wird gestartet..." : "Starten"}
                </Button>
              )}

              {slot.status === 'RUNNING' && (
                <>
                  <Button
                    onClick={() => onPause(slot.id)}
                    variant="outline"
                    size="sm"
                    disabled={isPausing}
                    data-testid={`button-pause-${slot.id}`}
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    {isPausing ? "Wird pausiert..." : "Pausieren"}
                  </Button>
                  <Button
                    onClick={() => onStop(slot.id)}
                    variant="outline"
                    size="sm"
                    disabled={isStopping}
                    data-testid={`button-stop-${slot.id}`}
                  >
                    <Square className="mr-2 h-4 w-4" />
                    {isStopping ? "Wird beendet..." : "Beenden"}
                  </Button>
                  <Button
                    onClick={() => onProblem(slot.id)}
                    variant="outline"
                    size="sm"
                    data-testid={`button-problem-${slot.id}`}
                  >
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Problem
                  </Button>
                </>
              )}

              {slot.status === 'PAUSED' && (
                <>
                  <Button
                    onClick={() => onStart(slot.id)}
                    variant="default"
                    size="sm"
                    disabled={isStarting}
                    data-testid={`button-resume-${slot.id}`}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {isStarting ? "Wird fortgesetzt..." : "Fortsetzen"}
                  </Button>
                  <Button
                    onClick={() => onStop(slot.id)}
                    variant="outline"
                    size="sm"
                    disabled={isStopping}
                    data-testid={`button-stop-paused-${slot.id}`}
                  >
                    <Square className="mr-2 h-4 w-4" />
                    {isStopping ? "Wird beendet..." : "Beenden"}
                  </Button>
                  <Button
                    onClick={() => onProblem(slot.id)}
                    variant="outline"
                    size="sm"
                    data-testid={`button-problem-paused-${slot.id}`}
                  >
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Problem
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
