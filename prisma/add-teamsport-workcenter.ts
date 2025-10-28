import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.workCenter.findFirst({
    where: { department: "TEAMSPORT" },
  });

  if (existing) {
    console.log("TEAMSPORT WorkCenter bereits vorhanden:", existing);
    return;
  }

  const wc = await prisma.workCenter.create({
    data: {
      name: "Teamsport Produktion",
      department: "TEAMSPORT",
      capacityMin: 660,
      concurrentCapacity: 2,
      active: true,
    },
  });

  console.log("TEAMSPORT WorkCenter erstellt:", wc);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
