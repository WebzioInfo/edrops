-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryVerificationStatus') THEN
        CREATE TYPE "DeliveryVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');
    END IF;
END $$;

-- AlterTable
ALTER TABLE "order_jar_allocations" ADD COLUMN IF NOT EXISTS "deliveredQuantity" INTEGER;
ALTER TABLE "order_jar_allocations" ADD COLUMN IF NOT EXISTS "undeliveredQuantity" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "order_delivery_verifications" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "otpGeneratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "status" "DeliveryVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "outForDeliveryQty" INTEGER NOT NULL DEFAULT 0,
    "deliveredQty" INTEGER NOT NULL DEFAULT 0,
    "undeliveredQty" INTEGER NOT NULL DEFAULT 0,
    "shortDeliveryReason" TEXT,
    "deliveryNotes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_delivery_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "order_delivery_verifications_orderId_key" ON "order_delivery_verifications"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "order_delivery_verifications_orderId_idx" ON "order_delivery_verifications"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "order_delivery_verifications_isVerified_idx" ON "order_delivery_verifications"("isVerified");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_delivery_verifications_orderId_fkey'
    ) THEN
        ALTER TABLE "order_delivery_verifications" ADD CONSTRAINT "order_delivery_verifications_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_delivery_verifications_verifiedByUserId_fkey'
    ) THEN
        ALTER TABLE "order_delivery_verifications" ADD CONSTRAINT "order_delivery_verifications_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
