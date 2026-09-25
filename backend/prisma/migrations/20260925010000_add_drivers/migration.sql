-- CreateTable
CREATE TABLE IF NOT EXISTS "drivers" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "routeOrArea" TEXT,
    "vehicleType" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- AlterTable Order: add driverId if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Order' AND column_name = 'driverId'
  ) THEN
    ALTER TABLE "Order" ADD COLUMN "driverId" TEXT;
  END IF;
END $$;

-- CreateIndex on drivers
CREATE INDEX IF NOT EXISTS "drivers_distributorId_idx" ON "drivers"("distributorId");
CREATE INDEX IF NOT EXISTS "drivers_isActive_idx" ON "drivers"("isActive");
CREATE INDEX IF NOT EXISTS "drivers_phone_idx" ON "drivers"("phone");
CREATE INDEX IF NOT EXISTS "drivers_vehicleNumber_idx" ON "drivers"("vehicleNumber");

-- CreateIndex on Order(driverId)
CREATE INDEX IF NOT EXISTS "Order_driverId_idx" ON "Order"("driverId");

-- AddForeignKey for drivers.distributorId -> User(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drivers_distributorId_fkey'
  ) THEN
    ALTER TABLE "drivers" ADD CONSTRAINT "drivers_distributorId_fkey"
      FOREIGN KEY ("distributorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey for Order.driverId -> drivers(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_driverId_fkey'
  ) THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_driverId_fkey"
      FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
