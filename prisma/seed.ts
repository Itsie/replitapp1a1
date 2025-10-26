import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

async function main() {
  console.log('Seeding database...');

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
      console.log(`✓ Created user: ${userData.email} (${userData.role}) with password: ${userData.plainPassword}`);
    } else {
      // Update existing user with hashed password
      await prisma.user.update({
        where: { email: userData.email },
        data: {
          password: hashedPassword,
        },
      });
      console.log(`✓ Updated user password: ${userData.email} with password: ${userData.plainPassword}`);
    }
  }

  // Create test work center for RBAC testing
  const testWorkCenter = await prisma.workCenter.findFirst({
    where: { name: 'Test Bereich' },
  });

  let workCenterId: string;
  if (!testWorkCenter) {
    const newWorkCenter = await prisma.workCenter.create({
      data: {
        name: 'Test Bereich',
        department: 'DRUCK',
        capacityMin: 660,
        concurrentCapacity: 2,
        active: true,
      },
    });
    workCenterId = newWorkCenter.id;
    console.log(`✓ Created test work center: ${newWorkCenter.name}`);
  } else {
    workCenterId = testWorkCenter.id;
    console.log(`- Test work center already exists: ${testWorkCenter.name}`);
  }

  // Create test order for RBAC testing
  const testOrder = await prisma.order.findFirst({
    where: { title: 'Test Order for RBAC' },
  });

  let orderId: string;
  if (!testOrder) {
    const newOrder = await prisma.order.create({
      data: {
        title: 'Test Order for RBAC',
        customer: 'Test Customer',
        department: 'DRUCK',
        source: 'INTERNAL',
        workflow: 'FUER_PROD',
        totalNet: 0,
        totalGross: 0,
      },
    });
    orderId = newOrder.id;
    console.log(`✓ Created test order: ${newOrder.title}`);
  } else {
    orderId = testOrder.id;
    console.log(`- Test order already exists: ${testOrder.title}`);
  }

  // Create test time slot for RBAC testing
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0); // Set to midnight
  const dateStr = tomorrow.toISOString().split('T')[0];

  const existingSlot = await prisma.timeSlot.findFirst({
    where: {
      workCenterId,
      date: tomorrow,
      startMin: 480, // 08:00
    },
  });

  if (!existingSlot) {
    await prisma.timeSlot.create({
      data: {
        date: tomorrow,
        startMin: 480, // 08:00
        lengthMin: 120, // 2 hours
        workCenterId,
        orderId,
        status: 'PLANNED',
      },
    });
    console.log(`✓ Created test time slot for ${dateStr} 08:00-10:00`);
  } else {
    console.log(`- Test time slot already exists for ${dateStr}`);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
