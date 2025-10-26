-- AlterTable
ALTER TABLE "Order" ADD COLUMN "deliveredAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "deliveredNote" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveredQty" INTEGER;
ALTER TABLE "Order" ADD COLUMN "settledAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "settledBy" TEXT;
