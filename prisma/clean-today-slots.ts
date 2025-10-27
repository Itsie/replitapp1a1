import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const result = await prisma.timeSlot.deleteMany({
    where: {
      date: today,
    },
  });
  
  console.log(`✓ Deleted ${result.count} time slots for today`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
