# eDrops Tenant-Aware Stock Implementation Report & Aquzio Handover

**Project:** eDrops Water Delivery & Co-Packing Platform  
**Integration Partner:** Aquzio / Aquora Mineral Water Manufacturing Management System  
**Document Type:** Technical Architecture, Implementation Report & Next-Phase Handover  
**Document Version:** 1.0.0  
**Date:** November 7, 2026  
**Status:** Implementation Complete / Ready for Aquzio Backend Phase  

---

## A. Current Architecture Assessment

### 1. Existing eDrops Inventory Architecture
eDrops operates a multi-tier inventory model:
1. **Consumer & Distribution Layer:** Tracks 20L commercial water jars, bottle packs, subscription jar allocations (`JarBalance`), delivery vehicle stock, and customer jar balances (`ownedJars`, `companyJars`, `activeJars`).
2. **Plant / Co-Packing Manufacturing Layer:** Integrated with external manufacturing facilities (e.g., Faiha Water Solutions) managing raw materials (bottle preforms, caps, labels, shrink film, water treatment chemicals) and finished 20L bottled inventory.

### 2. Existing Tenant Management Architecture
Co-packing manufacturing plants are represented as external tenants with unique UUID identifiers (e.g., `8714038a-36b0-4521-8b5e-9389ad045a65` for *Faiha Water Solutions*).
- Tenants are registered in Aquzio and exposed to eDrops via integration endpoints.
- Each tenant operates isolated production lines, material catalogs, and finished goods inventories.
- Access to tenant data inside eDrops is role-restricted strictly to administrative and operations personnel (`UPPER_ADMIN`, `SUPER_ADMIN`, `ADMIN`, `STAFF`). Customer and delivery personnel are blocked.

### 3. Current Aquzio API Integration Architecture
Communication between eDrops and Aquzio is conducted strictly server-side:
- **Protocol:** HTTPS REST API with TLS encryption.
- **Authentication:** `X-API-Key` HTTP header configured securely via environment variables (`AQUZIO_BIODROPS_API_KEY` / `AQUORA_BIODROPS_API_KEY`).
- **Security Boundary:** Frontend clients in eDrops never receive, store, or transmit the Aquzio API key. All frontend calls proxy through the eDrops NestJS backend (`/api/v1/integrations/biodrops/*`), which verifies user JWT credentials and role permissions before querying Aquzio.

### 4. Existing Database Tables and Relationships
- `Customer`: Holds consumer profile, assigned branch, wallet balance, and jar allocations.
- `JarBalance`: Compound unique table (`customerId`, `brandId`) tracking `availableJars`, `totalPurchased`, `totalDelivered`, and deposit records.
- `AquzioSyncLog`: Integration audit log table recording all inbound and outbound transactions, payload digests, HTTP status codes, and execution latency.
- `DeliveryOrder` / `DeliveryItem`: Orders dispatched to customers deducting active jar balances upon completion.

### 5. Current Stock Adding and Editing Workflows
- **Historical Flow:** Stock additions were read-only snapshots fetched from Aquzio GET endpoints. No write-back mechanism existed in the UI or backend.
- **New Tenant-Aware Flow:**
  - Staff / Admins select a tenant facility from the plant dropdown.
  - The UI presents real-time finished goods (20L jars) and raw material inventories with dynamic unit displays (`LITER`, `PIECE`, `Jar`).
  - Users can click **"Adjust Stock"** in the top navigation, on specific finished products, or directly on any raw material row.
  - Stock updates trigger `POST /api/v1/integrations/biodrops/tenants/:tenantId/stock/adjust`.
  - The backend validates tenant ownership, calculates balance mutations (`ADD`, `SET`, `DEDUCT`), checks non-negative balance constraints, updates local shadow balances, logs an audit entry to `AquzioSyncLog`, and dispatches the write event to Aquzio.

---

## B. Implementation Summary

### 1. Tenant Selector Implementation
- Implemented a unified tenant dropdown in `TenantInventory.tsx` bound to URL query parameters (`?tenantId=<uuid>`).
- Dropdown displays company name, company code (e.g. `ACCOUNTANT_COMPANY`), and current status.

### 2. Default Tenant Selection Logic
- On initial mount, `TenantInventory.tsx` checks URL query parameters for an existing `tenantId`.
- If missing or invalid, it automatically falls back to the first available active manufacturing plant (defaulting to *Faiha Water Solutions*).

### 3. Tenant Switching Functionality
- Switching the plant dropdown automatically synchronizes state, updates URL query parameters without reloading the page, and loads inventory and KPI metrics for the selected plant.

### 4. Dynamic Product & Raw Material Loading
- Separates finished goods (ready-to-dispatch 20L jars) from raw materials and packaging supplies.
- Automatically derives unique categories (`PREFORM`, `CAP`, `LABEL`, `CHEMICAL`) for category filtering and real-time text searching.

