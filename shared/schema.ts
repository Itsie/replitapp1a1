import { z } from "zod";
import type { Order, SizeTable, PrintAsset, OrderAsset, OrderPosition, OrderSource, Department, WorkflowState, QCState, WarehouseGroup, WarehousePlace } from "@prisma/client";

// Re-export Prisma types
export type { Order, SizeTable, PrintAsset, OrderAsset, OrderPosition, OrderSource, Department, WorkflowState, QCState, WarehouseGroup, WarehousePlace };

// Enum schemas
export const orderSourceSchema = z.enum(["JTL", "INTERNAL"]);
export const departmentSchema = z.enum(["TEAMSPORT", "TEXTILVEREDELUNG", "STICKEREI", "DRUCK", "SONSTIGES"]);
export const workflowStateSchema = z.enum(["ENTWURF", "NEU", "PRUEFUNG", "FUER_PROD", "IN_PROD", "WARTET_FEHLTEILE", "FERTIG", "ZUR_ABRECHNUNG", "ABGERECHNET"]);
export const qcStateSchema = z.enum(["IO", "NIO", "UNGEPRUEFT"]);

// ===== MODERNIZED STATUS LABELS & COLORS =====
// German workflow labels (Order Status)
export const WORKFLOW_LABELS: Record<WorkflowState, string> = {
  ENTWURF: "Entwurf",
  NEU: "Neu",
  PRUEFUNG: "Prüfung",
  FUER_PROD: "Bereit für Produktion",
  IN_PROD: "In Produktion",
  WARTET_FEHLTEILE: "Wartet auf Fehlteile",
  FERTIG: "Fertig produziert",
  ZUR_ABRECHNUNG: "Zur Abrechnung",
  ABGERECHNET: "Abgerechnet",
};

// Department labels
export const DEPARTMENT_LABELS: Record<Department, string> = {
  TEAMSPORT: "Teamsport",
  TEXTILVEREDELUNG: "Textilveredelung",
  STICKEREI: "Stickerei",
  DRUCK: "Druck",
  SONSTIGES: "Sonstiges",
};

// Source labels
export const SOURCE_LABELS: Record<OrderSource, string> = {
  JTL: "JTL",
  INTERNAL: "Intern",
};

// TimeSlot Status Labels (for production view)
export const TIMESLOT_STATUS_LABELS = {
  PLANNED: "Geplant",
  RUNNING: "In Produktion",
  PAUSED: "Pause",
  DONE: "Fertig",
  BLOCKED: "Blockiert",
} as const;

// Kontrastsichere Badge-Styles (solid), Dunkel/Hell tauglich
export const WORKFLOW_BADGE_CLASSES: Record<WorkflowState, string> = {
  ENTWURF: "bg-slate-500 text-white border-transparent dark:bg-slate-600",
  NEU: "bg-cyan-600 text-white border-transparent dark:bg-cyan-500",
  PRUEFUNG: "bg-amber-600 text-white border-transparent dark:bg-amber-500",
  FUER_PROD: "bg-indigo-600 text-white border-transparent dark:bg-indigo-500",
  IN_PROD: "bg-blue-600 text-white border-transparent dark:bg-blue-500",
  WARTET_FEHLTEILE: "bg-orange-600 text-white border-transparent dark:bg-orange-500",
  FERTIG: "bg-emerald-600 text-white border-transparent dark:bg-emerald-500",
  ZUR_ABRECHNUNG: "bg-fuchsia-600 text-white border-transparent dark:bg-fuchsia-500",
  ABGERECHNET: "bg-zinc-700 text-white border-transparent dark:bg-zinc-600",
};

// Department Badge Classes (solid colors)
export const DEPARTMENT_BADGE_CLASSES: Record<Department, string> = {
  TEAMSPORT: "bg-blue-500 text-white border-transparent dark:bg-blue-600",
  TEXTILVEREDELUNG: "bg-purple-500 text-white border-transparent dark:bg-purple-600",
  STICKEREI: "bg-pink-500 text-white border-transparent dark:bg-pink-600",
  DRUCK: "bg-green-600 text-white border-transparent dark:bg-green-500",
  SONSTIGES: "bg-gray-500 text-white border-transparent dark:bg-gray-600",
};

