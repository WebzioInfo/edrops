# EDROPS ↔ AQUZIO API HANDOVER SPECIFICATION & INTEGRATION CONTRACT

**Target Audience:** Aquzio Backend Development & Systems Engineering Team  
**Author:** Edrops Principal Architecture & Integration Engineering  
**Document Version:** 2.0.0  
**Integration Status:** Read APIs Operational / Write APIs Proposed for Development  
**Document Classification:** Technical API Contract & Handover  

---

## 1. INTEGRATION ARCHITECTURE OVERVIEW

The integration connects Edrops (commercial distribution and consumer sales) with Aquzio (manufacturing execution, raw materials, batch production, and quality control).

```
[ Edrops Client ]
       | (JWT Cookie / Header)
       v
[ Edrops NestJS Backend ]
       |
       |  HTTPS REST (X-API-Key Header)
       v
[ Aquzio Backend Gateway ]
       |
       v
[ Aquzio Supabase PostgreSQL ] (Source of Truth)
```

- **Transport:** HTTPS with TLS 1.3 encryption.
- **Header Authentication:** Every outbound request from Edrops includes `X-API-Key: <secret>`.
- **User-Agent:** `eDrops-Backend-Production/1.0`.
- **IP / Firewall Restrictions:** Must be configured to allow Edrops production egress IPs.

---

## 2. EXISTING READ API CONTRACTS (VERIFIED IN CODEBASE)

The following three read endpoints are actively consumed by Edrops.

### 2.1 Endpoint 1: List Production-Enabled Tenants
- **Route:** `GET /api/v1/integrations/biodrops/tenants`
- **Purpose:** Populates the multi-tenant manufacturing plant switcher in Edrops.
- **Request Headers:**
  ```http
  Accept: application/json
  X-API-Key: [REDACTED_API_KEY]
  ```
