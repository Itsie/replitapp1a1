import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const today = new Date('2025-10-28T00:00:00Z');
  
  const slots = await prisma.timeSlot.findMany({
    where: { date: today },
    include: {
      workCenter: true,
      order: { select: { title: true, displayOrderNumber: true } }
    },
    orderBy: { startMin: 'asc' }
  });

  console.log(`Found ${slots.length} TimeSlots for 2025-10-28:`);
  slots.forEach(slot => {
    const orderInfo = slot.order 
      ? `${slot.order.displayOrderNumber || ''} ${slot.order.title}`
      : slot.blocked 
        ? `Blocker: ${slot.note}`
        : 'No Order';
    
    const startTime = `${Math.floor(slot.startMin / 60).toString().padStart(2, '0')}:${(slot.startMin % 60).toString().padStart(2, '0')}`;
    const endMin = slot.startMin + slot.lengthMin;
    const endTime = `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`;
    
    console.log(`  ${startTime}-${endTime} | ${slot.workCenter.department} | ${slot.workCenter.name} | ${orderInfo}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
