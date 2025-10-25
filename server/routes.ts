import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOrderSchema, updateOrderSchema, insertSizeTableSchema, csvImportSchema, insertPrintAssetSchema, insertOrderAssetSchema, insertPositionSchema, updatePositionSchema, insertWorkCenterSchema, updateWorkCenterSchema, insertTimeSlotSchema, updateTimeSlotSchema, batchTimeSlotSchema } from "@shared/schema";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { upload } from "./upload";
import path from "path";
import fs from "fs";

export async function registerRoutes(app: Express): Promise<Server> {
  // GET /api/orders - List orders with filters
  app.get("/api/orders", async (req, res) => {
    try {
      const filters = {
        q: req.query.q as string | undefined,
        department: req.query.department as any,
        source: req.query.source as any,
        workflow: req.query.workflow as any,
      };
      
      const orders = await storage.getOrders(filters);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });
  
  // GET /api/orders/:id - Get order details
  app.get("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrderById(req.params.id);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });
  
  // POST /api/orders - Create new INTERNAL order
  app.post("/api/orders", async (req, res) => {
    try {
      const validated = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(validated);
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating order:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });
  
  // PATCH /api/orders/:id - Update order fields
  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const validated = updateOrderSchema.parse(req.body);
      const order = await storage.updateOrder(req.params.id, validated);
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error) {
        if (error.message === "Order not found") {
          return res.status(404).json({ error: "Order not found" });
        }
        if (error.message === "Cannot modify customer or address fields for JTL orders") {
          return res.status(409).json({ error: "Cannot modify customer or address fields for JTL orders" });
        }
        if (error.message === "Cannot modify order fields in production, only notes allowed") {
          return res.status(409).json({ error: "Cannot modify order fields in production, only notes allowed" });
        }
      }
      console.error("Error updating order:", error);
      res.status(500).json({ error: "Failed to update order" });
    }
  });
  
  // GET /api/orders/:id/size - Get size table with countsBySize
  app.get("/api/orders/:id/size", async (req, res) => {
    try {
      const sizeTable = await storage.getSizeTable(req.params.id);
      
      if (!sizeTable) {
        return res.json(null);
      }
      
      // Calculate countsBySize
      const countsBySize: Record<string, number> = {};
      for (const row of sizeTable.rows) {
        const number = typeof row.number === 'string' ? parseInt(row.number, 10) : row.number;
        countsBySize[row.size] = (countsBySize[row.size] || 0) + number;
      }
      
      res.json({
        scheme: sizeTable.scheme,
        rows: sizeTable.rows,
        comment: sizeTable.comment,
        countsBySize,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Order not found") {
        return res.status(404).json({ error: "Order not found" });
      }
      console.error("Error fetching size table:", error);
      res.status(500).json({ error: "Failed to fetch size table" });
    }
  });

  // POST /api/orders/:id/size - Create/update size table (upsert)
  app.post("/api/orders/:id/size", async (req, res) => {
    try {
      const validated = insertSizeTableSchema.parse(req.body);
      const sizeTable = await storage.createOrUpdateSizeTable(req.params.id, validated);
      
      // Calculate countsBySize by summing quantities
      const countsBySize: Record<string, number> = {};
      for (const row of sizeTable.rows) {
        const number = typeof row.number === 'string' ? parseInt(row.number, 10) : row.number;
        countsBySize[row.size] = (countsBySize[row.size] || 0) + number;
      }
      
      res.json({
        scheme: sizeTable.scheme,
        rows: sizeTable.rows,
        comment: sizeTable.comment,
        countsBySize,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error && error.message === "Order not found") {
        return res.status(404).json({ error: "Order not found" });
      }
      console.error("Error creating/updating size table:", error);
      res.status(500).json({ error: "Failed to create/update size table" });
    }
  });

  // POST /api/orders/:id/size/import-csv - Import CSV and create/update size table
  app.post("/api/orders/:id/size/import-csv", async (req, res) => {
    try {
      const { csv, scheme, allowDuplicates } = csvImportSchema.parse(req.body);
      
      // Parse CSV
      const lines = csv.trim().split('\n');
      if (lines.length < 2) {
        return res.status(400).json({ error: "CSV must have at least header and one data row" });
      }
      
      // Parse header (case-insensitive)
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const sizeIdx = header.indexOf('size');
      const numberIdx = header.indexOf('number');
      const nameIdx = header.indexOf('name');
      
      if (sizeIdx === -1 || numberIdx === -1) {
        return res.status(400).json({ error: "CSV must have 'size' and 'number' columns" });
      }
      
      // Parse rows
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length > sizeIdx && cols.length > numberIdx) {
          rows.push({
            size: cols[sizeIdx],
            number: parseInt(cols[numberIdx], 10),
            name: nameIdx !== -1 && cols.length > nameIdx ? (cols[nameIdx] || null) : null,
          });
        }
      }
      
      const data = {
        scheme: scheme || "CUSTOM",
        rows,
        comment: null,
        allowDuplicates: allowDuplicates || false,
      };
      
      const validated = insertSizeTableSchema.parse(data);
      const sizeTable = await storage.createOrUpdateSizeTable(req.params.id, validated);
      
      // Calculate countsBySize by summing quantities
      const countsBySize: Record<string, number> = {};
      for (const row of sizeTable.rows) {
        const number = typeof row.number === 'string' ? parseInt(row.number, 10) : row.number;
        countsBySize[row.size] = (countsBySize[row.size] || 0) + number;
      }
      
      res.json({
        scheme: sizeTable.scheme,
        rows: sizeTable.rows,
        comment: sizeTable.comment,
        countsBySize,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error && error.message === "Order not found") {
        return res.status(404).json({ error: "Order not found" });
      }
      console.error("Error importing CSV:", error);
      res.status(500).json({ error: "Failed to import CSV" });
    }
  });

  // GET /api/orders/:id/size/export.csv - Export size table as CSV
  app.get("/api/orders/:id/size/export.csv", async (req, res) => {
    try {
      const sizeTable = await storage.getSizeTable(req.params.id);
      
      if (!sizeTable) {
        return res.status(404).json({ error: "Size table not found" });
      }
      
      // Generate CSV
      const csvLines = ['size,number,name'];
      for (const row of sizeTable.rows) {
        csvLines.push(`${row.size},${row.number},${row.name || ''}`);
      }
      
      const csvContent = csvLines.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="order-${req.params.id}-sizetable.csv"`);
      res.send(csvContent);
    } catch (error) {
      if (error instanceof Error && error.message === "Order not found") {
        return res.status(404).json({ error: "Order not found" });
      }
      console.error("Error exporting CSV:", error);
      res.status(500).json({ error: "Failed to export CSV" });
    }
  });
  
  // POST /api/orders/:id/print-assets - Add print asset (legacy)
  app.post("/api/orders/:id/print-assets", async (req, res) => {
    try {
      const validated = insertPrintAssetSchema.parse(req.body);
      const order = await storage.addPrintAsset(req.params.id, validated);
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error && error.message === "Order not found") {
        return res.status(404).json({ error: "Order not found" });
      }
      console.error("Error adding print asset:", error);
      res.status(500).json({ error: "Failed to add print asset" });
    }
  });
  
  // GET /api/orders/:id/assets - List all order assets
  app.get("/api/orders/:id/assets", async (req, res) => {
    try {
      const assets = await storage.getOrderAssets(req.params.id);
      res.json(assets);
    } catch (error) {
      if (error instanceof Error && error.message === "Order not found") {
        return res.status(404).json({ error: "Order not found" });
      }
      console.error("Error fetching assets:", error);
      res.status(500).json({ error: "Failed to fetch assets" });
    }
  });
  
  // POST /api/orders/:id/assets - Create asset with path or url
  app.post("/api/orders/:id/assets", async (req, res) => {
    try {
      const validated = insertOrderAssetSchema.parse(req.body);
      const asset = await storage.createOrderAsset(req.params.id, validated);
      res.status(201).json(asset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error) {
        if (error.message === "Order not found") {
          return res.status(404).json({ error: "Order not found" });
        }
        if (error.message === "UNC path must start with // or \\\\") {
          return res.status(400).json({ error: "UNC path must start with // or \\\\" });
        }
      }
      console.error("Error creating asset:", error);
      res.status(500).json({ error: "Failed to create asset" });
    }
  });
  
  // POST /api/orders/:id/assets/upload - Upload file(s)
  app.post("/api/orders/:id/assets/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const orderId = req.params.id;
      const file = req.file;
      
      // Extract metadata from form fields
      const kind = req.body.kind || "FILE";
      const label = req.body.label || file.originalname;
      const required = req.body.required === "true" || req.body.required === true;
      const notes = req.body.notes || null;
      
      // Build public URL
      const publicUrl = `/uploads/orders/${orderId}/${file.filename}`;
      
      // Get file extension
      const ext = path.extname(file.originalname).toLowerCase();
      
      // Create asset in database
      const asset = await storage.createOrderAsset(orderId, {
        kind,
        label,
        url: publicUrl,
        ext: ext || null,
        size: file.size,
        required,
        notes,
        path: null,
      });
      
      res.status(201).json(asset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error && error.message === "Order not found") {
        return res.status(404).json({ error: "Order not found" });
      }
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });
  
  // DELETE /api/orders/:id/assets/:assetId - Delete asset
  app.delete("/api/orders/:id/assets/:assetId", async (req, res) => {
    try {
      const result = await storage.deleteOrderAsset(req.params.id, req.params.assetId);
      
      // If a file path was returned, delete the file from disk
      if (result.filePath) {
        // SECURITY: Validate path is within uploads directory before deletion
        const uploadsDir = path.join(process.cwd(), 'uploads');
        const fullPath = path.join(process.cwd(), result.filePath);
        const resolvedPath = path.resolve(fullPath);
        const resolvedUploads = path.resolve(uploadsDir);
        
        // Ensure resolved path is within uploads directory
        if (!resolvedPath.startsWith(resolvedUploads)) {
          return res.status(403).json({ error: "Invalid file path" });
        }
        
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
      
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Asset not found") {
          return res.status(404).json({ error: "Asset not found" });
        }
        if (error.message === "Asset does not belong to this order") {
          return res.status(403).json({ error: "Asset does not belong to this order" });
        }
      }
      console.error("Error deleting asset:", error);
      res.status(500).json({ error: "Failed to delete asset" });
    }
  });
  
  // POST /api/orders/:id/submit - Submit order for production
  app.post("/api/orders/:id/submit", async (req, res) => {
    try {
      const order = await storage.submitOrder(req.params.id);
      res.json(order);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Order not found") {
          return res.status(404).json({ error: "Order not found" });
        }
        if (error.message === "Required print asset missing") {
          return res.status(412).json({ error: "Required print asset missing" });
        }
        if (error.message === "Size table required for TEAMSPORT department") {
          return res.status(412).json({ error: "Größentabelle erforderlich" });
        }
      }
      console.error("Error submitting order:", error);
      res.status(500).json({ error: "Failed to submit order" });
    }
  });

  // GET /api/orders/:id/positions - List positions for order
  app.get("/api/orders/:id/positions", async (req, res) => {
    try {
      const positions = await storage.getPositions(req.params.id);
      res.json(positions);
    } catch (error) {
      if (error instanceof Error && error.message === "Order not found") {
        return res.status(404).json({ error: "Order not found" });
      }
      console.error("Error fetching positions:", error);
      res.status(500).json({ error: "Failed to fetch positions" });
    }
  });

  // POST /api/orders/:id/positions - Create one or many positions
  app.post("/api/orders/:id/positions", async (req, res) => {
    try {
      const orderId = req.params.id;
      
      // Support both single object and array
      const isArray = Array.isArray(req.body);
      const itemsToValidate = isArray ? req.body : [req.body];
      
      // Validate all items
      const validated = itemsToValidate.map(item => insertPositionSchema.parse(item));
      
      // Create positions and recalculate totals
      const result = await storage.createPositions(orderId, validated);
      
      res.status(201).json(isArray ? result : result[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error && error.message === "Order not found") {
        return res.status(404).json({ error: "Order not found" });
      }
      console.error("Error creating positions:", error);
      res.status(500).json({ error: "Failed to create positions" });
    }
  });

  // PATCH /api/orders/:id/positions/:posId - Update position
  app.patch("/api/orders/:id/positions/:posId", async (req, res) => {
    try {
      const validated = updatePositionSchema.parse(req.body);
      const position = await storage.updatePosition(req.params.id, req.params.posId, validated);
      res.json(position);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error) {
        if (error.message === "Order not found" || error.message === "Position not found") {
          return res.status(404).json({ error: error.message });
        }
      }
      console.error("Error updating position:", error);
      res.status(500).json({ error: "Failed to update position" });
    }
  });

  // DELETE /api/orders/:id/positions/:posId - Delete position
  app.delete("/api/orders/:id/positions/:posId", async (req, res) => {
    try {
      await storage.deletePosition(req.params.id, req.params.posId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Order not found" || error.message === "Position not found") {
          return res.status(404).json({ error: error.message });
        }
      }
      console.error("Error deleting position:", error);
      res.status(500).json({ error: "Failed to delete position" });
    }
  });

  // ===== WorkCenter Routes =====

  // GET /api/workcenters - List work centers
  app.get("/api/workcenters", async (req, res) => {
    try {
      const department = req.query.department as any;
      const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined;
      
      const workCenters = await storage.getWorkCenters(department, active);
      res.json(workCenters);
    } catch (error) {
      console.error("Error fetching work centers:", error);
      res.status(500).json({ error: "Failed to fetch work centers" });
    }
  });

  // POST /api/workcenters - Create work center
  app.post("/api/workcenters", async (req, res) => {
    try {
      const validated = insertWorkCenterSchema.parse(req.body);
      const workCenter = await storage.createWorkCenter(validated);
      res.status(201).json(workCenter);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(422).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating work center:", error);
      res.status(500).json({ error: "Failed to create work center" });
    }
  });

  // PATCH /api/workcenters/:id - Update work center
  app.patch("/api/workcenters/:id", async (req, res) => {
    try {
      const validated = updateWorkCenterSchema.parse(req.body);
      const workCenter = await storage.updateWorkCenter(req.params.id, validated);
      res.json(workCenter);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(422).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error && error.message === "WorkCenter not found") {
        return res.status(404).json({ error: "WorkCenter not found" });
      }
      console.error("Error updating work center:", error);
      res.status(500).json({ error: "Failed to update work center" });
    }
  });

  // DELETE /api/workcenters/:id - Delete work center
  app.delete("/api/workcenters/:id", async (req, res) => {
    try {
      await storage.deleteWorkCenter(req.params.id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "WorkCenter not found") {
          return res.status(404).json({ error: "WorkCenter not found" });
        }
        if (error.message === "Cannot delete WorkCenter with future TimeSlots") {
          return res.status(409).json({ error: "Cannot delete WorkCenter with future TimeSlots" });
        }
      }
      console.error("Error deleting work center:", error);
      res.status(500).json({ error: "Failed to delete work center" });
    }
  });

  // ===== TimeSlot Routes =====

  // GET /api/calendar - Get time slots for calendar view
  app.get("/api/calendar", async (req, res) => {
    try {
      if (!req.query.startDate || !req.query.endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const filters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        workCenterId: req.query.workCenterId as string | undefined,
        department: req.query.department as any,
      };

      const slots = await storage.getCalendar(filters);
      res.json(slots);
    } catch (error) {
      console.error("Error fetching calendar:", error);
      res.status(500).json({ error: "Failed to fetch calendar" });
    }
  });

  // GET /api/orders/:id/timeslots - Get time slots for an order
  app.get("/api/orders/:id/timeslots", async (req, res) => {
    try {
      const slots = await storage.getOrderTimeSlots(req.params.id);
      res.json(slots);
    } catch (error) {
      console.error("Error fetching order time slots:", error);
      res.status(500).json({ error: "Failed to fetch order time slots" });
    }
  });

  // POST /api/timeslots - Create time slot
  app.post("/api/timeslots", async (req, res) => {
    try {
      const validated = insertTimeSlotSchema.parse(req.body);
      const timeSlot = await storage.createTimeSlot(validated);
      res.status(201).json(timeSlot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(422).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error) {
        if (error.message === "Order not found" || error.message === "WorkCenter not found") {
          return res.status(404).json({ error: error.message });
        }
        if (error.message === "Time slot overlaps with existing slot") {
          return res.status(409).json({ error: error.message });
        }
        if (
          error.message === "Order department must match WorkCenter department" ||
          error.message === "Order must be in FUER_PROD, IN_PROD, or WARTET_FEHLTEILE workflow state"
        ) {
          return res.status(412).json({ error: error.message });
        }
        if (error.message === "Time slot must be within working hours (07:00-18:00)") {
          return res.status(422).json({ error: error.message });
        }
      }
      console.error("Error creating time slot:", error);
      res.status(500).json({ error: "Failed to create time slot" });
    }
  });

  // PATCH /api/timeslots/:id - Update time slot
  app.patch("/api/timeslots/:id", async (req, res) => {
    try {
      const validated = updateTimeSlotSchema.parse(req.body);
      const timeSlot = await storage.updateTimeSlot(req.params.id, validated);
      res.json(timeSlot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(422).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error) {
        if (error.message === "TimeSlot not found" || error.message === "Order not found" || error.message === "WorkCenter not found") {
          return res.status(404).json({ error: error.message });
        }
        if (error.message === "Time slot overlaps with existing slot") {
          return res.status(409).json({ error: error.message });
        }
        if (
          error.message === "Order department must match WorkCenter department" ||
          error.message === "Order must be in FUER_PROD, IN_PROD, or WARTET_FEHLTEILE workflow state"
        ) {
          return res.status(412).json({ error: error.message });
        }
        if (error.message === "Time slot must be within working hours (07:00-18:00)") {
          return res.status(422).json({ error: error.message });
        }
      }
      console.error("Error updating time slot:", error);
      res.status(500).json({ error: "Failed to update time slot" });
    }
  });

  // DELETE /api/timeslots/:id - Delete time slot
  app.delete("/api/timeslots/:id", async (req, res) => {
    try {
      await storage.deleteTimeSlot(req.params.id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === "TimeSlot not found") {
        return res.status(404).json({ error: "TimeSlot not found" });
      }
      console.error("Error deleting time slot:", error);
      res.status(500).json({ error: "Failed to delete time slot" });
    }
  });

  // POST /api/timeslots/batch - Batch operations for time slots
  app.post("/api/timeslots/batch", async (req, res) => {
    try {
      const validated = batchTimeSlotSchema.parse(req.body);
      const result = await storage.batchTimeSlots(validated);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(422).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes("overlaps")) {
          return res.status(409).json({ error: error.message });
        }
        if (
          error.message.includes("department") ||
          error.message.includes("workflow state")
        ) {
          return res.status(412).json({ error: error.message });
        }
        if (error.message.includes("working hours")) {
          return res.status(422).json({ error: error.message });
        }
      }
      console.error("Error in batch operation:", error);
      res.status(500).json({ error: "Failed to execute batch operation" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
