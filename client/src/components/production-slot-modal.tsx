import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Play,
  Pause,
  Square,
  AlertCircle,
  ChevronDown,
  FileText,
  Download,
  Table2,
  Package,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  WORKFLOW_LABELS,
  DEPARTMENT_LABELS,
  getWorkflowBadgeClass,
  getDepartmentBadgeClass,
  getTimeSlotBadgeClass,
  TIMESLOT_STATUS_LABELS,
} from "@shared/schema";
import type { Department, WorkflowState } from "@prisma/client";

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
    orderAssets?: Array<{
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

interface ProductionSlotModalProps {
  isOpen: boolean;
  slot: TimeSlotWithOrder | null;
  onClose: () => void;
}

type ProblemType = "missing_parts" | "quality";
type ProblemReason = "FEHLTEILE" | "MASCHINE" | "SONSTIGES";

const PROBLEM_REASONS: Record<ProblemReason, string> = {
  FEHLTEILE: "Fehlteile",
  MASCHINE: "Maschine defekt",
  SONSTIGES: "Sonstiges",
};

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${mins}min`;
}

export function ProductionSlotModal({
  isOpen,
  slot,
  onClose,
}: ProductionSlotModalProps) {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [problemDialogOpen, setProblemDialogOpen] = useState(false);
  const [problemType, setProblemType] = useState<ProblemType>("missing_parts");
  const [problemReason, setProblemReason] = useState<ProblemReason>("FEHLTEILE");
  const [problemNote, setProblemNote] = useState("");
  const [updateWorkflow, setUpdateWorkflow] = useState(true);

  // Timer for running slots
  useEffect(() => {
    if (slot?.status === "RUNNING") {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [slot?.status]);

  // Calculate elapsed time
  let elapsedMin = 0;
  if (slot?.status === "RUNNING" && slot.startedAt) {
    const elapsedMs = currentTime - new Date(slot.startedAt).getTime();
    elapsedMin = Math.floor(elapsedMs / 60000);
  }

  // Mutations
  const startMutation = useMutation({
    mutationFn: async (slotId: string) => {
      await apiRequest("POST", `/api/timeslots/${slotId}/start`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/timeslots");
        },
      });
      toast({
        title: "Erfolgreich",
        description: "Arbeitsschritt gestartet",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description:
          error.message || "Arbeitsschritt konnte nicht gestartet werden",
        variant: "destructive",
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (slotId: string) => {
      await apiRequest("POST", `/api/timeslots/${slotId}/pause`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/timeslots");
        },
      });
      toast({
        title: "Erfolgreich",
        description: "Arbeitsschritt pausiert",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description:
          error.message || "Arbeitsschritt konnte nicht pausiert werden",
        variant: "destructive",
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async (slotId: string) => {
      await apiRequest("POST", `/api/timeslots/${slotId}/stop`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/timeslots");
        },
      });
      toast({
        title: "Erfolgreich",
        description: "Arbeitsschritt beendet",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description:
          error.message || "Arbeitsschritt konnte nicht beendet werden",
        variant: "destructive",
      });
    },
  });

  const problemMutation = useMutation({
    mutationFn: async ({
      slotId,
      note,
      escalate,
    }: {
      slotId: string;
      note: string;
      escalate: boolean;
    }) => {
      if (problemType === "missing_parts") {
        await apiRequest("POST", `/api/timeslots/${slotId}/missing-parts`, {
          note,
          updateOrderWorkflow: escalate,
        });
      } else {
        await apiRequest("POST", `/api/timeslots/${slotId}/qc-fail`, {
          note,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/timeslots");
        },
      });
      toast({
        title: "Erfolgreich",
        description: "Problem gemeldet",
      });
      setProblemDialogOpen(false);
      setProblemNote("");
      setProblemReason("FEHLTEILE");
      setUpdateWorkflow(true);
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Fehler",
        description: error.message || "Problem konnte nicht gemeldet werden",
        variant: "destructive",
      });
    },
  });

  const handleStart = () => {
    if (slot) {
      startMutation.mutate(slot.id);
    }
  };

  const handlePause = () => {
    if (slot) {
      pauseMutation.mutate(slot.id);
    }
  };

  const handleStop = () => {
    if (slot) {
      stopMutation.mutate(slot.id);
    }
  };

  const handleProblem = (type: ProblemType) => {
    setProblemType(type);
    setProblemDialogOpen(true);
  };

  const handleSubmitProblem = () => {
    if (slot && problemNote.trim()) {
      problemMutation.mutate({
        slotId: slot.id,
        note: problemNote,
        escalate: updateWorkflow && problemReason === "FEHLTEILE",
      });
    }
  };

  if (!slot || !slot.order) {
    return null;
  }

  const order = slot.order;
  const allAssets = [...(order.printAssets || []), ...(order.orderAssets || [])];

  return (
    <>
      <Dialog open={isOpen && !problemDialogOpen} onOpenChange={onClose}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          data-testid="dialog-production-slot"
        >
          <DialogHeader>
            <DialogTitle>Produktionsdetails</DialogTitle>
            <DialogDescription>
              {order.displayOrderNumber && `${order.displayOrderNumber} · `}
              {order.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Time Slot Info Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      ZEIT
                    </Label>
                    <p className="font-medium">
                      {formatTime(slot.startMin)} -{" "}
                      {formatTime(slot.startMin + slot.lengthMin)} (
                      {formatDuration(slot.lengthMin)})
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      ARBEITSPLATZ
                    </Label>
                    <p className="font-medium">{slot.workCenter.name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      STATUS
                    </Label>
                    <div>
                      <span
                        className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${getTimeSlotBadgeClass(
                          slot.status
                        )}`}
                      >
                        {TIMESLOT_STATUS_LABELS[
                          slot.status as keyof typeof TIMESLOT_STATUS_LABELS
                        ] || slot.status}
                      </span>
                    </div>
                  </div>
                  {slot.status === "RUNNING" && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 inline mr-1" />
                        LAUFZEIT
                      </Label>
                      <p className="font-medium text-green-600">
                        {formatDuration(elapsedMin)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tabs with Order Details */}
            <Tabs defaultValue="positions" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="positions" data-testid="tab-positions">
                  Positionen
                </TabsTrigger>
                <TabsTrigger value="assets" data-testid="tab-assets">
                  Druckdaten
                </TabsTrigger>
                <TabsTrigger value="sizes" data-testid="tab-sizes">
                  Größentabelle
                </TabsTrigger>
                <TabsTrigger value="notes" data-testid="tab-notes">
                  Notizen
                </TabsTrigger>
              </TabsList>

              {/* Positions Tab */}
              <TabsContent value="positions" className="mt-4">
                {order.positions && order.positions.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Positionen ({order.positions.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {order.positions.map((pos) => (
                          <div
                            key={pos.id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                            data-testid={`position-${pos.id}`}
                          >
                            <div>
                              <p className="font-medium text-sm">
                                {pos.articleName}
                              </p>
                              {pos.articleNumber && (
                                <p className="text-xs text-muted-foreground">
                                  Art.-Nr.: {pos.articleNumber}
                                </p>
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
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Keine Positionen vorhanden
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Print Assets Tab */}
              <TabsContent value="assets" className="mt-4">
                {allAssets.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Druckdaten ({allAssets.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {allAssets.map((asset) => (
                          <a
                            key={asset.id}
                            href={asset.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-3 rounded-lg border hover-elevate active-elevate-2"
                            data-testid={`asset-${asset.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <Download className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium text-sm">
                                  {asset.label}
                                </p>
                                {asset.required && (
                                  <p className="text-xs text-red-600">
                                    Erforderlich
                                  </p>
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
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Keine Druckdaten vorhanden
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Size Table Tab */}
              <TabsContent value="sizes" className="mt-4">
                {order.sizeTable && order.sizeTable.rowsJson.length > 0 ? (
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
                              {order.sizeTable.scheme === "roster" ? (
                                <>
                                  <th className="text-left p-2 font-medium">
                                    Nr.
                                  </th>
                                  <th className="text-left p-2 font-medium">
                                    Name
                                  </th>
                                  <th className="text-left p-2 font-medium">
                                    Größe
                                  </th>
                                </>
                              ) : order.sizeTable.scheme === "simple" ? (
                                <>
                                  <th className="text-left p-2 font-medium">
                                    Größe
                                  </th>
                                  <th className="text-right p-2 font-medium">
                                    Anzahl
                                  </th>
                                </>
                              ) : (
                                <>
                                  <th className="text-left p-2 font-medium">
                                    Größe
                                  </th>
                                  <th className="text-left p-2 font-medium">
                                    Farbe
                                  </th>
                                  <th className="text-right p-2 font-medium">
                                    Anzahl
                                  </th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {order.sizeTable.rowsJson.map(
                              (row: any, idx: number) => (
                                <tr key={idx} className="border-t">
                                  {order.sizeTable?.scheme === "roster" ? (
                                    <>
                                      <td className="p-2">{row.number}</td>
                                      <td className="p-2">{row.name || "—"}</td>
                                      <td className="p-2 font-medium">
                                        {row.size}
                                      </td>
                                    </>
                                  ) : order.sizeTable?.scheme === "simple" ? (
                                    <>
                                      <td className="p-2">{row.size}</td>
                                      <td className="text-right p-2 font-medium">
                                        {row.quantity}
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="p-2">{row.size}</td>
                                      <td className="p-2">{row.color}</td>
                                      <td className="text-right p-2 font-medium">
                                        {row.quantity}
                                      </td>
                                    </>
                                  )}
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                      {order.sizeTable.comment && (
                        <p className="text-sm text-muted-foreground mt-3">
                          {order.sizeTable.comment}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Keine Größentabelle vorhanden
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Auftragsnotizen
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {order.notes ? (
                      <p className="text-sm whitespace-pre-wrap">
                        {order.notes}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Keine Notizen vorhanden
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {/* Action Buttons based on status */}
            {slot.status === "PLANNED" && (
              <Button
                onClick={handleStart}
                disabled={startMutation.isPending}
                data-testid="button-start"
              >
                <Play className="mr-2 h-4 w-4" />
                {startMutation.isPending ? "Wird gestartet..." : "Starten"}
              </Button>
            )}

            {slot.status === "RUNNING" && (
              <>
                <Button
                  onClick={handlePause}
                  variant="outline"
                  disabled={pauseMutation.isPending}
                  data-testid="button-pause"
                >
                  <Pause className="mr-2 h-4 w-4" />
                  {pauseMutation.isPending ? "Wird pausiert..." : "Pause"}
                </Button>
                <Button
                  onClick={handleStop}
                  variant="outline"
                  disabled={stopMutation.isPending}
                  data-testid="button-stop"
                >
                  <Square className="mr-2 h-4 w-4" />
                  {stopMutation.isPending ? "Wird beendet..." : "Fertigstellen"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="destructive"
                      data-testid="button-problem-menu"
                    >
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Problem melden
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => handleProblem("missing_parts")}
                      data-testid="menu-missing-parts"
                    >
                      Fehlteil melden
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleProblem("quality")}
                      data-testid="menu-quality-problem"
                    >
                      Qualitätsproblem
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}

            {slot.status === "PAUSED" && (
              <>
                <Button
                  onClick={handleStart}
                  disabled={startMutation.isPending}
                  data-testid="button-resume"
                >
                  <Play className="mr-2 h-4 w-4" />
                  {startMutation.isPending
                    ? "Wird fortgesetzt..."
                    : "Fortsetzen"}
                </Button>
                <Button
                  onClick={handleStop}
                  variant="outline"
                  disabled={stopMutation.isPending}
                  data-testid="button-stop-paused"
                >
                  <Square className="mr-2 h-4 w-4" />
                  {stopMutation.isPending ? "Wird beendet..." : "Fertigstellen"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="destructive"
                      data-testid="button-problem-menu-paused"
                    >
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Problem melden
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => handleProblem("missing_parts")}
                      data-testid="menu-missing-parts-paused"
                    >
                      Fehlteil melden
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleProblem("quality")}
                      data-testid="menu-quality-problem-paused"
                    >
                      Qualitätsproblem
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}

            <Button variant="outline" onClick={onClose} data-testid="button-close">
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Problem Report Dialog */}
      <Dialog open={problemDialogOpen} onOpenChange={setProblemDialogOpen}>
        <DialogContent data-testid="dialog-problem-report">
          <DialogHeader>
            <DialogTitle>
              {problemType === "missing_parts"
                ? "Fehlteil melden"
                : "Qualitätsproblem melden"}
            </DialogTitle>
            <DialogDescription>
              {problemType === "missing_parts"
                ? "Melden Sie fehlende Teile für diesen Arbeitsschritt"
                : "Melden Sie ein Qualitätsproblem"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {problemType === "missing_parts" && (
              <div className="space-y-2">
                <Label>Grund *</Label>
                <RadioGroup
                  value={problemReason}
                  onValueChange={(val) => setProblemReason(val as ProblemReason)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="FEHLTEILE"
                      id="reason-fehlteile"
                      data-testid="radio-reason-fehlteile"
                    />
                    <Label htmlFor="reason-fehlteile" className="cursor-pointer">
                      Fehlteile
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="MASCHINE"
                      id="reason-maschine"
                      data-testid="radio-reason-maschine"
                    />
                    <Label htmlFor="reason-maschine" className="cursor-pointer">
                      Maschine defekt
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem
                      value="SONSTIGES"
                      id="reason-sonstiges"
                      data-testid="radio-reason-sonstiges"
                    />
                    <Label htmlFor="reason-sonstiges" className="cursor-pointer">
                      Sonstiges
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

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

            {problemType === "missing_parts" && problemReason === "FEHLTEILE" && (
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
    </>
  );
}
