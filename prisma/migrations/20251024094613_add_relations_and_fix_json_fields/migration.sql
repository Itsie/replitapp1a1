/*
  Warnings:

  - You are about to alter the column `raw` on the `JTLOrderPosition` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `rows` on the `SizeTable` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InvoiceQueueItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceQueueItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceQueueItem" ("comment", "createdAt", "id", "orderId", "status") SELECT "comment", "createdAt", "id", "orderId", "status" FROM "InvoiceQueueItem";
DROP TABLE "InvoiceQueueItem";
ALTER TABLE "new_InvoiceQueueItem" RENAME TO "InvoiceQueueItem";
CREATE UNIQUE INDEX "InvoiceQueueItem_orderId_key" ON "InvoiceQueueItem"("orderId");
CREATE TABLE "new_JTLOrderPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jtlOrderNumber" TEXT NOT NULL,
    "articleNumber" TEXT,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "unitPriceGross" REAL NOT NULL DEFAULT 0,
    "unitPriceNet" REAL,
    "taxRate" REAL,
    "discountAbs" REAL,
    "discountPct" REAL,
    "rowType" TEXT NOT NULL DEFAULT 'NORMAL',
    "parentKey" TEXT,
    "variation" TEXT,
    "isShipping" BOOLEAN NOT NULL DEFAULT false,
    "isCredit" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB NOT NULL
);
INSERT INTO "new_JTLOrderPosition" ("articleNumber", "description", "discountAbs", "discountPct", "id", "isCredit", "isShipping", "jtlOrderNumber", "parentKey", "quantity", "raw", "rowType", "taxRate", "unitPriceGross", "unitPriceNet", "variation") SELECT "articleNumber", "description", "discountAbs", "discountPct", "id", "isCredit", "isShipping", "jtlOrderNumber", "parentKey", "quantity", "raw", "rowType", "taxRate", "unitPriceGross", "unitPriceNet", "variation" FROM "JTLOrderPosition";
DROP TABLE "JTLOrderPosition";
ALTER TABLE "new_JTLOrderPosition" RENAME TO "JTLOrderPosition";
CREATE TABLE "new_SizeTable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheme" TEXT NOT NULL,
    "rows" JSONB NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SizeTable" ("comment", "createdAt", "id", "rows", "scheme") SELECT "comment", "createdAt", "id", "rows", "scheme" FROM "SizeTable";
DROP TABLE "SizeTable";
ALTER TABLE "new_SizeTable" RENAME TO "SizeTable";
CREATE TABLE "new_TimeSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "startMin" INTEGER NOT NULL,
    "lengthMin" INTEGER NOT NULL,
    "workCenterId" TEXT NOT NULL,
    "orderId" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    CONSTRAINT "TimeSlot_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimeSlot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TimeSlot" ("blocked", "date", "id", "lengthMin", "note", "orderId", "startMin", "workCenterId") SELECT "blocked", "date", "id", "lengthMin", "note", "orderId", "startMin", "workCenterId" FROM "TimeSlot";
DROP TABLE "TimeSlot";
ALTER TABLE "new_TimeSlot" RENAME TO "TimeSlot";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
