import { useState, useEffect } from "react";
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
import { 
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Pause, Square, AlertCircle, Clock, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { WORKFLOW_LABELS, getWorkflowBadgeColor } from "@shared/schema";
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
  qc: string | null;
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

type ProblemReason = "MATERIAL" | "MACHINE" | "OTHER";

// Workflow Badge Mapping
const WORKFLOW_BADGES = {
  ENTWURF:         { label: "Entwurf",          class: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100" },
  NEU:             { label: "Neu",              class: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100" },
  PRUEFUNG:        { label: "Prüfung",          class: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100" },
  FUER_PROD:       { label: "Für Produktion",   class: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" },
  IN_PROD:         { label: "In Produktion",    class: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100" },
  WARTET_FEHLTEILE:{ label: "Wartet Fehlteile", class: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" },
  FERTIG:          { label: "Fertig",           class: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" },
  ZUR_ABRECHNUNG:  { label: "Zur Abrechnung",   class: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100" },
  ABGERECHNET:     { label: "Abgerechnet",      class: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100" },
};

// TimeSlot Status Badge Mapping
const SLOT_BADGE = {
  PLANNED: "bg-slate-600 text-white",
  RUNNING: "bg-green-600 text-white",
  PAUSED:  "bg-yellow-600 text-white",
  DONE:    "bg-blue-600 text-white",
  BLOCKED: "bg-red-600 text-white",
};

const SLOT_LABEL = {
  PLANNED: "Geplant",
  RUNNING: "Läuft",
  PAUSED:  "Pausiert",
  DONE:    "Fertig",
  BLOCKED: "Blockiert",
};

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getProblemReasonLabel(reason: ProblemReason): string {
  switch (reason) {
    case "MATERIAL": return "Fehlteil";
    case "MACHINE": return "Maschine defekt";
    case "OTHER": return "Sonstiges";
  }
}

export default function ProductionToday() {
  const { toast } = useToast();
  const [selectedDepartment, setSelectedDepartment] = useState<Department | "ALL">("ALL");
  const [showCompleted, setShowCompleted] = useState(false);
  const [problemDialogOpen, setProblemDialogOpen] = useState(false);
  const [problemSlotId, setProblemSlotId] = useState<string | null>(null);
  const [problemReason, setProblemReason] = useState<ProblemReason>("MATERIAL");
  const [problemNote, setProblemNote] = useState("");
  const [updateOrderWorkflow, setUpdateOrderWorkflow] = useState(false);

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];

  // Fetch work centers
  const { data: workCenters = [] } = useQuery<WorkCenterWithSlotCount[]>({
    queryKey: ['/api/workcenters?active=true'],
  });

  // Fetch today's time slots
  const { data: timeSlots = [], isLoading } = useQuery<TimeSlotWithOrder[]>({
    queryKey: [`/api/calendar?startDate=${today}&endDate=${today}`],
  });

  // Filter time slots
  const filteredSlots = timeSlots.filter(slot => {
    // Filter by department
    if (selectedDepartment !== "ALL" && slot.order?.department !== selectedDepartment) {
      return false;
    }
    // Filter out DONE slots unless showCompleted is enabled
    if (!showCompleted && slot.status === "DONE") {
      return false;
    }
    return true;
  });

  // Mutations
  const startMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/timeslots/${id}/start`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to start");
      }
      return await res.json();
    },
    onSuccess: async (data) => {
      // Update order workflow to IN_PROD
      if (data.orderId) {
        await apiRequest("PATCH", `/api/orders/${data.orderId}`, { workflow: "IN_PROD" });
      }
      await queryClient.refetchQueries({ queryKey: [`/api/calendar?startDate=${today}&endDate=${today}`] });
      await queryClient.refetchQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/orders');
      }});
      toast({ title: "TimeSlot gestartet" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Fehler beim Starten", 
        description: error.message || "Unbekannter Fehler",
        variant: "destructive" 
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/timeslots/${id}/pause`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to pause");
      }
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: [`/api/calendar?startDate=${today}&endDate=${today}`] });
      toast({ title: "TimeSlot pausiert" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Fehler beim Pausieren", 
        description: error.message || "Unbekannter Fehler",
        variant: "destructive" 
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/timeslots/${id}/stop`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to stop");
      }
      return await res.json();
    },
    onSuccess: async (data) => {
      // Update order workflow to FERTIG
      if (data.orderId) {
        await apiRequest("PATCH", `/api/orders/${data.orderId}`, { workflow: "FERTIG" });
      }
      await queryClient.refetchQueries({ queryKey: [`/api/calendar?startDate=${today}&endDate=${today}`] });
      await queryClient.refetchQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/orders');
      }});
      toast({ title: "TimeSlot beendet" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Fehler beim Beenden", 
        description: error.message || "Unbekannter Fehler",
        variant: "destructive" 
      });
    },
  });

  const problemMutation = useMutation({
    mutationFn: async ({ id, reason, note, updateOrderWorkflow }: { id: string; reason: ProblemReason; note: string; updateOrderWorkflow: boolean }) => {
      const res = await apiRequest("POST", `/api/timeslots/${id}/missing-parts`, { 
        note: `[${getProblemReasonLabel(reason)}] ${note}`, 
        updateOrderWorkflow 
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to report problem");
      }
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: [`/api/calendar?startDate=${today}&endDate=${today}`] });
      await queryClient.refetchQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/orders');
      }});
      toast({ title: "Problem gemeldet" });
      setProblemDialogOpen(false);
      setProblemSlotId(null);
      setProblemNote("");
      setProblemReason("MATERIAL");
      setUpdateOrderWorkflow(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Fehler beim Melden des Problems", 
        description: error.message || "Unbekannter Fehler",
        variant: "destructive" 
      });
    },
  });

  const handOverMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}`, { workflow: "ZUR_ABRECHNUNG" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to hand over");
      }
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: [`/api/calendar?startDate=${today}&endDate=${today}`] });
      await queryClient.refetchQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/orders');
      }});
      toast({ title: "An Kunden ausgegeben" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Fehler bei der Ausgabe", 
        description: error.message || "Unbekannter Fehler",
        variant: "destructive" 
      });
    },
  });

  const handleStart = (id: string) => {
    startMutation.mutate(id);
  };

  const handlePause = (id: string) => {
    pauseMutation.mutate(id);
  };

  const handleStop = (id: string) => {
    stopMutation.mutate(id);
  };

  const handleOpenProblem = (id: string) => {
    setProblemSlotId(id);
    setProblemDialogOpen(true);
  };

  const handleSubmitProblem = () => {
    if (problemSlotId && problemNote.trim()) {
      problemMutation.mutate({ 
        id: problemSlotId, 
        reason: problemReason,
        note: problemNote, 
        updateOrderWorkflow 
      });
    }
  };

  const handleHandOver = (orderId: string) => {
    handOverMutation.mutate(orderId);
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-page-title">
          Produktion heute
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Heutige Produktionsaufträge und Fortschritt
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="department-filter" className="text-xs font-medium uppercase text-muted-foreground mb-2 block">
                Abteilung
              </Label>
              <Select value={selectedDepartment} onValueChange={(value) => setSelectedDepartment(value as Department | "ALL")}>
                <SelectTrigger id="department-filter" data-testid="select-department-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Alle</SelectItem>
                  <SelectItem value="TEAMSPORT">Teamsport</SelectItem>
                  <SelectItem value="TEXTILVEREDELUNG">Textilveredelung</SelectItem>
                  <SelectItem value="STICKEREI">Stickerei</SelectItem>
                  <SelectItem value="DRUCK">Druck</SelectItem>
                  <SelectItem value="SONSTIGES">Sonstiges</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="show-completed" 
                checked={showCompleted} 
                onCheckedChange={(checked) => setShowCompleted(!!checked)}
                data-testid="checkbox-show-completed"
              />
              <Label htmlFor="show-completed" className="text-sm font-normal cursor-pointer">
                Fertige anzeigen
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time Slots */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-sm" data-testid="text-loading">Lade Daten...</p>
          </CardContent>
        </Card>
      ) : filteredSlots.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-sm" data-testid="text-no-slots">
              Keine TimeSlots für heute gefunden.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredSlots.map(slot => {
            return (
              <Card key={slot.id} data-testid={`card-timeslot-${slot.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* Time - Prominent */}
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold tracking-tight" data-testid={`text-time-${slot.id}`}>
                          {formatTime(slot.startMin)}–{formatTime(slot.startMin + slot.lengthMin)}
                        </span>
                        <span className="text-xs text-muted-foreground">({slot.lengthMin} min)</span>
                      </div>

                      {/* Timer for RUNNING slots */}
                      {slot.status === 'RUNNING' && slot.startedAt && (
                        <LiveTimer startTime={new Date(slot.startedAt)} slotId={slot.id} />
                      )}

                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={SLOT_BADGE[slot.status as keyof typeof SLOT_BADGE] || SLOT_BADGE.PLANNED} data-testid={`badge-status-${slot.id}`}>
                          {SLOT_LABEL[slot.status as keyof typeof SLOT_LABEL] || slot.status}
                        </Badge>
                        {slot.order && (
                          <Badge variant="outline" className={WORKFLOW_BADGES[slot.order.workflow as keyof typeof WORKFLOW_BADGES]?.class || ""}>
                            {WORKFLOW_BADGES[slot.order.workflow as keyof typeof WORKFLOW_BADGES]?.label || slot.order.workflow}
                          </Badge>
                        )}
                      </div>

                      {/* Order Info */}
                      {slot.order ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-medium" data-testid={`text-order-number-${slot.id}`}>
                              {slot.order.displayOrderNumber || slot.order.id}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {slot.order.department}
                            </Badge>
                          </div>
                          <p className="text-sm" data-testid={`text-order-title-${slot.id}`}>
                            {slot.order.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {slot.order.customer}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {slot.blocked ? 'Blockiert' : 'Kein Auftrag zugeordnet'}
                        </p>
                      )}

                      {/* WorkCenter */}
                      <p className="text-xs text-muted-foreground">
                        Bereich: {slot.workCenter.name}
                      </p>

                      {/* Missing Parts Note */}
                      {slot.missingPartsNote && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2">
                          <p className="text-xs font-medium">Problem:</p>
                          <p className="text-xs text-muted-foreground">{slot.missingPartsNote}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {slot.order && (
                      <div className="flex flex-col gap-2">
                        {/* Start/Resume Button */}
                        {(slot.status === 'PLANNED' || slot.status === 'PAUSED') && (
                          <Button 
                            size="sm" 
                            onClick={() => handleStart(slot.id)}
                            data-testid={slot.status === 'PAUSED' ? `button-resume-${slot.id}` : `button-start-${slot.id}`}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            {slot.status === 'PAUSED' ? 'Fortsetzen' : 'Start'}
                          </Button>
                        )}

                        {/* Pause Button */}
                        {slot.status === 'RUNNING' && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handlePause(slot.id)}
                            data-testid={`button-pause-${slot.id}`}
                          >
                            <Pause className="w-4 h-4 mr-1" />
                            Pause
                          </Button>
                        )}

                        {/* Stop Button with Tooltip */}
                        {(slot.status === 'RUNNING' || slot.status === 'PAUSED') ? (
                          <Button 
                            size="sm"
                            onClick={() => handleStop(slot.id)}
                            data-testid={`button-stop-${slot.id}`}
                          >
                            <Square className="w-4 h-4 mr-1" />
                            Beenden
                          </Button>
                        ) : slot.status !== 'DONE' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button 
                                  size="sm"
                                  disabled
                                  data-testid={`button-stop-${slot.id}`}
                                >
                                  <Square className="w-4 h-4 mr-1" />
                                  Beenden
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Kann nur beendet werden, wenn gestartet oder pausiert.
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {/* Hand Over Button */}
                        {slot.status === 'DONE' && slot.order.workflow === 'FERTIG' && (
                          <Button 
                            size="sm"
                            onClick={() => handleHandOver(slot.order!.id)}
                            data-testid={`button-handover-${slot.id}`}
                          >
                            <Package className="w-4 h-4 mr-1" />
                            An Kunden ausgegeben
                          </Button>
                        )}

                        {/* Problem Button */}
                        {(slot.status === 'RUNNING' || slot.status === 'PAUSED') && (
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleOpenProblem(slot.id)}
                            data-testid={`button-problem-${slot.id}`}
                          >
                            <AlertCircle className="w-4 h-4 mr-1" />
                            Problem melden
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Problem Dialog */}
      <Dialog open={problemDialogOpen} onOpenChange={setProblemDialogOpen}>
        <DialogContent data-testid="dialog-problem">
          <DialogHeader>
            <DialogTitle>Problem melden</DialogTitle>
            <DialogDescription>
              Melden Sie ein Problem für diesen TimeSlot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium uppercase text-muted-foreground mb-3 block">
                Grund
              </Label>
              <RadioGroup value={problemReason} onValueChange={(value) => setProblemReason(value as ProblemReason)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="MATERIAL" id="reason-material" data-testid="radio-reason-material" />
                  <Label htmlFor="reason-material" className="cursor-pointer">Fehlteil</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="MACHINE" id="reason-machine" data-testid="radio-reason-machine" />
                  <Label htmlFor="reason-machine" className="cursor-pointer">Maschine defekt</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="OTHER" id="reason-other" data-testid="radio-reason-other" />
                  <Label htmlFor="reason-other" className="cursor-pointer">Sonstiges</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="problem-note" className="text-xs font-medium uppercase text-muted-foreground mb-2 block">
                Kommentar *
              </Label>
              <Textarea
                id="problem-note"
                value={problemNote}
                onChange={(e) => setProblemNote(e.target.value)}
                placeholder="Beschreiben Sie das Problem..."
                rows={4}
                data-testid="textarea-problem-note"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="update-workflow"
                checked={updateOrderWorkflow}
                onCheckedChange={(checked) => setUpdateOrderWorkflow(checked === true)}
                data-testid="checkbox-update-workflow"
              />
              <Label htmlFor="update-workflow" className="cursor-pointer text-sm">
                Auftragsstatus auf "Wartet Fehlteile" setzen
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setProblemDialogOpen(false);
                setProblemNote("");
                setProblemReason("MATERIAL");
                setUpdateOrderWorkflow(false);
              }}
              data-testid="button-problem-cancel"
            >
              Abbrechen
            </Button>
            <Button 
              onClick={handleSubmitProblem}
              disabled={!problemNote.trim()}
              data-testid="button-problem-submit"
            >
              Melden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Live Timer Component
function LiveTimer({ startTime, slotId }: { startTime: Date; slotId: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const start = new Date(startTime).getTime();
      setElapsed(now - start);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400" data-testid={`timer-${slotId}`}>
      <Clock className="w-4 h-4" />
      <span>{formatDuration(elapsed)}</span>
    </div>
  );
}
