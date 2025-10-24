import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Upload, Plus, LinkIcon, FileIcon, Trash, Eye, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { OrderAsset } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AttachmentsTabProps {
  orderId: string;
}

export function AttachmentsTab({ orderId }: AttachmentsTabProps) {
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pathDialogOpen, setPathDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<OrderAsset | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const { data: assets = [], isLoading } = useQuery<OrderAsset[]>({
    queryKey: [`/api/orders/${orderId}/assets`],
  });
  
  const handleDeleteClick = (asset: OrderAsset) => {
    setAssetToDelete(asset);
    setDeleteDialogOpen(true);
  };
  
  const deleteMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const res = await apiRequest("DELETE", `/api/orders/${orderId}/assets/${assetId}`, {});
      if (!res.ok) throw new Error("Failed to delete asset");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}/assets`] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      toast({
        title: "Gelöscht",
        description: "Anhang wurde erfolgreich entfernt.",
      });
      setDeleteDialogOpen(false);
      setAssetToDelete(null);
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Anhang konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    },
  });
  
  const handleCopy = (text: string, assetId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(assetId);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: "Kopiert",
      description: "Pfad wurde in die Zwischenablage kopiert.",
    });
  };
  
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-muted/60">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Druckdaten / Anhänge</CardTitle>
          <div className="flex gap-2">
            <Button
              onClick={() => setUploadDialogOpen(true)}
              size="sm"
              data-testid="button-upload-file"
            >
              <Upload className="h-4 w-4 mr-2" />
              Datei hochladen
            </Button>
            <Button
              onClick={() => setPathDialogOpen(true)}
              size="sm"
              variant="outline"
              data-testid="button-add-path"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Server-Pfad hinzufügen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Lade Anhänge...</div>
          ) : assets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-assets">
              <FileIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Noch keine Anhänge</p>
              <p className="text-sm mt-1">Laden Sie Dateien hoch oder fügen Sie einen Serverpfad hinzu</p>
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Typ</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Quelle</TableHead>
                    <TableHead>Größe</TableHead>
                    <TableHead>Erforderlich</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => (
                    <TableRow key={asset.id} data-testid={`asset-row-${asset.id}`}>
                      <TableCell>
                        <Badge variant={asset.kind === "PRINT" ? "default" : "secondary"}>
                          {asset.kind}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{asset.label}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {asset.url ? (
                            <>
                              <FileIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Datei</span>
                            </>
                          ) : (
                            <>
                              <LinkIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Server-Pfad</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatFileSize(asset.size)}</TableCell>
                      <TableCell>
                        {asset.kind === "PRINT" && asset.required ? "✓" : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(asset.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {asset.url && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => window.open(asset.url!, "_blank")}
                              data-testid={`button-open-${asset.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleCopy(asset.path || asset.url || "", asset.id)}
                            data-testid={`button-copy-${asset.id}`}
                          >
                            {copiedId === asset.id ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteClick(asset)}
                            data-testid={`button-delete-${asset.id}`}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      <UploadDialog
        orderId={orderId}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />
      
      <ServerPathDialog
        orderId={orderId}
        open={pathDialogOpen}
        onOpenChange={setPathDialogOpen}
      />
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anhang löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie "{assetToDelete?.label}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => assetToDelete && deleteMutation.mutate(assetToDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Wird gelöscht..." : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UploadDialog({ orderId, open, onOpenChange }: { orderId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [kind, setKind] = useState<"PRINT" | "FILE">("PRINT");
  const [label, setLabel] = useState("");
  const [required, setRequired] = useState(false);
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("kind", kind);
      formData.append("label", label || selectedFile.name);
      formData.append("required", String(required));
      if (notes) formData.append("notes", notes);
      
      const res = await fetch(`/api/orders/${orderId}/assets/upload`, {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) throw new Error("Upload failed");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}/assets`] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      toast({
        title: "Hochgeladen",
        description: "Datei wurde erfolgreich hochgeladen.",
      });
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Datei konnte nicht hochgeladen werden.",
        variant: "destructive",
      });
    },
  });
  
  const resetForm = () => {
    setKind("PRINT");
    setLabel("");
    setRequired(false);
    setNotes("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      if (!label) setLabel(e.dataTransfer.files[0].name);
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      if (!label) setLabel(e.target.files[0].name);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-upload">
        <DialogHeader>
          <DialogTitle>Datei hochladen</DialogTitle>
          <DialogDescription>
            Laden Sie eine Datei hoch oder ziehen Sie sie in den Bereich.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              data-testid="input-file"
            />
            {selectedFile ? (
              <div>
                <FileIcon className="h-12 w-12 mx-auto mb-2 text-primary" />
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="mt-3"
                >
                  Andere Datei wählen
                </Button>
              </div>
            ) : (
              <div>
                <Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium mb-1">Datei hier ablegen</p>
                <p className="text-sm text-muted-foreground mb-3">oder</p>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-browse"
                >
                  Durchsuchen
                </Button>
              </div>
            )}
          </div>
          
          <div>
            <Label>Art</Label>
            <Select value={kind} onValueChange={(v: any) => setKind(v)}>
              <SelectTrigger data-testid="select-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRINT">PRINT (druckrelevant)</SelectItem>
                <SelectItem value="FILE">FILE (sonstiges)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Bezeichnung für die Datei"
              data-testid="input-label"
            />
          </div>
          
          {kind === "PRINT" && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="upload-required"
                checked={required}
                onCheckedChange={(checked) => setRequired(checked === true)}
                data-testid="checkbox-required"
              />
              <Label htmlFor="upload-required" className="cursor-pointer">
                Erforderlich für Produktion
              </Label>
            </div>
          )}
          
          <div>
            <Label>Notizen (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Zusätzliche Informationen..."
              rows={2}
              data-testid="textarea-notes"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={!selectedFile || uploadMutation.isPending}
            data-testid="button-upload"
          >
            {uploadMutation.isPending ? "Wird hochgeladen..." : "Hochladen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ServerPathDialog({ orderId, open, onOpenChange }: { orderId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [kind, setKind] = useState<"PRINT" | "FILE">("PRINT");
  const [label, setLabel] = useState("");
  const [path, setPath] = useState("");
  const [required, setRequired] = useState(false);
  const [notes, setNotes] = useState("");
  
  const pathMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/assets`, {
        kind,
        label,
        path,
        required,
        notes: notes || null,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to add path");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}/assets`] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      toast({
        title: "Hinzugefügt",
        description: "Server-Pfad wurde erfolgreich hinzugefügt.",
      });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Server-Pfad konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    },
  });
  
  const resetForm = () => {
    setKind("PRINT");
    setLabel("");
    setPath("");
    setRequired(false);
    setNotes("");
  };
  
  const handleSubmit = () => {
    if (!label || !path) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive",
      });
      return;
    }
    
    if (!path.startsWith("//") && !path.startsWith("\\\\")) {
      toast({
        title: "Fehler",
        description: "UNC-Pfad muss mit // oder \\\\ beginnen.",
        variant: "destructive",
      });
      return;
    }
    
    pathMutation.mutate();
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-server-path">
        <DialogHeader>
          <DialogTitle>Server-Pfad hinzufügen</DialogTitle>
          <DialogDescription>
            Fügen Sie einen UNC-Pfad zu einer Datei auf dem Server hinzu.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Art</Label>
            <Select value={kind} onValueChange={(v: any) => setKind(v)}>
              <SelectTrigger data-testid="select-path-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRINT">PRINT (druckrelevant)</SelectItem>
                <SelectItem value="FILE">FILE (sonstiges)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Label *</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="z.B. Logo Vorderseite"
              data-testid="input-path-label"
            />
          </div>
          
          <div>
            <Label>Serverpfad (UNC) *</Label>
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="//server/share/ordner/datei.pdf"
              data-testid="input-path"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Muss mit // oder \\ beginnen
            </p>
          </div>
          
          {kind === "PRINT" && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="path-required"
                checked={required}
                onCheckedChange={(checked) => setRequired(checked === true)}
                data-testid="checkbox-path-required"
              />
              <Label htmlFor="path-required" className="cursor-pointer">
                Erforderlich für Produktion
              </Label>
            </div>
          )}
          
          <div>
            <Label>Notizen (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Zusätzliche Informationen..."
              rows={2}
              data-testid="textarea-path-notes"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={pathMutation.isPending}
            data-testid="button-save-path"
          >
            {pathMutation.isPending ? "Wird hinzugefügt..." : "Hinzufügen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
