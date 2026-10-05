-- AlterTable
ALTER TABLE "order_delivery_verifications" ADD COLUMN IF NOT EXISTS "refillRate" DOUBLE PRECISION;
ALTER TABLE "order_delivery_verifications" ADD COLUMN IF NOT EXISTS "depositRate" DOUBLE PRECISION;
ALTER TABLE "order_delivery_verifications" ADD COLUMN IF NOT EXISTS "refillAmount" DOUBLE PRECISION;
ALTER TABLE "order_delivery_verifications" ADD COLUMN IF NOT EXISTS "depositQty" INTEGER;
ALTER TABLE "order_delivery_verifications" ADD COLUMN IF NOT EXISTS "depositAmount" DOUBLE PRECISION;
ALTER TABLE "order_delivery_verifications" ADD COLUMN IF NOT EXISTS "calculatedTotal" DOUBLE PRECISION;
ALTER TABLE "order_delivery_verifications" ADD COLUMN IF NOT EXISTS "amountReceived" DOUBLE PRECISION;
ALTER TABLE "order_delivery_verifications" ADD COLUMN IF NOT EXISTS "paymentMode" TEXT;
ALTER TABLE "order_delivery_verifications" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "order_delivery_verifications" ADD COLUMN IF NOT EXISTS "isManualAdjustment" BOOLEAN DEFAULT false;
