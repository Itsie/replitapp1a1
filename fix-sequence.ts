import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find highest order number for 2025
  const orders = await prisma.order.findMany({
    where: {
      displayOrderNumber: { startsWith: 'INT-2025-' },
    },
    select: { displayOrderNumber: true },
  });
  
  let maxNum = 999;
  for (const order of orders) {
    if (order.displayOrderNumber) {
      const num = parseInt(order.displayOrderNumber.split('-')[2], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  
  console.log(`Highest order number: INT-2025-${maxNum}`);
  console.log(`Setting sequence to: ${maxNum + 1}`);
  
  // Update sequence
  await prisma.orderSequence.upsert({
    where: { year: 2025 },
    create: { year: 2025, current: maxNum + 1 },
    update: { current: maxNum + 1 },
  });
  
  console.log('Sequence fixed!');
  await prisma.$disconnect();
}

main().catch(console.error);
