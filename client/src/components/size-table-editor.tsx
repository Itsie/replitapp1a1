import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Download, Upload, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SizeTableRow } from "@shared/schema";

const ALPHA_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const NUMERIC_SIZES = ["104", "116", "128", "140", "152", "164", "176", "S", "M", "L", "XL"];

interface SizeQuantity {
  size: string;
  qty: number;
}

interface SizeTableEditorProps {
  initialData?: {
    scheme: string;
    rows: SizeTableRow[];
    comment: string | null;
  };
  onSave: (data: { scheme: string; rows: SizeTableRow[]; comment: string | null; allowDuplicates: boolean }) => Promise<void>;
  onCancel: () => void;
}

export function SizeTableEditor({ initialData, onSave, onCancel }: SizeTableEditorProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [scheme, setScheme] = useState<string>(initialData?.scheme || "ALPHA");
  const [sizeQuantities, setSizeQuantities] = useState<SizeQuantity[]>(() => {
    if (initialData?.rows) {
      const counts: Record<string, number> = {};
      initialData.rows.forEach(row => {
        counts[row.size] = (counts[row.size] || 0) + 1;
      });
      return Object.entries(counts).map(([size, qty]) => ({ size, qty }));
    }
    return ALPHA_SIZES.map(size => ({ size, qty: 0 }));
  });
  const [roster, setRoster] = useState<SizeTableRow[]>(initialData?.rows || []);
  const [comment, setComment] = useState<string>(initialData?.comment || "");
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [csvImportText, setCsvImportText] = useState("");
  const [startNumber, setStartNumber] = useState(1);

  const totalItems = useMemo(() => {
    return sizeQuantities.reduce((sum, sq) => sum + sq.qty, 0);
  }, [sizeQuantities]);

  const handleSchemeChange = (newScheme: string) => {
    setScheme(newScheme);
    if (newScheme === "ALPHA") {
      setSizeQuantities(ALPHA_SIZES.map(size => ({ size, qty: 0 })));
    } else if (newScheme === "NUMERIC") {
      setSizeQuantities(NUMERIC_SIZES.map(size => ({ size, qty: 0 })));
    }
  };

  const addCustomSize = () => {
    const newSize = prompt("Bitte Größenbezeichnung eingeben:");
    if (newSize && newSize.trim()) {
      setSizeQuantities([...sizeQuantities, { size: newSize.trim(), qty: 1 }]);
    }
  };

  const removeSize = (index: number) => {
    setSizeQuantities(sizeQuantities.filter((_, i) => i !== index));
  };

  const updateQty = (index: number, qty: number) => {
    const newSizes = [...sizeQuantities];
    newSizes[index] = { ...newSizes[index], qty: Math.max(0, qty) };
    setSizeQuantities(newSizes);
  };

  const generateRoster = () => {
    const newRoster: SizeTableRow[] = [];
    sizeQuantities.forEach(sq => {
      for (let i = 0; i < sq.qty; i++) {
        newRoster.push({
          size: sq.size,
          number: 0,
          name: null,
        });
      }
    });
    setRoster(newRoster);
    setStep(2);
  };

  const updateRosterItem = (index: number, field: keyof SizeTableRow, value: any) => {
    const newRoster = [...roster];
    newRoster[index] = { ...newRoster[index], [field]: value };
    setRoster(newRoster);
  };

  const autoNumberRoster = () => {
    const newRoster = roster.map((item, idx) => ({
      ...item,
      number: startNumber + idx,
    }));
    setRoster(newRoster);
  };

  const parseCSV = (csv: string) => {
    try {
      const lines = csv.trim().split('\n');
      if (lines.length < 2) {
        throw new Error("CSV muss mindestens Header und eine Datenzeile enthalten");
      }

      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const sizeIdx = header.findIndex(h => h === 'size' || h === 'größe');
      const numberIdx = header.findIndex(h => h === 'number' || h === 'nummer');
      const nameIdx = header.findIndex(h => h === 'name');

      if (sizeIdx === -1 || numberIdx === -1) {
        throw new Error("CSV muss 'size' und 'number' Spalten enthalten");
      }

      const rows: SizeTableRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length > Math.max(sizeIdx, numberIdx)) {
          rows.push({
            size: cols[sizeIdx],
            number: parseInt(cols[numberIdx], 10) || 0,
            name: nameIdx !== -1 && cols.length > nameIdx ? (cols[nameIdx] || null) : null,
          });
        }
      }

      setRoster(rows);
      toast({
        title: "CSV importiert",
        description: `${rows.length} Einträge erfolgreich geladen.`,
      });
    } catch (error: any) {
      toast({
        title: "Fehler beim Import",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const pasteNames = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const names = text.split('\n').map(n => n.trim()).filter(n => n);
      
      const newRoster = [...roster];
      names.forEach((name, idx) => {
        if (idx < newRoster.length) {
          newRoster[idx] = { ...newRoster[idx], name };
        }
      });
      setRoster(newRoster);
      
      toast({
        title: "Namen eingefügt",
        description: `${Math.min(names.length, roster.length)} Namen aus Zwischenablage eingefügt.`,
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Zwischenablage konnte nicht gelesen werden.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    try {
      // If we have an existing roster (editing mode), always save it
      // If we're in step 1 and roster is empty (new table), generate it
      let rowsToSave = roster;
      if (roster.length === 0 && step === 1) {
        // Only auto-generate for brand new tables
        const generatedRoster: SizeTableRow[] = [];
        let currentNumber = 1;
        sizeQuantities.forEach(sq => {
          for (let i = 0; i < sq.qty; i++) {
            generatedRoster.push({
              size: sq.size,
              number: currentNumber++, // Auto-increment numbers for uniqueness
              name: null,
            });
          }
        });
        rowsToSave = generatedRoster;
      }
      
      await onSave({ scheme, rows: rowsToSave, comment: comment || null, allowDuplicates });
      toast({
        title: "Gespeichert",
        description: "Größentabelle wurde erfolgreich gespeichert.",
      });
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message || "Speichern fehlgeschlagen.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {step === 1 ? (
        <div className="space-y-4">
          <div>
            <Label>Schema</Label>
            <Select value={scheme} onValueChange={handleSchemeChange}>
              <SelectTrigger data-testid="select-scheme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALPHA">Alphabetisch (XS, S, M, L, XL, ...)</SelectItem>
                <SelectItem value="NUMERIC">Numerisch (104, 116, 128, ...)</SelectItem>
                <SelectItem value="CUSTOM">Benutzerdefiniert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">Größen & Mengen</CardTitle>
              {scheme === "CUSTOM" && (
                <Button size="sm" variant="outline" onClick={addCustomSize} data-testid="button-add-custom-size">
                  <Plus className="h-4 w-4 mr-2" />
                  Größe hinzufügen
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {sizeQuantities.map((sq, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Label className="w-20">{sq.size}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={sq.qty}
                    onChange={(e) => updateQty(index, parseInt(e.target.value) || 0)}
                    className="w-24"
                    data-testid={`input-qty-${sq.size}`}
                  />
                  {scheme === "CUSTOM" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeSize(index)}
                      data-testid={`button-remove-${sq.size}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="pt-4 border-t mt-4">
                <p className="text-sm font-medium">
                  Gesamt: <span className="text-primary" data-testid="text-total-items">{totalItems}</span> Stück
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={onCancel} data-testid="button-cancel-step1">
              Abbrechen
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={totalItems === 0}
                data-testid="button-save-simple"
              >
                Direkt speichern
              </Button>
              <Button
                onClick={generateRoster}
                disabled={totalItems === 0}
                data-testid="button-next-to-roster"
              >
                Weiter zur Roster-Eingabe ({totalItems} Einträge)
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setStep(1)} data-testid="button-back-to-step1">
              ← Zurück zu Größen
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={pasteNames} data-testid="button-paste-names">
                Namen aus Zwischenablage
              </Button>
            </div>
          </div>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Auto-Nummerierung</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end gap-2">
              <div className="flex-1">
                <Label>Startwert</Label>
                <Input
                  type="number"
                  min="0"
                  max="999"
                  value={startNumber}
                  onChange={(e) => setStartNumber(parseInt(e.target.value) || 1)}
                  data-testid="input-start-number"
                />
              </div>
              <Button onClick={autoNumberRoster} data-testid="button-auto-number">
                <Hash className="h-4 w-4 mr-2" />
                Nummern generieren
              </Button>
            </CardContent>
          </Card>

          <Tabs defaultValue="table" className="w-full">
            <TabsList data-testid="tabs-roster-input">
              <TabsTrigger value="table">Tabelle</TabsTrigger>
              <TabsTrigger value="csv">CSV Import</TabsTrigger>
            </TabsList>

            <TabsContent value="table">
              <Card className="rounded-2xl">
                <CardContent className="p-0">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2 border-r w-16">#</th>
                          <th className="text-left p-2 border-r">Größe</th>
                          <th className="text-left p-2 border-r">Nummer (0-999)</th>
                          <th className="text-left p-2">Name (optional)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roster.map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2 border-r text-muted-foreground">{index + 1}</td>
                            <td className="p-2 border-r">
                              <Select
                                value={item.size}
                                onValueChange={(value) => updateRosterItem(index, "size", value)}
                              >
                                <SelectTrigger className="h-8" data-testid={`select-size-${index}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {sizeQuantities.map(sq => (
                                    <SelectItem key={sq.size} value={sq.size}>{sq.size}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2 border-r">
                              <Input
                                type="number"
                                min="0"
                                max="999"
                                value={item.number}
                                onChange={(e) => updateRosterItem(index, "number", parseInt(e.target.value) || 0)}
                                className="h-8"
                                data-testid={`input-number-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="text"
                                maxLength={30}
                                value={item.name || ""}
                                onChange={(e) => updateRosterItem(index, "name", e.target.value || null)}
                                className="h-8"
                                placeholder="Optional"
                                data-testid={`input-name-${index}`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="csv">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base">CSV Import</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Format: size,number,name (Header erforderlich)
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="size,number,name&#10;S,1,Max Mustermann&#10;M,2,Anna Schmidt&#10;..."
                    value={csvImportText}
                    onChange={(e) => setCsvImportText(e.target.value)}
                    rows={10}
                    data-testid="textarea-csv-import"
                  />
                  <Button
                    onClick={() => parseCSV(csvImportText)}
                    disabled={!csvImportText.trim()}
                    data-testid="button-import-csv"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    CSV importieren
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div>
            <Label>Kommentar (optional)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Zusätzliche Anmerkungen zur Größentabelle..."
              rows={3}
              data-testid="textarea-comment"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel} data-testid="button-cancel-step2">
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={roster.length === 0} data-testid="button-save-sizetable">
              Größentabelle speichern
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
