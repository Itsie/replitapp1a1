-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WorkCenter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "capacityMin" INTEGER NOT NULL DEFAULT 660,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "extId" TEXT,
    "source" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "dueDate" DATETIME,
    "notes" TEXT,
    "workflow" TEXT NOT NULL DEFAULT 'NEU',
    "qc" TEXT NOT NULL DEFAULT 'UNGEPRUEFT',
    "location" TEXT,
    "sizeTableId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_sizeTableId_fkey" FOREIGN KEY ("sizeTableId") REFERENCES "SizeTable" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SizeTable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheme" TEXT NOT NULL,
    "rows" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PrintAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrintAsset_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "startMin" INTEGER NOT NULL,
    "lengthMin" INTEGER NOT NULL,
    "workCenterId" TEXT NOT NULL,
    "orderId" TEXT,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT
);

-- CreateTable
CREATE TABLE "JTLOrderPosition" (
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
    "raw" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "InvoiceQueueItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Order_extId_key" ON "Order"("extId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceQueueItem_orderId_key" ON "InvoiceQueueItem"("orderId");
