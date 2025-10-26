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

const WORKFLOW_BADGES: Record<WorkflowState, { label: string; class: string }> = {
  ENTWURF:          { label: "Entwurf",          class: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100" },
  NEU:              { label: "Neu",              class: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100" },
  PRUEFUNG:         { label: "Prüfung",          class: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100" },
  FUER_PROD:        { label: "Für Produktion",   class: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" },
  IN_PROD:          { label: "In Produktion",    class: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100" },
  WARTET_FEHLTEILE: { label: "Wartet Fehlteile", class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" },
  FERTIG:           { label: "Fertig",           class: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" },
  ZUR_ABRECHNUNG:   { label: "Zur Abrechnung",   class: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100" },
  ABGERECHNET:      { label: "Abgerechnet",      class: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100" },
};

const SLOT_BADGE: Record<string, string> = {
  PLANNED: "bg-slate-600 text-white",
  RUNNING: "bg-green-600 text-white",
  PAUSED:  "bg-yellow-600 text-white",
  DONE:    "bg-zinc-400 text-white dark:bg-zinc-600",
  BLOCKED: "bg-red-600 text-white",
};

const SLOT_LABEL: Record<string, string> = {
  PLANNED: "Geplant",
  RUNNING: "Läuft",
  PAUSED:  "Pausiert",
  DONE:    "Fertig",
  BLOCKED: "Blockiert",
};

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
  const [hideCompleted, setHideCompleted] = useState(false);
  const [collapsedSlots, setCollapsedSlots] = useState<Set<string>>(new Set());
  
  // Track previous slot statuses to detect transitions
  const previousStatusesRef = useRef<Map<string, string>>(new Map());
  
  // Problem Dialog State
  const [problemDialogOpen, setProblemDialogOpen] = useState(false);
  const [problemSlotId, setProblemSlotId] = useState<string | null>(null);
  const [problemReason, setProblemReason] = useState<ProblemReason>("FEHLTEILE");
  const [problemNote, setProblemNote] = useState("");
  const [updateWorkflow, setUpdateWorkflow] = useState(true);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch today's time slots
  const { data: slots = [], isLoading } = useQuery<TimeSlotWithOrder[]>({
    queryKey: ["/api/calendar", {
      startDate: today.toISOString(),
      endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      ...(selectedDepartment !== "all" && { department: selectedDepartment })
    }],
  });

  // Fetch work centers for department filter
  const { data: workCenters = [] } = useQuery<WorkCenterWithSlotCount[]>({
    queryKey: ["/api/workcenters"],
  });

  // Get unique departments
  const departments = Array.from(new Set(workCenters.map(wc => wc.department)));

  // Start mutation
  const startMutation = useMutation({
    mutationFn: async (slotId: string) => {
      await apiRequest("POST", `/api/timeslots/${slotId}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      toast({
        title: "Gestartet",
        description: "Arbeitsschritt wurde gestartet.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Konnte nicht gestartet werden.",
        variant: "destructive",
      });
    },
  });

  // Pause mutation
  const pauseMutation = useMutation({
    mutationFn: async (slotId: string) => {
      await apiRequest("POST", `/api/timeslots/${slotId}/pause`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      toast({
        title: "Pausiert",
        description: "Arbeitsschritt wurde pausiert.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Konnte nicht pausiert werden.",
        variant: "destructive",
      });
    },
  });

  // Stop mutation
  const stopMutation = useMutation({
    mutationFn: async (slotId: string) => {
      await apiRequest("POST", `/api/timeslots/${slotId}/stop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      toast({
        title: "Beendet",
        description: "Arbeitsschritt wurde beendet. Dauer wurde gespeichert.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Konnte nicht beendet werden.",
        variant: "destructive",
      });
    },
  });

  // Problem melden mutation
  const problemMutation = useMutation({
    mutationFn: async ({ slotId, note, updateWorkflow }: { slotId: string; note: string; updateWorkflow: boolean }) => {
      await apiRequest("POST", `/api/timeslots/${slotId}/missing-parts`, {
        note,
        updateOrderWorkflow: updateWorkflow,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      setProblemDialogOpen(false);
      setProblemSlotId(null);
      setProblemNote("");
      setProblemReason("FEHLTEILE");
      setUpdateWorkflow(true);
      toast({
        title: "Problem gemeldet",
        description: "Das Problem wurde erfolgreich gemeldet.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Problem konnte nicht gemeldet werden.",
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
    if (!problemSlotId || !problemNote.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie eine Notiz ein.",
        variant: "destructive",
      });
      return;
    }

    const fullNote = `${PROBLEM_REASONS[problemReason]}: ${problemNote}`;
    problemMutation.mutate({
      slotId: problemSlotId,
      note: fullNote,
      updateWorkflow,
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

  // Auto-collapse newly DONE slots (only on status transition, preserving user toggles)
  useEffect(() => {
    if (slots.length === 0) return;

    setCollapsedSlots(prev => {
      const newSet = new Set(prev);
      const previousStatuses = previousStatusesRef.current;

      slots.forEach(slot => {
        const prevStatus = previousStatuses.get(slot.id);
        
        // Auto-collapse if status is/became DONE (includes first load with undefined prevStatus)
        // This triggers on: initial load (undefined→DONE) and transitions (RUNNING/PAUSED→DONE)
        if (slot.status === 'DONE' && prevStatus !== 'DONE') {
          newSet.add(slot.id);
        }
        
        // Remove from collapsed if slot is no longer DONE
        if (slot.status !== 'DONE' && newSet.has(slot.id)) {
          newSet.delete(slot.id);
        }
        
        // Update status tracking
        previousStatuses.set(slot.id, slot.status);
      });

      // Clean up orphaned IDs from slots that no longer exist
      const currentSlotIds = new Set(slots.map(s => s.id));
      for (const [id] of previousStatuses) {
        if (!currentSlotIds.has(id)) {
          previousStatuses.delete(id);
        }
      }

      return newSet;
    });
  }, [slots]);

  // Filter slots
  let filteredSlots = slots;
  if (hideCompleted) {
    filteredSlots = filteredSlots.filter(s => s.status !== 'DONE');
  }

  // Sort: RUNNING first, then PAUSED, PLANNED, BLOCKED, DONE last
  const statusPriority: Record<string, number> = {
    RUNNING: 1,
    PAUSED: 2,
    PLANNED: 3,
    BLOCKED: 4,
    DONE: 5,
  };
  
  filteredSlots = [...filteredSlots].sort((a, b) => {
    const aPriority = statusPriority[a.status] || 99;
    const bPriority = statusPriority[b.status] || 99;
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    // Within same status, sort by startMin
    return a.startMin - b.startMin;
  });

  if (isLoading) {
    return (
      <div className="container max-w-7xl py-8">
        <div className="text-center py-12 text-muted-foreground">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Produktion heute</h1>
        <p className="text-muted-foreground">
          {today.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Filters */}
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

      {/* Time Slots */}
      {filteredSlots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Keine Arbeitsschritte für heute geplant.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredSlots.map(slot => (
            <TimeSlotCard
              key={slot.id}
              slot={slot}
              isCollapsed={collapsedSlots.has(slot.id)}
              onToggleCollapse={() => toggleCollapse(slot.id)}
              onStart={handleStart}
              onPause={handlePause}
              onStop={handleStop}
              onProblem={handleOpenProblemDialog}
            />
          ))}
        </div>
      )}

      {/* Problem Dialog */}
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
                <Label htmlFor="update-workflow" className="cursor-pointer text-sm">
                  Auftragsstatus auf "Wartet Fehlteile" setzen
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

interface TimeSlotCardProps {
  slot: TimeSlotWithOrder;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onStart: (id: string) => void;
  onPause: (id: string) => void;
  onStop: (id: string) => void;
  onProblem: (id: string) => void;
}

function TimeSlotCard({
  slot,
  isCollapsed,
  onToggleCollapse,
  onStart,
  onPause,
  onStop,
  onProblem,
}: TimeSlotCardProps) {
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update timer every second for RUNNING slots
  useEffect(() => {
    if (slot.status === 'RUNNING') {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [slot.status]);

  // Calculate elapsed time for RUNNING status
  let elapsedMin = 0;
  if (slot.status === 'RUNNING' && slot.startedAt) {
    const elapsedMs = currentTime - new Date(slot.startedAt).getTime();
    elapsedMin = Math.floor(elapsedMs / 60000);
  }

  const isDone = slot.status === 'DONE';
  const isBlocked = slot.status === 'BLOCKED';

  return (
    <Card
      className={`${isDone ? 'bg-muted/30 border-muted' : ''} ${isBlocked ? 'border-red-300 dark:border-red-700' : ''}`}
      data-testid={`card-slot-${slot.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <Badge className={SLOT_BADGE[slot.status]} data-testid={`badge-status-${slot.status}`}>
                {SLOT_LABEL[slot.status]}
              </Badge>
              
              {slot.status === 'PAUSED' && (
                <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700">
                  Pausiert
                </Badge>
              )}

              <span className="text-2xl font-bold">
                {formatTime(slot.startMin)} - {formatTime(slot.startMin + slot.lengthMin)}
              </span>
              
              <span className="text-sm text-muted-foreground">
                ({slot.lengthMin}min geplant)
              </span>
            </div>

            <CardTitle className="text-xl mb-1">
              {slot.order ? (
                <>
                  {slot.order.displayOrderNumber && (
                    <span className="text-primary">{slot.order.displayOrderNumber}</span>
                  )}
                  {slot.order.displayOrderNumber && ' - '}
                  {slot.order.title}
                </>
              ) : (
                <span className="text-muted-foreground italic">Kein Auftrag zugeordnet</span>
              )}
            </CardTitle>

            {slot.order && (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{slot.order.customer}</span>
                <span>•</span>
                <Badge className={WORKFLOW_BADGES[slot.order.workflow]?.class}>
                  {WORKFLOW_BADGES[slot.order.workflow]?.label}
                </Badge>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Live Timer for RUNNING */}
            {slot.status === 'RUNNING' && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <Clock className="h-4 w-4 text-green-600 dark:text-green-400 animate-pulse" />
                <span className="font-mono text-lg font-semibold text-green-700 dark:text-green-300">
                  {formatDuration(elapsedMin)}
                </span>
              </div>
            )}

            {/* Actual Duration for DONE */}
            {isDone && slot.actualDurationMin !== null && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Tatsächliche Dauer:</div>
                  <div className="font-mono text-base font-semibold text-blue-700 dark:text-blue-300">
                    {formatDuration(slot.actualDurationMin)}
                  </div>
                </div>
              </div>
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

      {(!isDone || !isCollapsed) && (
        <CardContent className="space-y-4">
          {/* Work Center */}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Bereich:</span>
            <span>{slot.workCenter.name}</span>
            <span className="text-muted-foreground">({slot.workCenter.department})</span>
          </div>

          {/* Notes */}
          {slot.note && (
            <div className="text-sm">
              <span className="font-medium">Notiz:</span> {slot.note}
            </div>
          )}

          {/* Missing Parts Note */}
          {slot.missingPartsNote && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-red-700 dark:text-red-300 mb-1">Problem:</div>
                  <div className="text-red-600 dark:text-red-400">{slot.missingPartsNote}</div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            {slot.status === 'PLANNED' && (
              <Button
                onClick={() => onStart(slot.id)}
                variant="default"
                data-testid={`button-start-${slot.id}`}
              >
                <Play className="mr-2 h-4 w-4" />
                Start
              </Button>
            )}

            {slot.status === 'RUNNING' && (
              <>
                <Button
                  onClick={() => onPause(slot.id)}
                  variant="outline"
                  data-testid={`button-pause-${slot.id}`}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
                <Button
                  onClick={() => onStop(slot.id)}
                  variant="default"
                  data-testid={`button-stop-${slot.id}`}
                >
                  <Square className="mr-2 h-4 w-4" />
                  Beenden
                </Button>
                <Button
                  onClick={() => onProblem(slot.id)}
                  variant="destructive"
                  data-testid={`button-problem-${slot.id}`}
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Problem melden
                </Button>
              </>
            )}

            {slot.status === 'PAUSED' && (
              <>
                <Button
                  onClick={() => onStart(slot.id)}
                  variant="default"
                  data-testid={`button-resume-${slot.id}`}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Fortsetzen
                </Button>
                <Button
                  onClick={() => onStop(slot.id)}
                  variant="outline"
                  data-testid={`button-stop-paused-${slot.id}`}
                >
                  <Square className="mr-2 h-4 w-4" />
                  Beenden
                </Button>
                <Button
                  onClick={() => onProblem(slot.id)}
                  variant="destructive"
                  data-testid={`button-problem-paused-${slot.id}`}
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Problem melden
                </Button>
              </>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
