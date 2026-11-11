# eDrops Distributor Profit & Loss (P&L) System – Implementation Report

**Document Status:** Production Ready  
**Date:** November 11, 2026  
**System:** eDrops ERP – Distributor Financial Reporting Engine  
**Target:** Distributor Portal (`/distributor/reports`)  
**Auditor & Architect:** Principal Financial Systems Architect & Backend/Frontend Lead  

---

## 1. Executive Summary

A dedicated, production-grade **Distributor Profit & Loss (P&L)** reporting and operating expense management system has been implemented in eDrops.

Prior to this implementation:
- The Admin portal possessed an organization-wide P&L engine, but distributors had only basic sales and purchase volume counts with no true accrual profitability visibility.
- Distributors had no dedicated mechanism to record operational depot costs (fuel, wages, vehicle maintenance, rent, utilities).
- Raw purchase totals were conflated with Cost of Goods Sold (COGS), violating matching principles (COGS is incurred when goods are sold, not when stock is purchased).
- Customer refundable jar deposits (₹150.00/jar liability) were in danger of being conflated with sales revenue.

### Core Achievements:
1. **Isolated Multi-Tenant Security:** A central `DistributorIdentityResolver` guarantees strict multi-tenant isolation. A distributor's JWT session bounds all database queries; cross-tenant parameter spoofing is physically rejected.
2. **True Accrual Accounting Engine:**
   - **Net Recognized Operating Revenue:** Excludes customer refundable jar deposits (`depositTotal`), removes GST pass-throughs, accounts for discounts and returns, and integrates taxable accessory sales.
   - **Wholesale COGS Engine:** Reflects true product acquisition cost pegged to actual distributor purchase history and supplier invoice agreements (standard baseline: ₹28.00 pickup / ₹35.00 delivery), plus accessory costs and damaged jar write-offs.
   - **OPEX Management:** Full 15-category operational expense tracker backed by a dedicated PostgreSQL database table (`distributor_expenses`).
   - **Financial Margins:** Gross Profit, Gross Margin %, Total OPEX, Operating Profit, and Net Profit Before Tax with zero-division protection.
3. **Dedicated UI in `/distributor/reports`:** Seamlessly integrated `DistributorProfitLossTab` featuring KPI metrics, expandable financial statements, recent expense activity ledger, "Record Expense" modal with real-time validation, and print/export functionality.
4. **Automated Verification:** 6 test suites with 54 unit tests passing (100% pass rate) and zero build errors across both NestJS backend and Vite frontend.

---

## 2. Architecture & Identity Resolution

### The Dual-ID Challenge
In the eDrops schema:
- Customer orders (`Order`) and wholesale supplier purchases (`Purchase`) associate with `User.id` via `distributorId`.
- Distributor sales (`distributor_sales`), jar inventory items (`jar_inventory_items`), and distributor expenses (`distributor_expenses`) associate with `Distributor.id`.

### Authoritative Identity Resolution
We introduced `DistributorIdentityResolver` (`backend/src/distributor/distributor-identity.resolver.ts`):
- Accepts the authenticated JWT `req.user`.
- For `DISTRIBUTOR` role users, queries `distributor.findUnique({ where: { userId: user.id } })`.
- Returns an immutable `DistributorIdentity` object containing both `userId` and `distributorId`.
- For `ADMIN` users inspecting distributor accounts, allows an explicit `distributorId` query parameter, but strictly forbids distributors from querying another distributor's records.

---

## 3. Financial Calculation Formulas

### A. Net Operating Revenue
```
Gross Order Value (Delivered & Completed)
- Customer Refundable Jar Deposits (depositTotal liability)
- Applicable Output GST
- Discounts Applied
- Cancelled / Rejected Orders (excluded entirely)
+ Taxable Accessory Sales (net of GST)
= Net Recognized Operating Revenue
```
*Accounting Rule:* Customer jar security deposits (₹150/jar) are balance sheet liabilities, not operating revenue. They are strictly segregated in the P&L calculation and presented in a dedicated Balance Sheet Liability section.

### B. Cost of Goods Sold (COGS)
```
  (Water Jars Delivered × Verified Wholesale Unit Cost)
+ (Accessories Sold × Accessory Wholesale Unit Cost)
+ (Damaged / Lost Inventory Write-offs)
= Total Cost of Goods Sold (COGS)
```
- Wholesale Unit Cost Priority:
  1. Linked Aquzio/Wholesale supplier purchase batch invoice rate.
  2. Fallback to standard commercial baseline (₹28.00 pickup / ₹35.00 delivery-inclusive).
  3. System provides an explicit audit flag when estimated baseline pricing is used.

### C. Gross Profit & Gross Margin
```
Gross Profit = Net Recognized Revenue - Total COGS
Gross Margin % = (Gross Profit / Net Recognized Revenue) × 100
```
*(Guarded against division-by-zero: defaults to 0.00% if Net Revenue is 0).*