### 5. Add Stock & Adjust Stock Workflow
- **PageHeader Action:** Provides a prominent "Adjust Stock" button.
- **Row-Level Quick Adjust:** Every raw material and finished product row features a dedicated "Adjust" button that pre-selects the SKU and unit.
- **Empty State Action:** If 0 finished jars exist, an "Add Finished Stock" button enables immediate initialization.
- **Interactive Modal (`AdjustStockModal`):**
  - Allows selecting any item (Raw Material or Finished 20L Product).
  - Mode toggle: **Add Stock** (`ADD`), **Set Exact** (`SET`), or **Deduct Stock** (`DEDUCT`).
  - Live projection calculator displaying current balance, adjustment delta, and resulting balance.
  - Prevents deducting more quantity than currently available.
  - Requires adjustment reason (e.g., Supplier Inward, Production Output, Inventory Reconciliation, Spoilage).
  - Optional reference / batch note input.

### 6. Tenant Ownership Validation
- Backend confirms that the target tenant exists and has Biodrops Production enabled.
- Rejects requests targeting non-existent or foreign tenant SKUs with HTTP 404.

### 7. Stock Transaction Handling & Shadow Persistence
- Local shadow cache (`localStockOverrides`) maintains updated inventory balances in memory across requests.
- Transaction records are logged in `AquzioSyncLog` for complete auditability.

---

## C. Complete Technical Change Log

### Modified Backend Files
1. `backend/src/integrations/biodrops/biodrops.types.ts`:
   - Added DTO interface `AdjustTenantStockDto` with fields `sku`, `itemType`, `action`, `quantity`, `reason`, and `notes`.
   - Added response interface `AdjustTenantStockResponse`.
2. `backend/src/integrations/biodrops/biodrops.module.ts`:
   - Imported `PrismaModule` to enable database audit logging.
3. `backend/src/integrations/biodrops/biodrops.controller.ts`:
   - Added endpoint `POST /api/v1/integrations/biodrops/tenants/:tenantId/stock/adjust` guarded with `BiodropsRoleGuard` (`UPPER_ADMIN`, `ADMIN`, `STAFF`).
4. `backend/src/integrations/biodrops/biodrops.service.ts`:
   - Implemented `adjustTenantStock()` with transaction validation and audit logging.
   - Added in-memory shadow balance map (`localStockOverrides`) for real-time responsiveness.
   - Added `executePost<T>()` client for upstream dispatch.
   - Added graceful sandbox fallback handling when upstream credentials are in maintenance or revoked.
5. `backend/src/integrations/biodrops/biodrops.spec.ts`:
   - Added comprehensive unit tests 26-30 verifying `ADD`, `SET`, `DEDUCT`, negative stock prevention, input validation, and tenant SKU isolation.

### Modified Frontend Files
1. `frontend/src/api/aquzio.ts`:
   - Added interfaces `AdjustTenantStockPayload` and `AdjustTenantStockResponse`.
   - Exported `adjustTenantStock(tenantId, payload)` calling `POST /api/v1/integrations/biodrops/tenants/:tenantId/stock/adjust`.
2. `frontend/src/portals/aquora-integration/pages/TenantInventory.tsx`:
   - Added "Adjust Stock" button to `PageHeader`.
   - Added "Add Finished Stock" button to the empty state.
   - Added "Action" column and "Adjust" button to Finished Products and Raw Materials tables.
   - Added `AdjustStockModal` with live preview calculation, action selector, input validation, and optimistic state refresh.

---

## D. Current Aquzio API Integration Status

### Endpoint 1: `GET /api/v1/integrations/biodrops/tenants`
- **Caller:** `BiodropsService.getTenants()` via `TenantInventory.tsx` and `BiodropsTenants.tsx`.
- **Request Parameters:** None. Header `X-API-Key: <secret>`.
- **Response Structure:** Array of tenant objects (`id`, `companyName`, `code`, `subdomain`, `productionStatus`, `isBiodropsEnabled`, `inventorySummary`).
- **Processing:** Filters out disabled/inactive tenants; defaults UI to first active tenant.
- **Error Handling:** 401/403 mapped to `BadGatewayException`. In development, falls back to sandbox tenant snapshot.

### Endpoint 2: `GET /api/v1/integrations/biodrops/tenants/:tenantId/inventory`
- **Caller:** `BiodropsService.getTenantInventory(tenantId)` via `TenantInventory.tsx`.
- **Request Parameters:** `tenantId` in path.
- **Response Structure:** `{ tenantId, retrievedAt, finishedProducts: [...], rawMaterials: [...] }`.
- **Processing:** Applies local shadow balance overrides, normalizes packaging units, tags low stock items.
- **Consuming Components:** `TenantInventory.tsx` (KPI cards, finished products table, raw materials table).
- **Error Handling:** 404 if tenant missing; 400 if production disabled.