// Source Badge Classes (solid colors)
export const SOURCE_BADGE_CLASSES: Record<OrderSource, string> = {
  JTL: "bg-sky-600 text-white border-transparent dark:bg-sky-500",
  INTERNAL: "bg-emerald-600 text-white border-transparent dark:bg-emerald-500",
};

// TimeSlot Status Colors (for production views - solid colors)
export const TIMESLOT_BADGE_CLASSES: Record<string, string> = {
  PLANNED: "bg-indigo-600 text-white border-transparent dark:bg-indigo-500",
  RUNNING: "bg-emerald-600 text-white border-transparent dark:bg-emerald-500",
  PAUSED: "bg-amber-600 text-white border-transparent dark:bg-amber-500",
  DONE: "bg-teal-600 text-white border-transparent dark:bg-teal-500",
  BLOCKED: "bg-red-600 text-white border-transparent dark:bg-red-500",
};

// Convenience-Getter
export function getWorkflowBadgeClass(wf: WorkflowState): string {
  return WORKFLOW_BADGE_CLASSES[wf] ?? "bg-slate-500 text-white border-transparent";
}

export function getDepartmentBadgeClass(dep: Department): string {
  return DEPARTMENT_BADGE_CLASSES[dep] ?? "bg-gray-500 text-white border-transparent";
}

export function getSourceBadgeClass(src: OrderSource): string {
  return SOURCE_BADGE_CLASSES[src] ?? "bg-gray-500 text-white border-transparent";
}

export function getTimeSlotBadgeClass(status: string): string {
  return TIMESLOT_BADGE_CLASSES[status] ?? "bg-slate-500 text-white border-transparent";
}

// ===== ORDER HINTS =====
// Text hints that appear in the "Hinweise" column to show requirements or warnings

