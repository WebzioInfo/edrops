-- AlterTable Distributor: add canManufacture and jarDepositRate
ALTER TABLE "Distributor" ADD COLUMN IF NOT EXISTS "canManufacture" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Distributor" ADD COLUMN IF NOT EXISTS "jarDepositRate" DOUBLE PRECISION NOT NULL DEFAULT 150.0;

-- CreateTable raw_material_items
CREATE TABLE IF NOT EXISTS "raw_material_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'PACKAGING',
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "centralStock" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 100,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_material_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable distributor_raw_material_stocks
CREATE TABLE IF NOT EXISTS "distributor_raw_material_stocks" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributor_raw_material_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable raw_material_movements
CREATE TABLE IF NOT EXISTS "raw_material_movements" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "distributorId" TEXT,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "referenceId" TEXT NOT NULL,
    "batchNumber" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_material_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable distributor_production_batches
CREATE TABLE IF NOT EXISTS "distributor_production_batches" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "outputQuantity" INTEGER NOT NULL DEFAULT 0,
    "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "consumptions" JSONB,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distributor_production_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable distributor_jar_settlements
CREATE TABLE IF NOT EXISTS "distributor_jar_settlements" (
    "id" TEXT NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "jarsSettled" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
    "paymentMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "paymentReference" TEXT,
    "companyJarsBefore" INTEGER NOT NULL,
    "companyJarsAfter" INTEGER NOT NULL,
    "distributorJarsBefore" INTEGER NOT NULL,
    "distributorJarsAfter" INTEGER NOT NULL,
    "physicalJarsTotal" INTEGER NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distributor_jar_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "raw_material_items_code_key" ON "raw_material_items"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "distributor_raw_material_stocks_distributorId_materialId_key" ON "distributor_raw_material_stocks"("distributorId", "materialId");
CREATE INDEX IF NOT EXISTS "distributor_raw_material_stocks_distributorId_idx" ON "distributor_raw_material_stocks"("distributorId");

CREATE INDEX IF NOT EXISTS "raw_material_movements_materialId_createdAt_idx" ON "raw_material_movements"("materialId", "createdAt");
CREATE INDEX IF NOT EXISTS "raw_material_movements_distributorId_createdAt_idx" ON "raw_material_movements"("distributorId", "createdAt");
CREATE INDEX IF NOT EXISTS "raw_material_movements_referenceId_idx" ON "raw_material_movements"("referenceId");

CREATE UNIQUE INDEX IF NOT EXISTS "distributor_production_batches_batchNumber_key" ON "distributor_production_batches"("batchNumber");
CREATE INDEX IF NOT EXISTS "distributor_production_batches_distributorId_createdAt_idx" ON "distributor_production_batches"("distributorId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "distributor_jar_settlements_settlementNumber_key" ON "distributor_jar_settlements"("settlementNumber");
CREATE INDEX IF NOT EXISTS "distributor_jar_settlements_distributorId_createdAt_idx" ON "distributor_jar_settlements"("distributorId", "createdAt");
CREATE INDEX IF NOT EXISTS "distributor_jar_settlements_settlementNumber_idx" ON "distributor_jar_settlements"("settlementNumber");

-- AddForeignKey
ALTER TABLE "distributor_raw_material_stocks" ADD CONSTRAINT "distributor_raw_material_stocks_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "distributor_raw_material_stocks" ADD CONSTRAINT "distributor_raw_material_stocks_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "raw_material_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "raw_material_movements" ADD CONSTRAINT "raw_material_movements_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "raw_material_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "raw_material_movements" ADD CONSTRAINT "raw_material_movements_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "raw_material_movements" ADD CONSTRAINT "raw_material_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "distributor_production_batches" ADD CONSTRAINT "distributor_production_batches_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "distributor_production_batches" ADD CONSTRAINT "distributor_production_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "distributor_jar_settlements" ADD CONSTRAINT "distributor_jar_settlements_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "distributor_jar_settlements" ADD CONSTRAINT "distributor_jar_settlements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