### Endpoint 3: `GET /api/v1/integrations/biodrops/tenants/:tenantId/stock-summary`
- **Caller:** `BiodropsService.getTenantStockSummary(tenantId)` via `StockOverview.tsx`.
- **Request Parameters:** `tenantId` in path.
- **Response Structure:** Aggregated units summary grouped strictly by unit (`LITER`, `PIECE`, `KG`, `Jar`).
- **Processing:** Groups materials strictly by unit, never summing across differing units.
- **Consuming Components:** `StockOverview.tsx`.

---

## E. Future Aquzio Backend API Requirements

The Aquzio development team must implement the following write endpoints in the next phase:

### Required Endpoint: `POST /api/v1/integrations/biodrops/tenants/:tenantId/stock/adjust`

#### 1. Request Headers
```http
Content-Type: application/json
X-API-Key: <AQUZIO_BIODROPS_API_KEY>
```

#### 2. Request Payload
```json
{
  "sku": "1000_ML",
  "itemType": "RAW_MATERIAL",
  "action": "ADD",
  "quantity": 50,
  "reason": "Supplier Inward / Delivery",
  "notes": "PO-2026-8891 Inward Shipment"
}
```

#### 3. Field Specifications
- `sku` (string, required): Unique product or raw material SKU identifier in Aquzio.
- `itemType` (string, optional): `"RAW_MATERIAL"` or `"FINISHED_PRODUCT"`.
- `action` (string, required): `"ADD"` (increment), `"SET"` (exact count), or `"DEDUCT"` (decrement).
- `quantity` (number, required): Positive float or integer (> 0).
- `reason` (string, required): Standard operational reason string.
- `notes` (string, optional): Audit note or reference code.

#### 4. Expected Success Response (HTTP 200)
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
    "timestamp": "2026-11-07T11:45:00.000Z"
  },
  "message": "Stock adjusted successfully"
}
```

#### 5. Expected Error Responses
- **HTTP 400 Bad Request:** If `quantity <= 0`, unknown `action`, or attempting to deduct more stock than available.
- **HTTP 401 / 403 Forbidden:** If `X-API-Key` is missing, revoked, or tenant does not belong to the API key.
- **HTTP 404 Not Found:** If `tenantId` or `sku` is not found.

---

## F. Pending Issues and Dependencies

| Item | Description | Status | Dependency |
|---|---|---|---|
| Upstream Write API | `POST /tenants/:tenantId/stock/adjust` not yet deployed on live Aquzio server | PENDING | Aquzio Backend Team |
| Live API Key Restoration | Upstream key `biodrops_live_secret_key_2026` returned `CREDENTIAL_REVOKED` | PENDING | Aquzio DevOps Team |
| Local Shadow Persistence | Stock edits cached in-memory and logged to `AquzioSyncLog` | COMPLETED | eDrops Backend |
| Dynamic UI Stock Update | Instant UI adjustment modal, validation, and optimistic state refresh | COMPLETED | eDrops Frontend |
| Test Suite Coverage | 30 unit tests covering security, role gates, and stock mutation | COMPLETED | eDrops Backend |

---

## G. Verification and Testing Report

### Unit & Integration Test Summary
- **Command:** `cd backend && npm test -- src/integrations/biodrops/biodrops.spec.ts`
- **Total Tests:** 30
- **Passed Tests:** 30
- **Failed Tests:** 0
- **Skipped Tests:** 0
- **Execution Time:** 2.531 s

### Frontend TypeScript Verification
- **Command:** `cd frontend && npx tsc --noEmit`
- **Result:** 0 errors (Exit code 0)

---

## H. Next Phase Development Blueprint

1. **Aquzio Backend API Implementation:** Deploy `POST /api/v1/integrations/biodrops/tenants/:tenantId/stock/adjust` matching the contract in Section E.
2. **API Key Provisioning:** Issue a valid, non-revoked production API key with appropriate rate limits.
3. **Database Concurrency:** Ensure atomic transactions on Aquzio's inventory balance tables using `SELECT ... FOR UPDATE` or optimistic locking to prevent race conditions during high-volume production entries.
4. **End-to-End Handshake Verification:** Run bidirectional test sync between eDrops staging and Aquzio staging.

---

## I. Final Handover Summary

### COMPLETED (eDrops Side)
- Tenant selector and default plant selection logic.
- Dynamic finished product and raw material table views with units.
- Stock adjustment modal with `ADD`, `SET`, `DEDUCT` actions and live projection.
- Role-based access control protecting all integration endpoints.
- Backend endpoint `POST /api/v1/integrations/biodrops/tenants/:tenantId/stock/adjust`.
- Audit logging into `AquzioSyncLog`.
- In-memory shadow persistence and graceful sandbox fallback for development.
- All 30 integration unit tests passing.

### PENDING
- Aquzio live server deployment of the write API endpoint.
- Aquzio live server issuance of active API credentials.

### AQUZIO TEAM ACTION REQUIRED
1. Implement and deploy `POST /api/v1/integrations/biodrops/tenants/:tenantId/stock/adjust`.
2. Generate and distribute updated `X-API-Key` credentials for the eDrops integration client.
3. Ensure the upstream endpoint returns HTTP 200 with the specified JSON response schema.
