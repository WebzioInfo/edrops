-- CreateTable
CREATE TABLE IF NOT EXISTS "distributor_pincodes" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "location" TEXT,
    "district" TEXT,
    "state" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distributor_pincodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "distributor_pincodes_distributorId_pincode_key" ON "distributor_pincodes"("distributorId", "pincode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "distributor_pincodes_pincode_idx" ON "distributor_pincodes"("pincode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "distributor_pincodes_distributorId_idx" ON "distributor_pincodes"("distributorId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'distributor_pincodes_distributorId_fkey'
  ) THEN
    ALTER TABLE "distributor_pincodes" ADD CONSTRAINT "distributor_pincodes_distributorId_fkey"
      FOREIGN KEY ("distributorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
