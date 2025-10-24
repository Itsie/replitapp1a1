import { z } from "zod";
import type { Order, SizeTable, PrintAsset, OrderSource, Department, WorkflowState, QCState } from "@prisma/client";

// Re-export Prisma types
export type { Order, SizeTable, PrintAsset, OrderSource, Department, WorkflowState, QCState };

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
});

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

// Infer types
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertSizeTable = z.infer<typeof insertSizeTableSchema>;
export type InsertPrintAsset = z.infer<typeof insertPrintAssetSchema>;

// Order with relations for API responses
export type OrderWithRelations = Order & {
  sizeTable: SizeTable | null;
  printAssets: PrintAsset[];
};
