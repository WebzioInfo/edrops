-- Extend OrderStatus enum with ERP flow statuses
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'READY';

-- Extend PaymentStatus enum with explicit ERP statuses
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'UNPAID';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAID';

-- Add distributorId to Order table
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "distributorId" TEXT;

-- Add foreign key constraint to User table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_distributorId_fkey'
  ) THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_distributorId_fkey"
      FOREIGN KEY ("distributorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Create index on distributorId for fast distributor scoped lookups
CREATE INDEX IF NOT EXISTS "Order_distributorId_idx" ON "Order"("distributorId");
