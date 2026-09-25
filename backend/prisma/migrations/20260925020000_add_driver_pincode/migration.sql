-- AlterTable drivers: add pincode column with default value for existing records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drivers' AND column_name = 'pincode'
  ) THEN
    ALTER TABLE "drivers" ADD COLUMN "pincode" TEXT NOT NULL DEFAULT '682001';
  END IF;
END $$;

-- CreateIndex on drivers(pincode)
CREATE INDEX IF NOT EXISTS "drivers_pincode_idx" ON "drivers"("pincode");
