import { PrismaClient, type OrderSource, type Department, type WorkflowState, type OrderPosition, Prisma } from "@prisma/client";
import type { InsertOrder, InsertSizeTable, InsertPrintAsset, InsertPosition, UpdatePosition, OrderWithRelations } from "@shared/schema";

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
  
  // Size Table
  createOrUpdateSizeTable(orderId: string, sizeTable: InsertSizeTable): Promise<OrderWithRelations>;
  
  // Print Assets
  addPrintAsset(orderId: string, asset: InsertPrintAsset): Promise<OrderWithRelations>;
  
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
        positions: true,
      },
    });
    
    return order;
  }
  
  async createOrUpdateSizeTable(orderId: string, sizeTableData: InsertSizeTable): Promise<OrderWithRelations> {
    // First check if order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { sizeTable: true },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // If sizeTable exists, update it; otherwise create new
    if (order.sizeTableId) {
      await prisma.sizeTable.update({
        where: { id: order.sizeTableId },
        data: sizeTableData,
      });
    } else {
      const sizeTable = await prisma.sizeTable.create({
        data: sizeTableData,
      });
      
      await prisma.order.update({
        where: { id: orderId },
        data: { sizeTableId: sizeTable.id },
      });
    }
    
    return await this.getOrderById(orderId) as OrderWithRelations;
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
  
  async submitOrder(orderId: string): Promise<OrderWithRelations> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { printAssets: true },
    });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    // Check if at least one required print asset exists
    const hasRequiredAsset = order.printAssets.some(asset => asset.required);
    
    if (!hasRequiredAsset) {
      throw new Error('Required print asset missing');
    }
    
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { workflow: 'FUER_PROD' },
      include: {
        sizeTable: true,
        printAssets: true,
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
