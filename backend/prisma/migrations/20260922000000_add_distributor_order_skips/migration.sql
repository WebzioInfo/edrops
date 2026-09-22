-- CreateTable
CREATE TABLE IF NOT EXISTS "distributor_order_skips" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'SKIPPED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributor_order_skips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "distributor_order_skips_orderId_distributorId_key" ON "distributor_order_skips"("orderId", "distributorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "distributor_order_skips_distributorId_idx" ON "distributor_order_skips"("distributorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "distributor_order_skips_orderId_idx" ON "distributor_order_skips"("orderId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'distributor_order_skips_distributorId_fkey'
  ) THEN
    ALTER TABLE "distributor_order_skips" ADD CONSTRAINT "distributor_order_skips_distributorId_fkey"
      FOREIGN KEY ("distributorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'distributor_order_skips_orderId_fkey'
  ) THEN
    ALTER TABLE "distributor_order_skips" ADD CONSTRAINT "distributor_order_skips_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