// Calculate which text hints to show for an order
export function getOrderHints(order: OrderWithRelations): string[] {
  const hints: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check for missing print assets (required printAssets or orderAssets)
  const hasRequiredAssets = (order.printAssets && order.printAssets.some(a => a.required)) || 
                            (order.orderAssets && order.orderAssets.some(a => a.required));
  if (!hasRequiredAssets) {
    hints.push("Druckdaten fehlen");
  }

  // Check for missing size table (TEAMSPORT only)
  if (order.department === "TEAMSPORT" && !order.sizeTable) {
    hints.push("Größentabelle fehlt");
  }

  // Check for overdue or due today
  if (order.dueDate && order.workflow !== "FERTIG" && order.workflow !== "ABGERECHNET" && order.workflow !== "ZUR_ABRECHNUNG") {
    const dueDate = new Date(order.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    if (dueDate.getTime() === today.getTime()) {
      hints.push("Heute fällig");
    } else if (dueDate < today) {
      const diffTime = Math.abs(today.getTime() - dueDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const formattedDate = dueDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      hints.push(`Überfällig seit ${formattedDate}`);
    }
  }

  return hints;
}

// Insert schemas for creating new records
export const insertOrderSchema = z.object({
  title: z.string().min(1, "Title is required"),
  customer: z.string().optional(),
  department: departmentSchema,
  dueDate: z.string().datetime().optional().nullable().transform(val => val || null),
  notes: z.string().optional().nullable().transform(val => val || null),
  location: z.string().optional().nullable().transform(val => val || null),
  locationPlaceId: z.string().optional().nullable().transform(val => val || null),
  company: z.string().optional().nullable().transform(val => val || null),
  contactFirstName: z.string().optional().nullable().transform(val => val || null),
  contactLastName: z.string().optional().nullable().transform(val => val || null),
  customerEmail: z.string().email("Must be a valid email address"),
  customerPhone: z.string().min(5, "Phone number must be at least 5 characters"),
  billStreet: z.string().min(1, "Billing street is required"),
  billZip: z.string().min(1, "Billing ZIP code is required"),
  billCity: z.string().min(1, "Billing city is required"),
  billCountry: z.string().default("DE"),
  shipStreet: z.string().optional().nullable().transform(val => val || null),
  shipZip: z.string().optional().nullable().transform(val => val || null),
  shipCity: z.string().optional().nullable().transform(val => val || null),
  shipCountry: z.string().optional().nullable().transform(val => val || null),
}).refine(
  (data) => {
    // Either company OR (firstName + lastName) is required
    return data.company || (data.contactFirstName && data.contactLastName);
  },
  {
    message: "Either company name or both first and last name are required",
    path: ["company"],
  }
).refine(
  (data) => {
    // If any shipping field is provided, all shipping fields must be present
    const hasAnyShipping = data.shipStreet || data.shipZip || data.shipCity || data.shipCountry;
    if (hasAnyShipping) {
      return data.shipStreet && data.shipZip && data.shipCity && data.shipCountry;
    }
    return true;
  },
  {
    message: "If using alternate shipping address, all shipping fields (street, ZIP, city, country) are required",
    path: ["shipStreet"],
  }
);

// Schema for size table row entries (roster-style: one item per jersey/shirt)
export const sizeTableRowSchema = z.object({
  size: z.string().min(1).max(10, "Size must be 1-10 characters"),
  number: z.number().int().min(0).max(999, "Number must be 0-999"),
  name: z.string().max(30, "Name must be max 30 characters").optional().nullable(),
});

export const insertSizeTableSchema = z.object({
  scheme: z.enum(["ALPHA", "NUMERIC", "CUSTOM"]),
  rows: z.array(sizeTableRowSchema).min(1).max(1000, "Max 1000 items allowed"),
  comment: z.string().optional().nullable(),
  allowDuplicates: z.boolean().optional().default(false),
}).refine(
  (data) => {
    if (data.allowDuplicates) return true;
    const numbers = data.rows.map(r => r.number);
    const uniqueNumbers = new Set(numbers);
    return numbers.length === uniqueNumbers.size;
  },
  {
    message: "Duplicate numbers found. Enable 'allowDuplicates' or ensure all numbers are unique.",
    path: ["rows"],
  }
);

export const csvImportSchema = z.object({
  csv: z.string().min(1, "CSV data is required"),
  scheme: z.enum(["ALPHA", "NUMERIC", "CUSTOM"]).optional(),
  allowDuplicates: z.boolean().optional().default(false),
});

export const insertPrintAssetSchema = z.object({
  label: z.string().min(1, "Label is required"),
  url: z.string().url("Must be a valid URL"),
  required: z.boolean().default(true),
});

// Schema for OrderAsset (new asset system)
export const assetKindSchema = z.enum(["PRINT", "FILE"]);

export const insertOrderAssetSchema = z.object({
  kind: assetKindSchema,
  label: z.string().min(1, "Label is required"),
  path: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  ext: z.string().optional().nullable(),
  size: z.number().int().positive().optional().nullable(),
  required: z.boolean().default(false),
  notes: z.string().optional().nullable(),
}).refine(
  (data) => data.path || data.url,
  {
    message: "Either path or url must be provided",
    path: ["path"],
  }
);

// Position procurement status enum
export const procurementStatusSchema = z.enum(["NONE", "ORDER_NEEDED", "ORDERED", "RECEIVED"]);

// Schema for creating/updating order positions
export const insertPositionSchema = z.object({
  articleName: z.string().min(1, "Article name is required"),
  articleNumber: z.string().optional().nullable(),
  qty: z.number().positive("Quantity must be positive"),
  unit: z.string().default("Stk"),
  unitPriceNet: z.number().nonnegative("Price must be non-negative"),
  vatRate: z.number().int().refine(val => [0, 7, 19].includes(val), {
    message: "VAT rate must be 0, 7, or 19",
  }).default(19),
  procurement: procurementStatusSchema.default("NONE"),
  supplierNote: z.string().optional().nullable(),
});

export const updatePositionSchema = insertPositionSchema.partial();

// Schema for updating order fields
export const updateOrderSchema = z.object({
  // Customer fields
  company: z.string().trim().optional().nullable(),
  contactFirstName: z.string().trim().optional().nullable(),
  contactLastName: z.string().trim().optional().nullable(),
  customerEmail: z.string().email("Must be a valid email address").optional(),
  customerPhone: z.string().min(5, "Phone number must be at least 5 characters").optional(),
  
  // Billing address
  billStreet: z.string().trim().min(1, "Billing street is required").optional(),
  billZip: z.string().trim().min(1, "Billing ZIP code is required").optional(),
  billCity: z.string().trim().min(1, "Billing city is required").optional(),
  billCountry: z.string().optional(),
  
  // Shipping address (optional)
  shipStreet: z.string().trim().optional().nullable(),
  shipZip: z.string().trim().optional().nullable(),
  shipCity: z.string().trim().optional().nullable(),
  shipCountry: z.string().optional().nullable(),
  
  // Meta fields
  title: z.string().trim().min(1, "Title is required").optional(),
  customer: z.string().trim().min(1, "Customer is required").optional(),
  department: departmentSchema.optional(),
  workflow: workflowStateSchema.optional(),
  dueDate: z.string().datetime().optional().nullable().transform(val => val || null),
  location: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

// Infer types
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type UpdateOrder = z.infer<typeof updateOrderSchema>;
export type InsertSizeTable = z.infer<typeof insertSizeTableSchema>;
export type CSVImport = z.infer<typeof csvImportSchema>;
export type SizeTableRow = z.infer<typeof sizeTableRowSchema>;
export type InsertPrintAsset = z.infer<typeof insertPrintAssetSchema>;
export type InsertOrderAsset = z.infer<typeof insertOrderAssetSchema>;
export type AssetKind = z.infer<typeof assetKindSchema>;
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type UpdatePosition = z.infer<typeof updatePositionSchema>;

// API response types
export type SizeTableResponse = {
  scheme: string;
  rows: SizeTableRow[];
  comment: string | null;
  countsBySize: Record<string, number>;
};

// Order with relations for API responses
export type OrderWithRelations = Order & {
  sizeTable: SizeTable | null;
  printAssets: PrintAsset[];
  orderAssets: OrderAsset[];
  positions: OrderPosition[];
  timeSlots?: Array<{
    id: string;
    status: string;
    startedAt: Date | null;
  }>;
};

// ===== WorkCenter & TimeSlot Schemas =====

// WorkCenter insert schema
export const insertWorkCenterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  department: departmentSchema,
  capacityMin: z.number().int().positive("Capacity must be positive").default(660),
  concurrentCapacity: z.number().int().min(1, "Concurrent capacity must be at least 1").default(2),
  active: z.boolean().default(true),
});

// WorkCenter update schema
export const updateWorkCenterSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  department: departmentSchema.optional(),
  capacityMin: z.number().int().positive("Capacity must be positive").optional(),
  concurrentCapacity: z.number().int().min(1, "Concurrent capacity must be at least 1").optional(),
  active: z.boolean().optional(),
});

