import { PrismaClient } from '@prisma/client';
import { startOfDay } from 'date-fns';

const prisma = new PrismaClient();

async function addTestSlot() {
  console.log('\n🎯 Adding test slot with production data...\n');

  const today = startOfDay(new Date());

  // Find an order that has printAssets and sizeTable
  const order = await prisma.order.findFirst({
    where: {
      department: 'DRUCK',
      NOT: {
        printAssets: { none: {} },
        sizeTable: null,
        positions: { none: {} },
      },
    },
    include: {
      printAssets: true,
      sizeTable: true,
      positions: true,
    },
  });

  if (!order) {
    console.log('❌ No order found with printAssets, sizeTable and positions');
    console.log('Creating a simple test...');
    return;
  }

  console.log(`✓ Found order: ${order.displayOrderNumber || order.title}`);
  console.log(`  - ${order.printAssets?.length || 0} print assets`);
  console.log(`  - Size table: ${order.sizeTable ? 'Yes' : 'No'}`);
  console.log(`  - ${order.positions?.length || 0} positions`);

  // Find a work center
  const workCenter = await prisma.workCenter.findFirst({
    where: { department: 'DRUCK' },
  });

  if (!workCenter) {
    console.log('❌ No work center found for DRUCK');
    return;
  }

  // Delete existing time slots for today for this order
  await prisma.timeSlot.deleteMany({
    where: {
      orderId: order.id,
      date: today,
    },
  });

  // Create a RUNNING time slot for today
  const timeSlot = await prisma.timeSlot.create({
    data: {
      date: today,
      startMin: 9 * 60, // 09:00
      lengthMin: 90, // 1.5 hours
      status: 'RUNNING',
      startedAt: new Date(today.getTime() + 9 * 60 * 60 * 1000),
      orderId: order.id,
      workCenterId: workCenter.id,
    },
  });

  console.log(`\n✅ Created time slot: ${timeSlot.date.toLocaleDateString('de-DE')} 09:00-10:30 (RUNNING)`);
  console.log('\nTo test: Login as planner@1ashirt.de, go to /production-today');
  console.log('The order should show all production details!\n');
}

addTestSlot()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
