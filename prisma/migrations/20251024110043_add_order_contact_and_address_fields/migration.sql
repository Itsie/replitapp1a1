-- AlterTable
ALTER TABLE "Order" ADD COLUMN "billCity" TEXT;
ALTER TABLE "Order" ADD COLUMN "billCountry" TEXT DEFAULT 'DE';
ALTER TABLE "Order" ADD COLUMN "billStreet" TEXT;
ALTER TABLE "Order" ADD COLUMN "billZip" TEXT;
ALTER TABLE "Order" ADD COLUMN "company" TEXT;
ALTER TABLE "Order" ADD COLUMN "contactFirstName" TEXT;
ALTER TABLE "Order" ADD COLUMN "contactLastName" TEXT;
ALTER TABLE "Order" ADD COLUMN "customerEmail" TEXT;
ALTER TABLE "Order" ADD COLUMN "customerPhone" TEXT;
ALTER TABLE "Order" ADD COLUMN "shipCity" TEXT;
ALTER TABLE "Order" ADD COLUMN "shipCountry" TEXT;
ALTER TABLE "Order" ADD COLUMN "shipStreet" TEXT;
ALTER TABLE "Order" ADD COLUMN "shipZip" TEXT;
