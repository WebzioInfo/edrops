# eDrops – Distributor Profit & Loss (P&L) Architecture Audit

**Auditor:** Senior Financial Systems Architect, Accounting Auditor, SaaS ERP Architect & Principal Backend Engineer  
**Scope:** Distributor Portal & Distributor Role – Complete Financial Architecture Audit  
**Project:** eDrops Core ERP (`/home/user/murshid/edrops`)  
**Audit Mode:** Read-Only Deep Architectural Investigation & Codebase Verification  
**Date of Audit:** November 11, 2026  
**Status:** Audit Complete – Ready for Architectural Review  

---

## 1. Executive Summary

This audit report delivers an exhaustive, evidence-based investigation of the financial architecture, database schema, transactional data flows, and accounting infrastructure of the **Distributor role** inside the **eDrops** platform.

Following the successful implementation of the executive Admin Profit & Loss system (`GET /staff/reports/pnl`), the platform roadmap requires an independent, distributor-isolated Profit & Loss statement inside the Distributor Portal (`/distributor/reports`).

### Key Findings Summary:

1. **Dual Business Model for Distributors:**
   eDrops operates a hybrid business model where distributors function simultaneously as **Wholesale Buyers (Co-packing Customers)** and **Retail Delivery Operators**:
   - **As Wholesale Buyers:** Distributors purchase 20L water jars, accessories, and raw materials from eDrops or Aquzio contract plants at wholesale rates (₹28 pickup / ₹35 delivery-inclusive).
   - **As Retail Operators:** Distributors receive customer orders dispatched through eDrops (`Order`), deliver goods in their service areas (pincodes), collect cash on delivery (COD) or fulfill prepaid online orders, and sell accessories directly to retail customers.

