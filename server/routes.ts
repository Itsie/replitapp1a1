import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOrderSchema, updateOrderSchema, insertSizeTableSchema, csvImportSchema, insertPrintAssetSchema, insertOrderAssetSchema, insertPositionSchema, updatePositionSchema, insertWorkCenterSchema, updateWorkCenterSchema, insertTimeSlotSchema, updateTimeSlotSchema, batchTimeSlotSchema, timeSlotQCSchema, timeSlotMissingPartsSchema, insertWarehouseGroupSchema, updateWarehouseGroupSchema, insertWarehousePlaceSchema, updateWarehousePlaceSchema, generateWarehousePlacesSchema, assignWarehousePlaceSchema } from "@shared/schema";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { upload } from "./upload";
import path from "path";
import fs from "fs";
import { requireAuth, requireRole } from "./auth";
import { verifyPassword, hashPassword } from "./password";

export async function registerRoutes(app: Express): Promise<Server> {
  // ===== Auth Routes =====
  
  // POST /api/auth/login - Login with email and password
  app.post("/api/auth/login", async (req, res) => {
    try {
      const loginSchema = z.object({
        email: z.string().email("Invalid email"),
        password: z.string().min(1, "Password is required"),
      });

      const { email, password } = loginSchema.parse(req.body);

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Verify password
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Regenerate session to prevent session fixation attacks
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ error: "Login failed" });
        }

        // Create session with new session ID
        req.session.userId = user.id;

        // Save session before sending response
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            return res.status(500).json({ error: "Login failed" });
          }

          // Return user data (without password)
          res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          });
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // POST /api/auth/logout - Logout (destroy session)
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // POST /api/auth/change-password - Change password (requires authentication)
  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const changePasswordSchema = z.object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string().min(6, "New password must be at least 6 characters"),
      });

      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

      // Get current user with password
      const user = await storage.getUserByEmail(req.user!.email);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const isValid = await verifyPassword(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Hash new password and update
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashedPassword });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // ===== User Routes =====
  
  // GET /api/me - Get current user
  app.get("/api/me", requireAuth, async (req, res) => {
    res.json(req.user);
  });

  // GET /api/users - List all users (ADMIN only)
  app.get("/api/users", requireRole('ADMIN'), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // POST /api/users - Create new user (ADMIN only)
  app.post("/api/users", requireRole('ADMIN'), async (req, res) => {
    try {
      const createUserSchema = z.object({
        email: z.string().email("Invalid email"),
        name: z.string().min(1, "Name is required"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        role: z.enum(['ADMIN', 'PROD_PLAN', 'PROD_RUN', 'SALES_OPS', 'ACCOUNTING']),
      });

      const validated = createUserSchema.parse(req.body);

      // Check if email already exists
      const existing = await storage.getUserByEmail(validated.email);
      if (existing) {
        return res.status(409).json({ error: "Email already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(validated.password);

      // Create user
      const user = await storage.createUser({
        ...validated,
        password: hashedPassword,
      });

      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // PATCH /api/users/:id - Update user (ADMIN only)
  app.patch("/api/users/:id", requireRole('ADMIN'), async (req, res) => {
    try {
      const updateUserSchema = z.object({
        email: z.string().email("Invalid email").optional(),
        name: z.string().min(1, "Name is required").optional(),
        password: z.string().min(6, "Password must be at least 6 characters").optional(),
        role: z.enum(['ADMIN', 'PROD_PLAN', 'PROD_RUN', 'SALES_OPS', 'ACCOUNTING']).optional(),
      });

      const validated = updateUserSchema.parse(req.body);

      // If email is being changed, check if it's already taken
      if (validated.email) {
        const existing = await storage.getUserByEmail(validated.email);
        if (existing && existing.id !== req.params.id) {
          return res.status(409).json({ error: "Email already exists" });
        }
      }

      // If password is being updated, hash it
      const updateData: any = { ...validated };
      if (validated.password) {
        updateData.password = await hashPassword(validated.password);
      }

      // Update user
      const user = await storage.updateUser(req.params.id, updateData);

      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // DELETE /api/users/:id - Delete user (ADMIN only)
  app.delete("/api/users/:id", requireRole('ADMIN'), async (req, res) => {
    try {
      // Prevent deleting own account
      if (req.user!.id === req.params.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });
  
  // ===== Order Routes =====
  
  // GET /api/orders - List orders with filters (requires authentication)
  app.get("/api/orders", requireAuth, async (req, res) => {
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
  
  // GET /api/orders/:id - Get order details (requires authentication)
  app.get("/api/orders/:id", requireAuth, async (req, res) => {
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
  
  // POST /api/orders - Create new INTERNAL order (ADMIN, SALES_OPS, or PROD_PLAN)
  app.post("/api/orders", requireRole('ADMIN', 'SALES_OPS', 'PROD_PLAN'), async (req, res) => {
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
  
  // PATCH /api/orders/:id - Update order fields (ADMIN, SALES_OPS, or PROD_PLAN)
  app.patch("/api/orders/:id", requireRole('ADMIN', 'SALES_OPS', 'PROD_PLAN'), async (req, res) => {
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
  
  // GET /api/orders/:id/size - Get size table with countsBySize (requires authentication)
  app.get("/api/orders/:id/size", requireAuth, async (req, res) => {
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

  // GET /api/orders/:id/size/export.csv - Export size table as CSV (requires authentication)
  app.get("/api/orders/:id/size/export.csv", requireAuth, async (req, res) => {
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
  
  // GET /api/orders/:id/assets - List all order assets (requires authentication)
  app.get("/api/orders/:id/assets", requireAuth, async (req, res) => {
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

  // GET /api/orders/:id/positions - List positions for order (requires authentication)
  app.get("/api/orders/:id/positions", requireAuth, async (req, res) => {
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

  // POST /api/orders/:id/deliver - Mark order as delivered (ADMIN or PROD_PLAN only)
  app.post("/api/orders/:id/deliver", requireRole('ADMIN', 'PROD_PLAN'), async (req, res) => {
    try {
      const deliverSchema = z.object({
        deliveredAt: z.string().datetime(),
        deliveredQty: z.number().int().positive().optional(),
        deliveredNote: z.string().optional(),
      });

      const validated = deliverSchema.parse(req.body);
      const order = await storage.deliverOrder(req.params.id, {
        deliveredAt: new Date(validated.deliveredAt),
        deliveredQty: validated.deliveredQty,
        deliveredNote: validated.deliveredNote,
      });

      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error) {
        if (error.message === "Order not found") {
          return res.status(404).json({ error: "Order not found" });
        }
        if (error.message.includes("Order must be FERTIG or FUER_PROD")) {
          return res.status(412).json({ error: error.message });
        }
        if (error.message.includes("open time slots")) {
          return res.status(412).json({ error: error.message });
        }
      }
      console.error("Error delivering order:", error);
      res.status(500).json({ error: "Failed to deliver order" });
    }
  });

  // ===== Accounting Routes =====

  // GET /api/accounting/orders - Get orders for accounting (ACCOUNTING or ADMIN only)
  app.get("/api/accounting/orders", requireRole('ADMIN', 'ACCOUNTING'), async (req, res) => {
    try {
      const filters = {
        status: req.query.status as 'ZUR_ABRECHNUNG' | 'ABGERECHNET' | undefined,
        q: req.query.q as string | undefined,
        dueFrom: req.query.dueFrom as string | undefined,
        dueTo: req.query.dueTo as string | undefined,
      };

      const orders = await storage.getAccountingOrders(filters);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching accounting orders:", error);
      res.status(500).json({ error: "Failed to fetch accounting orders" });
    }
  });

  // POST /api/accounting/orders/:id/settle - Mark order as settled (ACCOUNTING or ADMIN only)
  app.post("/api/accounting/orders/:id/settle", requireRole('ADMIN', 'ACCOUNTING'), async (req, res) => {
    try {
      const order = await storage.settleOrder(req.params.id, req.user!.id);
      res.json(order);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Order not found") {
          return res.status(404).json({ error: "Order not found" });
        }
        if (error.message === "Order must be in ZUR_ABRECHNUNG status") {
          return res.status(412).json({ error: error.message });
        }
      }
      console.error("Error settling order:", error);
      res.status(500).json({ error: "Failed to settle order" });
    }
  });

  // ===== WorkCenter Routes =====

  // GET /api/workcenters - List work centers (requires authentication)
  app.get("/api/workcenters", requireAuth, async (req, res) => {
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

  // POST /api/workcenters - Create work center (ADMIN or PROD_PLAN only)
  app.post("/api/workcenters", requireRole('ADMIN', 'PROD_PLAN'), async (req, res) => {
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

  // PATCH /api/workcenters/:id - Update work center (ADMIN or PROD_PLAN only)
  app.patch("/api/workcenters/:id", requireRole('ADMIN', 'PROD_PLAN'), async (req, res) => {
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

  // DELETE /api/workcenters/:id - Delete work center (ADMIN or PROD_PLAN only)
  app.delete("/api/workcenters/:id", requireRole('ADMIN', 'PROD_PLAN'), async (req, res) => {
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

  // GET /api/calendar - Get time slots for calendar view (requires authentication)
  app.get("/api/calendar", requireAuth, async (req, res) => {
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

  // GET /api/timeslots - Get time slots with filters (weekly planning or daily production) (requires authentication)
  app.get("/api/timeslots", requireAuth, async (req, res) => {
    try {
      const department = req.query.department as string | undefined;
      const weekStart = req.query.weekStart as string | undefined;
      const date = req.query.date as string | undefined;

      // Support two modes: weekly planning (department + weekStart) or daily production (date only)
      if (date) {
        // Daily production mode - return all slots for a specific date
        const dateObj = new Date(date);
        const dateStr = dateObj.toISOString().split('T')[0];
        
        const filters = {
          startDate: dateStr,
          endDate: dateStr,
        };

        const slots = await storage.getCalendar(filters);
        res.json({ slots });
      } else {
        // Weekly planning mode - requires department and weekStart
        if (!department) {
          return res.status(400).json({ error: "department or date parameter is required" });
        }
        
        if (!weekStart) {
          return res.status(400).json({ error: "weekStart parameter is required when using department" });
        }

        // Calculate week end (Sunday, 6 days after Monday)
        const startDate = new Date(weekStart);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);

        const filters = {
          startDate: weekStart,
          endDate: endDate.toISOString().split('T')[0],
          department: department as any,
        };

        const slots = await storage.getCalendar(filters);
        res.json(slots);
      }
    } catch (error) {
      console.error("Error fetching time slots:", error);
      res.status(500).json({ error: "Failed to fetch time slots" });
    }
  });

  // GET /api/orders/:id/timeslots - Get time slots for an order (requires authentication)
  app.get("/api/orders/:id/timeslots", requireAuth, async (req, res) => {
    try {
      const slots = await storage.getOrderTimeSlots(req.params.id);
      res.json(slots);
    } catch (error) {
      console.error("Error fetching order time slots:", error);
      res.status(500).json({ error: "Failed to fetch order time slots" });
    }
  });

  // POST /api/timeslots - Create time slot (ADMIN or PROD_PLAN only)
  app.post("/api/timeslots", requireRole('ADMIN', 'PROD_PLAN'), async (req, res) => {
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
        if (
          error.message === "Time slot overlaps with existing slot" ||
          error.message.includes("Kapazität") ||
          error.message.includes("Capacity exceeded")
        ) {
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

  // PATCH /api/timeslots/:id - Update time slot (ADMIN or PROD_PLAN only)
  app.patch("/api/timeslots/:id", requireRole('ADMIN', 'PROD_PLAN'), async (req, res) => {
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
        if (
          error.message === "Time slot overlaps with existing slot" ||
          error.message.includes("Kapazität") ||
          error.message.includes("Capacity exceeded")
        ) {
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

  // DELETE /api/timeslots/:id - Delete time slot (ADMIN or PROD_PLAN only)
  app.delete("/api/timeslots/:id", requireRole('ADMIN', 'PROD_PLAN'), async (req, res) => {
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

  // POST /api/timeslots/batch - Batch operations for time slots (ADMIN or PROD_PLAN only)
  app.post("/api/timeslots/batch", requireRole('ADMIN', 'PROD_PLAN'), async (req, res) => {
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

  // ===== TimeSlot Action Routes (ADMIN, PROD_PLAN or PROD_RUN) =====

  // POST /api/timeslots/:id/start - Start a time slot (ADMIN, PROD_PLAN or PROD_RUN)
  app.post("/api/timeslots/:id/start", requireRole('ADMIN', 'PROD_PLAN', 'PROD_RUN'), async (req, res) => {
    try {
      const timeSlot = await storage.startTimeSlot(req.params.id);
      res.json(timeSlot);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "TimeSlot nicht gefunden") {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes("kann nur aus Status")) {
          return res.status(422).json({ error: error.message });
        }
        if (error.message === "TimeSlot muss einem Auftrag zugeordnet sein") {
          return res.status(422).json({ error: error.message });
        }
      }
      console.error("Error starting time slot:", error);
      res.status(500).json({ error: "Failed to start time slot" });
    }
  });

  // POST /api/timeslots/:id/pause - Pause a time slot (ADMIN, PROD_PLAN or PROD_RUN)
  app.post("/api/timeslots/:id/pause", requireRole('ADMIN', 'PROD_PLAN', 'PROD_RUN'), async (req, res) => {
    try {
      const timeSlot = await storage.pauseTimeSlot(req.params.id);
      res.json(timeSlot);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "TimeSlot nicht gefunden") {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes("kann nur aus Status")) {
          return res.status(422).json({ error: error.message });
        }
      }
      console.error("Error pausing time slot:", error);
      res.status(500).json({ error: "Failed to pause time slot" });
    }
  });

  // POST /api/timeslots/:id/stop - Stop a time slot (ADMIN, PROD_PLAN or PROD_RUN)
  app.post("/api/timeslots/:id/stop", requireRole('ADMIN', 'PROD_PLAN', 'PROD_RUN'), async (req, res) => {
    try {
      const timeSlot = await storage.stopTimeSlot(req.params.id);
      res.json(timeSlot);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "TimeSlot nicht gefunden") {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes("kann nur aus Status")) {
          return res.status(422).json({ error: error.message });
        }
      }
      console.error("Error stopping time slot:", error);
      res.status(500).json({ error: "Failed to stop time slot" });
    }
  });

  // POST /api/timeslots/:id/qc - Set QC for a time slot (ADMIN, PROD_PLAN or PROD_RUN)
  app.post("/api/timeslots/:id/qc", requireRole('ADMIN', 'PROD_PLAN', 'PROD_RUN'), async (req, res) => {
    try {
      const validated = timeSlotQCSchema.parse(req.body);
      const timeSlot = await storage.setTimeSlotQC(req.params.id, validated.qc, validated.note);
      res.json(timeSlot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error) {
        if (error.message === "TimeSlot nicht gefunden") {
          return res.status(404).json({ error: error.message });
        }
        if (error.message.includes("kann nur für abgeschlossene")) {
          return res.status(422).json({ error: error.message });
        }
      }
      console.error("Error setting QC:", error);
      res.status(500).json({ error: "Failed to set QC" });
    }
  });

  // POST /api/timeslots/:id/missing-parts - Mark time slot as having missing parts (ADMIN, PROD_PLAN or PROD_RUN)
  app.post("/api/timeslots/:id/missing-parts", requireRole('ADMIN', 'PROD_PLAN', 'PROD_RUN'), async (req, res) => {
    try {
      const validated = timeSlotMissingPartsSchema.parse(req.body);
      const timeSlot = await storage.setTimeSlotMissingParts(
        req.params.id, 
        validated.note, 
        validated.updateOrderWorkflow
      );
      res.json(timeSlot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error) {
        if (error.message === "TimeSlot nicht gefunden") {
          return res.status(404).json({ error: error.message });
        }
        if (error.message === "TimeSlot muss einem Auftrag zugeordnet sein") {
          return res.status(422).json({ error: error.message });
        }
      }
      console.error("Error marking missing parts:", error);
      res.status(500).json({ error: "Failed to mark missing parts" });
    }
  });

  // ===== Warehouse Routes =====

  // GET /api/warehouse/groups - Get all warehouse groups
  app.get("/api/warehouse/groups", requireAuth, async (req, res) => {
    try {
      const groups = await storage.getWarehouseGroups();
      res.json(groups);
    } catch (error) {
      console.error("Error fetching warehouse groups:", error);
      res.status(500).json({ error: "Failed to fetch warehouse groups" });
    }
  });

  // GET /api/warehouse/groups/:id - Get warehouse group by ID
  app.get("/api/warehouse/groups/:id", requireAuth, async (req, res) => {
    try {
      const group = await storage.getWarehouseGroupById(req.params.id);
      if (!group) {
        return res.status(404).json({ error: "Warehouse group not found" });
      }
      res.json(group);
    } catch (error) {
      console.error("Error fetching warehouse group:", error);
      res.status(500).json({ error: "Failed to fetch warehouse group" });
    }
  });

  // POST /api/warehouse/groups - Create warehouse group (ADMIN or LAGER only)
  app.post("/api/warehouse/groups", requireRole('ADMIN', 'LAGER'), async (req, res) => {
    try {
      const validated = insertWarehouseGroupSchema.parse(req.body);
      const group = await storage.createWarehouseGroup(validated);
      res.json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating warehouse group:", error);
      res.status(500).json({ error: "Failed to create warehouse group" });
    }
  });

  // PATCH /api/warehouse/groups/:id - Update warehouse group (ADMIN or LAGER only)
  app.patch("/api/warehouse/groups/:id", requireRole('ADMIN', 'LAGER'), async (req, res) => {
    try {
      const validated = updateWarehouseGroupSchema.parse(req.body);
      const group = await storage.updateWarehouseGroup(req.params.id, validated);
      res.json(group);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error updating warehouse group:", error);
      res.status(500).json({ error: "Failed to update warehouse group" });
    }
  });

  // DELETE /api/warehouse/groups/:id - Delete warehouse group (ADMIN or LAGER only)
  app.delete("/api/warehouse/groups/:id", requireRole('ADMIN', 'LAGER'), async (req, res) => {
    try {
      await storage.deleteWarehouseGroup(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting warehouse group:", error);
      res.status(500).json({ error: "Failed to delete warehouse group" });
    }
  });

  // POST /api/warehouse/groups/:groupId/generate-places - Generate places (ADMIN or LAGER only)
  app.post("/api/warehouse/groups/:groupId/generate-places", requireRole('ADMIN', 'LAGER'), async (req, res) => {
    try {
      const validated = generateWarehousePlacesSchema.parse(req.body);
      const result = await storage.generateWarehousePlaces(req.params.groupId, validated);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error && error.message === "Warehouse group not found") {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error generating warehouse places:", error);
      res.status(500).json({ error: "Failed to generate warehouse places" });
    }
  });

  // GET /api/warehouse/places - Get all warehouse places
  app.get("/api/warehouse/places", requireAuth, async (req, res) => {
    try {
      const groupId = req.query.groupId as string | undefined;
      const places = await storage.getWarehousePlaces(groupId);
      res.json(places);
    } catch (error) {
      console.error("Error fetching warehouse places:", error);
      res.status(500).json({ error: "Failed to fetch warehouse places" });
    }
  });

  // GET /api/warehouse/places/:id - Get warehouse place by ID
  app.get("/api/warehouse/places/:id", requireAuth, async (req, res) => {
    try {
      const place = await storage.getWarehousePlaceById(req.params.id);
      if (!place) {
        return res.status(404).json({ error: "Warehouse place not found" });
      }
      res.json(place);
    } catch (error) {
      console.error("Error fetching warehouse place:", error);
      res.status(500).json({ error: "Failed to fetch warehouse place" });
    }
  });

  // POST /api/warehouse/places - Create warehouse place (ADMIN or LAGER only)
  app.post("/api/warehouse/places", requireRole('ADMIN', 'LAGER'), async (req, res) => {
    try {
      const validated = insertWarehousePlaceSchema.parse(req.body);
      const place = await storage.createWarehousePlace(validated);
      res.json(place);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating warehouse place:", error);
      res.status(500).json({ error: "Failed to create warehouse place" });
    }
  });

  // PATCH /api/warehouse/places/:id - Update warehouse place (ADMIN or LAGER only)
  app.patch("/api/warehouse/places/:id", requireRole('ADMIN', 'LAGER'), async (req, res) => {
    try {
      const validated = updateWarehousePlaceSchema.parse(req.body);
      const place = await storage.updateWarehousePlace(req.params.id, validated);
      res.json(place);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error updating warehouse place:", error);
      res.status(500).json({ error: "Failed to update warehouse place" });
    }
  });

  // DELETE /api/warehouse/places/:id - Delete warehouse place (ADMIN or LAGER only)
  app.delete("/api/warehouse/places/:id", requireRole('ADMIN', 'LAGER'), async (req, res) => {
    try {
      await storage.deleteWarehousePlace(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting warehouse place:", error);
      res.status(500).json({ error: "Failed to delete warehouse place" });
    }
  });

  // PATCH /api/orders/:id/warehouse-place - Assign order to warehouse place (Authenticated users)
  app.patch("/api/orders/:id/warehouse-place", requireAuth, async (req, res) => {
    try {
      const validated = assignWarehousePlaceSchema.parse(req.body);
      const order = await storage.assignOrderToWarehousePlace(req.params.id, validated.placeId);
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      if (error instanceof Error) {
        if (error.message === "Order not found" || error.message === "Warehouse place not found") {
          return res.status(404).json({ error: error.message });
        }
        if (error.message === "Warehouse place is already occupied") {
          return res.status(422).json({ error: error.message });
        }
      }
      console.error("Error assigning warehouse place:", error);
      res.status(500).json({ error: "Failed to assign warehouse place" });
    }
  });

  // POST /api/orders/:id/release-from-missing-parts - Release order from missing parts status (ADMIN or PROD_PLAN only)
  app.post("/api/orders/:id/release-from-missing-parts", requireRole('ADMIN', 'PROD_PLAN'), async (req, res) => {
    try {
      const order = await storage.releaseOrderFromMissingParts(req.params.id);
      res.json(order);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Order not found") {
          return res.status(404).json({ error: error.message });
        }
        if (error.message === "Order is not in WARTET_FEHLTEILE status") {
          return res.status(422).json({ error: error.message });
        }
      }
      console.error("Error releasing order from missing parts:", error);
      res.status(500).json({ error: "Failed to release order from missing parts" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
