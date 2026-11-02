# eDrops – Aquora Biodrops Production API Integration Documentation

## Overview
This document outlines the complete architectural implementation and upstream connection resolution for the Aquora Biodrops Production API integration in the eDrops platform. The integration connects eDrops to the live Aquora manufacturing service to monitor eligible finished 20L jars, dynamic raw material stocks, facility balances, and low-inventory reorder alerts.

---

## 1. Upstream Connectivity & Connection Resolution

### Root Cause of Initial HTTP 502 Failures:
- Initial default assumed port was `3001` with an unaligned demo API key.
- The actual running Aquora .NET Core API (`Aquora.API.exe`) listens on port **`5000`** (`http://127.0.0.1:5000`).
- The integration uses environment-driven API key authentication validated against Aquora.

### Current Configuration (`backend/.env`):
```env
# ==============================================================================
# AQUORA BIODROPS PRODUCTION API INTEGRATION
# ==============================================================================
AQUORA_BIODROPS_API_URL=https://aquora-backend.webziointernational.in/api/v1/integrations/biodrops
AQUORA_BIODROPS_API_KEY=<configured_aquora_api_key>
```

### Enhanced Error Classification & Logging:
[`BiodropsService`](file:///c:/Users/SINAN/Desktop/edrops/backend/src/integrations/biodrops/biodrops.service.ts) logs categorized diagnostics without leaking secrets:
- **`CONNECTION_REFUSED`**: Catches `ECONNREFUSED` when the Aquora host/port is inactive.
- **`DNS_RESOLUTION_FAILURE`**: Catches `ENOTFOUND` / `EAI_AGAIN` on invalid hostnames.
- **`CONNECTION_TIMEOUT`**: Catches `AbortError` / `ETIMEDOUT` after 10000ms.
- **`TLS_SSL_FAILURE`**: Catches certificate and handshake failures.
- **`[HTTP_AUTH_FAILURE]`**: Catches HTTP 401/403 (Invalid or revoked API key).
- **`[HTTP_NOT_FOUND]`**: Catches HTTP 404.
- **`[HTTP_RATE_LIMITED]`**: Catches HTTP 429.
- **`[HTTP_SERVER_ERROR]`**: Catches HTTP 500 / 5xx.

---

## 2. Access Control Matrix (Strict RBAC)

The entire integration is strictly restricted to **Upper Admin**, **Admin**, and **Staff** roles. All other authenticated roles and unauthenticated requests are rejected.

| Actor / Role | Backend Access | Frontend Navigation Menu | Direct URL Access |
|---|---|---|---|
| **Upper Admin** (`SUPER_ADMIN`, `UPPER_ADMIN`, or Admin `level > 1`) | **Allowed** (HTTP 200) | **Visible** | **Allowed** |
| **Admin** (`ADMIN`) | **Allowed** (HTTP 200) | **Visible** | **Allowed** |
| **Staff** (`STAFF`) | **Allowed** (HTTP 200) | **Visible** | **Allowed** |
| **Manager** (`MANAGER`) | **Denied** (HTTP 403) | **Hidden** | **Access Denied** (HTTP 403 Page) |
| **Customer** (`CUSTOMER`) | **Denied** (HTTP 403) | **Hidden** | **Access Denied** (HTTP 403 Page) |
| **Delivery Partner** (`DELIVERY_PARTNER`) | **Denied** (HTTP 403) | **Hidden** | **Access Denied** (HTTP 403 Page) |
| **Distributor** (`DISTRIBUTOR`) | **Denied** (HTTP 403) | **Hidden** | **Access Denied** (HTTP 403 Page) |
| **Unauthenticated User** | **Denied** (HTTP 401) | **Hidden** | **Redirect to `/login`** with return path |

### Backend Enforcement:
- Guard: [`BiodropsRoleGuard`](file:///c:/Users/SINAN/Desktop/edrops/backend/src/integrations/biodrops/biodrops-role.guard.ts)
- Applied at the controller level: `@UseGuards(AuthGuard('jwt'), BiodropsRoleGuard)`
- Reads role strictly from the verified JWT payload (`req.user.role`).
- Never trusts client-supplied headers or request body role fields.

### Frontend Enforcement:
- Guard: [`AquoraProtectedRoute`](file:///c:/Users/SINAN/Desktop/edrops/frontend/src/components/AquoraProtectedRoute.tsx)
- Custom branded HTTP 403 page: [`AccessDenied.tsx`](file:///c:/Users/SINAN/Desktop/edrops/frontend/src/pages/AccessDenied.tsx)
- Dynamic navigation generation in [`sidebarConfig.ts`](file:///c:/Users/SINAN/Desktop/edrops/frontend/src/components/common/sidebarConfig.ts)

---

## 3. Endpoints & Data Contracts

### 1. `GET /api/v1/integrations/biodrops/tenants`
- Proxies to Aquora `GET /tenants`
- Returns only tenants where Biodrops Production is enabled (`isBiodropsProduction: true` or `productionStatus: 'ACTIVE'/'ENABLED'`).
- Live sample tenants verified:
  - Faiha Water Solutions (`8714038a-36b0-4521-8b5e-9389ad045a65`)
  - Gangothri Aqua (`7cde4eab-7c29-4a2c-87cd-579071887701`)
  - Greenmount Aquaa (`3475f7bd-7f3e-423c-9048-47e6765a6d76`)
  - Greenway Manufactures (`35477107-72fc-447f-9f0a-00610529244d`)

### 2. `GET /api/v1/integrations/biodrops/tenants/:tenantId/inventory`
- Proxies to Aquora `GET /tenants/:tenantId/inventory`
- Extracts Finished Products: name, SKU, available stock, reserved stock, damaged stock, dynamic unit.
- Extracts Raw Materials: name, SKU, category, available quantity, used quantity, wasted quantity, dynamic unit, reorder level, and calculates `isLowStock`.

### 3. `GET /api/v1/integrations/biodrops/tenants/:tenantId/stock-summary`
- Proxies to Aquora `GET /tenants/:tenantId/stock-summary`
- **Crucial Rule**: Strictly groups raw materials by unit (e.g. `LITER`, `PIECE`, `ROLL`).
- **Never combines differing units into a single total.**
- Summarizes 20L finished jars, reserved stock, damaged stock, and low-stock alerts.

---

## 4. Verification Test Results

### 1. Live End-to-End Verification (`biodrops-live.spec.ts`):
```
PASS src/integrations/biodrops/biodrops-live.spec.ts
  Live Aquora Biodrops End-to-End Connectivity Verification
    √ 1. Successfully retrieves eligible Biodrops tenants from live Aquora backend (1518 ms)
    √ 2. Successfully retrieves selected tenant inventory from live Aquora backend (2056 ms)
    √ 3. Successfully retrieves stock summary from live Aquora backend with strict unit grouping (3836 ms)

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

### 2. RBAC & Security Test Suite (`biodrops.spec.ts`):
```
PASS src/integrations/biodrops/biodrops.spec.ts
  Aquora Biodrops Integration Module
    1. Access Control – CRITICAL RBAC REQUIREMENT
      √ Permits Upper Admin (UPPER_ADMIN role)
      √ Permits Upper Admin (SUPER_ADMIN role)
      √ Permits Upper Admin (Admin with level > 1)
      √ Permits Admin (ADMIN role)
      √ Permits Staff (STAFF role)
      √ Denies Manager role with HTTP 403 Forbidden
      √ Denies Customer role with HTTP 403 Forbidden
      √ Denies Delivery Partner role with HTTP 403 Forbidden
      √ Denies Distributor role with HTTP 403 Forbidden
      √ Denies Unauthenticated request with HTTP 401 Unauthorized
    2. Biodrops Tenants Endpoint (GET /api/v1/integrations/biodrops/tenants)
      √ Filters out disabled tenants and returns only production-enabled tenants
    3. Tenant Inventory Endpoint (GET /api/v1/integrations/biodrops/tenants/:tenantId/inventory)
      √ Returns finished products and raw materials with dynamic units
      √ Rejects disabled tenant inventory request with BadRequestException
    4. Stock Overview Endpoint (GET /api/v1/integrations/biodrops/tenants/:tenantId/stock-summary)
      √ Strictly groups raw materials by unit and NEVER combines different units
    5. Error Handling & Security Credentials Protection
      √ Transforms upstream 401/403 into BadGatewayException without exposing API credentials
      √ Handles connection timeouts and server unreachable states

Test Suites: 1 passed, 1 total
Tests:       16 passed, 16 total
```

### 3. Build Verification:
- Backend: `npm run build --prefix backend` $\to$ **Exit code 0**
- Frontend: `npm run build --prefix frontend` $\to$ **Exit code 0**
