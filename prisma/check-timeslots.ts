import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const slots = await prisma.timeSlot.findMany({
    where: {
      workCenter: {
        department: "TEAMSPORT",
      },
    },
    include: {
      workCenter: true,
      order: true,
    },
    orderBy: {
      date: "asc",
    },
  });

  console.log(`Found ${slots.length} TimeSlots for TEAMSPORT:`);
  slots.forEach((slot) => {
    console.log({
      id: slot.id,
      date: slot.date,
      startMin: slot.startMin,
      lengthMin: slot.lengthMin,
      blocked: slot.blocked,
      note: slot.note,
      workCenter: slot.workCenter.name,
      order: slot.order?.displayOrderNumber || "N/A",
    });
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
