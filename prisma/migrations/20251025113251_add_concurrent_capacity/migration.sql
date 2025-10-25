/*
  Warnings:

  - You are about to drop the column `sizeTableId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `rows` on the `SizeTable` table. All the data in the column will be lost.
  - Added the required column `orderId` to the `SizeTable` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rowsJson` to the `SizeTable` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `SizeTable` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "OrderPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "articleName" TEXT NOT NULL,
    "articleNumber" TEXT,
    "qty" DECIMAL NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'Stk',
    "unitPriceNet" DECIMAL NOT NULL,
    "vatRate" INTEGER NOT NULL DEFAULT 19,
    "lineNet" DECIMAL NOT NULL,
    "lineVat" DECIMAL NOT NULL,
    "lineGross" DECIMAL NOT NULL,
    "procurement" TEXT NOT NULL DEFAULT 'NONE',
    "supplierNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderPosition_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "path" TEXT,
    "url" TEXT,
    "ext" TEXT,
    "size" INTEGER,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,
    CONSTRAINT "OrderAsset_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderSequence" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year" INTEGER NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 999
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "extId" TEXT,
    "displayOrderNumber" TEXT,
    "source" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "dueDate" DATETIME,
    "notes" TEXT,
    "workflow" TEXT NOT NULL DEFAULT 'NEU',
    "qc" TEXT NOT NULL DEFAULT 'UNGEPRUEFT',
    "location" TEXT,
    "company" TEXT,
    "contactFirstName" TEXT,
    "contactLastName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "billStreet" TEXT,
    "billZip" TEXT,
    "billCity" TEXT,
    "billCountry" TEXT DEFAULT 'DE',
    "shipStreet" TEXT,
    "shipZip" TEXT,
    "shipCity" TEXT,
    "shipCountry" TEXT,
    "totalNet" DECIMAL,
    "totalVat" DECIMAL,
    "totalGross" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Order" ("billCity", "billCountry", "billStreet", "billZip", "company", "contactFirstName", "contactLastName", "createdAt", "customer", "customerEmail", "customerPhone", "department", "dueDate", "extId", "id", "location", "notes", "qc", "shipCity", "shipCountry", "shipStreet", "shipZip", "source", "title", "updatedAt", "workflow") SELECT "billCity", "billCountry", "billStreet", "billZip", "company", "contactFirstName", "contactLastName", "createdAt", "customer", "customerEmail", "customerPhone", "department", "dueDate", "extId", "id", "location", "notes", "qc", "shipCity", "shipCountry", "shipStreet", "shipZip", "source", "title", "updatedAt", "workflow" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_extId_key" ON "Order"("extId");
CREATE UNIQUE INDEX "Order_displayOrderNumber_key" ON "Order"("displayOrderNumber");
CREATE TABLE "new_SizeTable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "scheme" TEXT NOT NULL,
    "rowsJson" JSONB NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SizeTable_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SizeTable" ("comment", "createdAt", "id", "scheme") SELECT "comment", "createdAt", "id", "scheme" FROM "SizeTable";
DROP TABLE "SizeTable";
ALTER TABLE "new_SizeTable" RENAME TO "SizeTable";
CREATE UNIQUE INDEX "SizeTable_orderId_key" ON "SizeTable"("orderId");
CREATE TABLE "new_TimeSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "startMin" INTEGER NOT NULL,
    "lengthMin" INTEGER NOT NULL,
    "workCenterId" TEXT NOT NULL,
    "orderId" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "startedAt" DATETIME,
    "stoppedAt" DATETIME,
    "qc" TEXT,
    "missingPartsNote" TEXT,
    CONSTRAINT "TimeSlot_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimeSlot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TimeSlot" ("blocked", "date", "id", "lengthMin", "note", "orderId", "startMin", "workCenterId") SELECT "blocked", "date", "id", "lengthMin", "note", "orderId", "startMin", "workCenterId" FROM "TimeSlot";
DROP TABLE "TimeSlot";
ALTER TABLE "new_TimeSlot" RENAME TO "TimeSlot";
CREATE TABLE "new_WorkCenter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "capacityMin" INTEGER NOT NULL DEFAULT 660,
    "concurrentCapacity" INTEGER NOT NULL DEFAULT 2,
    "active" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_WorkCenter" ("active", "capacityMin", "department", "id", "name") SELECT "active", "capacityMin", "department", "id", "name" FROM "WorkCenter";
DROP TABLE "WorkCenter";
ALTER TABLE "new_WorkCenter" RENAME TO "WorkCenter";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "OrderSequence_year_key" ON "OrderSequence"("year");
