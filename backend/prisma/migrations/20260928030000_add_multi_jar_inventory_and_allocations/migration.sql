-- CreateTable
CREATE TABLE "jar_inventory_items" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownershipType" TEXT NOT NULL,
    "imageUrl" TEXT,
    "description" TEXT,
    "ownedQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jar_inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_jar_allocations" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "jarItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_jar_allocations_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "InventoryLog" ADD COLUMN "jarItemId" TEXT;

-- CreateIndex
CREATE INDEX "jar_inventory_items_distributorId_idx" ON "jar_inventory_items"("distributorId");
CREATE INDEX "jar_inventory_items_distributorId_ownershipType_idx" ON "jar_inventory_items"("distributorId", "ownershipType");
CREATE INDEX "jar_inventory_items_distributorId_isActive_idx" ON "jar_inventory_items"("distributorId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "order_jar_allocations_orderId_jarItemId_key" ON "order_jar_allocations"("orderId", "jarItemId");
CREATE INDEX "order_jar_allocations_orderId_idx" ON "order_jar_allocations"("orderId");
CREATE INDEX "order_jar_allocations_jarItemId_idx" ON "order_jar_allocations"("jarItemId");

-- CreateIndex
CREATE INDEX "InventoryLog_jarItemId_sequence_idx" ON "InventoryLog"("jarItemId", "sequence");

-- AddForeignKey
ALTER TABLE "jar_inventory_items" ADD CONSTRAINT "jar_inventory_items_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_jar_allocations" ADD CONSTRAINT "order_jar_allocations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_jar_allocations" ADD CONSTRAINT "order_jar_allocations_jarItemId_fkey" FOREIGN KEY ("jarItemId") REFERENCES "jar_inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_jarItemId_fkey" FOREIGN KEY ("jarItemId") REFERENCES "jar_inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing data:
-- 1. Create company-owned item for every distributor
INSERT INTO "jar_inventory_items" ("id", "distributorId", "name", "ownershipType", "imageUrl", "ownedQuantity", "reservedQuantity", "isActive", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    d.id,
    'Biodrops 20L Water Jar',
    'COMPANY',
    '/images/biodrops-jar.png',
    COALESCE(d."companyOwnedJars", 0),
    0,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Distributor" d;

-- Link existing company InventoryLogs to the new company item
UPDATE "InventoryLog" l
SET "jarItemId" = j.id
FROM "jar_inventory_items" j
WHERE l."distributorId" = j."distributorId" 
  AND j."ownershipType" = 'COMPANY'
  AND l."ownership" = 'COMPANY_OWNED';

-- 2. Create distributor-owned item for distributors that have distributorOwnedJars > 0 or jarImageUrl is set
INSERT INTO "jar_inventory_items" ("id", "distributorId", "name", "ownershipType", "imageUrl", "ownedQuantity", "reservedQuantity", "isActive", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    d.id,
    'Distributor Jar',
    'DISTRIBUTOR',
    d."jarImageUrl",
    COALESCE(d."distributorOwnedJars", 0),
    0,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Distributor" d
WHERE COALESCE(d."distributorOwnedJars", 0) > 0 OR d."jarImageUrl" IS NOT NULL;

-- Link existing distributor InventoryLogs to the new distributor item
UPDATE "InventoryLog" l
SET "jarItemId" = j.id
FROM "jar_inventory_items" j
WHERE l."distributorId" = j."distributorId" 
  AND j."ownershipType" = 'DISTRIBUTOR'
  AND l."ownership" = 'DISTRIBUTOR_OWNED';
