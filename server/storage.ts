import { PrismaClient, type OrderSource, type Department, type WorkflowState } from "@prisma/client";
import type { InsertOrder, InsertSizeTable, InsertPrintAsset, OrderWithRelations } from "@shared/schema";

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
  
  // Submit order
  submitOrder(orderId: string): Promise<OrderWithRelations>;
}

export class PrismaStorage implements IStorage {
  async getOrders(filters: OrderFilters): Promise<OrderWithRelations[]> {
    const where: any = {};
    
    // Search query - trim and check minimum length
    const searchQuery = filters.q?.trim();
    if (searchQuery && searchQuery.length >= 2) {
      where.OR = [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { customer: { contains: searchQuery, mode: 'insensitive' } },
        { extId: { contains: searchQuery, mode: 'insensitive' } },
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
      },
    });
  }
  
  async createOrder(orderData: InsertOrder): Promise<OrderWithRelations> {
    const order = await prisma.order.create({
      data: {
        ...orderData,
        source: 'INTERNAL',
        workflow: 'NEU',
        dueDate: orderData.dueDate ? new Date(orderData.dueDate) : null,
      },
      include: {
        sizeTable: true,
        printAssets: true,
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
      },
    });
    
    return updated;
  }
}

export const storage = new PrismaStorage();
