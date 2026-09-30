-- Migration: 20260930000000_production_jar_inventory_state_model
-- Establishes physical state breakdown and jar movement audit ledger

BEGIN;

-- 1. Add physical state breakdown columns to jar_inventory_items
ALTER TABLE "jar_inventory_items"
  ADD COLUMN IF NOT EXISTS "filledYardQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "emptyYardQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "customerQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "washingQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fillingQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "quarantineQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "damagedQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lostQuantity" INTEGER NOT NULL DEFAULT 0;

-- 2. Add returned quantity tracking to order allocations and delivery verification
ALTER TABLE "order_jar_allocations"
  ADD COLUMN IF NOT EXISTS "returnedQuantity" INTEGER DEFAULT 0;

ALTER TABLE "order_delivery_verifications"
  ADD COLUMN IF NOT EXISTS "returnedQty" INTEGER NOT NULL DEFAULT 0;

-- 3. Add movement audit columns to InventoryLog
ALTER TABLE "InventoryLog"
  ADD COLUMN IF NOT EXISTS "fromState" TEXT,
  ADD COLUMN IF NOT EXISTS "toState" TEXT,
  ADD COLUMN IF NOT EXISTS "orderId" TEXT,
  ADD COLUMN IF NOT EXISTS "customerId" TEXT,
  ADD COLUMN IF NOT EXISTS "createdById" TEXT;

-- 4. Create indexes on InventoryLog
CREATE INDEX IF NOT EXISTS "InventoryLog_orderId_idx" ON "InventoryLog"("orderId");
CREATE INDEX IF NOT EXISTS "InventoryLog_customerId_idx" ON "InventoryLog"("customerId");

-- 5. Add foreign keys to InventoryLog
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InventoryLog_orderId_fkey'
  ) THEN
    ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InventoryLog_customerId_fkey'
  ) THEN
    ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InventoryLog_createdById_fkey'
  ) THEN
    ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 6. Initialize existing data so breakdown matches owned totals
-- Calculate delivered customer jars per item from past delivered orders
WITH delivered_per_item AS (
  SELECT a."jarItemId", SUM(COALESCE(a."deliveredQuantity", a."quantity")) AS delivered
  FROM "order_jar_allocations" a
  JOIN "Order" o ON o.id = a."orderId"
  WHERE o.status IN ('DELIVERED', 'COMPLETED')
  GROUP BY a."jarItemId"
)
UPDATE "jar_inventory_items" j
SET "customerQuantity" = LEAST(j."ownedQuantity", COALESCE(d.delivered, 0)::integer),
    "filledYardQuantity" = GREATEST(0, j."ownedQuantity" - LEAST(j."ownedQuantity", COALESCE(d.delivered, 0)::integer))
FROM delivered_per_item d
WHERE j.id = d."jarItemId";

-- Initialize any remaining items with ownedQuantity > 0 where customerQuantity was not updated
UPDATE "jar_inventory_items"
SET "filledYardQuantity" = "ownedQuantity"
WHERE ("customerQuantity" + "filledYardQuantity" + "emptyYardQuantity" + "washingQuantity" + "fillingQuantity" + "quarantineQuantity" + "damagedQuantity" + "lostQuantity") <> "ownedQuantity";

-- 7. Add database integrity check constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_jar_items_non_negative'
  ) THEN
    ALTER TABLE "jar_inventory_items" ADD CONSTRAINT "chk_jar_items_non_negative"
      CHECK (
        "filledYardQuantity" >= 0 AND
        "emptyYardQuantity" >= 0 AND
        "customerQuantity" >= 0 AND
        "washingQuantity" >= 0 AND
        "fillingQuantity" >= 0 AND
        "quarantineQuantity" >= 0 AND
        "damagedQuantity" >= 0 AND
        "lostQuantity" >= 0 AND
        "reservedQuantity" >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_jar_items_reserved_le_filled'
  ) THEN
    ALTER TABLE "jar_inventory_items" ADD CONSTRAINT "chk_jar_items_reserved_le_filled"
      CHECK ("reservedQuantity" <= "filledYardQuantity");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_jar_items_reconciliation'
  ) THEN
    ALTER TABLE "jar_inventory_items" ADD CONSTRAINT "chk_jar_items_reconciliation"
      CHECK (
        "filledYardQuantity" +
        "emptyYardQuantity" +
        "customerQuantity" +
        "washingQuantity" +
        "fillingQuantity" +
        "quarantineQuantity" +
        "damagedQuantity" +
        "lostQuantity" = "ownedQuantity"
      );
  END IF;
END $$;

COMMIT;
