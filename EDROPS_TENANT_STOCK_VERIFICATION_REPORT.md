# EDROPS TENANT-AWARE STOCK VERIFICATION & TEST REPORT

**Auditor:** Independent Principal QA & Systems Auditor  
**Date of Execution:** November 8, 2026  
**Platform:** Edrops Web Application & NestJS Backend  
**Document Purpose:** Detailed verification, reproduction steps, test results, and evidence  

---

## 1. DETAILED FUNCTIONAL VERIFICATION

### 1.1 Default Tenant Verification
- **Test Objective:** Verify that a default manufacturing plant is automatically selected and consistent.
- **Reproduction Steps:**
  1. Navigate to `/aquzio-integration/tenant-inventory` with no query parameters.
  2. Inspect the Plant dropdown selector.
  3. Reload the page with query parameter `?tenantId=3b9a7c21-12f4-4a88-912b-7c5f8841a123`.
- **Observed Result:**
  - When no `tenantId` query param is supplied, `TenantInventory.tsx:77-85` picks `list[0].id` (*Faiha Water Solutions*, `8714038a-36b0-4521-8b5e-9389ad045a65`) and sets the URL query.
  - When a valid `tenantId` query parameter exists, that tenant is loaded and restored consistently across page reloads.
- **Classification:** **VERIFIED**

### 1.2 Tenant Switching Verification
- **Test Objective:** Confirm that changing the tenant dropdown immediately reloads products, clears previous state, and prevents stale data.
- **Reproduction Steps:**
  1. On `/aquzio-integration/tenant-inventory`, select "Gangothri Aqua Tech" from the plant dropdown.
  2. Observe network calls and UI transition.
- **Observed Result:**
  - URL query updates to `?tenantId=3b9a7c21-12f4-4a88-912b-7c5f8841a123`.
  - `loadingInventory` state activates, displaying loading skeleton cards.
  - Faiha Water Solutions' materials (e.g. *1000 ML BOTTLE*) are immediately unmounted.
  - Gangothri's specific materials (*20L Blue Preforms 700g*, *20L Blue Snap Caps*, *Gangothri Branding Label Rolls*) render.
- **Classification:** **VERIFIED**

### 1.3 Dynamic Product & Material Loading
- **Test Objective:** Verify that finished goods and raw materials are separated and display dynamic units.
- **Observed Result:**
  - Section 1 renders finished commercial ready-to-dispatch 20L jars (`Jar` unit).
  - Section 2 renders raw materials with dynamic units (`PIECE`, `LITER`, `KG`, `ROLL`).
  - Search input filters materials by name, SKU, or category.
  - Low stock tags trigger dynamically when `availableQuantity <= reorderLevel`.
- **Classification:** **VERIFIED**

### 1.4 Add Stock Workflow Verification
- **Test Objective:** Execute an "Add Stock" transaction and observe validation, local balance mutation, and audit trail.
- **Reproduction Steps:**
  1. Click "Adjust Stock" in top navigation or on row `1000 ML BOTTLE`.
  2. Set Action to "Add Stock" (`ADD`), Quantity: `50`, Reason: "Supplier Inward / Delivery".
  3. Click "Confirm Adjustment".
- **Observed Result:**
  - Modal live preview displays: `987 LITER -> 1,037 LITER`.
  - Backend `POST /api/v1/integrations/biodrops/tenants/:tenantId/stock/adjust` responds HTTP 200:
    ```json
    {
      "success": true,
      "tenantId": "8714038a-36b0-4521-8b5e-9389ad045a65",
      "sku": "1000_ML",
      "previousQuantity": 987,
      "newQuantity": 1037,
      "unit": "LITER",
      "action": "ADD"
    }
    ```
  - Audit record created in PostgreSQL table `aquzio_sync_logs`.
  - Shadow override updates memory balance to 1,037 LITER.
  - *Limitation:* Does NOT update Aquzio Supabase database because upstream write API is not yet built.
- **Classification:** **PARTIALLY IMPLEMENTED (SHADOW PERSISTENCE ONLY)**

### 1.5 Edit Stock / Deduct Stock Verification
- **Test Objective:** Test stock deduction and verify that deductions exceeding available stock are rejected.
- **Reproduction Steps:**
  1. Click "Adjust" on item with 100 LITER available.
  2. Select "Deduct" (`DEDUCT`), enter `150`.
- **Observed Result:**
  - Frontend disables confirmation button and displays toast error: `Cannot deduct 150 LITER. Maximum available is 100 LITER.`
  - Backend unit test 28 confirms: `adjustTenantStock throws BadRequestException when deducting more than current balance`.
- **Classification:** **VERIFIED (VALIDATION & SHADOW LOGIC)**

### 1.6 Tenant Isolation & Cross-Tenant Access
- **Test Objective:** Attempt to adjust a SKU that does not belong to the target tenant.
- **Reproduction Steps:**
  - Dispatch adjustment for SKU `20L_BLUE_PREFORM` (belonging to Gangothri) targeting tenant `8714038a-36b0-4521-8b5e-9389ad045a65` (Faiha).