// TimeSlot insert schema with validations
export const insertTimeSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  startMin: z.number().int().nonnegative("Start time must be non-negative"),
  lengthMin: z.number().int().positive("Length must be positive"),
  workCenterId: z.string().min(1, "WorkCenter ID is required"),
  orderId: z.string().optional().nullable(),
  blocked: z.boolean().default(false),
  note: z.string().optional().nullable(),
}).refine(
  (data) => data.startMin % 5 === 0,
  {
    message: "Start time must be in 5-minute increments",
    path: ["startMin"],
  }
).refine(
  (data) => data.lengthMin % 5 === 0,
  {
    message: "Length must be in 5-minute increments",
    path: ["lengthMin"],
  }
).refine(
  (data) => data.startMin >= 420 && data.startMin + data.lengthMin <= 1080,
  {
    message: "Time slot must be within working hours (07:00-18:00, 420-1080 minutes)",
    path: ["startMin"],
  }
).refine(
  (data) => {
    // If orderId is set, blocked must be false
    if (data.orderId && data.blocked) {
      return false;
    }
    return true;
  },
  {
    message: "Cannot have both orderId and blocked=true",
    path: ["blocked"],
  }
);

// TimeSlot update schema (partial)
export const updateTimeSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  startMin: z.number().int().nonnegative("Start time must be non-negative").optional(),
  lengthMin: z.number().int().positive("Length must be positive").optional(),
  workCenterId: z.string().min(1, "WorkCenter ID is required").optional(),
  orderId: z.string().optional().nullable(),
  blocked: z.boolean().optional(),
  note: z.string().optional().nullable(),
}).refine(
  (data) => !data.startMin || data.startMin % 5 === 0,
  {
    message: "Start time must be in 5-minute increments",
    path: ["startMin"],
  }
).refine(
  (data) => !data.lengthMin || data.lengthMin % 5 === 0,
  {
    message: "Length must be in 5-minute increments",
    path: ["lengthMin"],
  }
);

