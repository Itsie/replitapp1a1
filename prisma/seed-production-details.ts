import { PrismaClient } from '@prisma/client';
import { startOfDay, addDays } from 'date-fns';

const prisma = new PrismaClient();

async function seedProductionDetails() {
  console.log('\n🎯 Adding detailed production data for testing...\n');

  const today = startOfDay(new Date());

  // Find or create a work center
  let workCenter = await prisma.workCenter.findFirst({
    where: { department: 'DRUCK' },
  });

  if (!workCenter) {
    workCenter = await prisma.workCenter.create({
      data: {
        name: 'Test Druck-Station',
        department: 'DRUCK',
        concurrentCapacity: 2,
      },
    });
  }

  // Create an order with full details
  const order = await prisma.order.create({
    data: {
      displayOrderNumber: 'TEST-' + Date.now().toString().slice(-6),
      title: 'Vollständiger Test-Auftrag',
      customer: 'Test Kunde GmbH',
      customerEmail: 'test@kunde.de',
      source: 'INTERNAL',
      department: 'DRUCK',
      workflow: 'FUER_PROD',
      dueDate: addDays(today, 3),
      notes: 'Wichtig: Bitte spezielle Druckfarbe verwenden und auf Qualität achten!',
      sizeTable: {
        create: {
          scheme: 'detailed',
          rowsJson: [
            { size: 'S', color: 'Blau', quantity: 10 },
            { size: 'M', color: 'Blau', quantity: 25 },
            { size: 'L', color: 'Blau', quantity: 20 },
            { size: 'XL', color: 'Blau', quantity: 15 },
            { size: 'M', color: 'Rot', quantity: 10 },
            { size: 'L', color: 'Rot', quantity: 10 },
          ],
          comment: 'Gesamtmenge: 90 Stück, Lieferung in 2 Kartons',
        },
      },
      printAssets: {
        create: [
          {
            fileName: 'logo-vorne.pdf',
            filePath: 'uploads/test-logo-vorne.pdf',
            fileType: 'application/pdf',
            fileSize: 245678,
          },
          {
            fileName: 'logo-ruecken.pdf',
            filePath: 'uploads/test-logo-ruecken.pdf',
            fileType: 'application/pdf',
            fileSize: 189432,
          },
        ],
      },
      positions: {
        create: [
          {
            productType: 'T-Shirt Premium',
            color: 'Blau',
            quantity: 70,
            pricePerUnit: 12.50,
            note: 'Baumwolle 100%, Größe S-XL',
          },
          {
            productType: 'T-Shirt Premium',
            color: 'Rot',
            quantity: 20,
            pricePerUnit: 12.50,
            note: 'Baumwolle 100%, Größe M-L',
          },
        ],
      },
    },
  });

  console.log(`✓ Created order: ${order.displayOrderNumber} - ${order.title}`);

  // Create a time slot for today
  const timeSlot = await prisma.timeSlot.create({
    data: {
      date: today,
      startMin: 8 * 60, // 08:00
      lengthMin: 120, // 2 hours
      status: 'RUNNING',
      startedAt: new Date(today.getTime() + 8 * 60 * 60 * 1000),
      orderId: order.id,
      workCenterId: workCenter.id,
    },
  });

  console.log(`✓ Created time slot: ${timeSlot.date.toLocaleDateString('de-DE')} 08:00-10:00 (RUNNING)`);

  console.log('\n✅ Production details seeding completed!\n');
  console.log('To test: Login as planner@1ashirt.de, go to /production-today');
  console.log('The order should show:');
  console.log('  - Auftragsnotiz');
  console.log('  - 2 Druckdaten (downloadable PDFs)');
  console.log('  - Größentabelle mit 6 Zeilen');
  console.log('  - 2 Auftragspositionen\n');
}

seedProductionDetails()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
