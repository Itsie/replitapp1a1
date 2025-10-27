import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Erstelle Beispiel-Aufträge mit vollständigen Daten...\n');

  // Work Centers erstellen
  let druckStation1 = await prisma.workCenter.findFirst({
    where: { name: 'Druck-Station 1' },
  });
  if (!druckStation1) {
    druckStation1 = await prisma.workCenter.create({
      data: {
        name: 'Druck-Station 1',
        department: 'DRUCK',
        capacityMin: 660,
        concurrentCapacity: 2,
        active: true,
      },
    });
  }

  let stickereiStation = await prisma.workCenter.findFirst({
    where: { name: 'Stickerei-Maschine A' },
  });
  if (!stickereiStation) {
    stickereiStation = await prisma.workCenter.create({
      data: {
        name: 'Stickerei-Maschine A',
        department: 'STICKEREI',
        capacityMin: 660,
        concurrentCapacity: 1,
        active: true,
      },
    });
  }

  console.log('✅ Work Centers erstellt\n');

  // Warehouse Groups und Places
  let warehouseGroup = await prisma.warehouseGroup.findFirst({
    where: { name: 'Hauptlager' },
  });
  if (!warehouseGroup) {
    warehouseGroup = await prisma.warehouseGroup.create({
      data: {
        name: 'Hauptlager',
        description: 'Hauptlagerbereich für fertige Aufträge',
      },
    });
  }

  let lagerplatzA1 = await prisma.warehousePlace.findFirst({
    where: { 
      groupId: warehouseGroup.id,
      name: 'A-01' 
    },
  });
  if (!lagerplatzA1) {
    lagerplatzA1 = await prisma.warehousePlace.create({
      data: {
        name: 'A-01',
        groupId: warehouseGroup.id,
      },
    });
  }

  console.log('✅ Lagerplätze erstellt\n');

  // === AUFTRAG 1: NEU - Komplett ausgefüllt, wartet auf Druckdaten ===
  const order1 = await prisma.order.upsert({
    where: { displayOrderNumber: 'INT-2025-1001' },
    create: {
      displayOrderNumber: 'INT-2025-1001',
      title: 'FC Bayern Trikots 2025',
      customer: 'FC Bayern München e.V.',
      company: 'FC Bayern München e.V.',
      contactFirstName: 'Thomas',
      contactLastName: 'Müller',
      customerEmail: 'thomas.mueller@fcbayern.de',
      customerPhone: '+49 89 699310',
      
      // Rechnungsadresse
      billStreet: 'Säbener Straße 51-57',
      billZip: '81547',
      billCity: 'München',
      billCountry: 'Deutschland',
      
      // Versandadresse
      shipStreet: 'Allianz Arena',
      shipZip: '80939',
      shipCity: 'München',
      shipCountry: 'Deutschland',
      
      department: 'TEAMSPORT',
      source: 'INTERNAL',
      workflow: 'NEU',
      dueDate: new Date('2025-11-15'),
      location: 'Hauptlager Regal A',
      notes: 'Wichtiger Stammkunde - Priorität hoch. Logo muss exakt positioniert werden.',
      totalNet: 2400.00,
      totalGross: 2856.00,
    },
    update: {},
  });

  // Positionen für Auftrag 1
  const existingPos1 = await prisma.orderPosition.findFirst({
    where: { 
      orderId: order1.id,
      articleNumber: 'TRI-FCB-001'
    }
  });
  if (!existingPos1) {
    await prisma.orderPosition.create({
      data: {
        orderId: order1.id,
        articleNumber: 'TRI-FCB-001',
        articleName: 'Trikot Heimspiel Saison 2025',
        qty: 30,
        unitPriceNet: 80.00,
        lineNet: 2400.00,
        lineVat: 456.00,
        lineGross: 2856.00,
        supplierNote: 'Größen: S(5), M(10), L(10), XL(5)',
      },
    });
  }

  console.log('✅ Auftrag 1: FC Bayern Trikots (NEU) - Wartet auf Druckdaten');

  // === AUFTRAG 2: FUER_PROD - Bereit zur Einplanung ===
  const order2 = await prisma.order.upsert({
    where: { displayOrderNumber: 'INT-2025-1002' },
    create: {
      displayOrderNumber: 'INT-2025-1002',
      title: 'Vereins-Polo Shirts SV Musterhausen',
      customer: 'SV Musterhausen',
      company: 'SV Musterhausen 1920 e.V.',
      contactFirstName: 'Hans',
      contactLastName: 'Schmidt',
      customerEmail: 'h.schmidt@sv-musterhausen.de',
      customerPhone: '+49 761 555123',
      
      billStreet: 'Sportplatzweg 12',
      billZip: '79100',
      billCity: 'Freiburg',
      billCountry: 'Deutschland',
      
      shipStreet: 'Sportplatzweg 12',
      shipZip: '79100',
      shipCity: 'Freiburg',
      shipCountry: 'Deutschland',
      
      department: 'TEAMSPORT',
      source: 'INTERNAL',
      workflow: 'FUER_PROD',
      dueDate: new Date('2025-11-20'),
      location: null,
      notes: 'Standard-Auftrag, keine Besonderheiten',
      totalNet: 750.00,
      totalGross: 892.50,
    },
    update: {},
  });

  const existingPos2 = await prisma.orderPosition.findFirst({
    where: { orderId: order2.id, articleNumber: 'POLO-STD-001' }
  });
  if (!existingPos2) {
    await prisma.orderPosition.create({
      data: {
        orderId: order2.id,
        articleNumber: 'POLO-STD-001',
        articleName: 'Polo-Shirt Standard Dunkelblau',
        qty: 25,
        unitPriceNet: 30.00,
        lineNet: 750.00,
        lineVat: 142.50,
        lineGross: 892.50,
      },
    });
  }

  // Größentabelle für Auftrag 2
  const existingST2 = await prisma.sizeTable.findUnique({
    where: { orderId: order2.id },
  });
  if (!existingST2) {
    await prisma.sizeTable.create({
      data: {
        orderId: order2.id,
        scheme: 'ALPHA',
        rowsJson: [
          { size: 'S', quantity: 5, notes: '' },
          { size: 'M', quantity: 10, notes: '' },
          { size: 'L', quantity: 7, notes: '' },
          { size: 'XL', quantity: 3, notes: '' },
        ],
      },
    });
  }

  // Druckdaten für Auftrag 2
  const existingAsset2 = await prisma.orderAsset.findFirst({
    where: { orderId: order2.id, label: 'Vereinslogo SV Musterhausen' }
  });
  if (!existingAsset2) {
    await prisma.orderAsset.create({
      data: {
        orderId: order2.id,
        kind: 'PRINT',
        label: 'Vereinslogo SV Musterhausen',
        url: '/uploads/example/logo-sv-musterhausen.pdf',
        ext: 'pdf',
        size: 245678,
        required: true,
      },
    });
  }

  console.log('✅ Auftrag 2: SV Musterhausen Polos (FUER_PROD) - Bereit zur Planung');

  // === AUFTRAG 3: IN_PROD - Geplant für heute ===
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const order3 = await prisma.order.upsert({
    where: { displayOrderNumber: 'INT-2025-1003' },
    create: {
      displayOrderNumber: 'INT-2025-1003',
      title: 'Werbetextilien Firma Meyer GmbH',
      customer: 'Meyer GmbH',
      company: 'Meyer Maschinenbau GmbH & Co. KG',
      contactFirstName: 'Andrea',
      contactLastName: 'Weber',
      customerEmail: 'a.weber@meyer-gmbh.de',
      customerPhone: '+49 711 123456',
      
      billStreet: 'Industriestraße 45',
      billZip: '70565',
      billCity: 'Stuttgart',
      billCountry: 'Deutschland',
      
      shipStreet: 'Industriestraße 45',
      shipZip: '70565',
      shipCity: 'Stuttgart',
      shipCountry: 'Deutschland',
      
      department: 'DRUCK',
      source: 'INTERNAL',
      workflow: 'IN_PROD',
      dueDate: new Date('2025-11-05'),
      location: null,
      notes: 'Eilauftrag - Messe am 10.11.',
      totalNet: 1200.00,
      totalGross: 1428.00,
    },
    update: {},
  });

  const existingPos3 = await prisma.orderPosition.findFirst({
    where: { orderId: order3.id, articleNumber: 'SHIRT-PROMO-001' }
  });
  if (!existingPos3) {
    await prisma.orderPosition.create({
      data: {
        orderId: order3.id,
        articleNumber: 'SHIRT-PROMO-001',
        articleName: 'T-Shirt Premium Weiß mit Firmendruck',
        qty: 50,
        unitPriceNet: 24.00,
        lineNet: 1200.00,
        lineVat: 228.00,
        lineGross: 1428.00,
      },
    });
  }

  const existingAsset3 = await prisma.orderAsset.findFirst({
    where: { orderId: order3.id, label: 'Firmenlogo Meyer GmbH' }
  });
  if (!existingAsset3) {
    await prisma.orderAsset.create({
      data: {
        orderId: order3.id,
        kind: 'PRINT',
        label: 'Firmenlogo Meyer GmbH',
        url: '/uploads/example/meyer-logo.ai',
        ext: 'ai',
        size: 156789,
        required: true,
      },
    });
  }

  // Timeslot für heute
  const slot3 = await prisma.timeSlot.create({
    data: {
      date: today,
      startMin: 480, // 08:00
      lengthMin: 180, // 3 Stunden
      workCenterId: druckStation1.id,
      orderId: order3.id,
      status: 'RUNNING',
      startedAt: new Date(today.getTime() + (8 * 60 * 60 * 1000)), // 08:00 heute
    },
  });

  console.log('✅ Auftrag 3: Meyer GmbH Werbetextilien (IN_PROD) - Läuft gerade');

  // === AUFTRAG 4: FERTIG - Produktion abgeschlossen ===
  const order4 = await prisma.order.upsert({
    where: { displayOrderNumber: 'INT-2025-1004' },
    create: {
      displayOrderNumber: 'INT-2025-1004',
      title: 'TSV Heidelberg Trainingsanzüge',
      customer: 'TSV Heidelberg',
      company: 'Turn- und Sportverein Heidelberg 1846 e.V.',
      contactFirstName: 'Julia',
      contactLastName: 'Becker',
      customerEmail: 'j.becker@tsv-heidelberg.de',
      customerPhone: '+49 6221 987654',
      
      billStreet: 'Sportallee 88',
      billZip: '69115',
      billCity: 'Heidelberg',
      billCountry: 'Deutschland',
      
      department: 'STICKEREI',
      source: 'INTERNAL',
      workflow: 'FERTIG',
      dueDate: new Date('2025-10-28'),
      location: null,
      notes: 'Bestickung Logo + Vereinswappen',
      totalNet: 1800.00,
      totalGross: 2142.00,
    },
    update: {},
  });

  const existingPos4 = await prisma.orderPosition.findFirst({
    where: { orderId: order4.id, articleNumber: 'TRAIN-SUIT-001' }
  });
  if (!existingPos4) {
    await prisma.orderPosition.create({
      data: {
        orderId: order4.id,
        articleNumber: 'TRAIN-SUIT-001',
        articleName: 'Trainingsanzug Premium Schwarz/Rot',
        qty: 20,
        unitPriceNet: 90.00,
        lineNet: 1800.00,
        lineVat: 342.00,
        lineGross: 2142.00,
      },
    });
  }

  const existingST4 = await prisma.sizeTable.findUnique({
    where: { orderId: order4.id },
  });
  if (!existingST4) {
    await prisma.sizeTable.create({
      data: {
        orderId: order4.id,
        scheme: 'ALPHA',
        rowsJson: [
          { size: 'M', quantity: 8, notes: '' },
          { size: 'L', quantity: 8, notes: '' },
          { size: 'XL', quantity: 4, notes: '' },
        ],
      },
    });
  }

  const existingAsset4 = await prisma.orderAsset.findFirst({
    where: { orderId: order4.id, label: 'Stickvorlage TSV Wappen' }
  });
  if (!existingAsset4) {
    await prisma.orderAsset.create({
      data: {
        orderId: order4.id,
        kind: 'PRINT',
        label: 'Stickvorlage TSV Wappen',
        url: '/uploads/example/tsv-wappen.dst',
        ext: 'dst',
        size: 89012,
        required: true,
      },
    });
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  await prisma.timeSlot.create({
    data: {
      date: yesterday,
      startMin: 540, // 09:00
      lengthMin: 240, // 4 Stunden
      workCenterId: stickereiStation.id,
      orderId: order4.id,
      status: 'DONE',
      startedAt: new Date(yesterday.getTime() + (9 * 60 * 60 * 1000)),
      stoppedAt: new Date(yesterday.getTime() + (13 * 60 * 60 * 1000)),
      qc: 'IO',
    },
  });

  console.log('✅ Auftrag 4: TSV Heidelberg Trainingsanzüge (FERTIG) - Produktion abgeschlossen');

  // === AUFTRAG 5: ZUR_ABRECHNUNG - Wartet auf Abrechnung ===
  const order5 = await prisma.order.upsert({
    where: { displayOrderNumber: 'INT-2025-1005' },
    create: {
      displayOrderNumber: 'INT-2025-1005',
      title: 'Event-Shirts Stadtfest Mannheim',
      customer: 'Stadt Mannheim',
      company: 'Stadt Mannheim - Kulturamt',
      contactFirstName: 'Michael',
      contactLastName: 'Fischer',
      customerEmail: 'm.fischer@mannheim.de',
      customerPhone: '+49 621 293-0',
      
      billStreet: 'E 5, 1-2',
      billZip: '68159',
      billCity: 'Mannheim',
      billCountry: 'Deutschland',
      
      shipStreet: 'Marktplatz 1',
      shipZip: '68161',
      shipCity: 'Mannheim',
      shipCountry: 'Deutschland',
      
      department: 'DRUCK',
      source: 'INTERNAL',
      workflow: 'ZUR_ABRECHNUNG',
      dueDate: new Date('2025-10-25'),
      deliveredAt: new Date('2025-10-26'),
      deliveredNote: 'Abholung durch Hr. Fischer am 26.10.',
      location: null,
      notes: 'Öffentlicher Auftraggeber - Rechnung mit USt',
      totalNet: 450.00,
      totalGross: 535.50,
    },
    update: {},
  });

  const existingPos5 = await prisma.orderPosition.findFirst({
    where: { orderId: order5.id, articleNumber: 'SHIRT-EVENT-001' }
  });
  if (!existingPos5) {
    await prisma.orderPosition.create({
      data: {
        orderId: order5.id,
        articleNumber: 'SHIRT-EVENT-001',
        articleName: 'T-Shirt Fruit of the Loom Rot',
        qty: 30,
        unitPriceNet: 15.00,
        lineNet: 450.00,
        lineVat: 85.50,
        lineGross: 535.50,
      },
    });
  }

  const existingAsset5 = await prisma.orderAsset.findFirst({
    where: { orderId: order5.id, label: 'Stadtfest Logo 2025' }
  });
  if (!existingAsset5) {
    await prisma.orderAsset.create({
      data: {
        orderId: order5.id,
        kind: 'PRINT',
        label: 'Stadtfest Logo 2025',
        url: '/uploads/example/stadtfest-logo.pdf',
        ext: 'pdf',
        size: 312456,
        required: true,
      },
    });
  }

  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  await prisma.timeSlot.create({
    data: {
      date: twoDaysAgo,
      startMin: 600, // 10:00
      lengthMin: 120, // 2 Stunden
      workCenterId: druckStation1.id,
      orderId: order5.id,
      status: 'DONE',
      startedAt: new Date(twoDaysAgo.getTime() + (10 * 60 * 60 * 1000)),
      stoppedAt: new Date(twoDaysAgo.getTime() + (12 * 60 * 60 * 1000)),
      qc: 'IO',
    },
  });

  console.log('✅ Auftrag 5: Stadtfest Mannheim (ZUR_ABRECHNUNG) - Wartet auf Abrechnung');

  // === AUFTRAG 6: ABGERECHNET - Komplett abgeschlossen ===
  const order6 = await prisma.order.upsert({
    where: { displayOrderNumber: 'INT-2025-1006' },
    create: {
      displayOrderNumber: 'INT-2025-1006',
      title: 'Firmenshirts Bäckerei Müller',
      customer: 'Bäckerei Müller',
      company: 'Bäckerei Müller GmbH',
      contactFirstName: 'Klaus',
      contactLastName: 'Müller',
      customerEmail: 'info@baeckerei-mueller.de',
      customerPhone: '+49 7141 234567',
      
      billStreet: 'Hauptstraße 123',
      billZip: '71634',
      billCity: 'Ludwigsburg',
      billCountry: 'Deutschland',
      
      department: 'DRUCK',
      source: 'INTERNAL',
      workflow: 'ABGERECHNET',
      dueDate: new Date('2025-10-20'),
      deliveredAt: new Date('2025-10-22'),
      deliveredNote: 'Abgeholt',
      settledAt: new Date('2025-10-23'),
      settledBy: 'accounting@1ashirt.de',
      location: null,
      notes: 'Stammkunde - 5% Rabatt gewährt',
      totalNet: 285.00,
      totalGross: 339.15,
    },
    update: {},
  });

  const existingPos6 = await prisma.orderPosition.findFirst({
    where: { orderId: order6.id, articleNumber: 'POLO-WORK-001' }
  });
  if (!existingPos6) {
    await prisma.orderPosition.create({
      data: {
        orderId: order6.id,
        articleNumber: 'POLO-WORK-001',
        articleName: 'Arbeits-Polo Weiß mit Logodruck',
        qty: 15,
        unitPriceNet: 19.00,
        lineNet: 285.00,
        lineVat: 54.15,
        lineGross: 339.15,
      },
    });
  }

  const existingAsset6 = await prisma.orderAsset.findFirst({
    where: { orderId: order6.id, label: 'Bäckerei Müller Logo' }
  });
  if (!existingAsset6) {
    await prisma.orderAsset.create({
      data: {
        orderId: order6.id,
        kind: 'PRINT',
        label: 'Bäckerei Müller Logo',
        url: '/uploads/example/mueller-logo.png',
        ext: 'png',
        size: 45678,
        required: true,
      },
    });
  }

  console.log('✅ Auftrag 6: Bäckerei Müller (ABGERECHNET) - Komplett abgeschlossen');

  // === AUFTRAG 7: WARTET_FEHLTEILE - Mit Lagerzuweisung ===
  const order7 = await prisma.order.upsert({
    where: { displayOrderNumber: 'INT-2025-1007' },
    create: {
      displayOrderNumber: 'INT-2025-1007',
      title: 'Basketball-Trikots VfL Waiblingen',
      customer: 'VfL Waiblingen Basketball',
      company: 'VfL Waiblingen 1862 e.V. - Abteilung Basketball',
      contactFirstName: 'Sarah',
      contactLastName: 'Klein',
      customerEmail: 's.klein@vfl-waiblingen.de',
      customerPhone: '+49 7151 456789',
      
      billStreet: 'Sporthallenweg 7',
      billZip: '71332',
      billCity: 'Waiblingen',
      billCountry: 'Deutschland',
      
      department: 'TEAMSPORT',
      source: 'INTERNAL',
      workflow: 'WARTET_FEHLTEILE',
      dueDate: new Date('2025-11-12'),
      location: 'Lagerplatz A-01',
      locationPlaceId: lagerplatzA1.id,
      notes: 'WICHTIG: Spezielle Mesh-Qualität bestellt, kommt am 05.11.',
      totalNet: 1400.00,
      totalGross: 1666.00,
    },
    update: {},
  });

  const existingPos7 = await prisma.orderPosition.findFirst({
    where: { orderId: order7.id, articleNumber: 'BBALL-TRIKOT-001' }
  });
  if (!existingPos7) {
    await prisma.orderPosition.create({
      data: {
        orderId: order7.id,
        articleNumber: 'BBALL-TRIKOT-001',
        articleName: 'Basketball-Trikot Mesh Premium Blau/Gelb',
        qty: 20,
        unitPriceNet: 70.00,
        lineNet: 1400.00,
        lineVat: 266.00,
        lineGross: 1666.00,
      },
    });
  }

  const existingST7 = await prisma.sizeTable.findUnique({
    where: { orderId: order7.id },
  });
  if (!existingST7) {
    await prisma.sizeTable.create({
      data: {
        orderId: order7.id,
        scheme: 'ALPHA',
        rowsJson: [
          { size: 'M', quantity: 6, notes: '' },
          { size: 'L', quantity: 8, notes: '' },
          { size: 'XL', quantity: 4, notes: '' },
          { size: 'XXL', quantity: 2, notes: '' },
        ],
      },
    });
  }

  const existingAsset7 = await prisma.orderAsset.findFirst({
    where: { orderId: order7.id, label: 'VfL Vereinslogo' }
  });
  if (!existingAsset7) {
    await prisma.orderAsset.create({
      data: {
        orderId: order7.id,
        kind: 'PRINT',
        label: 'VfL Vereinslogo',
        url: '/uploads/example/vfl-logo.eps',
        ext: 'eps',
        size: 234567,
        required: true,
      },
    });
  }

  // Lagerzuweisung über locationPlaceId (bereits bei Order gesetzt)

  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  await prisma.timeSlot.create({
    data: {
      date: threeDaysAgo,
      startMin: 480, // 08:00
      lengthMin: 120,
      workCenterId: druckStation1.id,
      orderId: order7.id,
      status: 'BLOCKED',
      missingPartsNote: 'Mesh-Material nicht verfügbar - Nachbestellung läuft',
    },
  });

  console.log('✅ Auftrag 7: VfL Waiblingen Basketball (WARTET_FEHLTEILE) - Material fehlt');

  console.log('\n🎉 Alle 7 Beispiel-Aufträge wurden erfolgreich erstellt!\n');
  console.log('📋 Übersicht:');
  console.log('  1. FC Bayern Trikots (NEU) - Wartet auf Druckdaten');
  console.log('  2. SV Musterhausen Polos (FUER_PROD) - Bereit zur Planung');
  console.log('  3. Meyer GmbH Werbetextilien (IN_PROD) - Läuft gerade');
  console.log('  4. TSV Heidelberg Trainingsanzüge (FERTIG) - Abgeschlossen');
  console.log('  5. Stadtfest Mannheim (ZUR_ABRECHNUNG) - Wartet auf Rechnung');
  console.log('  6. Bäckerei Müller (ABGERECHNET) - Komplett fertig');
  console.log('  7. VfL Waiblingen Basketball (WARTET_FEHLTEILE) - Material fehlt\n');
}

main()
  .catch((e) => {
    console.error('❌ Fehler beim Erstellen der Beispiel-Aufträge:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
