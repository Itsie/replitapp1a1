import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

async function main() {
  console.log('🌱 Seeding production demo data...');

  // Create demo users for each role
  const users = [
    {
      email: 'admin@1ashirt.de',
      name: 'Admin User',
      role: 'ADMIN' as const,
      plainPassword: 'demo123',
    },
    {
      email: 'planner@1ashirt.de',
      name: 'Production Planner',
      role: 'PROD_PLAN' as const,
      plainPassword: 'demo123',
    },
    {
      email: 'worker@1ashirt.de',
      name: 'Production Worker',
      role: 'PROD_RUN' as const,
      plainPassword: 'demo123',
    },
    {
      email: 'sales@1ashirt.de',
      name: 'Sales Operations',
      role: 'SALES_OPS' as const,
      plainPassword: 'demo123',
    },
    {
      email: 'accounting@1ashirt.de',
      name: 'Accounting User',
      role: 'ACCOUNTING' as const,
      plainPassword: 'demo123',
    },
    {
      email: 'lager@1ashirt.de',
      name: 'Warehouse Manager',
      role: 'LAGER' as const,
      plainPassword: 'demo123',
    },
  ];

  for (const userData of users) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    const hashedPassword = await hashPassword(userData.plainPassword);

    if (!existingUser) {
      await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          role: userData.role,
          password: hashedPassword,
        },
      });
      console.log(`✓ Created user: ${userData.email} (${userData.role})`);
    } else {
      await prisma.user.update({
        where: { email: userData.email },
        data: {
          password: hashedPassword,
        },
      });
      console.log(`✓ Updated user password: ${userData.email}`);
    }
  }

  // Create work centers for different departments
  const workCenters = [
    { name: 'Druck-Station 1', department: 'DRUCK' as const, capacity: 2 },
    { name: 'Druck-Station 2', department: 'DRUCK' as const, capacity: 2 },
    { name: 'Stickerei Maschine A', department: 'STICKEREI' as const, capacity: 1 },
    { name: 'Stickerei Maschine B', department: 'STICKEREI' as const, capacity: 2 },
    { name: 'Textilveredelung Bereich 1', department: 'TEXTILVEREDELUNG' as const, capacity: 3 },
  ];

  const createdWorkCenters: Record<string, string> = {};

  for (const wc of workCenters) {
    const existing = await prisma.workCenter.findFirst({
      where: { name: wc.name },
    });

    if (!existing) {
      const created = await prisma.workCenter.create({
        data: {
          name: wc.name,
          department: wc.department,
          capacityMin: 660, // 11 hours
          concurrentCapacity: wc.capacity,
          active: true,
        },
      });
      createdWorkCenters[wc.name] = created.id;
      console.log(`✓ Created work center: ${wc.name}`);
    } else {
      createdWorkCenters[wc.name] = existing.id;
      console.log(`- Work center already exists: ${wc.name}`);
    }
  }

  // Create orders with different workflow states
  const orders = [
    {
      title: 'FC Bayern Trikots 2025',
      customer: 'FC Bayern München',
      department: 'DRUCK' as const,
      workflow: 'FUER_PROD' as const,
      totalNet: 2500,
      totalGross: 2975,
    },
    {
      title: 'Vereins-Polo Shirts',
      customer: 'SV Musterhausen',
      department: 'STICKEREI' as const,
      workflow: 'IN_PROD' as const,
      totalNet: 1200,
      totalGross: 1428,
    },
    {
      title: 'Firmenuniformen Bäckerei',
      customer: 'Bäckerei Schmidt',
      department: 'TEXTILVEREDELUNG' as const,
      workflow: 'FUER_PROD' as const,
      totalNet: 800,
      totalGross: 952,
    },
    {
      title: 'Event T-Shirts Stadtfest',
      customer: 'Stadt Musterstadt',
      department: 'DRUCK' as const,
      workflow: 'WARTET_FEHLTEILE' as const,
      totalNet: 1500,
      totalGross: 1785,
    },
    {
      title: 'Bestickte Caps',
      customer: 'Golf Club Elite',
      department: 'STICKEREI' as const,
      workflow: 'FERTIG' as const,
      totalNet: 600,
      totalGross: 714,
    },
    {
      title: 'Hoodies mit Logo',
      customer: 'Startup GmbH',
      department: 'DRUCK' as const,
      workflow: 'NEU' as const,
      totalNet: 3200,
      totalGross: 3808,
    },
  ];

  const createdOrders: Record<string, string> = {};

  for (const order of orders) {
    const existing = await prisma.order.findFirst({
      where: { title: order.title },
    });

    if (!existing) {
      const created = await prisma.order.create({
        data: {
          title: order.title,
          customer: order.customer,
          department: order.department,
          source: 'INTERNAL',
          workflow: order.workflow,
          totalNet: order.totalNet,
          totalGross: order.totalGross,
        },
      });
      createdOrders[order.title] = created.id;
      console.log(`✓ Created order: ${order.title} (${order.workflow})`);
    } else {
      createdOrders[order.title] = existing.id;
      console.log(`- Order already exists: ${order.title}`);
    }
  }

  // Create time slots for today, tomorrow, and day after tomorrow
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const timeSlots = [
    // Today - various statuses
    {
      date: today,
      startMin: 420, // 07:00
      lengthMin: 120,
      workCenter: 'Druck-Station 1',
      order: 'FC Bayern Trikots 2025',
      status: 'RUNNING' as const,
      startedAt: new Date(today.getTime() + 7 * 60 * 60 * 1000), // 07:00
    },
    {
      date: today,
      startMin: 540, // 09:00
      lengthMin: 90,
      workCenter: 'Stickerei Maschine A',
      order: 'Vereins-Polo Shirts',
      status: 'PAUSED' as const,
      startedAt: new Date(today.getTime() + 9 * 60 * 60 * 1000), // 09:00
    },
    {
      date: today,
      startMin: 660, // 11:00
      lengthMin: 60,
      workCenter: 'Textilveredelung Bereich 1',
      order: 'Firmenuniformen Bäckerei',
      status: 'DONE' as const,
      startedAt: new Date(today.getTime() + 11 * 60 * 60 * 1000),
      stoppedAt: new Date(today.getTime() + 12 * 60 * 60 * 1000),
    },
    {
      date: today,
      startMin: 780, // 13:00
      lengthMin: 90,
      workCenter: 'Druck-Station 2',
      order: 'FC Bayern Trikots 2025',
      status: 'PLANNED' as const,
    },
    
    // Tomorrow - various planned slots
    {
      date: tomorrow,
      startMin: 480, // 08:00
      lengthMin: 120,
      workCenter: 'Druck-Station 2',
      order: 'FC Bayern Trikots 2025',
      status: 'PLANNED' as const,
    },
    {
      date: tomorrow,
      startMin: 600, // 10:00
      lengthMin: 150,
      workCenter: 'Stickerei Maschine B',
      order: 'Bestickte Caps',
      status: 'PLANNED' as const,
    },
    {
      date: tomorrow,
      startMin: 510, // 08:30
      lengthMin: 90,
      workCenter: 'Textilveredelung Bereich 1',
      order: 'Firmenuniformen Bäckerei',
      status: 'PLANNED' as const,
    },
    
    // Day after tomorrow
    {
      date: dayAfter,
      startMin: 420, // 07:00
      lengthMin: 180,
      workCenter: 'Druck-Station 1',
      order: 'Hoodies mit Logo',
      status: 'PLANNED' as const,
    },
    {
      date: dayAfter,
      startMin: 480, // 08:00
      lengthMin: 120,
      workCenter: 'Stickerei Maschine A',
      order: 'Vereins-Polo Shirts',
      status: 'PLANNED' as const,
    },
  ];

  for (const slot of timeSlots) {
    const workCenterId = createdWorkCenters[slot.workCenter];
    const orderId = createdOrders[slot.order];

    if (!workCenterId || !orderId) {
      console.log(`⚠ Skipping slot: missing work center or order`);
      continue;
    }

    const existing = await prisma.timeSlot.findFirst({
      where: {
        date: slot.date,
        startMin: slot.startMin,
        workCenterId,
      },
    });

    if (!existing) {
      await prisma.timeSlot.create({
        data: {
          date: slot.date,
          startMin: slot.startMin,
          lengthMin: slot.lengthMin,
          workCenterId,
          orderId,
          status: slot.status,
          startedAt: slot.startedAt || null,
          stoppedAt: slot.stoppedAt || null,
        },
      });
      
      const dateStr = slot.date.toLocaleDateString('de-DE');
      const timeStr = `${Math.floor(slot.startMin / 60).toString().padStart(2, '0')}:${(slot.startMin % 60).toString().padStart(2, '0')}`;
      console.log(`✓ Created time slot: ${dateStr} ${timeStr} - ${slot.order} (${slot.status})`);
    } else {
      console.log(`- Time slot already exists`);
    }
  }

  // Create warehouse groups and places
  const warehouseGroups = [
    { name: 'Halle A', description: 'Hauptlager für fertige Produkte' },
    { name: 'Halle B', description: 'Rohstoffe und Materialien' },
  ];

  for (const group of warehouseGroups) {
    const existing = await (prisma as any).warehouseGroup.findFirst({
      where: { name: group.name },
    });

    if (!existing) {
      const created = await (prisma as any).warehouseGroup.create({
        data: {
          name: group.name,
          description: group.description,
        },
      });
      console.log(`✓ Created warehouse group: ${group.name}`);

      // Create some places in this group
      if (group.name === 'Halle A') {
        for (let i = 1; i <= 5; i++) {
          await (prisma as any).warehousePlace.create({
            data: {
              groupId: created.id,
              name: `A-${i.toString().padStart(3, '0')}`,
            },
          });
        }
        console.log(`  ✓ Created 5 warehouse places in ${group.name}`);
      }
    } else {
      console.log(`- Warehouse group already exists: ${group.name}`);
    }
  }

  console.log('');
  console.log('✅ Seeding completed!');
  console.log('');
  console.log('Demo users:');
  users.forEach(u => console.log(`  - ${u.email} / ${u.plainPassword} (${u.role})`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
