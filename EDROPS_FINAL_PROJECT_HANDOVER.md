# EDROPS × AQUZIO FINAL PROJECT HANDOVER DOCUMENT

**Document Version:** 1.0.0  
**Date:** November 8, 2026  
**Audience:** Edrops Engineering Team, Aquzio Integration Team, Product Owners  
**Document Purpose:** System architecture handover, responsibility matrix, technical debt register, and implementation roadmap.  

---

## 1. CURRENT SYSTEM ARCHITECTURE

Edrops and Aquzio form a federated multi-tenant mineral water supply chain:
- **Aquzio (Upstream Factory Tier):** Operates on Supabase PostgreSQL. Source of truth for manufacturing plant tenants, raw material inward logistics, batch blending, bottling lines, and QC approvals.
- **Edrops (Downstream Commercial Tier):** Operates on PostgreSQL via Prisma ORM and NestJS. Manages commercial distributors, retail stores, home deliveries, vehicle fleets, subscriptions, customer wallets, and deposit tracking.
- **Integration Bridge:** Server-to-server REST communication authenticated with `X-API-Key` headers.

---

## 2. STATUS BREAKDOWN BY FEATURE

### COMPLETED AND VERIFIED
- Dynamic tenant switcher dropdown bound to URL query parameters (`?tenantId=<uuid>`).
- Automatic default tenant fallback logic (`list[0].id` when no query exists).
- Real-time inventory loading separating finished goods (20L jars) from dynamic raw materials.
- Client-side category filtering (`PREFORM`, `CAP`, `LABEL`, `CHEMICAL`) and search.
- Dynamic measurement unit rendering (`LITER`, `PIECE`, `KG`, `ROLL`, `Jar`).
- Stock adjustment modal supporting `ADD`, `SET`, and `DEDUCT` actions.
- Negative stock deduction safety checks (client and server).
- Strict Role-Based Access Control (`UPPER_ADMIN`, `ADMIN`, `STAFF` allowed; others blocked).
- Security isolation of upstream API keys (zero exposure to frontend clients).
- Audit trail logging to `AquzioSyncLog`.
- In-memory development fallback preventing downtime when upstream is revoked.
- 30/30 unit tests passing for the integration service.

### PARTIALLY IMPLEMENTED
- **Stock Write Persistence:** Stock adjustments currently update an in-memory shadow override map (`localStockOverrides`) and log to PostgreSQL audit table. Updates do not write to Aquzio's database because Aquzio has not implemented write APIs.

### MISSING FEATURES
- Upstream `POST /api/v1/integrations/biodrops/tenants/:tenantId/stock/adjust` on Aquzio.
- PostgreSQL-backed persistent shadow cache in Edrops (to persist across NestJS restarts).
- Webhook notification from Aquzio to Edrops when factory batches complete.

---

## 3. KNOWN BUGS & TECHNICAL DEBT REGISTER

| ID | Module | Severity | Description | Remediation |
|---|---|---|---|---|
| DEBT-01 | Frontend `TenantInventory.tsx` | LOW | Strict TypeScript build (`tsc -b`) flags 2 unused imports (`TrendingUp`, `FinishedProductItem`) | Remove unused imports from header of file |
| DEBT-02 | Backend Global Tests | MEDIUM | 8 unrelated test suites fail due to outdated mock providers (`NotificationService`, `AddressService`) | Update test module mock definitions |
| DEBT-03 | Shadow Cache Persistence | MEDIUM | `localStockOverrides` is stored in a JavaScript `Map`; server restart resets shadow balances | Store shadow balances in a dedicated PostgreSQL table |
| BUG-01 | Upstream Production Auth | HIGH | Live Aquzio API key is revoked (`CREDENTIAL_REVOKED`, HTTP 403) | Aquzio team must un-revoke or regenerate key |

---

## 4. TEAM RESPONSIBILITY MATRIX

### A. Aquzio Team Responsibilities
1. **API Key Management:** Un-revoke or issue a fresh production API key for the Edrops integration service.
2. **Develop Write API:** Implement `POST /api/v1/integrations/biodrops/tenants/:tenantId/stock/adjust` adhering to the contract in `EDROPS_AQUZIO_API_HANDOVER.md`.
3. **Database Concurrency:** Implement atomic row locking (`SELECT ... FOR UPDATE`) in Supabase PostgreSQL to prevent race conditions during high-speed stock adjustments.
4. **Tenant Isolation:** Enforce that mutations on SKU `X` are rejected if SKU `X` does not belong to `:tenantId`.

### B. Edrops Team Responsibilities
1. **Clean Unused Imports:** Remove the 2 unused imports in `TenantInventory.tsx` to restore clean production builds (`tsc -b`).
2. **Database Shadow Persistence:** Replace `localStockOverrides` in-memory Map with an indexed table `TenantStockOverride` in Prisma to persist overrides across restarts.
3. **Update Test Suites:** Refactor the 8 failing legacy mock test suites.
4. **Staging Handshake:** Test end-to-end stock sync once Aquzio deploys the write endpoint.

---

## 5. RECOMMENDED NEXT IMPLEMENTATION PHASES

```
Phase 1 (Immediate) --------> Phase 2 (Aquzio Dev) --------> Phase 3 (E2E Sync) --------> Phase 4 (Production)
Fix 2 TS imports              Implement POST /adjust        Connect Edrops to staging      Issue prod credentials
Clean legacy tests            Enforce RLS in Supabase       Test atomic concurrency        Deploy live sync
Add DB shadow table           Un-revoke API key             Verify reconciliation          Launch monitoring
```

---

## 6. FINAL HANDOVER SUMMARY

- **All code changes remain 100% local.** Zero commits or git pushes were executed.
- **All four comprehensive reports are generated and placed in the project root.**
