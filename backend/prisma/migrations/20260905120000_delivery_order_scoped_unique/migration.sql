-- DropIndex
DROP INDEX IF EXISTS "Delivery_customerId_scheduledFor_key";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Delivery_customerId_scheduledFor_idx" ON "Delivery"("customerId", "scheduledFor");
