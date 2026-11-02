# eDrops – Aquzio (formerly Aquora) Biodrops Production API Integration Documentation

## Overview
This document outlines the complete architectural implementation, naming transition, and upstream connection compatibility for the **Aquzio Biodrops Production API** integration in the eDrops platform. The integration connects eDrops to the live Aquzio manufacturing services to monitor eligible finished 20L jars, dynamic raw material stocks, facility balances, and low-inventory reorder alerts.

---

## 1. Naming Directive & Architectural Transition: Aquora to Aquzio

In accordance with the architectural directive, all internal integration identities, components, routes, types, and UI elements have been transitioned to **Aquzio** while preserving 100% backward compatibility for the existing upstream infrastructure.

### Upstream Compatibility Matrix

| Category | Legacy Identifier | Canonical Aquzio Identifier | Upstream Status |
|---|---|---|---|
| **Environment: Base URL** | `AQUORA_BIODROPS_API_URL` | `AQUZIO_BIODROPS_API_URL` | Upstream uses `https://aquzio-backend.webziotech.in/api/v1/integrations/biodrops`. Supported as fallback. |
| **Environment: API Key** | `AQUORA_BIODROPS_API_KEY` | `AQUZIO_BIODROPS_API_KEY` | Transmitted via `X-API-Key` header. Supported as fallback. |
| **Backend Service** | `BiodropsService.fetchFromAquora` | `BiodropsService.fetchFromAquzio` | `fetchFromAquora` delegates to `fetchFromAquzio`. |
| **API Endpoints** | `/api/v1/integrations/biodrops/*` | `/api/v1/integrations/biodrops/*` & `/api/v1/integrations/aquzio/*` | Upstream endpoint schema preserved identically. |
| **Frontend API** | `frontend/src/api/aquora.ts` | `frontend/src/api/aquzio.ts` | `aquora.ts` re-exports all types and methods from `aquzio.ts`. |
| **Frontend Route Guard** | `AquoraProtectedRoute` | `AquzioProtectedRoute` | `AquoraProtectedRoute.tsx` re-exports `AquzioProtectedRoute`. |
| **Frontend Layout** | `AquoraIntegrationLayout` | `AquzioIntegrationLayout` | `AquoraIntegrationLayout.tsx` re-exports `AquzioIntegrationLayout`. |
| **Frontend Routes** | `/aquora-integration/*` | `/aquzio-integration/*` | Both routes mounted; `/aquora-integration` aliases to Aquzio. |
| **Sidebar Navigation** | `AQUORA INTEGRATION` | `AQUZIO INTEGRATION` | Displayed to Upper Admin, Admin, and Staff. |
| **LocalStorage State** | `edrops_aquora_sidebar_collapsed` | `edrops_aquzio_sidebar_collapsed` | Reads Aquzio first, falls back to Aquora key. |

---

## 2. Configuration & Precedence Rules

The backend configuration resolver strictly adheres to the following precedence hierarchy:

1. **`AQUZIO_BIODROPS_API_URL` / `AQUZIO_BIODROPS_API_KEY`**: If set, this canonical configuration is used unconditionally.
2. **`AQUORA_BIODROPS_API_URL` / `AQUORA_BIODROPS_API_KEY`**: If the canonical variables are not set, the resolver transparently falls back to the legacy variables and emits a non-fatal deprecation warning in system logs:
   ```
   [CONFIG_DEPRECATION] AQUORA_BIODROPS_* environment variables are deprecated. Please migrate to AQUZIO_BIODROPS_*.
   ```
3. **Production Protocol & Safety Enforcement**:
   - Loopback addresses (`localhost`, `127.0.0.1`) are strictly rejected in production environments.
   - Non-HTTPS protocol URLs are rejected in production.
   - API keys are forwarded strictly server-side over HTTPS via the `X-API-Key` header; credentials are never serialized or leaked to client browsers.

---

## 3. End-to-End Workflows & Integration Points

1. **Tenants List (`GET /api/v1/integrations/biodrops/tenants`)**:
   Retrieves active co-packing facilities enabled for Biodrops production.
2. **Tenant Live Inventory (`GET /api/v1/integrations/biodrops/tenants/:tenantId/inventory`)**:
   Fetches finished 20L jars (available, reserved, damaged) and raw materials with units.
3. **Stock Summary (`GET /api/v1/integrations/biodrops/tenants/:tenantId/stock-summary`)**:
   Groups raw materials strictly by unit (`pcs`, `rolls`, `liters`) without cross-unit contamination, highlighting low-stock reorder thresholds.

---

## 4. Verification & Automated Test Status

- **`src/integrations/biodrops/biodrops.spec.ts`**: **22 tests passed** (including canonical precedence and backward-compatible fallbacks).
- **`src/biodrops/biodrops-ecosystem.spec.ts`**: **13 tests passed** (including contract manufacturing and distributor commerce).
- **`src/inventory/manufacturing-settlement.spec.ts`**: **9 tests passed** (legacy bottle and inventory settlement preserved).
- **Frontend Production Build**: `tsc -b && vite build` passed cleanly with exit code 0.