- **Observed Result:**
  - Backend responds HTTP 404: `Item with SKU "20L_BLUE_PREFORM" not found in tenant "8714038a-36b0-4521-8b5e-9389ad045a65" inventory.`
  - Cross-tenant contamination is strictly rejected.
- **Classification:** **VERIFIED**

### 1.7 API Failure Handling
- **Test Objective:** Verify system resilience when upstream Aquzio is unreachable or credentials are revoked.
- **Observed Result:**
  - Upstream live server at `https://aquora-backend.webziointernational.in` responded HTTP 403 `CREDENTIAL_REVOKED`.
  - Edrops caught the upstream error and served the local sandbox dataset. The UI remained fully functional without crash.
- **Classification:** **VERIFIED**

---

## 2. AUTOMATED TEST RESULTS & LOGS

### 2.1 Biodrops Integration Test Suite
- **Command:** `cd backend && npm test -- src/integrations/biodrops/biodrops.spec.ts`
- **Output:**
  ```text
  PASS src/integrations/biodrops/biodrops.spec.ts
    Aquora Biodrops Integration Security Audit & Test Suite
      ✓ 1. Valid new Aquora API credential: sets X-API-Key header properly (20 ms)
      ✓ 2. Missing API URL: fails safely with BadGatewayException (30 ms)
      ✓ 3. Missing API key: fails safely with BadGatewayException (7 ms)
      ✓ 4. Invalid API key: rejects request and throws BadGatewayException (6 ms)
      ✓ 5. Aquora 401 response: mapped to BadGatewayException without retrying (7 ms)
      ✓ 6. Aquora 403 response: mapped to BadGatewayException without retrying (5 ms)
      ✓ 7. Disabled tenant 404 response: handles NotFoundException cleanly (6 ms)
      ✓ 8. Connection refused: classifies error as CONNECTION_REFUSED with safe message (5 ms)
      ✓ 9. DNS failure: classifies error as DNS_RESOLUTION_FAILURE with safe message (5 ms)
      ✓ 10. Connection timeout: classifies error as CONNECTION_TIMEOUT with safe message (5 ms)
      ✓ 11. Tenant listing: retrieves and filters out disabled tenants (5 ms)
      ✓ 12. Inventory retrieval: retrieves finished products and raw materials (6 ms)
      ✓ 13. Stock summary: retrieves 20L totals and grouped materials (6 ms)
      ✓ 14. Dynamic raw material units: strictly isolates units without cross-unit summing (8 ms)
      ✓ 15. Upper Admin access: UPPER_ADMIN, SUPER_ADMIN, and Admin level > 1 permitted (6 ms)
      ✓ 16. Admin access: ADMIN role permitted (3 ms)
      ✓ 17. Staff access: STAFF role permitted (3 ms)
      ✓ 18. Unauthorized roles: MANAGER, CUSTOMER, DELIVERY_PARTNER, DISTRIBUTOR denied (HTTP 403) (12 ms)
      ✓ 19. Unauthenticated requests: null or empty user denied (HTTP 401) (4 ms)
      ✓ 20. API credential never exposed to frontend: responses contain zero API secrets (2 ms)
      ✓ 21. Canonical Aquzio configuration: AQUZIO_* takes precedence over AQUORA_* (2 ms)
      ✓ 22. Backward compatibility fallback: AQUORA_* works when AQUZIO_* is unset (3 ms)
      ✓ 23. Available quantity 0 is always flagged as isLowStock even if reorderLevel is 0 (4 ms)
      ✓ 24. Normalizes discrete packaging items mistakenly measured in liters to pcs (2 ms)
      ✓ 25. Corrects misclassified bottle/jar items from PREFORM to PACKAGING (2 ms)
      ✓ 26. Adjust stock (ADD): increases available quantity and updates shadow inventory (3 ms)
      ✓ 27. Adjust stock (SET): sets absolute available quantity (3 ms)
      ✓ 28. Adjust stock (DEDUCT): decreases stock and prevents negative balance (5 ms)
      ✓ 29. Adjust stock validation: rejects missing SKU or empty reason (8 ms)
      ✓ 30. Adjust stock tenant isolation: throws NotFoundException for invalid SKU (9 ms)

  Test Suites: 1 passed, 1 total
  Tests:       30 passed, 30 total
  ```

### 2.2 Global Test Suite & Static Check Summary
| Check | Total | Passed | Failed | Status |
|---|---|---|---|---|
| Biodrops Integration Tests | 30 | 30 | 0 | PASSED (100%) |
| Global Backend Jest Suites | 44 | 36 | 8 | PARTIAL (8 legacy mocks broken) |
| Frontend Dev Server (Vite) | 1 | 1 | 0 | OPERATIONAL |
| Frontend Strict Build (`tsc -b`) | 2 errors | 0 | 2 | FAILED (Unused imports) |
