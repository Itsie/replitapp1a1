import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    select: { id: true, displayOrderNumber: true },
    orderBy: { displayOrderNumber: 'asc' },
  });
  
  console.log('Orders:', orders.map(o => o.displayOrderNumber).join(', '));
  
  const sequences = await prisma.orderSequence.findMany();
  console.log('Sequences:', sequences);
  
  await prisma.$disconnect();
}

main().catch(console.error);
