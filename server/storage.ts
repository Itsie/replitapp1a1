import { PrismaClient, type OrderSource, type Department, type WorkflowState, type OrderPosition, type OrderAsset, type WorkCenter, type TimeSlot, type WarehouseGroup, type WarehousePlace, Prisma } from "@prisma/client";
import type { InsertOrder, InsertSizeTable, InsertPrintAsset, InsertOrderAsset, InsertPosition, UpdatePosition, OrderWithRelations, InsertWorkCenter, UpdateWorkCenter, InsertTimeSlot, UpdateTimeSlot, BatchTimeSlot, InsertWarehouseGroup, UpdateWarehouseGroup, InsertWarehousePlace, UpdateWarehousePlace, GenerateWarehousePlaces, WarehousePlaceWithRelations, WarehouseGroupWithRelations } from "@shared/schema";

const prisma = new PrismaClient();

export interface OrderFilters {
  q?: string;
  department?: Department;
  source?: OrderSource;
  workflow?: WorkflowState;
}

export interface CalendarFilters {
  startDate: string;
  endDate: string;
  workCenterId?: string;
  department?: Department;
}

export interface WorkCenterWithSlotCount extends WorkCenter {
  slotsTodayCount: number;
}

export interface TimeSlotWithOrder extends TimeSlot {
  order?: {
    id: string;
    displayOrderNumber: string | null;
    title: string;
    customer: string;
    department: Department;
    workflow: WorkflowState;
    dueDate: Date | null;
    notes: string | null;
    printAssets: Array<{
      id: string;
      label: string;
      url: string;
      required: boolean;
    }>;
    sizeTable: {
      scheme: string;
      rowsJson: any[];
      comment: string | null;
    } | null;
    positions: Array<{
      id: string;
      articleName: string;
      articleNumber: string | null;
      qty: number;
      unit: string;
      unitPriceNet: number;
    }>;
  } | null;
  workCenter: {
    id: string;
    name: string;
    department: Department;
    concurrentCapacity: number;
  };
}

export interface IStorage {
  // Users
  getUserByEmail(email: string): Promise<{ id: string; email: string; name: string; role: any; password: string } | null>;
  getUserById(id: string): Promise<{ id: string; email: string; name: string; role: any } | null>;
  getAllUsers(): Promise<Array<{ id: string; email: string; name: string; role: any; createdAt: Date }>>;
  createUser(data: { email: string; name: string; password: string; role: any }): Promise<{ id: string; email: string; name: string; role: any }>;
  updateUser(id: string, data: Partial<{ email: string; name: string; password: string; role: any }>): Promise<{ id: string; email: string; name: string; role: any }>;
  deleteUser(id: string): Promise<void>;
  
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
  
  // Accounting
  deliverOrder(orderId: string, data: { deliveredAt: Date; deliveredQty?: number; deliveredNote?: string }): Promise<OrderWithRelations>;
  getAccountingOrders(filters: { status?: 'ZUR_ABRECHNUNG' | 'ABGERECHNET'; q?: string; dueFrom?: string; dueTo?: string }): Promise<OrderWithRelations[]>;
  settleOrder(orderId: string, userId: string): Promise<OrderWithRelations>;
  
  // WorkCenters
  getWorkCenters(department?: Department, active?: boolean): Promise<WorkCenterWithSlotCount[]>;
  getWorkCenterById(id: string): Promise<WorkCenter | null>;
  createWorkCenter(data: InsertWorkCenter): Promise<WorkCenter>;
  updateWorkCenter(id: string, data: UpdateWorkCenter): Promise<WorkCenter>;
  deleteWorkCenter(id: string): Promise<void>;
  
  // TimeSlots
  getCalendar(filters: CalendarFilters): Promise<TimeSlotWithOrder[]>;
  getOrderTimeSlots(orderId: string): Promise<TimeSlotWithOrder[]>;
  getTimeSlotById(id: string): Promise<TimeSlot | null>;
  createTimeSlot(data: InsertTimeSlot): Promise<TimeSlot>;
  updateTimeSlot(id: string, data: UpdateTimeSlot): Promise<TimeSlot>;
  deleteTimeSlot(id: string): Promise<void>;
  batchTimeSlots(data: BatchTimeSlot): Promise<{ created: number; updated: number; deleted: number }>;
  
  // TimeSlot actions
  startTimeSlot(id: string): Promise<TimeSlot>;
  pauseTimeSlot(id: string): Promise<TimeSlot>;
  stopTimeSlot(id: string): Promise<TimeSlot>;
  setTimeSlotQC(id: string, qc: 'IO' | 'NIO', note?: string | null): Promise<TimeSlot>;
  setTimeSlotMissingParts(id: string, note: string, updateOrderWorkflow: boolean): Promise<TimeSlot>;
  
