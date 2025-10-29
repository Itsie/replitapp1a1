import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Eye, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrderWithRelations } from "@shared/schema";
import { 
  WORKFLOW_LABELS, 
  DEPARTMENT_LABELS,
  getWorkflowBadgeClass, 
  getDepartmentBadgeClass,
} from "@shared/schema";

export default function PostCalculationPage() {
  const { data: orders, isLoading } = useQuery<OrderWithRelations[]>({
    queryKey: ['/api/accounting/orders', 'NACHKALKULATION'],
    queryFn: async () => {
      const res = await fetch('/api/accounting/orders?status=NACHKALKULATION', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch post-calculation orders');
      return res.json();
    },
  });

  return (
    <div className="w-full px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calculator className="w-6 h-6 text-foreground" />
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
            Nachkalkulation
          </h1>
        </div>
      </div>

        {/* Orders List */}
        <Card>
          <CardHeader>
            <CardTitle>Aufträge in Nachkalkulation</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !orders || orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-orders">
                Keine Aufträge in Nachkalkulation
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Auftrag</TableHead>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Abteilung</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fälligkeitsdatum</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                        <TableCell className="font-medium">
                          {order.displayOrderNumber || order.id.substring(0, 8)}
                        </TableCell>
                        <TableCell>{order.customer}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={getDepartmentBadgeClass(order.department)}
                          >
                            {DEPARTMENT_LABELS[order.department]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getWorkflowBadgeClass(order.workflow)}>
                            {WORKFLOW_LABELS[order.workflow]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {order.dueDate
                            ? new Date(order.dueDate).toLocaleDateString('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/orders/${order.id}`}>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              data-testid={`button-view-${order.id}`}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ansehen
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
