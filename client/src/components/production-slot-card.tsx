import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle } from "lucide-react";
import { useElapsedTime } from "@/hooks/use-elapsed-time";
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
  } | null;
  workCenter: {
    id: string;
    name: string;
    department: Department;
    concurrentCapacity: number;
  };
}

interface ProductionSlotCardProps {
  slot: TimeSlotWithOrder;
  onClick: () => void;
}

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

export function ProductionSlotCard({ slot, onClick }: ProductionSlotCardProps) {
  const elapsedMin = useElapsedTime(slot.startedAt, slot.status);

  const isRunning = slot.status === 'RUNNING';
  const isDone = slot.status === 'DONE';
  const isPaused = slot.status === 'PAUSED';
  const isBlocked = slot.status === 'BLOCKED';
  const isPlanned = slot.status === 'PLANNED';

  const getStatusBadge = () => {
    if (isRunning) {
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700 border-green-700">
          Läuft
        </Badge>
      );
    }
    if (isPaused) {
      return (
        <Badge variant="default" className="bg-yellow-600 hover:bg-yellow-700 border-yellow-700">
          Pausiert
        </Badge>
      );
    }
    if (isBlocked) {
      return (
        <Badge variant="default" className="bg-red-600 hover:bg-red-700 border-red-700">
          Blockiert
        </Badge>
      );
    }
    if (isDone) {
      return (
        <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 border-blue-700">
          Erledigt
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        Geplant
      </Badge>
    );
  };

  const getStatusText = () => {
    if (isRunning && slot.startedAt) {
      const start = new Date(slot.startedAt);
      return `Läuft seit ${start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (isPaused) {
      return 'Pausiert';
    }
    if (isDone && slot.actualDurationMin !== null) {
      return `Fertig in ${formatDuration(slot.actualDurationMin)}`;
    }
    if (isBlocked) {
      return slot.note || 'Blockiert';
    }
    return `Geplant: ${formatTime(slot.startMin)} - ${formatTime(slot.startMin + slot.lengthMin)}`;
  };

  const borderColor = isRunning 
    ? 'border-l-green-600' 
    : isPaused 
    ? 'border-l-yellow-600'
    : isBlocked 
    ? 'border-l-red-600'
    : isDone
    ? 'border-l-blue-600'
    : 'border-l-border';

  const bgColor = isRunning 
    ? 'bg-green-50/5 dark:bg-green-950/10' 
    : isPaused 
    ? 'bg-yellow-50/5 dark:bg-yellow-950/10'
    : isBlocked 
    ? 'bg-red-50/5 dark:bg-red-950/10'
    : '';

  return (
    <Card 
      className={`cursor-pointer hover-elevate border-l-4 ${borderColor} ${bgColor} ${isDone ? 'opacity-70' : ''}`}
      onClick={onClick}
      data-testid={`card-slot-${slot.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header Row */}
            <div className="flex items-center gap-2 flex-wrap">
              {slot.order ? (
                <>
                  {slot.order.displayOrderNumber && (
                    <span className="font-mono font-semibold text-sm" data-testid={`text-order-number-${slot.id}`}>
                      {slot.order.displayOrderNumber}
                    </span>
                  )}
                  <span className="text-base font-medium" data-testid={`text-order-title-${slot.id}`}>
                    {slot.order.title}
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Blockiert</span>
                </div>
              )}
            </div>

            {/* Details Row */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              {slot.order && (
                <>
                  <span data-testid={`text-customer-${slot.id}`}>{slot.order.customer}</span>
                  <span>•</span>
                </>
              )}
              <span>{slot.workCenter.name}</span>
              <span>•</span>
              <span className="font-mono">{formatTime(slot.startMin)} - {formatTime(slot.startMin + slot.lengthMin)}</span>
              <span>•</span>
              <span>{formatDuration(slot.lengthMin)}</span>
            </div>

            {/* Status Row */}
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <span className="text-sm text-muted-foreground">
                {getStatusText()}
              </span>
            </div>

            {/* Notes */}
            {slot.note && !slot.order && (
              <div className="text-sm bg-muted/30 p-2 rounded">
                {slot.note}
              </div>
            )}

            {slot.order?.notes && (
              <div className="text-sm bg-muted/30 p-2 rounded">
                <span className="font-medium">Notiz: </span>
                {slot.order.notes}
              </div>
            )}
          </div>

          {/* Runtime Display for Running Slots */}
          {isRunning && (
            <div className="flex-shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-background border">
                <Clock className="h-4 w-4 text-green-600" />
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Laufzeit</div>
                  <div className="font-mono font-semibold text-lg" data-testid={`text-elapsed-${slot.id}`}>
                    {formatDuration(elapsedMin)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
