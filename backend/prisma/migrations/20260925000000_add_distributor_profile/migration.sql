-- CreateTable
CREATE TABLE IF NOT EXISTS "Distributor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "agencyName" TEXT,
    "address" TEXT,
    "routeOrArea" TEXT,
    "vehicleType" TEXT,
    "vehiclePlate" TEXT,
    "jarOwnership" TEXT DEFAULT 'COMPANY_OWNED',
    "companyOwnedJars" INTEGER NOT NULL DEFAULT 0,
    "distributorOwnedJars" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Distributor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Distributor_userId_key" ON "Distributor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Distributor_referralCode_key" ON "Distributor"("referralCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Distributor_referralCode_idx" ON "Distributor"("referralCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Distributor_userId_idx" ON "Distributor"("userId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Distributor_userId_fkey'
  ) THEN
    ALTER TABLE "Distributor" ADD CONSTRAINT "Distributor_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Distributor_createdById_fkey'
  ) THEN
    ALTER TABLE "Distributor" ADD CONSTRAINT "Distributor_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Safe Backfill for existing distributor users without a Distributor profile:
DO $$
DECLARE
  dist_rec RECORD;
  ref_code TEXT;
  clean_phone TEXT;
BEGIN
  FOR dist_rec IN SELECT id, phone FROM "User" WHERE role = 'DISTRIBUTOR' AND id NOT IN (SELECT "userId" FROM "Distributor") LOOP
    clean_phone := regexp_replace(dist_rec.phone, '[^0-9]', '', 'g');
    IF length(clean_phone) >= 4 THEN
      ref_code := 'EDR-' || substring(clean_phone from length(clean_phone) - 3 for 4);
    ELSE
      ref_code := 'EDR-' || upper(substring(dist_rec.id from 1 for 6));
    END IF;

    -- Ensure uniqueness in case of collision
    WHILE EXISTS (SELECT 1 FROM "Distributor" WHERE "referralCode" = ref_code) LOOP
      ref_code := ref_code || floor(random() * 10)::text;
    END LOOP;

    INSERT INTO "Distributor" ("id", "userId", "referralCode", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, dist_rec.id, ref_code, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END LOOP;
END $$;
