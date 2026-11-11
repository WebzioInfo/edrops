-- CreateTable distributor_expenses
CREATE TABLE IF NOT EXISTS "distributor_expenses" (
    "id" TEXT NOT NULL,
    "distributorId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "vendorName" TEXT,
    "invoiceNumber" TEXT,
    "receiptUrl" TEXT,
    "description" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "distributor_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "distributor_expenses_distributorId_expenseDate_idx" ON "distributor_expenses"("distributorId", "expenseDate");
CREATE INDEX IF NOT EXISTS "distributor_expenses_distributorId_category_idx" ON "distributor_expenses"("distributorId", "category");
CREATE INDEX IF NOT EXISTS "distributor_expenses_status_idx" ON "distributor_expenses"("status");

-- AddForeignKey
ALTER TABLE "distributor_expenses" 
    ADD CONSTRAINT "distributor_expenses_distributorId_fkey" 
    FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
