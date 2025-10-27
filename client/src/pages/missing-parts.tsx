import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { CheckCircle2, AlertCircle, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  getWorkflowBadgeClass, 
  getDepartmentBadgeClass,
  WORKFLOW_LABELS,
  DEPARTMENT_LABELS 
} from "@shared/schema";
import type { Order, Department } from "@prisma/client";

interface OrderWithMissingParts extends Order {
  _count?: {
    timeSlots: number;
  };
}

export default function MissingPartsPage() {
  const { toast } = useToast();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithMissingParts | null>(null);

  const queryUrl = '/api/orders?workflow=WARTET_FEHLTEILE';
  
  const { data: response, isLoading } = useQuery<OrderWithMissingParts[]>({
    queryKey: [queryUrl],
  });

  const orders = response ?? [];

  const releaseMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return apiRequest('POST', `/api/orders/${orderId}/release-from-missing-parts`, {});
    },
    onSuccess: () => {
      // Refetch all orders and timeslots queries
      queryClient.refetchQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (
            key.startsWith('/api/orders') || 
            key.startsWith('/api/timeslots')
          );
        }
      });
      toast({
        title: "Auftrag freigegeben",
        description: "Der Auftrag wurde zurück zur Planung geschickt.",
      });
      setConfirmDialogOpen(false);
      setSelectedOrder(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: error.message || "Auftrag konnte nicht freigegeben werden",
      });
    },
  });

  const handleOpenConfirmDialog = (order: OrderWithMissingParts) => {
    setSelectedOrder(order);
    setConfirmDialogOpen(true);
  };

  const handleConfirmRelease = () => {
    if (selectedOrder) {
      releaseMutation.mutate(selectedOrder.id);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <div className="text-center py-12 text-muted-foreground">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Fehlteile-Management</h1>
        <p className="text-muted-foreground">
          Aufträge, die auf fehlende Teile warten
        </p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Keine Aufträge mit fehlenden Teilen vorhanden.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Aufträge mit Fehlteilen ({orders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Auftragsnummer</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Bereich</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fällig am</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                    <TableCell className="font-mono">
                      {order.displayOrderNumber || order.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="font-medium">{order.title}</TableCell>
                    <TableCell>{order.customer}</TableCell>
                    <TableCell>
                      <span className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${getDepartmentBadgeClass(order.department)}`}>
                        {DEPARTMENT_LABELS[order.department]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`whitespace-nowrap inline-flex items-center rounded-md text-[11px] leading-4 px-2 py-0.5 font-semibold ${getWorkflowBadgeClass(order.workflow)}`}>
                        {WORKFLOW_LABELS[order.workflow]}
                      </span>
                    </TableCell>
                    <TableCell>
                      {order.dueDate
                        ? new Date(order.dueDate).toLocaleDateString('de-DE')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleOpenConfirmDialog(order)}
                        disabled={releaseMutation.isPending}
                        data-testid={`button-release-${order.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Teile sind da
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent data-testid="dialog-confirm-release">
          <DialogHeader>
            <DialogTitle>Auftrag freigeben?</DialogTitle>
            <DialogDescription>
              Bestätigen Sie, dass alle fehlenden Teile für diesen Auftrag eingetroffen sind.
              Der Auftrag wird zurück zur Planung geschickt, damit er neu eingeplant werden kann.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-2 py-4">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-muted-foreground">Auftrag:</span>
                <span className="font-medium">{selectedOrder.title}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-muted-foreground">Kunde:</span>
                <span>{selectedOrder.customer}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-muted-foreground">Bereich:</span>
                <Badge variant="outline">{selectedOrder.department}</Badge>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={releaseMutation.isPending}
              data-testid="button-cancel-release"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleConfirmRelease}
              disabled={releaseMutation.isPending}
              data-testid="button-confirm-release"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Freigeben zur Planung
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
