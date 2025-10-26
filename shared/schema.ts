import { z } from "zod";
import type { Order, SizeTable, PrintAsset, OrderAsset, OrderPosition, OrderSource, Department, WorkflowState, QCState } from "@prisma/client";

// Re-export Prisma types
export type { Order, SizeTable, PrintAsset, OrderAsset, OrderPosition, OrderSource, Department, WorkflowState, QCState };

// Enum schemas
export const orderSourceSchema = z.enum(["JTL", "INTERNAL"]);
export const departmentSchema = z.enum(["TEAMSPORT", "TEXTILVEREDELUNG", "STICKEREI", "DRUCK", "SONSTIGES"]);
export const workflowStateSchema = z.enum(["ENTWURF", "NEU", "PRUEFUNG", "FUER_PROD", "IN_PROD", "WARTET_FEHLTEILE", "FERTIG", "ZUR_ABRECHNUNG", "ABGERECHNET"]);
export const qcStateSchema = z.enum(["IO", "NIO", "UNGEPRUEFT"]);

// German workflow labels and colors
export const WORKFLOW_LABELS: Record<WorkflowState, string> = {
  ENTWURF: "Entwurf",
  NEU: "Entwurf",
  PRUEFUNG: "Prüfung",
  FUER_PROD: "Für Produktion",
  IN_PROD: "In Produktion",
  WARTET_FEHLTEILE: "Wartet auf Fehlteile",
  FERTIG: "Produktion fertig",
  ZUR_ABRECHNUNG: "Ausgabe erfolgt",
  ABGERECHNET: "Abgerechnet",
};

export function getWorkflowBadgeVariant(workflow: WorkflowState): "default" | "secondary" | "destructive" | "outline" {
  switch (workflow) {
    case "ENTWURF":
    case "NEU":
      return "secondary";
    case "PRUEFUNG":
      return "secondary";
    case "FUER_PROD":
      return "default";
    case "IN_PROD":
      return "default";
    case "WARTET_FEHLTEILE":
      return "destructive";
    case "FERTIG":
      return "default";
    case "ZUR_ABRECHNUNG":
      return "outline";
    case "ABGERECHNET":
      return "outline";
    default:
      return "secondary";
  }
}

export function getWorkflowBadgeColor(workflow: WorkflowState): string {
  switch (workflow) {
    case "ENTWURF":
    case "NEU":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600";
    case "PRUEFUNG":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700";
    case "FUER_PROD":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700";
    case "IN_PROD":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-700";
    case "WARTET_FEHLTEILE":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700";
    case "FERTIG":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 dark:border-green-700";
    case "ZUR_ABRECHNUNG":
      return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-400 dark:border-green-600";
    case "ABGERECHNET":
      return "bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-300 border-gray-400 dark:border-gray-600";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600";
  }
}

// Insert schemas for creating new records
export const insertOrderSchema = z.object({
  title: z.string().min(1, "Title is required"),
  customer: z.string().min(1, "Customer is required"),
  department: departmentSchema,
  dueDate: z.string().datetime().optional().nullable().transform(val => val || null),
  notes: z.string().optional().nullable().transform(val => val || null),
  location: z.string().optional().nullable().transform(val => val || null),
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