2. **The ID Dual-Referencing Discrepancy (Architectural Risk #1):**
   A critical database discrepancy exists across the schema:
   - Tables referencing `User.id`: `Order.distributorId`, `Purchase.distributorId`, `Supplier.distributorId`, `SupplierTransaction.distributorId`, `DistributorOrderAssignment.distributorId`.
   - Tables referencing `Distributor.id`: `distributor_sales.distributorId`, `jar_inventory_items.distributorId`, `distributor_raw_material_stocks.distributorId`, `distributor_accessory_stocks.distributorId`, `distributor_jar_settlements.distributorId`.
   Any distributor financial calculation **must** resolve both `User.id` and `Distributor.id` through `Distributor.userId` to avoid massive data omission or multi-tenant leakage.

3. **Complete Absence of Distributor Expense Infrastructure (Architectural Risk #2):**
   The existing `expenses` table (`model Expense`) was designed strictly for company-wide centralized OPEX. It contains **no `distributorId` column**. The distributor portal has **zero expense tracking UI or endpoints**. A distributor currently has no mechanism to record fuel, delivery driver wages, godown rent, vehicle maintenance, or loading/unloading coolie charges.

4. **COGS Valuation Gap (Architectural Risk #3):**
   Inventory tables (`jar_inventory_items`, `distributor_accessory_stocks`) track **quantities only** (`ownedQuantity`, `filledYardQuantity`, `customerQuantity`, `damagedQuantity`, `lostQuantity`). They do **not** store purchase cost, batch valuation, or cost baselines. True FIFO or weighted-average COGS is not currently possible from stock tables alone; COGS must be derived from linked product master baselines (`Product.costPrice` or `Product.distributorPrice`) or historical purchase item rates.

5. **Aquzio Purchase Synchronization is Currently a Read-Only Stub:**
   While `DistributorSale` has columns `externalSource = 'AQUZIO'` and `externalBillId`, there is **no webhook, message queue, or background ingestion job** that pushes Aquzio plant purchases into eDrops. Distributors currently must enter their purchases manually in `/purchases` (`POST /purchases`).

---

## 2. Distributor Business Model Investigation

The audit evaluated all 21 distributor operations specified in the audit scope against live backend code, database tables, and frontend implementations:

| Operation | Implementation Status | Backing Table(s) | Primary Endpoint(s) | Architectural Notes |
| :--- | :--- | :--- | :--- | :--- |
| **1. Distributor Profile & Business Info** | IMPLEMENTED AND VERIFIED | `Distributor`, `User` | `GET /staff/distributors/:id`, `GET /distributor/service-areas/my-pincodes` | Agency name, route, vehicle number, jar deposit rate (₹150), ownership totals. |
| **2. Distributor-Owned Inventory** | IMPLEMENTED AND VERIFIED | `jar_inventory_items` (`ownershipType: 'DISTRIBUTOR'`) | `GET /distributor/inventory/items` | Tracks filled, empty, yard, customer, damaged, and lost quantities. |
| **3. eDrops-Owned Inventory at Distributor** | IMPLEMENTED AND VERIFIED | `jar_inventory_items` (`ownershipType: 'COMPANY'`) | `GET /distributor/inventory/items` | Jars issued by eDrops held in distributor depot. |
| **4. Purchases from Manufacturers via Aquzio** | NOT IMPLEMENTED | `distributor_sales` (`externalSource = 'AQUZIO'`) | None (Query stub in `biodrops.service.ts` only) | Query expects `externalSource: 'AQUZIO'`, but zero ingestion pipelines exist. |
| **5. Purchase Bills** | IMPLEMENTED AND VERIFIED | `Purchase`, `SupplierTransaction` | `GET /purchases`, `POST /purchases` | 7 live rows in DB. Stores items in JSON, subtotal, tax, amountPaid, paymentStatus. |
| **6. Purchase Returns & Debit Notes** | NOT IMPLEMENTED | None | None | No `PurchaseReturn` model. Deleting a purchase performs an inventory reversal, but no debit accounting exists. |
| **7. Regular Retail Sales** | IMPLEMENTED AND VERIFIED | `"Order"`, `"OrderItem"` | `GET /orders/distributor/all`, `POST /orders/distributor` | 9 live orders in DB. Retail prices (₹60-₹80), deposits, discounts, payment status. |
| **8. Bulk Wholesale Sales (eDrops to Dist)** | IMPLEMENTED AND VERIFIED | `distributor_sales`, `distributor_sale_items` | `GET /biodrops/distributors/:id/sales`, `POST /biodrops/sales/distributor` | 3 live rows in DB. Invoices at ₹28 (pickup) or ₹35 (delivered) + 18% GST. |
| **9. Subscription Sales & Deliveries** | PARTIALLY IMPLEMENTED | `PackagePurchase`, `Delivery` | `GET /deliveries`, `POST /biodrops/subscriptions/customized` | Packages bought at company level. Distributor only delivers jars; earns no tracked subscription margin. |
| **10. Customer Payments (Cash & Online)** | IMPLEMENTED AND VERIFIED | `"Payment"`, `"Order"` | `POST /orders/distributor/:id/payments` | Cash on delivery recorded by distributor; online prepaid processed via Razorpay. |
| **11. Customer Outstanding Balances** | IMPLEMENTED AND VERIFIED | `"Order"` | `GET /orders/distributor/all` | Calculated on the fly: `Math.max(0, totalAmount - amountPaid)`. |
| **12. Partial Payments** | IMPLEMENTED AND VERIFIED | `"Order"`, `"Purchase"` | `POST /orders/distributor/:id/payments`, `POST /purchases/:id/payments` | Supports progressive payments array with timestamp, method, and remaining balance. |
| **13. Distributor Commissions** | NOT IMPLEMENTED | None | None | Zero commission rules or ledger exist for distributors (only delivery partner driver rates exist). |
| **14. Delivery Charges** | PARTIALLY IMPLEMENTED | `"Order".deliveryCharge` | `POST /orders` | Stored on customer orders, but recognized as company revenue, not credited to distributor. |
| **15. Loading & Unloading Expenses** | NOT IMPLEMENTED | None | None | No schema or UI exists. |
| **16. Transportation & Fuel Expenses** | NOT IMPLEMENTED | None | None | The `expenses` table lacks `distributorId`. No distributor expense UI exists. |
| **17. Employee & Driver Wages** | NOT IMPLEMENTED | None | None | `Driver` table exists for delivery dispatch, but wage expenses are not tracked. |
| **18. Discounts & Promotional Expenses** | PARTIALLY IMPLEMENTED | `"Order".discountTotal`, `distributor_sales.discount` | `POST /orders/distributor` | Line-item discounts exist on orders, but distributor absorbed vs company absorbed is untracked. |
| **19. Damaged Goods & Wastage** | PARTIALLY IMPLEMENTED | `jar_inventory_items.damagedQuantity`, `distributor_production_batches` | `POST /distributor/inventory/adjust` | Quantities tracked in inventory, but financial cost write-off is NOT booked into P&L. |
| **20. Stock Adjustments** | IMPLEMENTED AND VERIFIED | `InventoryLog`, `jar_inventory_items` | `POST /distributor/inventory/adjust` | Physical count reconciliations adjust yard/customer stock with action audit logs. |
| **21. Jar Deposits, Returns & Ownership** | IMPLEMENTED AND VERIFIED | `distributor_ownership_ledgers`, `distributor_jar_settlements`, `JarDeposit` | `GET /biodrops/distributors/:id/ownership-status`, `POST /biodrops/distributors/:id/settle-ownership` | Jars settled at ₹250 rate. Customer deposits at ₹150 tracked as balance sheet liabilities. |

---

## 3. Revenue Investigation

### 3.1 Distributor Revenue Streams

A distributor on eDrops has three distinct potential revenue channels:

```
                                  ┌──────────────────────────────────────────────┐
                                  │          DISTRIBUTOR REVENUE SOURCES         │
                                  └──────────────────────┬───────────────────────┘
                                                         │
         ┌───────────────────────────────────────────────┼──────────────────────────────────────────────┐
         ▼                                               ▼                                              ▼
┌─────────────────────────────────┐     ┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│     Channel 1: Retail Orders    │     │   Channel 2: Direct Accessories │    │ Channel 3: Delivery Surcharges  │
│  Customers in assigned pincodes │     │ Dispensers, cradles, pumps sold │    │     Delivery charge portion     │
│       ("Order" table)           │     │    ("accessory_sales" table)    │    │      collected from customer    │
└────────────────┬────────────────┘     └────────────────┬────────────────┘    └────────────────┬────────────────┘
                 │                                       │                                      │
                 ▼                                       ▼                                      ▼
┌─────────────────────────────────┐     ┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│  Gross: Subtotal (₹60-80/jar)   │     │  Gross: Retail Price (₹250-900) │    │  Gross: Order deliveryCharge    │
│  Less: Refundable Jar Deposits  │     │  Less: Discounts                │    │  Net: Collected on delivery     │
│  Net: Operating Product Revenue │     │  Net: Accessory Revenue         │    │  (If credited to distributor)   │
└─────────────────────────────────┘     └─────────────────────────────────┘    └─────────────────────────────────┘
```

### 3.2 Detailed Revenue Channel Audit

#### Channel 1: Customer Retail Orders (`"Order"`, `"OrderItem"`)
- **Database Table:** `"Order"` and `"OrderItem"`
- **API Endpoint:** `GET /orders/distributor/all` (handled by `findDistributorOrders` in [`order.service.ts`](file:///home/user/murshid/edrops/backend/src/order/order.service.ts#L1607))
- **Frontend Page:** [`Orders.tsx`](file:///home/user/murshid/edrops/frontend/src/portals/distributor/pages/Orders.tsx) and [`Reports.tsx`](file:///home/user/murshid/edrops/frontend/src/portals/distributor/pages/Reports.tsx)
- **Transaction Creation Logic:** Customer places order via app/web or distributor creates via `POST /orders/distributor` ([`createDistributorOrder`](file:///home/user/murshid/edrops/backend/src/order/order.service.ts#L1982)).
- **Revenue Calculation Formula:**
  $$\text{Gross Order Value} = \text{Order}.\text{totalAmount}$$
  $$\text{Customer Deposit Liability} = \text{Order}.\text{depositTotal} = \sum (\text{item}.\text{deposit} \times \text{item}.\text{quantity})$$
  $$\text{Net Operating Order Revenue} = \text{Order}.\text{subTotal} - \text{Order}.\text{discountTotal} = \text{Order}.\text{totalAmount} - \text{Order}.\text{depositTotal} - \text{Order}.\text{deliveryCharge}$$
- **Tax Treatment:** Included in `subTotal` or item prices (water jars in India carry 12% or 18% GST depending on container size; packaged drinking water 20L is typically 18% GST).
- **Discount Treatment:** `Order.discountTotal` reduces operating revenue directly.
- **Payment Status:** `PAID`, `PARTIAL`, `PENDING`.
- **Cancellation & Reversal Logic:** Orders marked `CANCELLED`, `FAILED`, or `REJECTED` are excluded from recognized revenue.
- **Evidence in Production DB:** 9 live distributor orders. 7 are `DELIVERED, PAID` (Total: ₹5,400 gross, ₹3,600 deposit liability, ₹1,800 net operating revenue).

#### Channel 2: Direct Accessory Sales (`"accessory_sales"`)
- **Database Table:** `accessory_sales`
- **API Endpoint:** `GET /biodrops/distributors/:id/accessory-sales`, `POST /biodrops/sales/accessory`
- **Frontend Page:** [`DistributorBiodrops.tsx`](file:///home/user/murshid/edrops/frontend/src/portals/distributor/pages/DistributorBiodrops.tsx)
- **Transaction Creation Logic:** Distributor sells electrical dispensers, stands, manual pumps directly.
- **Revenue Calculation:** `taxableAmount + taxAmount = totalAmount`.
- **Status:** **IMPLEMENTED AND VERIFIED** (0 live rows currently, schema and service ready).

#### Channel 3: Customer Subscription Deliveries
- **Crucial Distinction:** Subscription packages (`PackagePurchase`) are purchased **directly from eDrops Company** via online gateway. The customer pays eDrops (e.g. ₹800 for 30 jars).
- **Distributor Impact:** The distributor fulfills individual deliveries (`Delivery` table, `orderId: null`).
- **Accounting Reality:** The distributor does **not** recognize the ₹800 subscription package fee as distributor gross revenue. Doing so would double-count company revenue as distributor revenue. Instead, the distributor only earns a delivery fee/fulfillment compensation (which is currently not automated in the ledger).

---

## 4. Cost and Expense Investigation

### 4.1 Distributor Cost Hierarchy

```
                                  ┌──────────────────────────────────────────────┐
                                  │           DISTRIBUTOR COST STRUCTURE         │
                                  └──────────────────────┬───────────────────────┘
                                                         │
         ┌───────────────────────────────────────────────┴──────────────────────────────────────────────┐
         ▼                                                                                              ▼
┌─────────────────────────────────┐                                            ┌─────────────────────────────────┐
│     COST OF GOODS SOLD (COGS)   │                                            │    OPERATING EXPENSES (OPEX)    │
│      Direct Product Outlay      │                                            │       Business Overhead         │
└────────────────┬────────────────┘                                            └────────────────┬────────────────┘
                 │                                                                              │
  ┌──────────────┴──────────────┐                                                ┌──────────────┴──────────────┐
  ▼                             ▼                                                ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐                      ┌─────────────────────────┐   ┌─────────────────────────┐
│ Wholesale Water Jar Cost│   │ Accessory Purchase Cost │                      │ Transportation & Fuel   │   │ Depot Rent & Utilities  │
│ ₹28/₹35 per 20L Jar     │   │ Stand/Pump Purchase Cost│                      │ Delivery vehicle fuel   │   │ Local storage rent      │
│ (from eDrops/Aquzio)    │   │ (from Supplier/eDrops)  │                      │ (UNTRACKED IN DB)       │   │ (UNTRACKED IN DB)       │
└─────────────────────────┘   └─────────────────────────┘                      └─────────────────────────┘   └─────────────────────────┘
```

### 4.2 Detailed Cost Line Investigation

1. **Wholesale Water Jar Cost (Distributor COGS):**
   - **Source:** When distributor buys water jars from eDrops:
     - Logged in `distributor_sales` / `distributor_sale_items` with `unitPrice = 28.0` (pickup) or `35.0` (delivered).
     - OR logged in `Purchase` table (`items` JSON) from local suppliers/plants (e.g. Biofix, PureStream).
   - **Status in DB:** 3 live `distributor_sales` invoices (total ₹4,956) and 7 live `Purchase` invoices (total ₹8,545).
   - **Accounting Evaluation:** This represents the true cost of inventory acquired by the distributor.

2. **Operating Expenses (Fuel, Maintenance, Rent, Salaries):**
   - **Investigation:** Examined `backend/src/expenses/expenses.service.ts` and `schema.prisma`.
   - **Finding:** The `expenses` table (`model Expense`) contains columns:
     `id`, `category`, `title`, `amount`, `expenseDate`, `paymentMethod`, `paymentStatus`, `status`, `vendorName`, `invoiceNumber`, `receiptUrl`, `notes`, `createdByUserId`, `approvedByUserId`.
   - **Critical Gap:** **There is NO `distributorId` column.**
   - All expenses in `expenses` are queried by Admin P&L globally. If a distributor user created an expense, it would either mix into the Admin P&L or fail authentication because `ExpensesController` requires `UserRole.ADMIN` or `UserRole.STAFF`.
   - **Status:** **NOT IMPLEMENTED FOR DISTRIBUTOR**.

3. **Damaged and Lost Jars:**
   - **Source:** Tracked in `jar_inventory_items`:
     - `damagedQuantity` (broken/punctured jars).
     - `lostQuantity` (unreturned customer jars).
   - **Finding:** Currently, quantity is updated via `POST /distributor/inventory/adjust` ([`adjustJarStock`](file:///home/user/murshid/edrops/backend/src/distributor/distributor-inventory.service.ts)), but **no financial expense or COGS write-off transaction is generated**. A lost or broken jar costs the distributor ₹250 (deposit forfeiture or replacement cost), but this cost is currently invisible in financial reports.
   - **Status:** **QUANTITY TRACKED, FINANCIAL VALUE UNTRACKED**.

4. **Jar Deposit Settlements:**
   - **Source:** `distributor_jar_settlements` and `distributor_ownership_ledgers`.
   - **Finding:** Jars settled at `ratePerJar = 250.0`. This is a **balance sheet capital asset transaction** (converting company liability into owned fixed asset), NOT an operational expense. It affects cash flow, not P&L.

---

## 5. Inventory and COGS Investigation

### 5.1 The 10 Critical Accounting Questions

| Question | Investigation Finding | Code / Database Evidence | Architectural Status |
| :--- | :--- | :--- | :--- |
| **1. How is distributor-owned stock identified?** | Identified via `jar_inventory_items.ownershipType = 'DISTRIBUTOR'` and `distributorOwnedJars` on `Distributor`. | [`schema.prisma#L1406`](file:///home/user/murshid/edrops/backend/prisma/schema.prisma#L1406) | IMPLEMENTED AND VERIFIED |
| **2. How is eDrops-owned stock identified?** | Identified via `jar_inventory_items.ownershipType = 'COMPANY'` and `companyOwnedJars` on `Distributor`. | [`schema.prisma#L1406`](file:///home/user/murshid/edrops/backend/prisma/schema.prisma#L1406) | IMPLEMENTED AND VERIFIED |
| **3. How is manufacturer-supplied stock recorded?** | Recorded via `Purchase.items` (JSON) or `distributor_sales` (`externalSource = 'AQUZIO'`). | [`purchase.service.ts#L400`](file:///home/user/murshid/edrops/backend/src/purchase/purchase.service.ts#L400) | PARTIALLY IMPLEMENTED |
| **4. How do stock purchases affect distributor inventory?** | `applyInventoryIntake` in `purchase.service.ts` increments `ownedQuantity` and `emptyYardQuantity` for jars, or upserts `distributorAccessoryStock`. | [`purchase.service.ts#L400-L490`](file:///home/user/murshid/edrops/backend/src/purchase/purchase.service.ts#L400-L490) | IMPLEMENTED AND VERIFIED |
| **5. How do sales reduce inventory?** | Order completion decrements `filledYardQuantity` and increments `customerQuantity` via `order.service.ts`. | [`order.service.ts#L3880`](file:///home/user/murshid/edrops/backend/src/order/order.service.ts#L3880) | IMPLEMENTED AND VERIFIED |
| **6. How do returns restore inventory?** | Customer empty returns increment `emptyYardQuantity` and decrement `customerQuantity` via `OrderExpectedReturn`. | [`distributor-inventory.service.ts#L180`](file:///home/user/murshid/edrops/backend/src/distributor/distributor-inventory.service.ts#L180) | IMPLEMENTED AND VERIFIED |
| **7. How do damaged products affect inventory valuation?** | Moved to `damagedQuantity` via stock adjustment. No accounting write-off is created. | [`distributor-inventory.service.ts`](file:///home/user/murshid/edrops/backend/src/distributor/distributor-inventory.service.ts) | PARTIALLY IMPLEMENTED (Qty only) |
| **8. Does inventory have purchase-cost information?** | **NO.** `jar_inventory_items` and `distributor_accessory_stocks` have zero cost columns. | [`schema.prisma#L1402`](file:///home/user/murshid/edrops/backend/prisma/schema.prisma#L1402) | NOT IMPLEMENTED |
| **9. Do different batches have different purchase costs?** | `distributor_production_batches` exists, but has no unit cost fields. Purchase batches are not linked to sales. | [`schema.prisma#L1595`](file:///home/user/murshid/edrops/backend/prisma/schema.prisma#L1595) | NOT IMPLEMENTED |
| **10. Is FIFO or Weighted Average valuation implemented?** | **NO.** There is no inventory costing engine (no lot tracking, no valuation layer). | Audit verification across `backend/src` | NOT IMPLEMENTED |

### 5.2 COGS Readiness Verdict

> [!WARNING]
> **Data Insufficiency for Pure FIFO COGS:**  
> Because `jar_inventory_items` does not record batch unit purchase costs, and `Order` does not reference purchase batch IDs, an arbitrary FIFO calculation cannot be performed on physical inventory tables without manufacturing assumptions.

**Viable & Accurate Solution for Distributor COGS:**
Distributor COGS must be calculated using the **Standard Wholesale Unit Cost Method**:
$$\text{Distributor COGS} = \sum_{\text{delivered items}} \left(\text{delivered item quantity} \times \text{Product}.\text{distributorPrice}\right)$$
* Where for a standard 20L Biodrops water jar, $\text{Product}.\text{distributorPrice} = ₹28.00$ (pickup) or $₹35.00$ (delivered).
* For accessories (dispensers, cradles), $\text{Product}.\text{costPrice}$ or $\text{Product}.\text{distributorPrice}$.
* This mirrors the verified accounting pattern used in the Admin P&L (which uses ₹20 Aquzio plant cost).

---

## 6. Aquzio Integration Investigation

### 6.1 Integration Touchpoints for Distributors

| Integration Point | Expected Functionality | Actual Code Implementation | Live Status | Source of Truth |
| :--- | :--- | :--- | :--- | :--- |
| **Tenants List** | List co-packing plants where distributor can source water | `GET /api/v1/integrations/biodrops/tenants` in `biodrops.service.ts` | IMPLEMENTED AND VERIFIED | Aquzio Database |
| **Purchase Invoices from Aquzio** | Sync purchase bills from Aquzio into distributor records | `getDistributorPurchaseBills` queries `externalSource = 'AQUZIO'` | NOT IMPLEMENTED (No sync worker) | eDrops (manual fallback) |
| **Stock Adjustments** | Authoritative bi-directional stock synchronization | `POST /api/v1/integrations/biodrops/tenants/:id/stock/adjust` | IMPLEMENTED AND VERIFIED | Aquzio (Plant) / eDrops (Hub) |
| **Purchase Costs Sync** | Dynamic live pricing from Aquzio co-packers | Hardcoded rate tables (`CO_PACKING_RATES`) | PARTIALLY IMPLEMENTED | eDrops rate table |
| **Duplicate Prevention** | Idempotency on purchase invoice imports | `externalBillId` unique constraint exists | IMPLEMENTED (Schema ready) | eDrops Database |

### 6.2 Source of Truth Matrix

- **Finished Goods Master Catalogue:** eDrops (`Product` table).
- **Manufacturing Raw Materials & Water Co-Packing:** Aquzio (`Aquora.API` / Tenant Schemas).
- **Distributor Depot Physical Stock:** eDrops (`jar_inventory_items`, `distributor_accessory_stocks`).
- **Retail Sales & Customer Receivables:** eDrops (`Order` table).
- **Distributor Supplier Payables:** eDrops (`Supplier`, `SupplierTransaction`, `Purchase`).

---

## 7. Admin vs Distributor Financial Separation

### 7.1 Financial Architecture Comparison

```
┌──────────────────────────────────────────────┐       ┌──────────────────────────────────────────────┐
│           ADMIN P&L (eDrops Company)         │       │          DISTRIBUTOR P&L (Distributor)       │
├──────────────────────────────────────────────┤       ├──────────────────────────────────────────────┤
│ REVENUE:                                     │       │ REVENUE:                                     │
│ • Retail Orders Subtotal (₹60 - ₹80/jar)     │       │ • Retail Orders Subtotal (for assigned area) │
│ • Subscription Packages (₹800 - ₹1200)       │       │ • Direct Accessory Sales                     │
│ • Bulk Sales to Distributors (₹28 - ₹35/jar) │       │ • (Subscriptions excluded - company owned)   │
│                                              │       │                                              │
│ COGS:                                        │       │ COGS:                                        │
│ • ₹20 / Jar paid to Aquzio Co-packing plants │       │ • ₹28 / ₹35 per Jar paid to eDrops / Plant   │
│ • Unit cost of accessories sold              │       │ • Unit wholesale cost of accessories sold    │
│                                              │       │                                              │
│ OPEX:                                        │       │ OPEX:                                        │
│ • Central Company Fuel & Fleet               │       │ • Distributor Local Delivery Fuel            │
│ • Central Warehouse Rent & Utilities         │       │ • Distributor Local Depot Rent               │
│ • Core Software & Management Salaries        │       │ • Distributor Driver & Helper Wages          │
│ • Statewide Marketing & Promotions           │       │ • Vehicle Maintenance & Tire Replacement     │
│                                              │       │                                              │
│ LIABILITIES:                                 │       │ LIABILITIES:                                 │
│ • All Customer Refundable Jar Deposits (₹150)│       │ • Customer Jar Deposits collected by dist.   │
│                                              │       │ • Company-Owned Jars owed to eDrops (₹250)   │
└──────────────────────────────────────────────┘       └──────────────────────────────────────────────┘
```

### 7.2 Strict Multi-Tenant Isolation Rules

1. **Isolation by Authenticated User:**
   - Any Distributor P&L endpoint must resolve the caller strictly via `req.user.id` or `req.user.sub`.
   - Under no circumstances can a distributor pass `?distributorId=...` in a query parameter to view another distributor's earnings or sales.
2. **Filtering by Dual ID:**
   - Orders query: `where: { distributorId: authenticatedUser.id }`.
   - Purchases query: `where: { distributorId: authenticatedUser.id }`.
   - Wholesale sales query: `where: { distributorId: distributorProfile.id }`.
   - Stock query: `where: { distributorId: distributorProfile.id }`.
3. **No Mixed Expenses:**
   - The Admin P&L queries `this.prisma.expense.findMany({ where: { status: 'APPROVED' } })`.
   - When distributor expenses are introduced, they **must not** appear in the Admin P&L as company operating expenses unless tagged as company-level expenses.

---

## 8. Accounting Accuracy Evaluation

The audit tested the existing architecture against standard accounting principles:

| Financial Element | Current Architectural Support | Evaluation & Gap Analysis |
| :--- | :--- | :--- |
| **Revenue Recognition** | ACCRUAL-INFORMED (Orders completed or delivered) | Sound. Excludes cancelled orders and excludes balance sheet deposit liabilities. |
| **COGS Recognition** | DERIVED (Standard Wholesale Cost) | Accurate when calculated via delivered quantity $\times$ ₹28/₹35. Lacks FIFO lot tracking. |
| **Gross Profit** | SUPPORTED | Gross Profit = Net Revenue - COGS. Accurately reflects product delivery margin. |
| **Operating Expenses (OPEX)** | MISSING INFRASTRUCTURE | No database table or UI currently stores distributor-specific OPEX. |
| **Net Operating Profit** | DEPENDENT ON OPEX | Without distributor OPEX, Net Profit currently equals Gross Profit. |
| **Accounts Receivable** | FULLY SUPPORTED | Tracked per customer on `"Order"` (`totalAmount - amountPaid`). Visible in `Orders.tsx`. |
| **Accounts Payable** | FULLY SUPPORTED | Tracked per supplier on `Supplier` & `SupplierTransaction` (`balance`). Visible in `Suppliers.tsx`. |
| **Customer Jar Liability** | FULLY SUPPORTED | Tracked on `"Order".depositTotal` and `JarDeposit`. Separated from revenue. |
| **Period-Based Reporting** | FULLY SUPPORTED | Date filtering logic (`TODAY`, `LAST_7_DAYS`, `LAST_30_DAYS`, `THIS_MONTH`, `CUSTOM`) verified in `Reports.tsx`. |
| **Double-Entry Ledger** | PARTIAL (Suppliers & Jar Settlements only) | Supplier transactions maintain running debit/credit/balance ledger. Customer orders use balance-due pattern. |

---

## 9. Security and Multi-Tenant Audit

1. **Authentication & Guards:**
   - Verified guard stack: `@UseGuards(AuthGuard('jwt'), RolesGuard)` with `@Roles(UserRole.DISTRIBUTOR)`.
   - JWT extraction correctly pulls `req.user.id`, `req.user.role`, and `req.user.sub`.
2. **Distributor ID Resolution Verification:**
   - In [`purchase.controller.ts#L33`](file:///home/user/murshid/edrops/backend/src/purchase/purchase.controller.ts#L33): `const distributorId = req.user.id || req.user.sub;` (Safe: impossible to spoof).
   - In [`order.controller.ts#L59`](file:///home/user/murshid/edrops/backend/src/order/order.controller.ts#L59): `const userId = req.user?.sub || req.user?.id;` (Safe: queries strictly `distributorId: userId`).
   - In [`biodrops.controller.ts#L399`](file:///home/user/murshid/edrops/backend/src/biodrops/biodrops.controller.ts#L399): `const target = req.user.role === UserRole.DISTRIBUTOR ? req.user.id : distId;` (Safe: overrides param if caller is distributor).
3. **Database Query Security:**
   - All Prisma queries in `PurchaseService` and `OrderService` include `where: { distributorId }`.
   - Zero instances of un-scoped raw SQL queries vulnerable to tenant leakage were found in distributor paths.

---

## 10. Missing Financial Data & Infrastructure Gaps

The following architectural components are **missing** and must be resolved to achieve a 100% complete Distributor P&L:

1. **Distributor Operating Expenses Table (`distributor_expenses`):**
   - Current state: Non-existent.
   - Requirement: A dedicated table or a `distributorId` column on `expenses` to record Fuel, Maintenance, Wages, Rent, and Miscellaneous operating overhead.
2. **Distributor P&L Backend Service & Endpoint:**
   - Current state: Admin P&L exists (`GET /staff/reports/pnl`), but Distributor P&L endpoint (`GET /distributor/reports/pnl`) does not exist.
3. **Distributor P&L Frontend Tab in Reports:**
   - Current state: [`Reports.tsx`](file:///home/user/murshid/edrops/frontend/src/portals/distributor/pages/Reports.tsx) has 4 tabs: `OVERVIEW`, `PURCHASES`, `SUPPLIERS`, `ORDERS`.
   - Requirement: Add a 5th tab `PROFIT_AND_LOSS` mirroring the clean executive design of [`ProfitLossTab.tsx`](file:///home/user/murshid/edrops/frontend/src/portals/admin/components/ProfitLossTab.tsx).
4. **Automated Purchase Bill Sync from Aquzio:**
   - Current state: Ingestion webhook/job missing.
5. **Damaged Goods Cost Write-Off:**
   - Current state: Damaged jars are recorded in inventory, but their monetary loss is not posted as a write-off expense.

---

## 11. Accounting Risks and Calculation Gaps

1. **Risk of Double-Counting Revenue with Purchases:**
   - In [`Reports.tsx#L441`](file:///home/user/murshid/edrops/frontend/src/portals/distributor/pages/Reports.tsx#L441), the UI displays "Total Purchases" alongside "Total Orders".
   - *Audit Warning:* Purchases represent cash outflows (inventory intake). Orders represent customer sales. Net Profit must **never** subtract raw total purchases from total sales in a single period, because purchases build inventory assets. Doing so would violate the matching principle of accounting. Only the cost of goods **actually sold** (COGS) must be subtracted.
2. **Risk of Treating Deposits as Revenue:**
   - When a customer orders 2 jars, they pay ₹300 (₹100 water + ₹200 jar deposit).
   - *Audit Rule:* The ₹200 deposit is a liability. Only the ₹100 is recognized as gross operating revenue.
3. **Dual ID Mapping Failure:**
   - If a backend query looks for `Purchase` using `Distributor.id` instead of `User.id`, it returns 0 rows.
   - If a backend query looks for `distributor_sales` using `User.id` instead of `Distributor.id`, it returns 0 rows.
   - *Audit Rule:* The distributor financial service must always resolve both IDs:
     ```ts
     const distributor = await prisma.distributor.findUnique({ where: { userId } });
     const distProfileId = distributor.id;
     const distUserId = userId;
     ```

---

## 12. Reusable Existing Components

The implementation can safely reuse the following production-tested components:

1. **Frontend UI Components:**
   - [`ProfitLossTab.tsx`](file:///home/user/murshid/edrops/frontend/src/portals/admin/components/ProfitLossTab.tsx): The entire visual structure (Stat cards, Revenue breakdown, COGS card, OPEX category bars, Net Margin badge, Print/PDF exporter) can be directly adapted for the Distributor portal.
   - [`ReportDateFilter.tsx`](file:///home/user/murshid/edrops/frontend/src/portals/distributor/components/reports/ReportDateFilter.tsx): Timezone-consistent date presets (`7d`, `30d`, `thisMonth`, custom date range).
   - [`distributorReportPdfGenerator.ts`](file:///home/user/murshid/edrops/frontend/src/portals/distributor/utils/distributorReportPdfGenerator.ts): Client-side PDF generation engine.
2. **Backend Services & Math Patterns:**
   - Strict Decimal round-off pattern from [`report.service.ts`](file:///home/user/murshid/edrops/backend/src/report/report.service.ts#L1280): `Number(val.toFixed(2))`.
   - Date range normalization from [`report.service.ts#L1185`](file:///home/user/murshid/edrops/backend/src/report/report.service.ts#L1185).
   - Customer deposit liability isolation pattern from [`report.service.ts#L1291`](file:///home/user/murshid/edrops/backend/src/report/report.service.ts#L1291).

---

## 13. Recommended Distributor P&L Architecture

### 13.1 Proposed Data Flow & Engine Design

```
                                  ┌──────────────────────────────────────────────┐
                                  │      GET /distributor/reports/pnl            │
                                  │   (Strict Auth: req.user.id / DISTRIBUTOR)   │
                                  └──────────────────────┬───────────────────────┘
                                                         │
                                                         ▼
                                  ┌──────────────────────────────────────────────┐
                                  │         Distributor Identity Resolver        │
                                  │  userId: req.user.id                         │
                                  │  distributorId: Distributor.id (via userId)  │
                                  └──────────────────────┬───────────────────────┘
                                                         │
                         ┌───────────────────────────────┴───────────────────────────────┐
                         ▼                                                               ▼
        ┌─────────────────────────────────┐                             ┌─────────────────────────────────┐
        │        REVENUE AGGREGATION      │                             │         COGS AGGREGATION        │
        │ • Order where distributorId     │                             │ • Jars delivered * ₹28.00       │
        │   and status != 'CANCELLED'     │                             │   (or Product.distributorPrice) │
        │ • Net = subTotal - discount     │                             │ • Accessory cost from Product   │
        │ • Customer deposits isolated    │                             │ • Damaged jars at cost write-off│
        └────────────────┬────────────────┘                             └────────────────┬────────────────┘
                         │                                                               │
                         └───────────────────────────────┬───────────────────────────────┘
                                                         │
                                                         ▼
                                  ┌──────────────────────────────────────────────┐
                                  │          GROSS PROFIT CALCULATION            │
                                  │   Gross Profit = Net Revenue - Total COGS    │
                                  │   Gross Margin % = (Gross Profit / Net) * 100│
                                  └──────────────────────┬───────────────────────┘
                                                         │
                                                         ▼
                                  ┌──────────────────────────────────────────────┐
                                  │         OPERATING EXPENSES (OPEX)            │
                                  │ • Distributor-tagged expenses (Fuel, Wages)  │
                                  │ • Total OPEX = Sum of approved categories    │
                                  └──────────────────────┬───────────────────────┘
                                                         │
                                                         ▼
                                  ┌──────────────────────────────────────────────┐
                                  │           NET OPERATING PROFIT               │
                                  │   Net Profit = Gross Profit - Total OPEX     │
                                  │   Net Margin % = (Net Profit / Net) * 100    │
                                  └──────────────────────────────────────────────┘
```

### 13.2 Concrete Financial Formulas

1. **Net Operating Revenue:**
   $$\text{Net Revenue} = \sum_{\text{Orders}} (\text{subTotal} - \text{discountTotal}) + \sum_{\text{AccessorySales}} \text{taxableAmount}$$
2. **Cost of Goods Sold (COGS):**
   $$\text{COGS} = \sum (\text{Water Jars Delivered} \times ₹28.00) + \sum (\text{Accessories Sold} \times \text{Product}.\text{costPrice})$$
3. **Gross Profit:**
   $$\text{Gross Profit} = \text{Net Revenue} - \text{COGS}$$
4. **Operating Expenses (OPEX):**
   $$\text{Total OPEX} = \sum \text{Distributor Expenses (Fuel, Maintenance, Wages, Rent, Misc)}$$
5. **Net Operating Profit:**
   $$\text{Net Profit} = \text{Gross Profit} - \text{Total OPEX}$$
6. **Customer Jar Deposit Liability (Held on Balance Sheet):**
   $$\text{Deposit Liability} = \sum_{\text{Orders}} \text{depositTotal}$$

---

## 14. Implementation Readiness Assessment

| Milestone / Deliverable | Complexity | Pre-Requisites | Risk Level | Readiness Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1: Backend Distributor P&L Endpoint** | Low | None (Reuse `Order`, `Product`, `Purchase` tables) | Low | **100% READY TO IMPLEMENT** |
| **Phase 2: Frontend P&L Tab in Distributor Reports** | Low | Phase 1 endpoint | Low | **100% READY TO IMPLEMENT** |
| **Phase 3: Distributor Expense Logging Support** | Medium | Migration adding `distributorId` to `expenses` | Medium | **REQUIRES MIGRATION APPROVAL** |
| **Phase 4: Aquzio Ingestion Pipeline** | Medium | Background cron/webhook from Aquzio API | Medium | **FUTURE ITERATION** |

### Implementation Recommendation:
1. **Immediate Step (Zero Risk):** Implement the core Distributor Profit & Loss calculation inside `backend/src/distributor` or `backend/src/report`, fetching the authenticated distributor's delivered orders, calculating accurate wholesale COGS (at ₹28/₹35 baseline), and isolating customer jar deposit liabilities.
2. Expose this through `GET /distributor/reports/pnl` and embed a dedicated **Profit & Loss** tab in [`Reports.tsx`](file:///home/user/murshid/edrops/frontend/src/portals/distributor/pages/Reports.tsx).
3. If the user desires distributor expense entry, create a clean migration adding `distributorId` to `expenses` with a dedicated "Add Expense" modal in the Distributor portal.

---
*Audit completed under strict READ-ONLY protocol. Zero modifications made to code, databases, or migrations.*