  // Warehouse
  getWarehouseGroups(): Promise<WarehouseGroupWithRelations[]>;
  getWarehouseGroupById(id: string): Promise<WarehouseGroupWithRelations | null>;
  createWarehouseGroup(data: InsertWarehouseGroup): Promise<WarehouseGroup>;
  updateWarehouseGroup(id: string, data: UpdateWarehouseGroup): Promise<WarehouseGroup>;
  deleteWarehouseGroup(id: string): Promise<void>;
  getWarehousePlaces(groupId?: string): Promise<WarehousePlaceWithRelations[]>;
  getWarehousePlaceById(id: string): Promise<WarehousePlaceWithRelations | null>;
  createWarehousePlace(data: InsertWarehousePlace): Promise<WarehousePlace>;
  updateWarehousePlace(id: string, data: UpdateWarehousePlace): Promise<WarehousePlace>;
  deleteWarehousePlace(id: string): Promise<void>;
  generateWarehousePlaces(groupId: string, data: GenerateWarehousePlaces): Promise<{ created: number; skipped: Array<{ name: string; reason: string }>; examples: string[] }>;
  assignOrderToWarehousePlace(orderId: string, placeId: string | null): Promise<OrderWithRelations>;
  releaseOrderFromMissingParts(orderId: string): Promise<OrderWithRelations>;
}

