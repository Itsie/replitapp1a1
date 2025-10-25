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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Play, Pause, Square, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WorkCenter, Department } from "@prisma/client";

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
    workflow: string;
    dueDate: Date | null;
  } | null;
}

interface WorkCenterWithSlotCount extends WorkCenter {
  slotsTodayCount: number;
}

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

function getStatusColor(status: string) {
  switch (status) {
    case 'PLANNED': return 'bg-slate-500';
    case 'RUNNING': return 'bg-green-500';
    case 'PAUSED': return 'bg-yellow-500';
    case 'DONE': return 'bg-blue-500';
    case 'BLOCKED': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'PLANNED': return 'Geplant';
    case 'RUNNING': return 'Läuft';
    case 'PAUSED': return 'Pausiert';
    case 'DONE': return 'Fertig';
    case 'BLOCKED': return 'Blockiert';
    default: return status;
  }
}

export default function ProductionToday() {
  const { toast } = useToast();
  const [selectedDepartment, setSelectedDepartment] = useState<Department | "ALL">("ALL");
  const [selectedWorkCenter, setSelectedWorkCenter] = useState<string>("ALL");
  const [qcDialogOpen, setQcDialogOpen] = useState(false);
  const [qcSlotId, setQcSlotId] = useState<string | null>(null);
  const [qcValue, setQcValue] = useState<"IO" | "NIO">("IO");
  const [qcNote, setQcNote] = useState("");
  const [missingPartsDialogOpen, setMissingPartsDialogOpen] = useState(false);
  const [missingPartsSlotId, setMissingPartsSlotId] = useState<string | null>(null);
  const [missingPartsNote, setMissingPartsNote] = useState("");
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
    if (selectedDepartment !== "ALL" && slot.order?.department !== selectedDepartment) {
      return false;
    }
    if (selectedWorkCenter !== "ALL" && slot.workCenterId !== selectedWorkCenter) {
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
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: [`/api/calendar?startDate=${today}&endDate=${today}`] });
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
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: [`/api/calendar?startDate=${today}&endDate=${today}`] });
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

  const qcMutation = useMutation({
    mutationFn: async ({ id, qc, note }: { id: string; qc: "IO" | "NIO"; note?: string }) => {
      const res = await apiRequest("POST", `/api/timeslots/${id}/qc`, { qc, note });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to set QC");
      }
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: [`/api/calendar?startDate=${today}&endDate=${today}`] });
      toast({ title: "QC gesetzt" });
      setQcDialogOpen(false);
      setQcSlotId(null);
      setQcNote("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Fehler beim Setzen der QC", 
        description: error.message || "Unbekannter Fehler",
        variant: "destructive" 
      });
    },
  });

  const missingPartsMutation = useMutation({
    mutationFn: async ({ id, note, updateOrderWorkflow }: { id: string; note: string; updateOrderWorkflow: boolean }) => {
      const res = await apiRequest("POST", `/api/timeslots/${id}/missing-parts`, { note, updateOrderWorkflow });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to report missing parts");
      }
      return await res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: [`/api/calendar?startDate=${today}&endDate=${today}`] });
      toast({ title: "Fehlteile gemeldet" });
      setMissingPartsDialogOpen(false);
      setMissingPartsSlotId(null);
      setMissingPartsNote("");
      setUpdateOrderWorkflow(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Fehler beim Melden der Fehlteile", 
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

  const handleOpenQC = (id: string) => {
    setQcSlotId(id);
    setQcDialogOpen(true);
  };

  const handleSubmitQC = () => {
    if (qcSlotId) {
      qcMutation.mutate({ id: qcSlotId, qc: qcValue, note: qcNote || undefined });
    }
  };

  const handleOpenMissingParts = (id: string) => {
    setMissingPartsSlotId(id);
    setMissingPartsDialogOpen(true);
  };

  const handleSubmitMissingParts = () => {
    if (missingPartsSlotId && missingPartsNote.trim()) {
      missingPartsMutation.mutate({ 
        id: missingPartsSlotId, 
        note: missingPartsNote, 
        updateOrderWorkflow 
      });
    }
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
          <div className="flex gap-4 flex-wrap">
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

            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="workcenter-filter" className="text-xs font-medium uppercase text-muted-foreground mb-2 block">
                Arbeitsplatz
              </Label>
              <Select value={selectedWorkCenter} onValueChange={setSelectedWorkCenter}>
                <SelectTrigger id="workcenter-filter" data-testid="select-workcenter-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Alle</SelectItem>
                  {workCenters
                    .filter(wc => selectedDepartment === "ALL" || wc.department === selectedDepartment)
                    .map(wc => (
                      <SelectItem key={wc.id} value={wc.id}>
                        {wc.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
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
            const workCenter = workCenters.find(wc => wc.id === slot.workCenterId);
            
            return (
              <Card key={slot.id} data-testid={`card-timeslot-${slot.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* Header */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge className={`${getStatusColor(slot.status)} text-white`} data-testid={`badge-status-${slot.id}`}>
                          {getStatusLabel(slot.status)}
                        </Badge>
                        <span className="text-sm font-medium" data-testid={`text-time-${slot.id}`}>
                          {formatTime(slot.startMin)} - {formatTime(slot.startMin + slot.lengthMin)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({slot.lengthMin} min)
                        </span>
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
                        Arbeitsplatz: {workCenter?.name || 'Unbekannt'}
                      </p>

                      {/* Timer for RUNNING slots */}
                      {slot.status === 'RUNNING' && slot.startedAt && (
                        <LiveTimer startTime={new Date(slot.startedAt)} slotId={slot.id} />
                      )}

                      {/* QC Badge */}
                      {slot.qc && (
                        <Badge variant={slot.qc === 'IO' ? 'default' : 'destructive'} className="text-xs">
                          QC: {slot.qc}
                        </Badge>
                      )}

                      {/* Missing Parts Note */}
                      {slot.missingPartsNote && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2">
                          <p className="text-xs font-medium">Fehlteile:</p>
                          <p className="text-xs text-muted-foreground">{slot.missingPartsNote}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {slot.order && (
                      <div className="flex flex-col gap-2">
                        {slot.status === 'PLANNED' && (
                          <Button 
                            size="sm" 
                            onClick={() => handleStart(slot.id)}
                            data-testid={`button-start-${slot.id}`}
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Start
                          </Button>
                        )}

                        {slot.status === 'RUNNING' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handlePause(slot.id)}
                              data-testid={`button-pause-${slot.id}`}
                            >
                              <Pause className="w-4 h-4 mr-1" />
                              Pause
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => handleStop(slot.id)}
                              data-testid={`button-stop-${slot.id}`}
                            >
                              <Square className="w-4 h-4 mr-1" />
                              Stop
                            </Button>
                          </>
                        )}

                        {slot.status === 'PAUSED' && (
                          <>
                            <Button 
                              size="sm"
                              onClick={() => handleStart(slot.id)}
                              data-testid={`button-resume-${slot.id}`}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Fortsetzen
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => handleStop(slot.id)}
                              data-testid={`button-stop-${slot.id}`}
                            >
                              <Square className="w-4 h-4 mr-1" />
                              Stop
                            </Button>
                          </>
                        )}

                        {slot.status === 'DONE' && !slot.qc && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleOpenQC(slot.id)}
                            data-testid={`button-qc-${slot.id}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            QC
                          </Button>
                        )}

                        {(slot.status === 'RUNNING' || slot.status === 'PAUSED') && (
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleOpenMissingParts(slot.id)}
                            data-testid={`button-missing-parts-${slot.id}`}
                          >
                            <AlertCircle className="w-4 h-4 mr-1" />
                            Fehlteile
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

      {/* QC Dialog */}
      <Dialog open={qcDialogOpen} onOpenChange={setQcDialogOpen}>
        <DialogContent data-testid="dialog-qc">
          <DialogHeader>
            <DialogTitle>Qualitätskontrolle</DialogTitle>
            <DialogDescription>
              Setzen Sie das QC-Ergebnis für diesen TimeSlot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium uppercase text-muted-foreground mb-3 block">
                QC Ergebnis
              </Label>
              <RadioGroup value={qcValue} onValueChange={(value) => setQcValue(value as "IO" | "NIO")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="IO" id="qc-io" data-testid="radio-qc-io" />
                  <Label htmlFor="qc-io" className="cursor-pointer">IO (In Ordnung)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="NIO" id="qc-nio" data-testid="radio-qc-nio" />
                  <Label htmlFor="qc-nio" className="cursor-pointer">NIO (Nicht in Ordnung)</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="qc-note" className="text-xs font-medium uppercase text-muted-foreground mb-2 block">
                Notiz (optional)
              </Label>
              <Textarea
                id="qc-note"
                value={qcNote}
                onChange={(e) => setQcNote(e.target.value)}
                placeholder="Zusätzliche Informationen..."
                rows={3}
                data-testid="textarea-qc-note"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQcDialogOpen(false)} data-testid="button-qc-cancel">
              Abbrechen
            </Button>
            <Button onClick={handleSubmitQC} data-testid="button-qc-submit">
              QC setzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Missing Parts Dialog */}
      <Dialog open={missingPartsDialogOpen} onOpenChange={setMissingPartsDialogOpen}>
        <DialogContent data-testid="dialog-missing-parts">
          <DialogHeader>
            <DialogTitle>Fehlteile melden</DialogTitle>
            <DialogDescription>
              Melden Sie fehlende Teile für diesen TimeSlot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="missing-parts-note" className="text-xs font-medium uppercase text-muted-foreground mb-2 block">
                Hinweis *
              </Label>
              <Textarea
                id="missing-parts-note"
                value={missingPartsNote}
                onChange={(e) => setMissingPartsNote(e.target.value)}
                placeholder="Beschreiben Sie die fehlenden Teile..."
                rows={4}
                data-testid="textarea-missing-parts-note"
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
                setMissingPartsDialogOpen(false);
                setMissingPartsNote("");
                setUpdateOrderWorkflow(false);
              }}
              data-testid="button-missing-parts-cancel"
            >
              Abbrechen
            </Button>
            <Button 
              onClick={handleSubmitMissingParts}
              disabled={!missingPartsNote.trim()}
              data-testid="button-missing-parts-submit"
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
