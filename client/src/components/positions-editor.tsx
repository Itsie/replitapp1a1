import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import type { OrderPosition } from "@shared/schema";

type LocalPosition = {
  id?: number;
  articleName: string;
  articleNumber: string | null;
  qty: number;
  unit: string;
  unitPriceNet: number;
  vatRate: number;
  procurement: string;
  supplierNote: string | null;
  lineNet?: number;
  lineVat?: number;
  lineGross?: number;
};

interface PositionsEditorProps {
  positions: LocalPosition[];
  onChange: (positions: LocalPosition[]) => void;
  readOnly?: boolean;
}

export function PositionsEditor({ positions, onChange, readOnly = false }: PositionsEditorProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [priceMode, setPriceMode] = useState<"netto" | "brutto">("netto");

  const calculateLineTotal = (qty: number, unitPrice: number, vatRate: number) => {
    const net = qty * unitPrice;
    const vat = net * (vatRate / 100);
    const gross = net + vat;
    return { lineNet: net, lineVat: vat, lineGross: gross };
  };

  const addPosition = () => {
    const newId = Math.max(0, ...positions.map(p => p.id || 0)) + 1;
    const newPosition: LocalPosition = {
      id: newId,
      articleName: "",
      articleNumber: null,
      qty: 1,
      unit: "Stk",
      unitPriceNet: 0,
      vatRate: 19,
      procurement: "NONE",
      supplierNote: null,
    };
    const totals = calculateLineTotal(newPosition.qty, newPosition.unitPriceNet, newPosition.vatRate);
    onChange([...positions, { ...newPosition, ...totals }]);
    setEditingId(newId);
  };

  const updatePosition = (index: number, field: keyof LocalPosition, value: any) => {
    const updated = [...positions];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "qty" || field === "unitPriceNet" || field === "vatRate") {
      const totals = calculateLineTotal(
        updated[index].qty,
        updated[index].unitPriceNet,
        updated[index].vatRate
      );
      updated[index] = { ...updated[index], ...totals };
    }

    onChange(updated);
  };
  
  const updatePriceField = (index: number, value: string) => {
    const price = parseFloat(value) || 0;
    const vatRate = positions[index].vatRate;
    
    let netPrice: number;
    if (priceMode === "brutto") {
      // Brutto → Netto umrechnen
      netPrice = price / (1 + vatRate / 100);
    } else {
      netPrice = price;
    }
    
    updatePosition(index, "unitPriceNet", netPrice);
  };

  const deletePosition = (index: number) => {
    onChange(positions.filter((_, i) => i !== index));
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return "—";
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const orderTotals = positions.reduce(
    (acc, pos) => ({
      net: acc.net + (pos.lineNet || 0),
      vat: acc.vat + (pos.lineVat || 0),
      gross: acc.gross + (pos.lineGross || 0),
    }),
    { net: 0, vat: 0, gross: 0 }
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Positionen</CardTitle>
          <div className="flex items-center gap-4">
            {!readOnly && (
              <>
                {/* Brutto/Netto Switch */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">PREISE:</Label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant={priceMode === "netto" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPriceMode("netto")}
                      data-testid="button-price-mode-netto"
                    >
                      Netto
                    </Button>
                    <Button
                      type="button"
                      variant={priceMode === "brutto" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPriceMode("brutto")}
                      data-testid="button-price-mode-brutto"
                    >
                      Brutto
                    </Button>
                  </div>
                </div>
                
                <Button
                  onClick={addPosition}
                  size="sm"
                  data-testid="button-add-position"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Position hinzufügen
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-positions">
              Keine Positionen vorhanden. Fügen Sie eine Position hinzu.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Art.-Nr</TableHead>
                    <TableHead className="min-w-[200px]">Artikelname</TableHead>
                    <TableHead className="w-[80px]">Menge</TableHead>
                    <TableHead className="w-[80px]">Einheit</TableHead>
                    <TableHead className="w-[120px]">Preis/{priceMode === "brutto" ? "Brutto" : "Netto"}</TableHead>
                    <TableHead className="w-[80px]">MwSt %</TableHead>
                    <TableHead className="w-[100px]">Netto</TableHead>
                    <TableHead className="w-[100px]">MwSt</TableHead>
                    <TableHead className="w-[100px]">Brutto</TableHead>
                    <TableHead className="w-[120px]">Beschaffung</TableHead>
                    <TableHead className="min-w-[150px]">Notiz</TableHead>
                    {!readOnly && <TableHead className="w-[80px]">Aktionen</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position, index) => (
                    <TableRow key={position.id || index} data-testid={`row-position-${index}`}>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-sm">{position.articleNumber || "—"}</span>
                        ) : (
                          <Input
                            value={position.articleNumber || ""}
                            onChange={(e) => updatePosition(index, "articleNumber", e.target.value || null)}
                            placeholder="Art.-Nr"
                            data-testid={`input-articleNumber-${index}`}
                            className="h-8"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="font-medium text-sm">{position.articleName}</span>
                        ) : (
                          <Input
                            value={position.articleName}
                            onChange={(e) => updatePosition(index, "articleName", e.target.value)}
                            placeholder="Artikelname *"
                            data-testid={`input-articleName-${index}`}
                            className="h-8"
                            required
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-sm">{position.qty}</span>
                        ) : (
                          <Input
                            type="number"
                            value={position.qty}
                            onChange={(e) => updatePosition(index, "qty", parseFloat(e.target.value) || 0)}
                            min="0.01"
                            step="0.01"
                            data-testid={`input-qty-${index}`}
                            className="h-8"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-sm">{position.unit}</span>
                        ) : (
                          <Input
                            value={position.unit}
                            onChange={(e) => updatePosition(index, "unit", e.target.value)}
                            placeholder="Stk"
                            data-testid={`input-unit-${index}`}
                            className="h-8"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-sm">{formatCurrency(position.unitPriceNet)}</span>
                        ) : (
                          <Input
                            type="number"
                            value={
                              priceMode === "brutto"
                                ? (position.unitPriceNet * (1 + position.vatRate / 100)).toFixed(2)
                                : position.unitPriceNet.toFixed(2)
                            }
                            onChange={(e) => updatePriceField(index, e.target.value)}
                            min="0"
                            step="0.01"
                            data-testid={`input-unitPrice-${index}`}
                            className="h-8"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-sm">{position.vatRate}%</span>
                        ) : (
                          <Select
                            value={position.vatRate.toString()}
                            onValueChange={(value) => updatePosition(index, "vatRate", parseInt(value))}
                          >
                            <SelectTrigger data-testid={`select-vatRate-${index}`} className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">0%</SelectItem>
                              <SelectItem value="7">7%</SelectItem>
                              <SelectItem value="19">19%</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium" data-testid={`text-lineNet-${index}`}>
                          {formatCurrency(position.lineNet)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm" data-testid={`text-lineVat-${index}`}>
                          {formatCurrency(position.lineVat)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium" data-testid={`text-lineGross-${index}`}>
                          {formatCurrency(position.lineGross)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-sm">{position.procurement}</span>
                        ) : (
                          <Select
                            value={position.procurement}
                            onValueChange={(value) => updatePosition(index, "procurement", value)}
                          >
                            <SelectTrigger data-testid={`select-procurement-${index}`} className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NONE">Keine</SelectItem>
                              <SelectItem value="ORDER_NEEDED">Bestellen</SelectItem>
                              <SelectItem value="ORDERED">Bestellt</SelectItem>
                              <SelectItem value="RECEIVED">Erhalten</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span className="text-sm text-muted-foreground">{position.supplierNote || "—"}</span>
                        ) : (
                          <Input
                            value={position.supplierNote || ""}
                            onChange={(e) => updatePosition(index, "supplierNote", e.target.value || null)}
                            placeholder="Notiz"
                            data-testid={`input-supplierNote-${index}`}
                            className="h-8"
                          />
                        )}
                      </TableCell>
                      {!readOnly && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deletePosition(index)}
                            data-testid={`button-delete-position-${index}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {positions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Summen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <Label>Gesamt Netto:</Label>
              <span className="font-medium" data-testid="text-total-net">
                {formatCurrency(orderTotals.net)}
              </span>
            </div>
            <div className="flex justify-between">
              <Label>Gesamt MwSt:</Label>
              <span className="font-medium" data-testid="text-total-vat">
                {formatCurrency(orderTotals.vat)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <Label className="text-lg">Gesamt Brutto:</Label>
              <span className="text-lg font-bold" data-testid="text-total-gross">
                {formatCurrency(orderTotals.gross)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
