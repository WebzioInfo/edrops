-- AlterTable Product: add fields for Biodrops unified catalogue
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sku" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "productType" TEXT NOT NULL DEFAULT 'WATER_PRODUCT';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "hsnCode" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 18.0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "distributorPrice" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "customerPrice" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "costPrice" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "uom" TEXT NOT NULL DEFAULT 'PCS';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "minStockLevel" INTEGER NOT NULL DEFAULT 10;

-- CreateTable vendors
CREATE TABLE IF NOT EXISTS "vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pinCode" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable vendor_ledger_entries
CREATE TABLE IF NOT EXISTS "vendor_ledger_entries" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "description" TEXT,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable raw_material_purchase_invoices
CREATE TABLE IF NOT EXISTS "raw_material_purchase_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendorId" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "cgst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sgst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "igst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "payments" JSONB DEFAULT '[]',
    "stockUpdated" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_material_purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable raw_material_purchase_items
CREATE TABLE IF NOT EXISTS "raw_material_purchase_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "productId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "hsnCode" TEXT,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "taxableAmount" DOUBLE PRECISION NOT NULL,
    "cgst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sgst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "igst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalAmount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "raw_material_purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable manufacturing_companies
CREATE TABLE IF NOT EXISTS "manufacturing_companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalTenantId" TEXT,
    "gstin" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "ifscCode" TEXT,
    "defaultCoPackingRate" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "currentPayable" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturing_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable manufacturer_copacking_rates
CREATE TABLE IF NOT EXISTS "manufacturer_copacking_rates" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "productId" TEXT,
    "rate" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manufacturer_copacking_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable manufacturer_raw_material_stocks
CREATE TABLE IF NOT EXISTS "manufacturer_raw_material_stocks" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturer_raw_material_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable material_issue_challans
CREATE TABLE IF NOT EXISTS "material_issue_challans" (
    "id" TEXT NOT NULL,
    "challanNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "manufacturerId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_issue_challans_pkey" PRIMARY KEY ("id")
);

-- CreateTable material_issue_items
CREATE TABLE IF NOT EXISTS "material_issue_items" (
    "id" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
    "consumedQuantity" INTEGER NOT NULL DEFAULT 0,
    "wastedQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "material_issue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable manufacturing_batches
CREATE TABLE IF NOT EXISTS "manufacturing_batches" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "productId" TEXT,
    "challanId" TEXT,
    "productionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plannedQuantity" INTEGER NOT NULL,
    "actualQuantity" INTEGER NOT NULL,
    "rejectedQuantity" INTEGER NOT NULL DEFAULT 0,
    "acceptedQuantity" INTEGER NOT NULL DEFAULT 0,
    "qcPassedQuantity" INTEGER NOT NULL DEFAULT 0,
    "qcRejectedQuantity" INTEGER NOT NULL DEFAULT 0,
    "qcStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "qcNotes" TEXT,
    "qcApprovedAt" TIMESTAMP(3),
    "qcApprovedById" TEXT,
    "goodsReceiptRecorded" BOOLEAN NOT NULL DEFAULT false,
    "coPackingRate" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "coPackingCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "consumablesCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalProductionCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "consumptions" JSONB,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturing_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable manufacturer_service_invoices
CREATE TABLE IF NOT EXISTS "manufacturer_service_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "manufacturerId" TEXT NOT NULL,
    "batchId" TEXT,
    "sacCode" TEXT NOT NULL DEFAULT '9988',
    "serviceQuantity" INTEGER NOT NULL,
    "coPackingRate" DOUBLE PRECISION NOT NULL,
    "taxableAmount" DOUBLE PRECISION NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 18.0,
    "cgst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sgst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "igst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "payments" JSONB DEFAULT '[]',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturer_service_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable manufacturer_ledger_entries
CREATE TABLE IF NOT EXISTS "manufacturer_ledger_entries" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "description" TEXT,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manufacturer_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable distributor_sales
CREATE TABLE IF NOT EXISTS "distributor_sales" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "distributorId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "deliveryRequired" BOOLEAN NOT NULL DEFAULT false,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "cgst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sgst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "igst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
    "paymentMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "outstandingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "payments" JSONB DEFAULT '[]',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributor_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable distributor_sale_items
CREATE TABLE IF NOT EXISTS "distributor_sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "hsnCode" TEXT,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 18.0,
    "taxableAmount" DOUBLE PRECISION NOT NULL,
    "cgst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sgst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "igst" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalAmount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "distributor_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable distributor_ownership_ledgers
CREATE TABLE IF NOT EXISTS "distributor_ownership_ledgers" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "companyJarsBefore" INTEGER NOT NULL,
    "distributorJarsBefore" INTEGER NOT NULL,
    "companyJarsAfter" INTEGER NOT NULL,
    "distributorJarsAfter" INTEGER NOT NULL,
    "jarsTransferred" INTEGER NOT NULL,
    "ratePerJar" DOUBLE PRECISION NOT NULL DEFAULT 250.0,
    "settlementAmount" DOUBLE PRECISION NOT NULL,
    "paymentReference" TEXT,
    "paymentMethod" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distributor_ownership_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable accessory_sales
CREATE TABLE IF NOT EXISTS "accessory_sales" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "distributorId" TEXT,
    "customerId" TEXT,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 18.0,
    "taxableAmount" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
    "paymentMethod" TEXT NOT NULL DEFAULT 'UPI',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accessory_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable distributor_accessory_stocks
CREATE TABLE IF NOT EXISTS "distributor_accessory_stocks" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributor_accessory_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable subscription_plan_configs
CREATE TABLE IF NOT EXISTS "subscription_plan_configs" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "waterQuotaPerCycle" INTEGER NOT NULL DEFAULT 30,
    "freeAccessories" JSONB,
    "discountedAccessories" JSONB,
    "promotionalBadge" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plan_configs_pkey" PRIMARY KEY ("id")
);

-- Indexes & Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "raw_material_purchase_invoices_invoiceNumber_key" ON "raw_material_purchase_invoices"("invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "manufacturing_companies_externalTenantId_key" ON "manufacturing_companies"("externalTenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "manufacturer_raw_material_stocks_manufacturerId_materialId_key" ON "manufacturer_raw_material_stocks"("manufacturerId", "materialId");
CREATE UNIQUE INDEX IF NOT EXISTS "material_issue_challans_challanNumber_key" ON "material_issue_challans"("challanNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "manufacturing_batches_batchNumber_key" ON "manufacturing_batches"("batchNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "manufacturer_service_invoices_invoiceNumber_key" ON "manufacturer_service_invoices"("invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "distributor_sales_invoiceNumber_key" ON "distributor_sales"("invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "distributor_ownership_ledgers_transactionNumber_key" ON "distributor_ownership_ledgers"("transactionNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "accessory_sales_invoiceNumber_key" ON "accessory_sales"("invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "distributor_accessory_stocks_distributorId_productId_key" ON "distributor_accessory_stocks"("distributorId", "productId");
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plan_configs_packageId_key" ON "subscription_plan_configs"("packageId");

