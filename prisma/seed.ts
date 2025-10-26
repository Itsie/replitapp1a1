import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo users for each role
  const users = [
    {
      email: 'admin@1ashirt.de',
      name: 'Admin User',
      role: 'ADMIN' as const,
      password: 'admin123', // In production, use bcrypt
    },
    {
      email: 'planner@1ashirt.de',
      name: 'Production Planner',
      role: 'PROD_PLAN' as const,
      password: 'planner123',
    },
    {
      email: 'worker@1ashirt.de',
      name: 'Production Worker',
      role: 'PROD_RUN' as const,
      password: 'worker123',
    },
    {
      email: 'sales@1ashirt.de',
      name: 'Sales Operations',
      role: 'SALES_OPS' as const,
      password: 'sales123',
    },
    {
      email: 'accounting@1ashirt.de',
      name: 'Accounting User',
      role: 'ACCOUNTING' as const,
      password: 'accounting123',
    },
  ];

  for (const userData of users) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (!existingUser) {
      await prisma.user.create({
        data: userData,
      });
      console.log(`✓ Created user: ${userData.email} (${userData.role})`);
    } else {
      console.log(`- User already exists: ${userData.email}`);
    }
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