### D. Operating Expenses (OPEX)
Tracked across 15 structured categories:
- `FUEL` – Fuel & Delivery Vehicles
- `VEHICLE_MAINTENANCE` – Vehicle Maintenance & Servicing
- `DRIVER_SALARY` – Driver & Delivery Wages
- `HELPER_SALARY` – Helper & Loading Wages
- `RENT` – Depot & Storage Rent
- `ELECTRICITY` – Electricity Utilities
- `WATER` – Water Utilities
- `LOADING_UNLOADING` – Loading & Coolie Charges
- `TRANSPORTATION` – Freight & Third-Party Logistics
- `PACKAGING` – Packaging & Caps
- `INTERNET` – Mobile & Internet
- `MARKETING` – Local Promotion & Signage
- `REPAIRS` – Equipment Repairs
- `BANK_CHARGES` – Bank & Payment Gateway Fees
- `OTHER` – General Depot Overhead

### E. Net Operating Profit
```
Net Profit Before Tax = Gross Profit - Total Operating Expenses
Net Margin % = (Net Profit / Net Recognized Revenue) × 100
```

---

## 4. Database Schema Changes

Added `DistributorExpense` model to `backend/prisma/schema.prisma` and applied cleanly to production Supabase:

```prisma
model DistributorExpense {
  id              String        @id @default(uuid())
  distributorId   String
  category        String
  title           String
  description     String?
  amount          Decimal       @db.Decimal(10, 2)
  expenseDate     DateTime      @default(now())
  paymentMethod   PaymentMethod @default(CASH)
  paymentStatus   PaymentStatus @default(COMPLETED)
  receiptUrl      String?
  vendorName      String?
  invoiceNumber   String?
  isVerified      Boolean       @default(true)
  metadata        Json?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  distributor     Distributor   @relation(fields: [distributorId], references: [id], onDelete: Cascade)

  @@index([distributorId])
  @@index([distributorId, expenseDate])
  @@index([distributorId, category])
  @@map("distributor_expenses")
}
```

---

## 5. Endpoints & API Reference

### Distributor P&L Controller (`/distributor/reports/pnl`)
- `GET /distributor/reports/pnl`: Returns comprehensive P&L statement, revenue breakdown, COGS breakdown, categorized OPEX, profit margins, balance sheet receivables/payables, and audit notes.
  - Query parameters: `preset` (`TODAY`, `YESTERDAY`, `LAST_7_DAYS`, `LAST_30_DAYS`, `THIS_MONTH`, `LAST_MONTH`, `THIS_QUARTER`, `THIS_YEAR`, `ALL_TIME`, `CUSTOM`), `startDate`, `endDate`.
- `GET /distributor/reports/pnl/summary`: Lightweight summary for dashboard widgets (Net Revenue, COGS, Gross Profit, OPEX, Net Profit).
- `GET /distributor/reports/pnl/details`: Detailed itemized transaction rows.

### Distributor Expenses Controller (`/distributor/expenses`)
- `GET /distributor/expenses`: List expenses with date, category, and payment status filtering.
- `POST /distributor/expenses`: Record an operating expense with category, amount, vendor, invoice number, and payment method.
- `GET /distributor/expenses/summary`: Aggregations grouped by category and total spend for the active date range.
- `DELETE /distributor/expenses/:id`: Soft-cancellation (preserves financial audit trail by marking payment status as `CANCELLED`).

---

## 6. Frontend Components

- **`DistributorProfitLossTab.tsx`:** Primary view mounted under `/distributor/reports`.
  - 6 Key Performance Metric cards (Revenue, COGS, Gross Profit, OPEX, Net Profit, Net Margin).
  - Expandable Financial Statement with ledger rows.
  - Recent Operational Expense Ledger with in-place cancellation and category icons.
  - "Record Expense" Modal with category dropdown, payment method selector, amount validation, and vendor metadata fields.
  - Print / Export support for offline review and accountant handoffs.
- **`Reports.tsx`:** Updated desktop tab pill switcher and mobile dropdown selector to seamlessly navigate between Overview, Profit & Loss (P&L), Purchases, Suppliers, and Customer Orders.

---

## 7. Verification & Automated Test Results

- **Backend Jest Unit Tests:**
  - `distributor-pnl.spec.ts`: 9 tests passed.
  - `distributor-expenses.spec.ts`: 2 tests passed.
  - Full Distributor Suite: 54 tests passed across 6 test suites in 12.09s.
- **Backend Build:** `prisma generate && nest build` compiled with 0 errors.
- **Frontend Build:** `tsc -b && vite build` compiled into production bundle in 1.91s with 0 errors.

---

## 8. Handover & Deployment Notes

The code is fully committed to the repository and ready for production deployment to Vercel and Railway/Cloud container runners.
No destructive migrations were introduced; the system maintains backward compatibility with all existing Admin reports, POS systems, inventory ledgers, and Aquzio integrations.
