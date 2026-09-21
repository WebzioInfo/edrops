-- Add assignment columns to Order table
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "assignmentStatus" TEXT NOT NULL DEFAULT 'UNASSIGNED';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "acceptedById" TEXT;

-- Foreign key for acceptedById
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_acceptedById_fkey'
  ) THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_acceptedById_fkey"
      FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Indices for fast queue lookup
CREATE INDEX IF NOT EXISTS "Order_assignmentStatus_idx" ON "Order"("assignmentStatus");
CREATE INDEX IF NOT EXISTS "Order_distributorId_assignmentStatus_idx" ON "Order"("distributorId", "assignmentStatus");

-- Backfill: If any order already had a distributor assigned, mark it as ASSIGNED and set acceptedAt
UPDATE "Order"
SET "assignmentStatus" = 'ASSIGNED',
    "acceptedAt" = COALESCE("acceptedAt", "createdAt"),
    "acceptedById" = COALESCE("acceptedById", "distributorId")
WHERE "distributorId" IS NOT NULL AND "assignmentStatus" = 'UNASSIGNED';
