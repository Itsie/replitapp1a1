import { z } from "zod";
import type { Order, SizeTable, PrintAsset, OrderPosition, OrderSource, Department, WorkflowState, QCState } from "@prisma/client";

// Re-export Prisma types
export type { Order, SizeTable, PrintAsset, OrderPosition, OrderSource, Department, WorkflowState, QCState };

// Enum schemas
export const orderSourceSchema = z.enum(["JTL", "INTERNAL"]);
export const departmentSchema = z.enum(["TEAMSPORT", "TEXTILVEREDELUNG", "STICKEREI", "DRUCK", "SONSTIGES"]);
export const workflowStateSchema = z.enum(["ENTWURF", "NEU", "PRUEFUNG", "FUER_PROD", "IN_PROD", "WARTET_FEHLTEILE", "FERTIG", "ZUR_ABRECHNUNG", "ABGERECHNET"]);
export const qcStateSchema = z.enum(["IO", "NIO", "UNGEPRUEFT"]);

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

// Schema for size table row entries
const sizeTableRowSchema = z.object({
  size: z.string(),
  qty: z.number().int().nonnegative(),
  name: z.string().optional(),
  number: z.string().optional(),
});

export const insertSizeTableSchema = z.object({
  scheme: z.string().min(1, "Scheme is required"),
  rows: z.array(sizeTableRowSchema).min(1, "At least one row is required"),
  comment: z.string().optional().nullable(),
});

export const insertPrintAssetSchema = z.object({
  label: z.string().min(1, "Label is required"),
  url: z.string().url("Must be a valid URL"),
  required: z.boolean().default(true),
});

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

// Infer types
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertSizeTable = z.infer<typeof insertSizeTableSchema>;
export type InsertPrintAsset = z.infer<typeof insertPrintAssetSchema>;
export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type UpdatePosition = z.infer<typeof updatePositionSchema>;

// Order with relations for API responses
export type OrderWithRelations = Order & {
  sizeTable: SizeTable | null;
  printAssets: PrintAsset[];
  positions: OrderPosition[];
};
