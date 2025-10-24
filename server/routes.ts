import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertOrderSchema, insertSizeTableSchema, insertPrintAssetSchema, insertPositionSchema, updatePositionSchema } from "@shared/schema";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";

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
  
  // POST /api/orders/:id/size - Create/update size table
  app.post("/api/orders/:id/size", async (req, res) => {
    try {
      const validated = insertSizeTableSchema.parse(req.body);
      const order = await storage.createOrUpdateSizeTable(req.params.id, validated);
      res.json(order);
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
  
  // POST /api/orders/:id/assets - Add print asset
  app.post("/api/orders/:id/assets", async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
