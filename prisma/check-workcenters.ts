import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const workCenters = await prisma.workCenter.findMany({
    orderBy: [{ department: 'asc' }, { name: 'asc' }]
  });

  console.log(`Found ${workCenters.length} WorkCenters:`);
  workCenters.forEach(wc => {
    console.log(`- ${wc.name} (${wc.department}) - ${wc.active ? 'active' : 'inactive'}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
