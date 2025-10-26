/*
  Warnings:

  - You are about to drop the `OrderStorage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StorageSlot` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "TimeSlot" ADD COLUMN "missingPartsReportedAt" DATETIME;
ALTER TABLE "TimeSlot" ADD COLUMN "missingPartsReportedBy" TEXT;
ALTER TABLE "TimeSlot" ADD COLUMN "missingPartsResolvedAt" DATETIME;
ALTER TABLE "TimeSlot" ADD COLUMN "missingPartsResolvedBy" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "OrderStorage";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "StorageSlot";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "WarehouseGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WarehousePlace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "occupiedByOrderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WarehousePlace_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WarehouseGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WarehousePlace_occupiedByOrderId_fkey" FOREIGN KEY ("occupiedByOrderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseGroup_name_key" ON "WarehouseGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WarehousePlace_occupiedByOrderId_key" ON "WarehousePlace"("occupiedByOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehousePlace_groupId_name_key" ON "WarehousePlace"("groupId", "name");
