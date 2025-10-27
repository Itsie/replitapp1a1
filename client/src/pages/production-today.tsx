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
import { Play, Pause, Square, AlertCircle, Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Calendar, FileText, Download, Table2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WorkCenter, Department, WorkflowState } from "@prisma/client";
import { 
  WORKFLOW_LABELS, 
  DEPARTMENT_LABELS,
  getWorkflowBadgeClass,
  getDepartmentBadgeClass,
  getTimeSlotBadgeClass,
  TIMESLOT_STATUS_LABELS
} from "@shared/schema";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, addDays, subDays, startOfDay, isSameDay } from "date-fns";
import { de } from "date-fns/locale";

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

  const [problemDialogOpen, setProblemDialogOpen] = useState(false);
  const [problemSlotId, setProblemSlotId] = useState<string | null>(null);
  const [problemNote, setProblemNote] = useState("");
  const [problemReason, setProblemReason] = useState<ProblemReason>("FEHLTEILE");
  const [updateWorkflow, setUpdateWorkflow] = useState(true);
  
  // Order Detail Modal
  const [orderDetailModalOpen, setOrderDetailModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlotWithOrder | null>(null);

  const startMutation = useMutation({
    mutationFn: async (slotId: string) => {
      await apiRequest('POST', `/api/timeslots/${slotId}/start`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/timeslots');
        }
      });
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
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/timeslots');
        }
      });
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
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/timeslots');
        }
      });
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
        updateOrderWorkflow: escalate,
      });
    },
    onSuccess: () => {
      // Invalidate all timeslots queries (including those with date parameters)
      // Invalidate all timeslots queries (including those with date parameters)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/timeslots');
        }
      });
      // Invalidate all orders queries (including those with workflow parameters)
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/orders');
        }
      });
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
          onStart={handleStart}
          onPause={handlePause}
          onStop={handleStop}
          onProblem={handleOpenProblemDialog}
          onViewDetails={(slot) => {
            setSelectedSlot(slot);
            setOrderDetailModalOpen(true);
          }}
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

      {/* Order Detail Modal */}
      <Dialog open={orderDetailModalOpen} onOpenChange={setOrderDetailModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-order-detail">
          <DialogHeader>
            <DialogTitle>Auftragsdetails</DialogTitle>
            {selectedSlot?.order && (
              <DialogDescription>
                {selectedSlot.order.displayOrderNumber && `${selectedSlot.order.displayOrderNumber} · `}
                {selectedSlot.order.title}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedSlot && selectedSlot.order && (
            <div className="space-y-6">
              {/* Time Slot Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Termin</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Zeit:</span>
                    <span className="font-medium">
                      {formatTime(selectedSlot.startMin)} - {formatTime(selectedSlot.startMin + selectedSlot.lengthMin)}
                      {' '}({formatDuration(selectedSlot.lengthMin)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Arbeitsplatz:</span>
                    <span className="font-medium">{selectedSlot.workCenter.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${getTimeSlotBadgeClass(selectedSlot.status)}`}>
                      {TIMESLOT_STATUS_LABELS[selectedSlot.status as keyof typeof TIMESLOT_STATUS_LABELS] || selectedSlot.status}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Order Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Auftragsinformationen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kunde:</span>
                    <span className="font-medium">{selectedSlot.order.customer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Abteilung:</span>
                    <span className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${getDepartmentBadgeClass(selectedSlot.order.department)}`}>
                      {DEPARTMENT_LABELS[selectedSlot.order.department]}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Workflow:</span>
                    <span className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${getWorkflowBadgeClass(selectedSlot.order.workflow)}`}>
                      {WORKFLOW_LABELS[selectedSlot.order.workflow]}
                    </span>
                  </div>
                  {selectedSlot.order.dueDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fällig:</span>
                      <span className="font-medium">
                        {format(new Date(selectedSlot.order.dueDate), "dd.MM.yyyy", { locale: de })}
                      </span>
                    </div>
                  )}
                  {selectedSlot.order.notes && (
                    <div className="pt-2 border-t">
                      <span className="text-muted-foreground block mb-1">Notizen:</span>
                      <p className="text-sm">{selectedSlot.order.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Print Assets */}
              {selectedSlot.order.printAssets && selectedSlot.order.printAssets.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Druckdaten ({selectedSlot.order.printAssets.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedSlot.order.printAssets.map((asset) => (
                        <a
                          key={asset.id}
                          href={asset.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 rounded-lg border hover-elevate active-elevate-2"
                          data-testid={`asset-link-${asset.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <Download className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{asset.label}</p>
                              {asset.required && (
                                <p className="text-xs text-red-600">Erforderlich</p>
                              )}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            Öffnen
                          </Button>
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Size Table */}
              {selectedSlot.order.sizeTable && selectedSlot.order.sizeTable.rowsJson.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Table2 className="h-4 w-4" />
                      Größentabelle
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            {selectedSlot.order.sizeTable.scheme === 'roster' ? (
                              <>
                                <th className="text-left p-2 font-medium">Nr.</th>
                                <th className="text-left p-2 font-medium">Name</th>
                                <th className="text-left p-2 font-medium">Größe</th>
                              </>
                            ) : selectedSlot.order.sizeTable.scheme === 'simple' ? (
                              <>
                                <th className="text-left p-2 font-medium">Größe</th>
                                <th className="text-right p-2 font-medium">Anzahl</th>
                              </>
                            ) : (
                              <>
                                <th className="text-left p-2 font-medium">Größe</th>
                                <th className="text-left p-2 font-medium">Farbe</th>
                                <th className="text-right p-2 font-medium">Anzahl</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSlot.order.sizeTable.rowsJson.map((row: any, idx: number) => (
                            <tr key={idx} className="border-t">
                              {selectedSlot.order?.sizeTable?.scheme === 'roster' ? (
                                <>
                                  <td className="p-2">{row.number}</td>
                                  <td className="p-2">{row.name || '—'}</td>
                                  <td className="p-2 font-medium">{row.size}</td>
                                </>
                              ) : selectedSlot.order?.sizeTable?.scheme === 'simple' ? (
                                <>
                                  <td className="p-2">{row.size}</td>
                                  <td className="text-right p-2 font-medium">{row.quantity}</td>
                                </>
                              ) : (
                                <>
                                  <td className="p-2">{row.size}</td>
                                  <td className="p-2">{row.color}</td>
                                  <td className="text-right p-2 font-medium">{row.quantity}</td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {selectedSlot.order.sizeTable.comment && (
                      <p className="text-sm text-muted-foreground mt-3">
                        {selectedSlot.order.sizeTable.comment}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Positions */}
              {selectedSlot.order.positions && selectedSlot.order.positions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Positionen ({selectedSlot.order.positions.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedSlot.order.positions.map((pos) => (
                        <div
                          key={pos.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                          data-testid={`position-detail-${pos.id}`}
                        >
                          <div>
                            <p className="font-medium text-sm">{pos.articleName}</p>
                            {pos.articleNumber && (
                              <p className="text-xs text-muted-foreground">Art.-Nr.: {pos.articleNumber}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">
                              {pos.qty} {pos.unit}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {Number(pos.unitPriceNet).toFixed(2)} €
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Control Buttons */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Aktionen</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {selectedSlot.status === 'PLANNED' && (
                      <Button
                        onClick={() => {
                          handleStart(selectedSlot.id);
                          setOrderDetailModalOpen(false);
                        }}
                        data-testid="modal-button-start"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Starten
                      </Button>
                    )}

                    {selectedSlot.status === 'RUNNING' && (
                      <>
                        <Button
                          onClick={() => {
                            handlePause(selectedSlot.id);
                            setOrderDetailModalOpen(false);
                          }}
                          variant="outline"
                          data-testid="modal-button-pause"
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Pause
                        </Button>
                        <Button
                          onClick={() => {
                            handleStop(selectedSlot.id);
                            setOrderDetailModalOpen(false);
                          }}
                          variant="outline"
                          data-testid="modal-button-stop"
                        >
                          <Square className="mr-2 h-4 w-4" />
                          Stop
                        </Button>
                        <Button
                          onClick={() => {
                            setProblemSlotId(selectedSlot.id);
                            setProblemDialogOpen(true);
                            setOrderDetailModalOpen(false);
                          }}
                          variant="destructive"
                          data-testid="modal-button-problem"
                        >
                          <AlertCircle className="mr-2 h-4 w-4" />
                          Problem melden
                        </Button>
                      </>
                    )}

                    {selectedSlot.status === 'PAUSED' && (
                      <>
                        <Button
                          onClick={() => {
                            handleStart(selectedSlot.id);
                            setOrderDetailModalOpen(false);
                          }}
                          data-testid="modal-button-resume"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Fortsetzen
                        </Button>
                        <Button
                          onClick={() => {
                            handleStop(selectedSlot.id);
                            setOrderDetailModalOpen(false);
                          }}
                          variant="outline"
                          data-testid="modal-button-stop-paused"
                        >
                          <Square className="mr-2 h-4 w-4" />
                          Stop
                        </Button>
                        <Button
                          onClick={() => {
                            setProblemSlotId(selectedSlot.id);
                            setProblemDialogOpen(true);
                            setOrderDetailModalOpen(false);
                          }}
                          variant="destructive"
                          data-testid="modal-button-problem-paused"
                        >
                          <AlertCircle className="mr-2 h-4 w-4" />
                          Problem melden
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOrderDetailModalOpen(false)}
              data-testid="button-close-detail"
            >
              Schließen
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
  onViewDetails: (slot: TimeSlotWithOrder) => void;
  isStarting?: boolean;
  isPausing?: boolean;
  isStopping?: boolean;
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
  onStart,
  onPause,
  onStop,
  onProblem,
  onViewDetails,
  isStarting = false,
  isPausing = false,
  isStopping = false,
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
                  onStart={onStart}
                  onPause={onPause}
                  onStop={onStop}
                  onProblem={onProblem}
                  onViewDetails={() => onViewDetails(slot)}
                  isStarting={isStarting}
                  isPausing={isPausing}
                  isStopping={isStopping}
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
  onStart: (id: string) => void;
  onPause: (id: string) => void;
  onStop: (id: string) => void;
  onProblem: (id: string) => void;
  onViewDetails: () => void;
  isStarting?: boolean;
  isPausing?: boolean;
  isStopping?: boolean;
}

function TimeSlotRow({
  slot,
  slotHeight,
  isCollapsed,
  onToggleCollapse,
  onStart,
  onPause,
  onStop,
  onProblem,
  onViewDetails,
  isStarting = false,
  isPausing = false,
  isStopping = false,
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

          {/* Action buttons - compact or full size */}
          {!isDone && (
            <div className={`flex items-center gap-1.5 pt-1 flex-wrap ${isCompact ? 'justify-center' : ''}`}>
              {slot.status === 'PLANNED' && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStart(slot.id);
                  }}
                  size="sm"
                  disabled={isStarting}
                  data-testid={`button-start-${slot.id}`}
                  className="h-7 text-xs"
                >
                  <Play className="mr-1 h-3 w-3" />
                  {isStarting ? "Startet..." : "Starten"}
                </Button>
              )}

              {slot.status === 'RUNNING' && (
                <>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPause(slot.id);
                    }}
                    variant="outline"
                    size="sm"
                    disabled={isPausing}
                    data-testid={`button-pause-${slot.id}`}
                    className="h-7 text-xs"
                  >
                    <Pause className="mr-1 h-3 w-3" />
                    {isPausing ? "Pausiert..." : "Pause"}
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStop(slot.id);
                    }}
                    variant="outline"
                    size="sm"
                    disabled={isStopping}
                    data-testid={`button-stop-${slot.id}`}
                    className="h-7 text-xs"
                  >
                    <Square className="mr-1 h-3 w-3" />
                    {isStopping ? "Stoppt..." : "Stop"}
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onProblem(slot.id);
                    }}
                    variant="outline"
                    size="sm"
                    data-testid={`button-problem-${slot.id}`}
                    className="h-7 text-xs"
                  >
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Problem
                  </Button>
                </>
              )}

              {slot.status === 'PAUSED' && (
                <>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStart(slot.id);
                    }}
                    size="sm"
                    disabled={isStarting}
                    data-testid={`button-resume-${slot.id}`}
                    className="h-7 text-xs"
                  >
                    <Play className="mr-1 h-3 w-3" />
                    {isStarting ? "Fortsetzt..." : "Weiter"}
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStop(slot.id);
                    }}
                    variant="outline"
                    size="sm"
                    disabled={isStopping}
                    data-testid={`button-stop-paused-${slot.id}`}
                    className="h-7 text-xs"
                  >
                    <Square className="mr-1 h-3 w-3" />
                    {isStopping ? "Stoppt..." : "Stop"}
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onProblem(slot.id);
                    }}
                    variant="outline"
                    size="sm"
                    data-testid={`button-problem-paused-${slot.id}`}
                    className="h-7 text-xs"
                  >
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Problem
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