// Batch operations schema
export const batchTimeSlotSchema = z.object({
  create: z.array(insertTimeSlotSchema).optional(),
  update: z.array(z.object({
    id: z.string().min(1, "ID is required"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
    startMin: z.number().int().nonnegative("Start time must be non-negative").optional(),
    lengthMin: z.number().int().positive("Length must be positive").optional(),
    workCenterId: z.string().min(1, "WorkCenter ID is required").optional(),
    orderId: z.string().optional().nullable(),
    blocked: z.boolean().optional(),
    note: z.string().optional().nullable(),
  })).optional(),
  delete: z.array(z.string().min(1, "ID is required")).optional(),
});

// TimeSlot status enum schema
export const timeSlotStatusSchema = z.enum(["PLANNED", "RUNNING", "PAUSED", "DONE", "BLOCKED"]);

// TimeSlot QC enum schema (subset of QCState - only IO/NIO, no UNGEPRUEFT)
export const timeSlotQCStateSchema = z.enum(["IO", "NIO"]);

// TimeSlot action schemas
export const timeSlotQCSchema = z.object({
  qc: timeSlotQCStateSchema,
  note: z.string().optional().nullable(),
});

export const timeSlotMissingPartsSchema = z.object({
  note: z.string().min(1, "Hinweis ist erforderlich"),
  updateOrderWorkflow: z.boolean().default(false), // optional: set order to WARTET_FEHLTEILE
});

// Infer types
export type InsertWorkCenter = z.infer<typeof insertWorkCenterSchema>;
export type UpdateWorkCenter = z.infer<typeof updateWorkCenterSchema>;
export type InsertTimeSlot = z.infer<typeof insertTimeSlotSchema>;
export type UpdateTimeSlot = z.infer<typeof updateTimeSlotSchema>;
export type BatchTimeSlot = z.infer<typeof batchTimeSlotSchema>;
export type TimeSlotStatus = z.infer<typeof timeSlotStatusSchema>;
export type TimeSlotQC = z.infer<typeof timeSlotQCSchema>;
export type TimeSlotMissingParts = z.infer<typeof timeSlotMissingPartsSchema>;

// ===== Warehouse Schemas =====

// WarehouseGroup schemas
export const insertWarehouseGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be max 50 characters"),
  description: z.string().max(200, "Description must be max 200 characters").optional().nullable(),
});

export const updateWarehouseGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be max 50 characters").optional(),
  description: z.string().max(200, "Description must be max 200 characters").optional().nullable(),
});

// WarehousePlace schemas
export const insertWarehousePlaceSchema = z.object({
  groupId: z.string().min(1, "Group is required"),
  name: z.string().min(1, "Name is required").max(50, "Name must be max 50 characters"),
});

export const updateWarehousePlaceSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be max 50 characters").optional(),
  groupId: z.string().min(1, "Group is required").optional(),
});

// Generator schema
export const generateWarehousePlacesSchema = z.object({
  prefix: z.string().max(20, "Prefix must be max 20 characters").default(""),
  start: z.number().int().min(1, "Start must be >= 1"),
  end: z.number().int().min(1, "End must be >= 1"),
  zeroPad: z.number().int().min(0, "Zero pad must be >= 0").max(4, "Zero pad must be <= 4").default(0),
  separator: z.string().max(5, "Separator must be max 5 characters").default(" "),
  suffix: z.string().max(20, "Suffix must be max 20 characters").default(""),
}).refine((data) => data.start <= data.end, {
  message: "Start must be <= End",
  path: ["start"],
});

// Order warehouse assignment schema
export const assignWarehousePlaceSchema = z.object({
  placeId: z.string().min(1, "Place ID is required").nullable(),
});

export type InsertWarehouseGroup = z.infer<typeof insertWarehouseGroupSchema>;
export type UpdateWarehouseGroup = z.infer<typeof updateWarehouseGroupSchema>;
export type InsertWarehousePlace = z.infer<typeof insertWarehousePlaceSchema>;
export type UpdateWarehousePlace = z.infer<typeof updateWarehousePlaceSchema>;
export type GenerateWarehousePlaces = z.infer<typeof generateWarehousePlacesSchema>;
export type AssignWarehousePlace = z.infer<typeof assignWarehousePlaceSchema>;

// WarehousePlace with relations for API responses
export type WarehousePlaceWithRelations = WarehousePlace & {
  group: WarehouseGroup;
  occupiedByOrder?: Order | null;
};

// WarehouseGroup with relations for API responses
export type WarehouseGroupWithRelations = WarehouseGroup & {
  places: WarehousePlace[];
};
