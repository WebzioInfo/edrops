-- Extend the existing log. Legacy warehouse entries remain unassigned.
BEGIN;
ALTER TABLE "InventoryLog"
  ADD COLUMN "sequence" SERIAL NOT NULL,
  ADD COLUMN "distributorId" TEXT,
  ADD COLUMN "ownership" TEXT,
  ADD COLUMN "quantity" INTEGER,
  ADD COLUMN "balanceAfter" INTEGER;
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_distributorId_fkey"
  FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "InventoryLog_sequence_key" ON "InventoryLog"("sequence");
CREATE INDEX "InventoryLog_distributorId_ownership_sequence_idx"
  ON "InventoryLog"("distributorId", "ownership", "sequence");

-- Serialize the opening snapshot with profile updates so no movement is lost.
LOCK TABLE "Distributor" IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO "InventoryLog" ("id", "action", "distributorId", "ownership", "quantity", "balanceAfter", "description", "createdAt")
SELECT gen_random_uuid()::text, 'OPENING_BALANCE', d.id, v.ownership, v.quantity, v.quantity,
  'Opening ownership snapshot when transaction tracking began; earlier movements are unavailable.', CURRENT_TIMESTAMP
FROM "Distributor" d
CROSS JOIN LATERAL (VALUES ('COMPANY_OWNED', d."companyOwnedJars"), ('DISTRIBUTOR_OWNED', d."distributorOwnedJars")) v(ownership, quantity)
WHERE v.quantity <> 0;

-- Capture the existing source of truth atomically, including all existing writers.
-- These are ownership changes, not claims about physical dispatch or returns.
CREATE FUNCTION record_distributor_ownership_change() RETURNS trigger AS $$
DECLARE
  previous_company INTEGER := 0;
  previous_owned INTEGER := 0;
  entry_action TEXT := 'OPENING_BALANCE';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    previous_company := OLD."companyOwnedJars";
    previous_owned := OLD."distributorOwnedJars";
    entry_action := 'ADJUSTMENT';
  END IF;
  IF NEW."companyOwnedJars" <> previous_company THEN
    INSERT INTO "InventoryLog" ("id", "action", "distributorId", "ownership", "quantity", "balanceAfter", "description", "createdAt")
    VALUES (gen_random_uuid()::text, entry_action, NEW.id, 'COMPANY_OWNED', NEW."companyOwnedJars" - previous_company, NEW."companyOwnedJars", 'Recorded company-owned jar total changed.', clock_timestamp());
  END IF;
  IF NEW."distributorOwnedJars" <> previous_owned THEN
    INSERT INTO "InventoryLog" ("id", "action", "distributorId", "ownership", "quantity", "balanceAfter", "description", "createdAt")
    VALUES (gen_random_uuid()::text, entry_action, NEW.id, 'DISTRIBUTOR_OWNED', NEW."distributorOwnedJars" - previous_owned, NEW."distributorOwnedJars", 'Recorded distributor-owned jar total changed.', clock_timestamp());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER distributor_ownership_history
AFTER INSERT OR UPDATE OF "companyOwnedJars", "distributorOwnedJars" ON "Distributor"
FOR EACH ROW EXECUTE FUNCTION record_distributor_ownership_change();
COMMIT;
