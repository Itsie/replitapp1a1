import { PrismaClient, type OrderSource, type Department, type WorkflowState, type OrderPosition, type OrderAsset, Prisma } from "@prisma/client";
import type { InsertOrder, InsertSizeTable, InsertPrintAsset, InsertOrderAsset, InsertPosition, UpdatePosition, OrderWithRelations } from "@shared/schema";

const prisma = new PrismaClient();

export interface OrderFilters {
  q?: string;
  department?: Department;
  source?: OrderSource;
  workflow?: WorkflowState;
}

export interface IStorage {
  // Orders
  getOrders(filters: OrderFilters): Promise<OrderWithRelations[]>;
  getOrderById(id: string): Promise<OrderWithRelations | null>;
  createOrder(order: InsertOrder): Promise<OrderWithRelations>;
  updateOrder(id: string, data: Partial<InsertOrder>): Promise<OrderWithRelations>;
  
  // Size Table
  getSizeTable(orderId: string): Promise<{ scheme: string; rows: any[]; comment: string | null } | null>;
  createOrUpdateSizeTable(orderId: string, sizeTable: InsertSizeTable): Promise<{ scheme: string; rows: any[]; comment: string | null }>;
  
  // Print Assets
  addPrintAsset(orderId: string, asset: InsertPrintAsset): Promise<OrderWithRelations>;
  
  // Order Assets
  getOrderAssets(orderId: string): Promise<OrderAsset[]>;
  createOrderAsset(orderId: string, asset: InsertOrderAsset): Promise<OrderAsset>;
  deleteOrderAsset(orderId: string, assetId: string): Promise<{ filePath?: string }>;
  
  // Positions
  getPositions(orderId: string): Promise<OrderPosition[]>;
  createPositions(orderId: string, positions: InsertPosition[]): Promise<OrderPosition[]>;
  updatePosition(orderId: string, posId: string, data: UpdatePosition): Promise<OrderPosition>;
  deletePosition(orderId: string, posId: string): Promise<void>;
  
  // Submit order
  submitOrder(orderId: string): Promise<OrderWithRelations>;
}

export class PrismaStorage implements IStorage {
  private async generateDisplayOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    
    // Use Prisma transaction to atomically increment the sequence
    const result = await prisma.$transaction(async (tx) => {
      // Upsert the sequence for the current year
      const sequence = await tx.orderSequence.upsert({
        where: { year },
        create: { year, current: 999 }, // First will be 1000
        update: { current: { increment: 1 } },
      });
      
      // Return the next sequence number
      return sequence.current + 1;
    });
    