- **Verified Response Structure (HTTP 200):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "8714038a-36b0-4521-8b5e-9389ad045a65",
        "companyName": "Faiha Water Solutions",
        "code": "ACCOUNTANT_COMPANY",
        "subdomain": "faiha",
        "productionStatus": "ACTIVE",
        "isBiodropsEnabled": true,
        "inventorySummary": {
          "totalFinishedJars": 0,
          "rawMaterialsCount": 4,
          "lowStockAlerts": 0,
          "lastUpdated": "2026-11-08T12:00:00.000Z"
        }
      }
    ]
  }
  ```

### 2.2 Endpoint 2: Get Tenant Live Inventory
- **Route:** `GET /api/v1/integrations/biodrops/tenants/:tenantId/inventory`
- **Purpose:** Supplies live finished goods and raw materials for the selected tenant facility.
- **Path Parameters:**
  - `tenantId` (UUID, required): Target tenant identifier.
- **Verified Response Structure (HTTP 200):**
  ```json
  {
    "success": true,
    "data": {
      "tenantId": "8714038a-36b0-4521-8b5e-9389ad045a65",
      "tenantName": "Faiha Water Solutions",
      "tenantCode": "ACCOUNTANT_COMPANY",
      "retrievedAt": "2026-11-08T12:00:00.000Z",
      "finishedProducts": [
        {
          "productId": "prod-jar-20l",
          "name": "Finished 20L Purified Water Jar",
          "sku": "20L_WATER_JAR",
          "availableStock": 120,
          "reservedStock": 10,
          "damagedStock": 2,
          "unit": "Jar",
          "lastUpdated": "2026-11-08T12:00:00.000Z"
        }
      ],
      "rawMaterials": [
        {
          "materialId": "mat-1",
          "name": "1000 ML BOTTLE PREFORM",
          "sku": "1000_ML",
          "category": "PREFORM",
          "availableQuantity": 987,
          "usedQuantity": 50,
          "wastedQuantity": 2,
          "reorderLevel": 200,
          "unit": "LITER"
        }
      ]
    }
  }
  ```

### 2.3 Endpoint 3: Get Tenant Stock Summary
- **Route:** `GET /api/v1/integrations/biodrops/tenants/:tenantId/stock-summary`
- **Purpose:** Groups inventory by measurement unit to avoid summing differing units together.
- **Verified Response Structure (HTTP 200):**
  ```json
  {
    "success": true,
    "data": {
      "tenantId": "8714038a-36b0-4521-8b5e-9389ad045a65",
      "finishedProductsSummary": {
        "totalAvailableStock": 120,
        "totalReservedStock": 10,
        "totalDamagedStock": 2,
        "totalStock": 132,
        "unit": "Jar"
      },
      "rawMaterialsGroupedByUnit": [
        {
          "unit": "LITER",
          "totalAvailable": 987,
          "totalUsed": 50,
          "totalWasted": 2,
          "itemCount": 1
        }
      ]
    }
  }
  ```

---

## 3. PROPOSED FUTURE WRITE API REQUIREMENTS

> [!IMPORTANT]
> The following endpoints do NOT yet exist on the Aquzio live backend. They are PROPOSED specifications required to complete the bidirectional sync.

### PROPOSED Endpoint: Adjust Tenant Stock
- **Route:** `POST /api/v1/integrations/biodrops/tenants/:tenantId/stock/adjust`
- **Method:** `POST`
- **Authentication:** `X-API-Key`
- **Idempotency:** Accepts optional header `Idempotency-Key: <uuid>`.

#### Proposed Request Payload:
```json
{
  "tenantId": "8714038a-36b0-4521-8b5e-9389ad045a65",
  "sku": "1000_ML",
  "itemType": "RAW_MATERIAL",
  "action": "ADD",
  "quantity": 50,
  "calculatedNewQuantity": 1037,
  "unit": "LITER",
  "movementType": "EDROPS_ADJUSTMENT",
  "description": "Changed in eDrops: Supplier Inward (PO-8891)",
  "reason": "Supplier Inward",
  "notes": "PO-8891 Inward Shipment from Premier Plastics",
  "operator": "eDrops System (Staff: Murshid)",
  "reference": "EDROPS-ADJ-1794143784",
  "adjustedAt": "2026-11-08T18:45:00.000Z"
}
```

#### Proposed Payload Schema:
| Field | Type | Required | Allowed Values / Constraints |
|---|---|---|---|
| `tenantId` | UUID | Yes | Target tenant/company UUID in Aquzio Supabase |
| `sku` | String | Yes | Non-empty string matching a registered tenant item |
| `itemType` | String | No | `"RAW_MATERIAL"` or `"FINISHED_PRODUCT"` |
| `action` | String | Yes | `"ADD"` (increment), `"SET"` (overwrite), `"DEDUCT"` (decrement) |
| `quantity` | Number | Yes | Positive float or integer (> 0) |
| `calculatedNewQuantity` | Number | Yes | Expected resulting balance after adjustment |
| `unit` | String | Yes | Measurement unit (`KG`, `LITER`, `PIECE`, `BOX`, `Jar`) |
| `movementType` | String | Yes | Badge tag for Movement History (e.g. `"EDROPS_ADJUSTMENT"`) |
| `description` | String | Yes | Text displayed in Movement History description column |
| `reason` | String | Yes | Standard operational reason |
| `notes` | String | No | Freeform reference code, PO number, or batch ID |
| `operator` | String | Yes | Text displayed in Movement History operator column |
| `reference` | String | Yes | Unique audit tracking reference |
| `adjustedAt` | ISO String | Yes | Timestamp of the event |

#### Proposed Success Response (HTTP 200):
```json
{
  "success": true,
  "data": {
    "tenantId": "8714038a-36b0-4521-8b5e-9389ad045a65",
    "sku": "1000_ML",
    "itemType": "RAW_MATERIAL",
    "previousQuantity": 987,
    "newQuantity": 1037,
    "unit": "LITER",
    "action": "ADD",
    "transactionId": "txn_aquzio_99182374",
    "timestamp": "2026-11-08T12:30:00.000Z"
  },
  "message": "Stock adjusted successfully"
}
```

#### Proposed Error Responses:
- **HTTP 400 Bad Request:**
  - `{"success": false, "message": "INVALID_QUANTITY", "errors": ["Quantity must be greater than zero"]}`
  - `{"success": false, "message": "INSUFFICIENT_STOCK", "errors": ["Cannot deduct 50 LITER; only 20 LITER available"]}`
- **HTTP 401 Unauthorized:** Missing or invalid API key.
- **HTTP 404 Not Found:** `tenantId` does not exist or `sku` is not found within the specified tenant.
- **HTTP 409 Conflict:** Concurrent update detected (retry suggested).

---

## 4. MANDATORY SECURITY & DATA-INTEGRITY RULES (THE 12 AXIOMS)

Aquzio must strictly implement these 12 rules on its backend:

1. **Independent Balance Calculation:**
   Never trust any calculated balance sent by the client. Aquzio must calculate `newQuantity` inside PostgreSQL using the current database balance and the requested `action` (`ADD`, `SET`, `DEDUCT`).

2. **Dual Tenant ID Verification:**
   The `tenantId` in the URL path (`/tenants/:tenantId/stock/adjust`) must strictly match `tenantId` in the request body. If they differ, immediately reject with HTTP 400. In addition, independently verify that the API key credential is authorized for that specific tenant.

3. **Cryptographic Identity vs Asserted Operator:**
   Never blindly trust the `operator` string. Aquzio must authenticate the request cryptographically via `X-API-Key`. The operator data provided in payload (`assertedName`, `staffId`) must be preserved as audit metadata without replacing the verified integration identity.

4. **Authoritative Server Timestamps:**
   Generate `created_at` and the authoritative ledger timestamp inside Aquzio using PostgreSQL's server clock (`NOW()`). Preserve client `adjustedAt` strictly as source event metadata.

5. **Full Schema Inspection:**
   Inspect the actual `raw_material_movements` table, triggers, and foreign keys in Supabase before writing queries. Do not assume the schema has only the columns visible in the UI.

6. **Preserve Field Semantic Distinctions:**
   - Integration Source: `EDROPS`
   - Movement Classification / Tag: `EDROPS_ADJUSTMENT`
   - Business Reason: `Supplier Inward`, `Physical Reconciliation`, `Damaged Write-off`, etc.
   - External Reference: `EDROPS-ADJ-XXXX` or source PO number.

7. **Purchase Receipt Compatibility:**
   Check whether `Supplier Inward` adjustments should link to or trigger Aquzio's existing purchase-receipt workflows rather than generic inventory mutations, preserving supplier ledger integrity.

8. **Atomic Single-Transaction Execution:**
   Update inventory and insert the movement record within ONE atomic database transaction (`BEGIN ... COMMIT`). If either fails, roll back completely. `balance_after` in the movement record must be calculated by Aquzio.

9. **Persistent Idempotency Protection:**
   Store `Idempotency-Key` headers in a database table scoped by tenant and API key. If a network retry occurs with the same key, return the original committed response without reapplying stock changes.

10. **Comprehensive Isolation & Concurrency Testing:**
    Verify tenant isolation, concurrent adjustments (locking rows with `SELECT ... FOR UPDATE`), duplicate requests, and rollback behavior on PostgreSQL.

11. **Authoritative Response Handshake:**
    Return the actual committed balance (`newQuantity`), transaction UUID, and movement ID in the response back to eDrops.

12. **Strict Failure Invariant:**
    Never return success (HTTP 200) if the inventory update or movement ledger insertion fails.

---

## 5. DATABASE & SUPABASE ARCHITECTURAL CONSIDERATIONS

1. **Row-Level Security (RLS):**
   - If Aquzio uses a shared database with a `tenant_id` column on inventory tables, the integration service role must be scoped strictly to the authorized tenant ID.
   - Cross-tenant mutations must be prevented at the database constraint level.
2. **Transaction Concurrency & Atomic Updates:**
   - In PostgreSQL, stock deductions must use atomic row locking (`SELECT ... FOR UPDATE`) or an arithmetic atomic update:
     ```sql
     UPDATE raw_materials 
     SET available_quantity = available_quantity + $1, updated_at = NOW() 
     WHERE tenant_id = $2 AND sku = $3 
     RETURNING available_quantity;
     ```
3. **Audit Ledger:**
   - Every mutation must insert a record into an immutable stock movement table (`stock_ledger`) capturing `tenant_id`, `sku`, `previous_qty`, `new_qty`, `reason`, `source='EDROPS_API'`, and `created_at`.

---

## 5. EXACT ACTIONS REQUIRED FROM AQUZIO TEAM

1. **Re-activate API Key:** Un-revoke or issue a valid replacement key for `biodrops_live_secret_key_2026` on `https://aquora-backend.webziointernational.in`.
2. **Implement Proposed Write API:** Develop and deploy `POST /api/v1/integrations/biodrops/tenants/:tenantId/stock/adjust`.
3. **Enforce Isolation & Validation:** Guarantee that mutations for SKU `X` are rejected if SKU `X` does not belong to `:tenantId`.
4. **Staging Testing:** Coordinate with the Edrops team to execute end-to-end integration tests between staging environments.
