-- AlterTable
ALTER TABLE "InventoryLog" ADD COLUMN IF NOT EXISTS "eventTimestamp" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- Backfill eventTimestamp from createdAt where null
UPDATE "InventoryLog" SET "eventTimestamp" = "createdAt" WHERE "eventTimestamp" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InventoryLog_eventTimestamp_idx" ON "InventoryLog"("eventTimestamp");

-- Fix historical OUT_FOR_DELIVERY logs where quantity was saved as positive
UPDATE "InventoryLog"
SET "quantity" = -ABS("quantity")
WHERE "action" = 'OUT_FOR_DELIVERY' AND "quantity" > 0;

-- Fix historical balanceAfter for specific referenced movements where owned total was incorrectly recorded
UPDATE "InventoryLog"
SET "balanceAfter" = 83
WHERE "referenceId" = 'ORD-DD460C22' AND "action" = 'OUT_FOR_DELIVERY';

UPDATE "InventoryLog"
SET "balanceAfter" = 2
WHERE "referenceId" = 'ORD-DD460C22' AND "action" = 'CUSTOMER_RETURN';

UPDATE "InventoryLog"
SET "balanceAfter" = 88
WHERE "referenceId" = 'ORD-D090871A' AND "action" = 'OUT_FOR_DELIVERY';
