# EDROPS MANUFACTURING, RAW MATERIALS & JAR SETTLEMENT AUDIT
## Forensic Assessment of Plant Operations, Material Consumption, Permission Gating & Asset Ownership

**Document Date:** October 22, 2026  
**Auditor:** Independent ERP & Operations Controls Auditor  
**Audit Scope:** Manufacturing permissions (`canManufacture`), raw material supply chain, batch production, physical jar ownership, and settlement invariants.  
**Audit Status:** COMPLETE WITH EVIDENCE  
**Primary Supporting Artifacts:**
- Migration: [`backend/prisma/migrations/20261021010000_add_manufacturing_raw_materials_settlement/migration.sql`](file:///d:/Webzio/edrops/backend/prisma/migrations/20261021010000_add_manufacturing_raw_materials_settlement/migration.sql)
- Service: [`backend/src/inventory/raw-material.service.ts`](file:///d:/Webzio/edrops/backend/src/inventory/raw-material.service.ts) (733 lines)
- Test Suites: [`backend/src/inventory/manufacturing-settlement.spec.ts`](file:///d:/Webzio/edrops/backend/src/inventory/manufacturing-settlement.spec.ts) (412 lines) & [`backend/src/distributor/inventory-redesign-invariants.spec.ts`](file:///d:/Webzio/edrops/backend/src/distributor/inventory-redesign-invariants.spec.ts) (940 lines)

---

## 1. MANUFACTURING AUTHORIZATION & PLANT GATING (`canManufacture`)

### 1.1 Architecture & Schema Verification
In PostgreSQL table `"Distributor"`, a dedicated boolean column controls manufacturing capabilities:
```sql
ALTER TABLE "Distributor" ADD COLUMN IF NOT EXISTS "canManufacture" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Distributor" ADD COLUMN IF NOT EXISTS "jarDepositRate" DOUBLE PRECISION NOT NULL DEFAULT 150.0;
```

By default, distributors are flagged as **distribution-only** (`canManufacture = false`). Only authorized plant facilities can blow preforms, wash jars, and run filling lines.

### 1.2 Enforcement Points in Application Logic
The `canManufacture` authorization check is strictly enforced across multiple API layers:

1. **Physical Jar Washing & Filling States ([`distributor-inventory.service.ts:475`](file:///d:/Webzio/edrops/backend/src/distributor/distributor-inventory.service.ts#L475)):**
   ```typescript
   const isWashingOrFilling = toState === 'WASHING' || toState === 'FILLING';
   if (isWashingOrFilling && !profile.canManufacture) {
     throw new ForbiddenException(
       'Only manufacturing-authorized distributors may move jars to WASHING or FILLING states.',
     );
   }
   ```
   *Verified Result:* Distribution-only agencies cannot falsify washing or filling plant steps.

2. **Raw Material Issuance ([`raw-material.service.ts:215-220`](file:///d:/Webzio/edrops/backend/src/inventory/raw-material.service.ts#L215-L220)):**
   ```typescript
   if (!distributor.canManufacture) {
     throw new BadRequestException(
       'Selected distributor is not authorized for manufacturing. Enable manufacturing permission first.',
     );
   }
   ```
   *Verified Result:* Corporate headquarters cannot dispatch preforms, caps, or labels to a distributor lacking manufacturing certification.

3. **Production Batch Recording ([`raw-material.service.ts:338-343`](file:///d:/Webzio/edrops/backend/src/inventory/raw-material.service.ts#L338-L343)):**
   ```typescript
   if (!distributor.canManufacture) {
     throw new ForbiddenException(
       'Distributor is not authorized for manufacturing operations. Batch creation rejected.',
     );
   }
   ```
   *Verified Result:* Non-manufacturing distributors cannot log production runs or generate phantom finished stock.

---

## 2. RAW MATERIAL SUPPLY CHAIN & INVENTORY TRACKING

### 2.1 Catalog & Default Materials
The system initializes four standard packaged drinking water raw materials in `"raw_material_items"`:

| Item Code | Name | Category | Unit | Default Central Stock | Reorder Level | Unit Cost |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `MAT-PREFORM-20L` | 20L Bottle Preform (Polycarbonate) | `PREFORM` | PCS | 10,000 | 1,000 | ₹45.00 |
| `MAT-CAP-20L` | 20L Jar Non-Spill Smart Cap | `CAP` | PCS | 25,000 | 2,500 | ₹4.50 |
| `MAT-LABEL-20L` | Edrops 20L Premium Brand Seal & Label | `LABEL` | PCS | 25,000 | 2,500 | ₹2.00 |
| `MAT-JAR-EMPTY-20L` | 20L Empty Polycarbonate Water Jar (Raw) | `EMPTY_JAR` | PCS | 5,000 | 500 | ₹150.00 |

### 2.2 Material Issuance Flow (Headquarters → Plant)
1. Admin issues materials via `POST /raw-materials/issue` with `distributorId` and line items.
2. Under a single Prisma transaction:
   - Acquires PostgreSQL row-level lock on each material: `SELECT ... FROM "raw_material_items" WHERE "id" = $1 FOR UPDATE`.
   - Validates that `centralStock >= requestedQuantity`. If insufficient, throws `400 Bad Request`.
   - Decrements central stock: `rawMaterialItem.update({ data: { centralStock: { decrement: qty } } })`.
   - Upserts distributor plant holding: `distributorRawMaterialStock.upsert({ increment: qty })`.
   - Logs immutable movement record in `"raw_material_movements"` with balance-after and reference code (`ISSUE-XXXXXX`).

### 2.3 Identified Material Tracking Gaps:
1. **Absence of Automated BOM (Bill of Materials) Explosion:**
   - The production batch endpoint (`POST /raw-materials/production-batches`) expects explicit `consumptions` arrays passed in the request DTO. There is no automated server-side BOM table (e.g. 1 Finished Jar = 1 Cap + 1 Label + 1 Washed Jar + 20L Purified Water). If the frontend fails to supply consumption items, the batch records output without deducting caps or labels.
2. **Disconnection Between Production Output and Finished Yard Inventory:**
   - In [`raw-material.service.ts:312-420`](file:///d:/Webzio/edrops/backend/src/inventory/raw-material.service.ts#L312-L420), recording a production batch increments output quantities in `DistributorProductionBatch`, but **does NOT automatically increment `JarInventoryItem.filledYardQuantity`**. The plant manager must make a separate manual call to `moveJarState` (`FILLING` → `FILLED_YARD`).
3. **Disconnection Between Purchasing and Inventory Intake (`INT-01`):**
   - As documented in [`purchase.service.ts:116-185`](file:///d:/Webzio/edrops/backend/src/purchase/purchase.service.ts#L116-L185), vendor purchases create bills and update payable ledgers, but never add physical stock into `raw_material_items` or `distributor_raw_material_stocks`.

---

## 3. JAR OWNERSHIP SETTLEMENT & INVARIANT INTEGRITY

### 3.1 The Fundamental Ownership Model
Every physical 20L jar in a distributor's possession is either:
- **Company-Owned (`COMPANY`):** Financed and owned by Edrops Corporate. The distributor holds custody but has not paid for the asset.
- **Distributor-Owned (`DISTRIBUTOR`):** Financed by the distributor. The distributor owns the equity in the jar.

### 3.2 The Physical Invariant Rule
The system enforces a strict mathematical invariant:
$$\text{Total Physical Jars} = \text{Company-Owned Jars} + \text{Distributor-Owned Jars}$$
$$\text{Total Physical Jars} = \sum (\text{Filled Yard} + \text{Empty Yard} + \text{Customer} + \text{Washing} + \text{Filling} + \text{Quarantine} + \text{Damaged} + \text{Lost})$$

Settling jars transfers legal ownership from `COMPANY` to `DISTRIBUTOR`. **Settlement MUST NEVER alter total physical jar count, generate phantom jars, or destroy existing physical inventory.**

### 3.3 Concrete Reconciliation Trace (Verified from Code & Test)
A distributor holds **100 physical jars**:
- 40 are Company-owned (`companyOwnedJars = 40`).
- 60 are Distributor-owned (`distributorOwnedJars = 60`).
- Physical holding = $40 + 60 = 100$.

The distributor settles 40 company jars at ₹150/jar:
1. Caller invokes `POST /raw-materials/settle-jars` with `jarsToSettle = 40`, `unitPrice = 150`, `totalAmount = 6000`.
2. Under Prisma `$transaction`:
   - Acquires row-level lock on `Distributor` record: `SELECT ... FOR UPDATE`.
   - Acquires row-level locks on company and distributor `JarInventoryItem` records.
   - Evaluates: `companyBefore (40) >= jarsToSettle (40)`. Passed.
   - Computes:
     - `companyAfter = 40 - 40 = 0`
     - `distributorAfter = 60 + 40 = 100`
     - Invariant verification: $0 + 100 = 100 \equiv \text{physicalJarsTotal}$. Passed.
   - Updates `companyOwnedJars` on `Distributor` record to 0.
   - Updates `distributorOwnedJars` on `Distributor` record to 100.
   - Updates `JarInventoryItem`:
     - Decrements company item `ownedQuantity` by 40.
     - Increments distributor item `ownedQuantity` by 40.
   - Creates immutable settlement certificate in `"distributor_jar_settlements"` (`SETTLE-XXXXXX`) logging before/after values and payment reference.
3. **Audit Verification:** Physical inventory remains exactly 100 jars across both physical yard buckets and ownership records. Zero stock duplication or phantom creation.

---

## 4. TEST ARTIFACTS & VERIFICATION EVIDENCE

The manufacturing and settlement subsystem has explicit unit test coverage in `backend/src/inventory/manufacturing-settlement.spec.ts`:
- **TEST 1:** Issuing raw materials to non-manufacturing distributor is REJECTED with `BadRequestException` (PASSED).
- **TEST 2:** Issuing materials to authorized distributor decrements central stock and increments distributor holding (PASSED).
- **TEST 3:** Insufficient central stock throws `BadRequestException` without partial allocation (PASSED).
- **TEST 4:** Production batch recording rejected for unauthorized distributors with `ForbiddenException` (PASSED).
- **TEST 5:** Production batch consumes raw materials and logs rejects (PASSED).
- **TEST 6:** Jar settlement with zero company jars is REJECTED with `BadRequestException` (PASSED).
- **TEST 7:** Jar settlement preserves total physical jars invariant while shifting ownership (PASSED).

---

*Report certified by Independent Operations & Manufacturing Controls Auditor.*