export class PrismaStorage implements IStorage {
  // User methods
  async getUserByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
      },
    });
  }

  async getUserById(id: string) {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
  }

  async getAllUsers() {
    return await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createUser(data: { email: string; name: string; password: string; role: any }) {
    const user = await prisma.user.create({
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
    return user;
  }

  async updateUser(id: string, data: Partial<{ email: string; name: string; password: string; role: any }>) {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
    return user;
  }

  async deleteUser(id: string) {
    await prisma.user.delete({
      where: { id },
    });
  }
  
  private async generateDisplayOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    
    // Use Prisma transaction to atomically increment the sequence
    const result = await prisma.$transaction(async (tx) => {
      // Try to find existing sequence
      const existing = await tx.orderSequence.findUnique({
        where: { year },
      });
      
      if (!existing) {
        // Create new sequence starting at 1000
        const sequence = await tx.orderSequence.create({
          data: { year, current: 1000 },
        });
        return sequence.current;
      } else {
        // Increment and return new value
        const sequence = await tx.orderSequence.update({
          where: { year },
          data: { current: { increment: 1 } },
        });
        return sequence.current;
      }
    });
    
    return `INT-${year}-${result}`;
  }
  
  async getOrders(filters: OrderFilters): Promise<OrderWithRelations[]> {
    const where: any = {};
    
    // Search query - trim and check minimum length
    const searchQuery = filters.q?.trim();
    if (searchQuery && searchQuery.length >= 2) {
      where.OR = [
        { title: { contains: searchQuery } },
        { customer: { contains: searchQuery } },
        { extId: { contains: searchQuery } },
        { displayOrderNumber: { contains: searchQuery } },
        { notes: { contains: searchQuery } },
        { location: { contains: searchQuery } },
        { billCity: { contains: searchQuery } },
        { billZip: { contains: searchQuery } },
        { customerEmail: { contains: searchQuery } },
        { customerPhone: { contains: searchQuery } },
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
        timeSlots: {
          where: {
            status: 'RUNNING',
          },
          orderBy: {
            startedAt: 'asc',
          },
          take: 1,
          select: {
            id: true,
            status: true,
            startedAt: true,
          },
        },
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
    
    // Auto-generate customer display name if not provided
    const customer = orderData.customer || 
      orderData.company || 
      (orderData.contactFirstName && orderData.contactLastName 
        ? `${orderData.contactFirstName} ${orderData.contactLastName}` 
        : "Unbekannt");
    
    const order = await prisma.order.create({
      data: {
        ...orderData,
        customer,
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
    
    // Rules for JTL orders: only allow dueDate, location, locationPlaceId, notes
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
      if (updateData.locationPlaceId !== undefined) data.locationPlaceId = updateData.locationPlaceId;
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
      
      // Auto-generate customer display name if company/contact fields are being updated
      if (updateData.customer !== undefined) {
        data.customer = updateData.customer;
      } else if (updateData.company !== undefined || updateData.contactFirstName !== undefined || updateData.contactLastName !== undefined) {
        // Merge with existing data to generate customer name
        const company = updateData.company !== undefined ? updateData.company : existingOrder.company;
        const firstName = updateData.contactFirstName !== undefined ? updateData.contactFirstName : existingOrder.contactFirstName;
        const lastName = updateData.contactLastName !== undefined ? updateData.contactLastName : existingOrder.contactLastName;
        
        data.customer = company || 
          (firstName && lastName ? `${firstName} ${lastName}` : "Unbekannt");
      }
      
      if (updateData.department !== undefined) data.department = updateData.department;
      if (updateData.workflow !== undefined) data.workflow = updateData.workflow;
      if (updateData.dueDate !== undefined) data.dueDate = updateData.dueDate ? new Date(updateData.dueDate) : null;
      if (updateData.location !== undefined) data.location = updateData.location;
      if (updateData.locationPlaceId !== undefined) data.locationPlaceId = updateData.locationPlaceId;
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

  async deliverOrder(orderId: string, data: { deliveredAt: Date; deliveredQty?: number; deliveredNote?: string }): Promise<OrderWithRelations> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        timeSlots: {
          where: {
            status: {
              in: ['PLANNED', 'RUNNING', 'PAUSED'],
            },
          },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Check if order is in FERTIG or FUER_PROD status
    if (order.workflow !== 'FERTIG' && order.workflow !== 'FUER_PROD') {
      throw new Error('Order must be FERTIG or FUER_PROD to be delivered');
    }

    // Check if there are no open time slots
    if (order.timeSlots.length > 0) {
      throw new Error('Cannot deliver order with open time slots (PLANNED/RUNNING/PAUSED)');
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        deliveredAt: data.deliveredAt,
        deliveredQty: data.deliveredQty,
        deliveredNote: data.deliveredNote,
        workflow: 'ZUR_ABRECHNUNG',
      },
      include: {
        sizeTable: true,
        printAssets: true,
        orderAssets: true,
        positions: true,
      },
    });

    return updated;
  }

  async releaseOrderFromMissingParts(orderId: string): Promise<OrderWithRelations> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Guard: Order must be in WARTET_FEHLTEILE status
    if (order.workflow !== 'WARTET_FEHLTEILE') {
      throw new Error('Order must have workflow WARTET_FEHLTEILE to be released');
    }

    // Delete ALL time slots for this order
    // This allows the order to be re-planned from scratch
    await prisma.timeSlot.deleteMany({
      where: {
        orderId: orderId,
      },
    });

    // Update order workflow back to FUER_PROD (ready for planning)
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        workflow: 'FUER_PROD',
      },
      include: {
        sizeTable: true,
        printAssets: true,
        orderAssets: true,
        positions: true,
      },
    });

    return updated;
  }

  async getAccountingOrders(filters: { status?: 'ZUR_ABRECHNUNG' | 'ABGERECHNET'; q?: string; dueFrom?: string; dueTo?: string }): Promise<OrderWithRelations[]> {
    const where: any = {};

    // Status filter
    if (filters.status) {
      where.workflow = filters.status;
    } else {
      // Default: show both ZUR_ABRECHNUNG and ABGERECHNET
      where.workflow = {
        in: ['ZUR_ABRECHNUNG', 'ABGERECHNET'],
      };
    }

    // Search filter
    if (filters.q) {
      where.OR = [
        { displayOrderNumber: { contains: filters.q } },
        { title: { contains: filters.q } },
        { customer: { contains: filters.q } },
        { customerEmail: { contains: filters.q } },
      ];
    }

    // Due date filters
    if (filters.dueFrom || filters.dueTo) {
      where.dueDate = {};
      if (filters.dueFrom) {
        where.dueDate.gte = new Date(filters.dueFrom);
      }
      if (filters.dueTo) {
        where.dueDate.lte = new Date(filters.dueTo);
      }
    }

    return await prisma.order.findMany({
      where,
      include: {
        sizeTable: true,
        printAssets: true,
        orderAssets: true,
        positions: true,
      },
      orderBy: [
        { deliveredAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async settleOrder(orderId: string, userId: string): Promise<OrderWithRelations> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.workflow !== 'ZUR_ABRECHNUNG') {
      throw new Error('Order must be in ZUR_ABRECHNUNG status');
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        settledAt: new Date(),
        settledBy: userId,
        workflow: 'ABGERECHNET',
      },
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

  // ===== WorkCenter Methods =====
  
  async getWorkCenters(department?: Department, active?: boolean): Promise<WorkCenterWithSlotCount[]> {
    const where: any = {};
    if (department) where.department = department;
    if (active !== undefined) where.active = active;

    const workCenters = await prisma.workCenter.findMany({
      where,
      include: {
        timeSlots: {
          where: {
            date: {
              gte: new Date(new Date().toISOString().split('T')[0]),
              lt: new Date(new Date(Date.now() + 86400000).toISOString().split('T')[0]),
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return workCenters.map(wc => ({
      ...wc,
      slotsTodayCount: wc.timeSlots.length,
      timeSlots: wc.timeSlots,
    }));
  }

  async getWorkCenterById(id: string): Promise<WorkCenter | null> {
    return await prisma.workCenter.findUnique({
      where: { id },
    });
  }

  async createWorkCenter(data: InsertWorkCenter): Promise<WorkCenter> {
    return await prisma.workCenter.create({
      data: {
        name: data.name,
        department: data.department,
        capacityMin: data.capacityMin ?? 660,
        concurrentCapacity: data.concurrentCapacity ?? 2,
        active: data.active ?? true,
      },
    });
  }

  async updateWorkCenter(id: string, data: UpdateWorkCenter): Promise<WorkCenter> {
    const existing = await prisma.workCenter.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('WorkCenter not found');
    }

    return await prisma.workCenter.update({
      where: { id },
      data,
    });
  }

  async deleteWorkCenter(id: string): Promise<void> {
    const existing = await prisma.workCenter.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('WorkCenter not found');
    }

    // Check for future time slots
    const today = new Date().toISOString().split('T')[0];
    const futureSlots = await prisma.timeSlot.count({
      where: {
        workCenterId: id,
        date: { gte: new Date(today) },
      },
    });

    if (futureSlots > 0) {
      throw new Error('Cannot delete WorkCenter with future TimeSlots');
    }

    await prisma.workCenter.delete({ where: { id } });
  }

  // ===== TimeSlot Methods =====

  private async checkTimeSlotCapacity(
    date: string,
    startMin: number,
    lengthMin: number,
    workCenterId: string,
    isBlocked: boolean,
    excludeId?: string
  ): Promise<{ hasCapacity: boolean; message?: string }> {
    const endMin = startMin + lengthMin;
    const dateObj = new Date(date);

    // Get WorkCenter to check concurrentCapacity
    const workCenter = await prisma.workCenter.findUnique({
      where: { id: workCenterId },
    });

    if (!workCenter) {
      return { hasCapacity: false, message: 'WorkCenter not found' };
    }

    const { concurrentCapacity } = workCenter;

    // Get all existing slots for this WorkCenter on this date (excluding current slot if updating)
    const where: any = {
      workCenterId,
      date: dateObj,
    };
    if (excludeId) {
      where.NOT = { id: excludeId };
    }

    const existingSlots = await prisma.timeSlot.findMany({ where });

    // For each minute in the proposed slot's range, check capacity usage
    for (let min = startMin; min < endMin; min++) {
      let usedCapacity = 0;

      for (const slot of existingSlots) {
        const slotEnd = slot.startMin + slot.lengthMin;
        
        // Check if this minute falls within the slot's range
        if (min >= slot.startMin && min < slotEnd) {
          if (slot.blocked) {
            // Blocker takes full capacity
            usedCapacity += concurrentCapacity;
          } else {
            // Regular slot takes 1 unit
            usedCapacity += 1;
          }
        }
      }

      // Calculate capacity needed for the new slot
      const newSlotCapacity = isBlocked ? concurrentCapacity : 1;

      // Check if adding the new slot would exceed capacity
      if (usedCapacity + newSlotCapacity > concurrentCapacity) {
        return {
          hasCapacity: false,
          message: `Kapazität überschritten um ${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} Uhr (${usedCapacity}/${concurrentCapacity} belegt)`,
        };
      }
    }

    return { hasCapacity: true };
  }

  private async validateTimeSlot(
    data: InsertTimeSlot | UpdateTimeSlot,
    existingSlot?: TimeSlot
  ): Promise<void> {
    // Merge with existing data for updates
    const merged = existingSlot ? { ...existingSlot, ...data } : data;
    
    // Validate working hours
    const startMin = merged.startMin!;
    const lengthMin = merged.lengthMin!;
    if (startMin < 420 || startMin + lengthMin > 1080) {
      throw new Error('Time slot must be within working hours (07:00-18:00)');
    }

    // Validate orderId and department if orderId is provided
    if (merged.orderId) {
      const order = await prisma.order.findUnique({
        where: { id: merged.orderId },
      });
      
      if (!order) {
        throw new Error('Order not found');
      }

      const workCenter = await prisma.workCenter.findUnique({
        where: { id: merged.workCenterId! },
      });

      if (!workCenter) {
        throw new Error('WorkCenter not found');
      }

      // Department guard
      if (order.department !== workCenter.department) {
        throw new Error('Order department must match WorkCenter department');
      }

      // Workflow guard
      const validWorkflows = ['FUER_PROD', 'IN_PROD', 'WARTET_FEHLTEILE'];
      if (!validWorkflows.includes(order.workflow)) {
        throw new Error('Order must be in FUER_PROD, IN_PROD, or WARTET_FEHLTEILE workflow state');
      }
    }

    // Check capacity
    const capacityCheck = await this.checkTimeSlotCapacity(
      merged.date! as unknown as string,
      startMin,
      lengthMin,
      merged.workCenterId!,
      merged.blocked ?? false,
      existingSlot?.id
    );

    if (!capacityCheck.hasCapacity) {
      throw new Error(capacityCheck.message || 'Capacity exceeded');
    }
  }

  async getCalendar(filters: CalendarFilters): Promise<TimeSlotWithOrder[]> {
    const where: any = {
      date: {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      },
    };

    if (filters.workCenterId) {
      where.workCenterId = filters.workCenterId;
    }

    if (filters.department) {
      where.workCenter = {
        department: filters.department,
      };
    }

    const slots = await prisma.timeSlot.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            displayOrderNumber: true,
            title: true,
            customer: true,
            department: true,
            workflow: true,
            dueDate: true,
            notes: true,
            printAssets: {
              select: {
                id: true,
                label: true,
                url: true,
                required: true,
              },
            },
            sizeTable: {
              select: {
                scheme: true,
                rowsJson: true,
                comment: true,
              },
            },
            positions: {
              select: {
                id: true,
                articleName: true,
                articleNumber: true,
                qty: true,
                unit: true,
                unitPriceNet: true,
              },
            },
          },
        },
        workCenter: {
          select: {
            id: true,
            name: true,
            department: true,
            concurrentCapacity: true,
          },
        },
      },
      orderBy: [
        { date: 'asc' },
        { startMin: 'asc' },
      ],
    });

    return slots;
  }

  async getOrderTimeSlots(orderId: string): Promise<TimeSlotWithOrder[]> {
    const slots = await prisma.timeSlot.findMany({
      where: { orderId },
      include: {
        order: {
          select: {
            id: true,
            displayOrderNumber: true,
            title: true,
            customer: true,
            department: true,
            workflow: true,
            dueDate: true,
          },
        },
        workCenter: {
          select: {
            id: true,
            name: true,
            department: true,
            concurrentCapacity: true,
          },
        },
      },
      orderBy: [
        { date: 'asc' },
        { startMin: 'asc' },
      ],
    });

    return slots;
  }

  async getTimeSlotById(id: string): Promise<TimeSlot | null> {
    return await prisma.timeSlot.findUnique({
      where: { id },
    });
  }

  async createTimeSlot(data: InsertTimeSlot): Promise<TimeSlot> {
    await this.validateTimeSlot(data);

    return await prisma.timeSlot.create({
      data: {
        date: new Date(data.date),
        startMin: data.startMin,
        lengthMin: data.lengthMin,
        workCenterId: data.workCenterId,
        orderId: data.orderId || null,
        blocked: data.blocked ?? false,
        note: data.note || null,
      },
    });
  }

  async updateTimeSlot(id: string, data: UpdateTimeSlot): Promise<TimeSlot> {
    const existing = await prisma.timeSlot.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('TimeSlot not found');
    }

    await this.validateTimeSlot(data, existing);

    const updateData: any = {};
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.startMin !== undefined) updateData.startMin = data.startMin;
    if (data.lengthMin !== undefined) updateData.lengthMin = data.lengthMin;
    if (data.workCenterId !== undefined) updateData.workCenterId = data.workCenterId;
    if (data.orderId !== undefined) updateData.orderId = data.orderId || null;
    if (data.blocked !== undefined) updateData.blocked = data.blocked;
    if (data.note !== undefined) updateData.note = data.note || null;

    return await prisma.timeSlot.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteTimeSlot(id: string): Promise<void> {
    const existing = await prisma.timeSlot.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('TimeSlot not found');
    }

    await prisma.timeSlot.delete({ where: { id } });
  }

  async batchTimeSlots(data: BatchTimeSlot): Promise<{ created: number; updated: number; deleted: number }> {
    let created = 0;
    let updated = 0;
    let deleted = 0;

    await prisma.$transaction(async (tx) => {
      // Delete operations
      if (data.delete && data.delete.length > 0) {
        for (const id of data.delete) {
          await tx.timeSlot.delete({ where: { id } });
          deleted++;
        }
      }

      // Create operations
      if (data.create && data.create.length > 0) {
        for (const slot of data.create) {
          await this.validateTimeSlot(slot);
          await tx.timeSlot.create({
            data: {
              date: new Date(slot.date),
              startMin: slot.startMin,
              lengthMin: slot.lengthMin,
              workCenterId: slot.workCenterId,
              orderId: slot.orderId || null,
              blocked: slot.blocked ?? false,
              note: slot.note || null,
            },
          });
          created++;
        }
      }

      // Update operations
      if (data.update && data.update.length > 0) {
        for (const { id, ...updateData } of data.update) {
          const existing = await tx.timeSlot.findUnique({ where: { id } });
          if (!existing) {
            throw new Error(`TimeSlot ${id} not found`);
          }

          await this.validateTimeSlot(updateData, existing);

          const dbUpdate: any = {};
          if (updateData.date !== undefined) dbUpdate.date = new Date(updateData.date);
          if (updateData.startMin !== undefined) dbUpdate.startMin = updateData.startMin;
          if (updateData.lengthMin !== undefined) dbUpdate.lengthMin = updateData.lengthMin;
          if (updateData.workCenterId !== undefined) dbUpdate.workCenterId = updateData.workCenterId;
          if (updateData.orderId !== undefined) dbUpdate.orderId = updateData.orderId || null;
          if (updateData.blocked !== undefined) dbUpdate.blocked = updateData.blocked;
          if (updateData.note !== undefined) dbUpdate.note = updateData.note || null;

          await tx.timeSlot.update({
            where: { id },
            data: dbUpdate,
          });
          updated++;
        }
      }
    });

    return { created, updated, deleted };
  }

  // ===== TimeSlot Action Methods =====

  async startTimeSlot(id: string): Promise<TimeSlot> {
    const slot = await prisma.timeSlot.findUnique({
      where: { id },
    });

    if (!slot) {
      throw new Error('TimeSlot nicht gefunden');
    }

    // Guard: Can only start PLANNED or PAUSED slots
    if (slot.status !== 'PLANNED' && slot.status !== 'PAUSED') {
      throw new Error(`TimeSlot kann nur aus Status PLANNED oder PAUSED gestartet werden (aktuell: ${slot.status})`);
    }

    // Guard: Must have an order assigned
    if (!slot.orderId) {
      throw new Error('TimeSlot muss einem Auftrag zugeordnet sein');
    }

    return await prisma.timeSlot.update({
      where: { id },
      data: {
        status: 'RUNNING',
        startedAt: slot.status === 'PLANNED' ? new Date() : slot.startedAt, // Preserve original start if resuming
      },
    });
  }

  async pauseTimeSlot(id: string): Promise<TimeSlot> {
    const slot = await prisma.timeSlot.findUnique({
      where: { id },
    });

    if (!slot) {
      throw new Error('TimeSlot nicht gefunden');
    }

    // Guard: Can only pause RUNNING slots
    if (slot.status !== 'RUNNING') {
      throw new Error(`TimeSlot kann nur aus Status RUNNING pausiert werden (aktuell: ${slot.status})`);
    }

    return await prisma.timeSlot.update({
      where: { id },
      data: {
        status: 'PAUSED',
        stoppedAt: new Date(),
      },
    });
  }

  async stopTimeSlot(id: string): Promise<TimeSlot> {
    const slot = await prisma.timeSlot.findUnique({
      where: { id },
    });

    if (!slot) {
      throw new Error('TimeSlot nicht gefunden');
    }

    // Guard: Can only stop RUNNING or PAUSED slots
    if (slot.status !== 'RUNNING' && slot.status !== 'PAUSED') {
      throw new Error(`TimeSlot kann nur aus Status RUNNING oder PAUSED beendet werden (aktuell: ${slot.status})`);
    }

    // Calculate actual duration if startedAt is set
    let actualDurationMin: number | undefined;
    const now = new Date();
    
    if (slot.startedAt) {
      const durationMs = now.getTime() - slot.startedAt.getTime();
      actualDurationMin = Math.round(durationMs / 60000); // Convert ms to minutes
    }

    const updatedSlot = await prisma.timeSlot.update({
      where: { id },
      data: {
        status: 'DONE',
        stoppedAt: now,
        actualDurationMin,
      },
    });

    // Check if all timeslots for this order are DONE
    // If yes, set order workflow to FERTIG
    if (slot.orderId) {
      await this.checkAndCompleteOrder(slot.orderId);
    }

    return updatedSlot;
  }

  async setTimeSlotQC(id: string, qc: 'IO' | 'NIO', note?: string | null): Promise<TimeSlot> {
    const slot = await prisma.timeSlot.findUnique({
      where: { id },
    });

    if (!slot) {
      throw new Error('TimeSlot nicht gefunden');
    }

    // Guard: Can only set QC for DONE slots
    if (slot.status !== 'DONE') {
      throw new Error(`QC kann nur für abgeschlossene TimeSlots gesetzt werden (aktuell: ${slot.status})`);
    }

    return await prisma.timeSlot.update({
      where: { id },
      data: {
        qc,
        missingPartsNote: note || slot.missingPartsNote, // Preserve existing note if none provided
      },
    });
  }

  /**
   * Check if all timeslots for an order are DONE and no BLOCKED/WARTET_FEHLTEILE
   * If yes, automatically set order workflow to FERTIG
   */
  private async checkAndCompleteOrder(orderId: string): Promise<void> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        timeSlots: true,
      },
    });

    if (!order || !order.timeSlots || order.timeSlots.length === 0) {
      return;
    }

    // Check if all timeslots are DONE
    const allDone = order.timeSlots.every(slot => slot.status === 'DONE');
    
    // Check if any timeslot is BLOCKED (missing parts)
    const hasBlocked = order.timeSlots.some(slot => slot.status === 'BLOCKED');

    // Auto-complete order if all slots DONE and no blocked slots
    if (allDone && !hasBlocked && order.workflow !== 'FERTIG') {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          workflow: 'FERTIG',
        },
      });
    }
  }

  async setTimeSlotMissingParts(id: string, note: string, updateOrderWorkflow: boolean): Promise<TimeSlot> {
    const slot = await prisma.timeSlot.findUnique({
      where: { id },
      include: {
        order: true,
      },
    });

    if (!slot) {
      throw new Error('TimeSlot nicht gefunden');
    }

    // Guard: Must have an order assigned
    if (!slot.orderId || !slot.order) {
      throw new Error('TimeSlot muss einem Auftrag zugeordnet sein');
    }

    // Update TimeSlot with missing parts note
    const updated = await prisma.timeSlot.update({
      where: { id },
      data: {
        missingPartsNote: note,
        status: 'BLOCKED', // Set status to BLOCKED when parts are missing
      },
    });

    // Optionally update order workflow to WARTET_FEHLTEILE
    if (updateOrderWorkflow) {
      await prisma.order.update({
        where: { id: slot.orderId },
        data: {
          workflow: 'WARTET_FEHLTEILE',
        },
      });
    }

    return updated;
  }

  // ===== Warehouse Methods =====

  async getWarehouseGroups(): Promise<WarehouseGroupWithRelations[]> {
    return await prisma.warehouseGroup.findMany({
      include: {
        places: {
          include: {
            occupiedByOrder: {
              select: {
                id: true,
                displayOrderNumber: true,
                title: true,
                customer: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async getWarehouseGroupById(id: string): Promise<WarehouseGroupWithRelations | null> {
    return await prisma.warehouseGroup.findUnique({
      where: { id },
      include: {
        places: {
          include: {
            occupiedByOrder: {
              select: {
                id: true,
                displayOrderNumber: true,
                title: true,
                customer: true,
              },
            },
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
    });
  }

  async createWarehouseGroup(data: InsertWarehouseGroup): Promise<WarehouseGroup> {
    return await prisma.warehouseGroup.create({
      data,
    });
  }

  async updateWarehouseGroup(id: string, data: UpdateWarehouseGroup): Promise<WarehouseGroup> {
    return await prisma.warehouseGroup.update({
      where: { id },
      data,
    });
  }

  async deleteWarehouseGroup(id: string): Promise<void> {
    await prisma.warehouseGroup.delete({
      where: { id },
    });
  }

  async getWarehousePlaces(groupId?: string): Promise<WarehousePlaceWithRelations[]> {
    const where: any = {};
    if (groupId) {
      where.groupId = groupId;
    }

    return await prisma.warehousePlace.findMany({
      where,
      include: {
        group: true,
        occupiedByOrder: {
          select: {
            id: true,
            displayOrderNumber: true,
            title: true,
            customer: true,
            workflow: true,
            dueDate: true,
          },
        },
      },
      orderBy: [
        { occupiedByOrderId: { sort: 'desc', nulls: 'last' } }, // occupied first
        { group: { name: 'asc' } },
        { name: 'asc' },
      ],
    });
  }

  async getWarehousePlaceById(id: string): Promise<WarehousePlaceWithRelations | null> {
    return await prisma.warehousePlace.findUnique({
      where: { id },
      include: {
        group: true,
        occupiedByOrder: {
          select: {
            id: true,
            displayOrderNumber: true,
            title: true,
            customer: true,
            workflow: true,
            dueDate: true,
          },
        },
      },
    });
  }

  async createWarehousePlace(data: InsertWarehousePlace): Promise<WarehousePlace> {
    return await prisma.warehousePlace.create({
      data,
    });
  }

  async updateWarehousePlace(id: string, data: UpdateWarehousePlace): Promise<WarehousePlace> {
    return await prisma.warehousePlace.update({
      where: { id },
      data,
    });
  }

  async deleteWarehousePlace(id: string): Promise<void> {
    await prisma.warehousePlace.delete({
      where: { id },
    });
  }

  async generateWarehousePlaces(groupId: string, data: GenerateWarehousePlaces): Promise<{ created: number; skipped: Array<{ name: string; reason: string }>; examples: string[] }> {
    const { prefix, start, end, zeroPad, separator, suffix } = data;

    // Verify group exists
    const group = await prisma.warehouseGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new Error('Warehouse group not found');
    }

    const toCreate: string[] = [];
    const skipped: Array<{ name: string; reason: string }> = [];

    // Generate place names
    for (let i = start; i <= end; i++) {
      const paddedNumber = i.toString().padStart(zeroPad, '0');
      const name = `${prefix.trim()}${separator}${paddedNumber}${suffix.trim()}`.trim();
      toCreate.push(name);
    }

    // Get existing places in this group
    const existing = await prisma.warehousePlace.findMany({
      where: {
        groupId,
        name: { in: toCreate },
      },
      select: { name: true },
    });

    const existingNames = new Set(existing.map(p => p.name));

    // Create only non-existing places
    let created = 0;
    for (const name of toCreate) {
      if (existingNames.has(name)) {
        skipped.push({ name, reason: 'exists' });
      } else {
        await prisma.warehousePlace.create({
          data: {
            groupId,
            name,
          },
        });
        created++;
      }
    }

    // Return summary with examples
    const examples = toCreate.slice(0, 3).concat(toCreate.length > 3 ? toCreate.slice(-3) : []);
    return { created, skipped, examples: [...new Set(examples)] };
  }

  async assignOrderToWarehousePlace(orderId: string, placeId: string | null): Promise<OrderWithRelations> {
    // Verify order exists
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    // If placeId is null, we're removing the assignment
    if (placeId === null) {
      await prisma.$transaction(async (tx) => {
        // Find and clear current assignment
        const currentPlace = await tx.warehousePlace.findFirst({
          where: { occupiedByOrderId: orderId },
        });

        if (currentPlace) {
          await tx.warehousePlace.update({
            where: { id: currentPlace.id },
            data: { occupiedByOrderId: null },
          });
        }
      });

      return await this.getOrderById(orderId) as OrderWithRelations;
    }

    // Use transaction to ensure atomic assignment
    await prisma.$transaction(async (tx) => {
      // Verify place exists and is free (with row lock)
      const place = await tx.warehousePlace.findUnique({
        where: { id: placeId },
      });

      if (!place) {
        throw new Error('Warehouse place not found');
      }

      // Check if place is occupied by a different order
      if (place.occupiedByOrderId && place.occupiedByOrderId !== orderId) {
        throw new Error('Warehouse place is already occupied');
      }

      // Clear any existing assignment for this order
      await tx.warehousePlace.updateMany({
        where: { occupiedByOrderId: orderId },
        data: { occupiedByOrderId: null },
      });

      // Assign order to the new place
      await tx.warehousePlace.update({
        where: { id: placeId },
        data: { occupiedByOrderId: orderId },
      });
    });

    return await this.getOrderById(orderId) as OrderWithRelations;
  }

  async releaseOrderFromMissingParts(orderId: string): Promise<OrderWithRelations> {
    // Verify order exists and is in WARTET_FEHLTEILE status
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.workflow !== 'WARTET_FEHLTEILE') {
      throw new Error('Order is not in WARTET_FEHLTEILE status');
    }

    // Delete ALL time slots for this order
    // This allows the order to be re-planned from scratch
    await prisma.timeSlot.deleteMany({
      where: {
        orderId: orderId,
      },
    });

    // Update order workflow to FUER_PROD
    return await this.updateOrder(orderId, {
      workflow: 'FUER_PROD',
    } as any);
  }
}

export const storage = new PrismaStorage();
