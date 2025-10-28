import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const allSlots = await prisma.timeSlot.findMany({
    include: {
      workCenter: true,
      order: { select: { title: true, displayOrderNumber: true } }
    },
    orderBy: [{ date: 'asc' }, { startMin: 'asc' }]
  });

  console.log(`Total TimeSlots: ${allSlots.length}\n`);
  
  allSlots.forEach(slot => {
    const orderInfo = slot.order 
      ? `${slot.order.displayOrderNumber || ''} ${slot.order.title}`
      : slot.blocked 
        ? `BLOCKER: ${slot.note}`
        : 'No Order';
    
    const startTime = `${Math.floor(slot.startMin / 60).toString().padStart(2, '0')}:${(slot.startMin % 60).toString().padStart(2, '0')}`;
    const endMin = slot.startMin + slot.lengthMin;
    const endTime = `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`;
    
    const dateStr = slot.date.toISOString().split('T')[0];
    
    console.log(`${dateStr} | ${startTime}-${endTime} | ${slot.workCenter.department.padEnd(18)} | ${slot.workCenter.name.padEnd(25)} | ${orderInfo}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