    return `INT-${year}-${result}`;
  }
  
  async getOrders(filters: OrderFilters): Promise<OrderWithRelations[]> {
    const where: any = {};
    
    // Search query - trim and check minimum length
    const searchQuery = filters.q?.trim();
    if (searchQuery && searchQuery.length >= 2) {
      where.OR = [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { customer: { contains: searchQuery, mode: 'insensitive' } },
        { extId: { contains: searchQuery, mode: 'insensitive' } },
        { displayOrderNumber: { contains: searchQuery, mode: 'insensitive' } },
        { notes: { contains: searchQuery, mode: 'insensitive' } },
        { location: { contains: searchQuery, mode: 'insensitive' } },
        { billCity: { contains: searchQuery, mode: 'insensitive' } },
        { billZip: { contains: searchQuery, mode: 'insensitive' } },
        { customerEmail: { contains: searchQuery, mode: 'insensitive' } },
        { customerPhone: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }
    
    if (filters.department && filters.department.trim()) {
      where.department = filters.department;
    }
    
    if (filters.source && filters.source.trim()) {
      where.source = filters.source;
    }
    
    if (filters.workflow && filters.workflow.trim()) {
      where.workflow = filters.workflow;
    }
    
    // Limit results to 200 if no filters are applied (performance safeguard)
    const hasFilters = 
      filters.department || 
      filters.source || 
      filters.workflow || 
      (searchQuery && searchQuery.length >= 2);
    const limit = hasFilters ? undefined : 200;
    
    return await prisma.order.findMany({
      where,
      include: {
        sizeTable: true,
        printAssets: true,
        orderAssets: true,
        positions: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }
  
  async getOrderById(id: string): Promise<OrderWithRelations | null> {
    return await prisma.order.findUnique({
      where: { id },
      include: {
        sizeTable: true,
        printAssets: true,
        orderAssets: true,
        positions: true,
      },
    });
  }
  
  async createOrder(orderData: InsertOrder): Promise<OrderWithRelations> {
    // Generate display order number for INTERNAL orders
    const displayOrderNumber = await this.generateDisplayOrderNumber();
    
    const order = await prisma.order.create({
      data: {
        ...orderData,
        source: 'INTERNAL',
        workflow: 'NEU',
        displayOrderNumber,
        dueDate: orderData.dueDate ? new Date(orderData.dueDate) : null,
      },
      include: {
        sizeTable: true,
        printAssets: true,
        orderAssets: true,
        positions: true,
      },
    });
    
    return order;
  }
  
  async updateOrder(id: string, updateData: Partial<InsertOrder>): Promise<OrderWithRelations> {
    // Get existing order to check source and workflow
    const existingOrder = await prisma.order.findUnique({
      where: { id },
    });
    
    if (!existingOrder) {
      throw new Error('Order not found');
    }
    
    // Prepare update data
    const data: any = {};
    
    // Rules for JTL orders: only allow dueDate, location, notes
    if (existingOrder.source === 'JTL') {
      // Check if trying to update restricted fields
      const restrictedFields = ['company', 'contactFirstName', 'contactLastName', 'customerEmail', 'customerPhone',
        'billStreet', 'billZip', 'billCity', 'billCountry', 'shipStreet', 'shipZip', 'shipCity', 'shipCountry',
        'title', 'customer', 'department'];
      
      const attemptingRestrictedUpdate = restrictedFields.some(field => field in updateData);
      
      if (attemptingRestrictedUpdate) {
        throw new Error('Cannot modify customer or address fields for JTL orders');
      }
      
      // Only allow these fields for JTL orders
      if (updateData.dueDate !== undefined) data.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null;
      if (updateData.location !== undefined) data.location = updateData.location;
      if (updateData.notes !== undefined) data.notes = updateData.notes;
    } 
    // Rules for IN_PROD orders: only allow notes
    else if (existingOrder.workflow === 'IN_PROD') {
      if (Object.keys(updateData).some(key => key !== 'notes')) {
        throw new Error('Cannot modify order fields in production, only notes allowed');
      }
      if (updateData.notes !== undefined) data.notes = updateData.notes;
    }
    // INTERNAL orders not in production: allow all fields
    else {
      if (updateData.company !== undefined) data.company = updateData.company;
      if (updateData.contactFirstName !== undefined) data.contactFirstName = updateData.contactFirstName;
      if (updateData.contactLastName !== undefined) data.contactLastName = updateData.contactLastName;
      if (updateData.customerEmail !== undefined) data.customerEmail = updateData.customerEmail;
      if (updateData.customerPhone !== undefined) data.customerPhone = updateData.customerPhone;
      if (updateData.billStreet !== undefined) data.billStreet = updateData.billStreet;
      if (updateData.billZip !== undefined) data.billZip = updateData.billZip;
      if (updateData.billCity !== undefined) data.billCity = updateData.billCity;
      if (updateData.billCountry !== undefined) data.billCountry = updateData.billCountry;
      if (updateData.shipStreet !== undefined) data.shipStreet = updateData.shipStreet;
      if (updateData.shipZip !== undefined) data.shipZip = updateData.shipZip;
      if (updateData.shipCity !== undefined) data.shipCity = updateData.shipCity;
      if (updateData.shipCountry !== undefined) data.shipCountry = updateData.shipCountry;
      if (updateData.title !== undefined) data.title = updateData.title;
      if (updateData.customer !== undefined) data.customer = updateData.customer;
      if (updateData.department !== undefined) data.department = updateData.department;
      if (updateData.dueDate !== undefined) data.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null;
      if (updateData.location !== undefined) data.location = updateData.location;
      if (updateData.notes !== undefined) data.notes = updateData.notes;
    }
    
    const updated = await prisma.order.update({
      where: { id },
      data,
      include: {
        sizeTable: true,
        printAssets: true,
        orderAssets: true,
        positions: true,
      },
    });
    
    return updated;
  }
  
  async getSizeTable(orderId: string): Promise<{ scheme: string; rows: any[]; comment: string | null } | null> {
    // First check if order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { sizeTable: true },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    if (!order.sizeTable) {
      return null;
    }
    
    return {
      scheme: order.sizeTable.scheme,
      rows: order.sizeTable.rowsJson as any[],
      comment: order.sizeTable.comment,
    };
  }

  async createOrUpdateSizeTable(orderId: string, sizeTableData: InsertSizeTable): Promise<{ scheme: string; rows: any[]; comment: string | null }> {
    // First check if order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { sizeTable: true },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    const { allowDuplicates, ...data } = sizeTableData;
    
    // Upsert sizeTable (create or update)
    const sizeTable = await prisma.sizeTable.upsert({
      where: { orderId },
      create: {
        orderId,
        scheme: data.scheme,
        rowsJson: data.rows,
        comment: data.comment,
      },
      update: {
        scheme: data.scheme,
        rowsJson: data.rows,
        comment: data.comment,
      },
    });
    
    return {
      scheme: sizeTable.scheme,
      rows: sizeTable.rowsJson as any[],
      comment: sizeTable.comment,
    };
  }
  
  async addPrintAsset(orderId: string, assetData: InsertPrintAsset): Promise<OrderWithRelations> {
    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    await prisma.printAsset.create({
      data: {
        ...assetData,
        orderId,
      },
    });
    
    return await this.getOrderById(orderId) as OrderWithRelations;
  }
  
  async getOrderAssets(orderId: string): Promise<OrderAsset[]> {
    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    return await prisma.orderAsset.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }
  
  async createOrderAsset(orderId: string, assetData: InsertOrderAsset): Promise<OrderAsset> {
    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // SECURITY: Validate and normalize UNC path if provided
    let normalizedPath = assetData.path;
    if (normalizedPath) {
      // Check for null bytes (security risk)
      if (normalizedPath.includes('\0')) {
        throw new Error('Invalid characters in path');
      }
      
      // Convert backslashes to forward slashes
      normalizedPath = normalizedPath.replace(/\\/g, '/');
      
      // Ensure it starts with //
      if (!normalizedPath.startsWith('//')) {
        throw new Error('UNC path must start with // or \\\\');
      }
      
      // Validate UNC path format: //server/share/path
      const uncPattern = /^\/\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+(\/[^\0<>"|?*]*)?$/;
      if (!uncPattern.test(normalizedPath)) {
        throw new Error('Invalid UNC path format. Expected: //server/share/path');
      }
    }
    
    return await prisma.orderAsset.create({
      data: {
        orderId,
        kind: assetData.kind,
        label: assetData.label,
        path: normalizedPath,
        url: assetData.url,
        ext: assetData.ext,
        size: assetData.size,
        required: assetData.required || false,
        notes: assetData.notes,
      },
    });
  }
  
  async deleteOrderAsset(orderId: string, assetId: string): Promise<{ filePath?: string }> {
    // Verify asset exists and belongs to order
    const asset = await prisma.orderAsset.findUnique({
      where: { id: assetId },
    });
    
    if (!asset) {
      throw new Error('Asset not found');
    }
    
    if (asset.orderId !== orderId) {
      throw new Error('Asset does not belong to this order');
    }
    
    // Delete from database
    await prisma.orderAsset.delete({
      where: { id: assetId },
    });
    
    // Return file path if it's an uploaded file (for deletion by route handler)
    if (asset.url && asset.url.startsWith('/uploads/')) {
      return { filePath: asset.url };
    }
    
    return {};
  }
  
  async submitOrder(orderId: string): Promise<OrderWithRelations> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        printAssets: true,
        orderAssets: true,
        sizeTable: true,
        positions: true,
      },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Check if at least one position exists
    if (!order.positions || order.positions.length === 0) {
      throw new Error('At least one position is required');
    }
    
    // NEW: Check for PRINT assets (path or url) for TEAMSPORT department
    if (order.department === 'TEAMSPORT') {
      const hasPrintAsset = order.orderAssets.some(
        asset => asset.kind === 'PRINT' && (asset.path || asset.url)
      );
      
      if (!hasPrintAsset) {
        throw new Error('At least one PRINT asset (path or upload) is required for TEAMSPORT department');
      }
      
      // Check if size table exists for TEAMSPORT
      if (!order.sizeTable) {
        throw new Error('Size table required for TEAMSPORT department');
      }
    }
    
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { workflow: 'FUER_PROD' },
      include: {
        sizeTable: true,
        printAssets: true,
        orderAssets: true,
        positions: true,
      },
    });
    
    return updated;
  }

  // Helper to calculate line totals
  private calculateLineTotals(qty: number, unitPriceNet: number, vatRate: number) {
    const lineNet = new Prisma.Decimal(qty).mul(new Prisma.Decimal(unitPriceNet));
    const lineVat = lineNet.mul(new Prisma.Decimal(vatRate)).div(100);
    const lineGross = lineNet.add(lineVat);
    
    return {
      lineNet,
      lineVat,
      lineGross,
    };
  }

  // Helper to recalculate and update order totals
  private async recalculateOrderTotals(orderId: string): Promise<void> {
    const positions = await prisma.orderPosition.findMany({
      where: { orderId },
    });

    let totalNet = new Prisma.Decimal(0);
    let totalVat = new Prisma.Decimal(0);
    let totalGross = new Prisma.Decimal(0);

    for (const pos of positions) {
      totalNet = totalNet.add(pos.lineNet);
      totalVat = totalVat.add(pos.lineVat);
      totalGross = totalGross.add(pos.lineGross);
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        totalNet,
        totalVat,
        totalGross,
      },
    });
  }

  async getPositions(orderId: string): Promise<OrderPosition[]> {
    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return await prisma.orderPosition.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createPositions(orderId: string, positions: InsertPosition[]): Promise<OrderPosition[]> {
    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const created: OrderPosition[] = [];

    // Use transaction to create all positions and update totals atomically
    await prisma.$transaction(async (tx) => {
      for (const posData of positions) {
        const { lineNet, lineVat, lineGross } = this.calculateLineTotals(
          posData.qty,
          posData.unitPriceNet,
          posData.vatRate
        );

        const position = await tx.orderPosition.create({
          data: {
            orderId,
            articleName: posData.articleName,
            articleNumber: posData.articleNumber || null,
            qty: new Prisma.Decimal(posData.qty),
            unit: posData.unit,
            unitPriceNet: new Prisma.Decimal(posData.unitPriceNet),
            vatRate: posData.vatRate,
            lineNet,
            lineVat,
            lineGross,
            procurement: posData.procurement,
            supplierNote: posData.supplierNote || null,
          },
        });

        created.push(position);
      }
    });

    // Recalculate order totals after transaction
    await this.recalculateOrderTotals(orderId);

    return created;
  }

  async updatePosition(orderId: string, posId: string, data: UpdatePosition): Promise<OrderPosition> {
    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Verify position exists and belongs to the order
    const existingPos = await prisma.orderPosition.findUnique({
      where: { id: posId },
    });

    if (!existingPos || existingPos.orderId !== orderId) {
      throw new Error('Position not found');
    }

    // Merge existing data with updates
    const updateData: any = { ...data };

    // If qty, unitPriceNet, or vatRate changed, recalculate line totals
    const needsRecalc = data.qty !== undefined || data.unitPriceNet !== undefined || data.vatRate !== undefined;

    if (needsRecalc) {
      const qty = data.qty !== undefined ? data.qty : Number(existingPos.qty);
      const unitPriceNet = data.unitPriceNet !== undefined ? data.unitPriceNet : Number(existingPos.unitPriceNet);
      const vatRate = data.vatRate !== undefined ? data.vatRate : existingPos.vatRate;

      const { lineNet, lineVat, lineGross } = this.calculateLineTotals(qty, unitPriceNet, vatRate);
      
      updateData.qty = new Prisma.Decimal(qty);
      updateData.unitPriceNet = new Prisma.Decimal(unitPriceNet);
      updateData.lineNet = lineNet;
      updateData.lineVat = lineVat;
      updateData.lineGross = lineGross;
    }

    const updated = await prisma.orderPosition.update({
      where: { id: posId },
      data: updateData,
    });

    // Recalculate order totals
    await this.recalculateOrderTotals(orderId);

    return updated;
  }

  async deletePosition(orderId: string, posId: string): Promise<void> {
    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Verify position exists and belongs to the order
    const existingPos = await prisma.orderPosition.findUnique({
      where: { id: posId },
    });

    if (!existingPos || existingPos.orderId !== orderId) {
      throw new Error('Position not found');
    }

    await prisma.orderPosition.delete({
      where: { id: posId },
    });

    // Recalculate order totals
    await this.recalculateOrderTotals(orderId);
  }
}

export const storage = new PrismaStorage();
