# EDROPS FINANCIAL INTEGRITY & ACCOUNTING AUDIT
## Forensic Evaluation of Ledger Consistency, Payment Reconciliation, Wallet Liabilities, Deposits & Subscriptions

**Document Date:** October 22, 2026  
**Auditor:** Independent Financial Controls & ERP Accounting Auditor  
**Audit Scope:** Wallets, security deposits, subscription billing, supplier ledgers, delivery settlements, payment gateways, and double-entry accounting.  
**Audit Status:** COMPLETE WITH EVIDENCE  
**Primary Supporting Artifacts:**
- [`backend/src/schedule/subscription.scheduler.ts`](file:///d:/Webzio/edrops/backend/src/schedule/subscription.scheduler.ts)
- [`backend/src/supplier/supplier.service.ts`](file:///d:/Webzio/edrops/backend/src/supplier/supplier.service.ts)
- [`backend/src/order/order.service.ts`](file:///d:/Webzio/edrops/backend/src/order/order.service.ts)
- [`backend/src/wallet/wallet.service.ts`](file:///d:/Webzio/edrops/backend/src/wallet/wallet.service.ts)
- [`backend/prisma/schema.prisma`](file:///d:/Webzio/edrops/backend/prisma/schema.prisma)

---

## 1. EXECUTIVE FINANCIAL VERDICT: HIGH RISK — SIGNIFICANT FINANCIAL LEAKS & LEDGER DESYNCHRONIZATION IDENTIFIED

While individual transaction records are stored in PostgreSQL with ACID guarantees, the financial architecture exhibits **severe business logic leaks**, **ledger desynchronization bugs**, and a **complete absence of a formal double-entry General Ledger (GL)**.

---

## 2. FORENSIC BREAKDOWN OF CONFIRMED FINANCIAL DEFECTS

### 2.1 Infinite Zero-Cost Subscription Orders (`FIN-01`)
- **Vulnerability ID:** `FIN-01` (Severity: CRITICAL)
- **Affected File:** [`backend/src/schedule/subscription.scheduler.ts:92-130`](file:///d:/Webzio/edrops/backend/src/schedule/subscription.scheduler.ts#L92-L130)
- **Verified Code Implementation:**
  ```typescript
  const order = await tx.order.create({
    data: {
      customerId: schedule.customerId,
      orderType: 'SUBSCRIPTION_ORDER',
      status: OrderStatus.NEW,
      scheduledDate: today,
      deliveryAddressId: defaultAddress.id,
      totalAmount: 0, // Prepaid, deduced from jarBalance
      paymentStatus: 'SUCCESS', // Prepaid via jar balance
      paymentMethod: 'PREPAID',
      deliveryVerification: {
        create: {
          otp: generateDeliveryOtp(),
        },
      },
      items: {
        create: {
          productId: product.id,
          quantity: todayQty,
          unitPrice: 0,
          total: 0,
        },
      },
    },
  });
  ```
- **Audit Findings:**
  1. The code comment explicitly asserts: `"Prepaid, deduced from jarBalance"`.
  2. However, **NO deduction call is executed**. Neither `BalanceEngine.deductJars()`, `customer.jarBalance.decrement()`, nor `wallet.decrement()` is invoked anywhere in the transaction.
  3. No customer jar balance or wallet balance validation is performed prior to order creation.
  4. The order is committed with `totalAmount: 0` and `paymentStatus: 'SUCCESS'`.
  5. The distributor claims the order, dispatches filled jars, and delivers them to the customer without any financial exchange.
- **Business Impact:** Direct financial loss. Customers can set up recurring daily subscriptions and receive infinite free water jars perpetually without ever purchasing vouchers or topping up wallets.
- **Required Remediation:** Call `BalanceEngine.deductJars()` inside the scheduler transaction. If the customer lacks balance, fail order creation or set `paymentStatus = 'PENDING'`.

---

### 2.2 Supplier Balance Ledger Desynchronization on Manual Adjustments (`FIN-02`)
- **Vulnerability ID:** `FIN-02` (Severity: HIGH)
- **Affected File:** [`backend/src/supplier/supplier.service.ts:135-140`](file:///d:/Webzio/edrops/backend/src/supplier/supplier.service.ts#L135-L140)
- **Verified Code Implementation:**
  ```typescript
  // Latest adjustment if any
  const latestAdjustment = supplier.transactions[0];

  const balance =
    latestAdjustment !== undefined
      ? latestAdjustment.balance
      : Math.round((openingPayable + totalPendingPurchases) * 100) / 100;
  ```
- **Audit Findings:**
  1. When querying supplier accounts payable balances via `GET /suppliers`, the service checks if any transaction row exists in `supplier.transactions[0]`.
  2. If any manual adjustment was ever recorded, the service **freezes on `latestAdjustment.balance`** as the supplier's balance.
  3. Any subsequent purchases created via `PurchaseService` or supplier payments recorded after the adjustment are completely ignored by the balance calculation.
- **Business Impact:** Accounts payable statements displayed to distributors become corrupt and frozen, causing incorrect payments or disputed balances with vendors.
- **Required Remediation:** Compute supplier balance as a continuous cumulative sum across all transactions (`openingBalance + sum(purchases) - sum(payments)`).

---

### 2.3 Prepaid Short Deliveries Fail to Credit Customer Wallet (`FIN-03`)
- **Vulnerability ID:** `FIN-03` (Severity: MEDIUM)
- **Affected File:** [`backend/src/order/order.service.ts:3035-3115`](file:///d:/Webzio/edrops/backend/src/order/order.service.ts#L3035-L3115)
- **Verified Code Implementation:**
  - Customer prepays online for 10 jars at ₹100/jar = ₹1,000 via Razorpay (`paymentStatus: 'PAID'`, `currentPaid: 1000`).
  - Driver arrives and delivers only 8 jars (short delivery of 2 jars due to stock shortage or customer request).
  - Delivery settlement computes actual delivered value: $\text{calculatedAmount} = 8 \times 100 = \text{₹}800$.
  - Line 3040 computes: `netPayable = Math.max(0, settlement.calculatedAmount - currentPaid) = 0`.
  - Line 3100:
    ```typescript
    else if (netPayable === 0 && currentPaid >= settlement.calculatedAmount) {
      newPaymentStatus = PaymentStatus.PAID;
      paymentHistoryNote = 'Order already fully paid (no additional collection required)';
    }
    ```
- **Audit Findings:**
  1. The excess ₹200 paid by the customer is acknowledged by the settlement engine, but **no refund or wallet credit is executed**.
  2. The system does not create a `WalletTransaction` (`WalletTransactionType.REFUND`).
  3. The extra ₹200 remains absorbed into the order record with no liability ledger entry.
- **Business Impact:** Customer financial discrepancy, customer dissatisfaction, and manual audit/refund overhead.
- **Required Remediation:** Trigger an automatic credit to the customer's wallet (`WalletTransactionType.REFUND`, amount = ₹200) during delivery completion when `currentPaid > calculatedAmount`.

---

### 2.4 Admin Financial Ledger Aggregation Query Defect
- **Vulnerability ID:** `FIN-04` (Severity: MEDIUM)
- **Affected File:** [`backend/src/wallet/wallet.service.ts:60-70`](file:///d:/Webzio/edrops/backend/src/wallet/wallet.service.ts#L60-L70)
- **Audit Findings:**
  1. In `getAdminLedger()`, the service computes `depositsRefunded` by querying:
     ```typescript
     this.prisma.transaction.aggregate({
       _sum: { amount: true },
       where: { type: TransactionType.REFUND },
     });
     ```
  2. However, in the database schema, customer security deposits are tracked exclusively in the `DepositTransaction` table with `DepositTransactionType.DEPOSIT_REFUNDED`.
  3. The generic `Transaction` table does not contain deposit refunds.
  4. As a result, `getAdminLedger()` always reports `depositsRefunded: 0` regardless of how many customer deposits have actually been refunded.
- **Business Impact:** Inaccurate corporate financial reporting.

---

## 3. GENERAL LEDGER (GL) & DOUBLE-ENTRY ASSESSMENT

### 3.1 Current System Architecture
Edrops currently operates on **isolated transaction log tables**:
- `Payment` (customer order payments)
- `WalletTransaction` (customer prepaid wallet debits and credits)
- `DepositTransaction` (customer jar security deposits)
- `SupplierTransaction` (vendor bills, payments, and adjustments)
- `DistributorJarSettlement` (distributor jar ownership deposits)

### 3.2 Material Accounting Deficiency: Lack of Double-Entry General Ledger
The application **lacks a formalized double-entry General Ledger**:
1. **No Chart of Accounts (COA):** No standard accounts exist for Cash, Bank, Accounts Receivable (AR), Accounts Payable (AP), Customer Wallet Liability, Deposit Liability, Sales Revenue, or Inventory Asset.
2. **No Balancing Journal Entries:** When a transaction occurs (e.g. customer tops up wallet with ₹1,000), a single credit is added to `WalletTransaction`. There is no offsetting debit to `Bank Clearing / Razorpay In-Flight`.
3. **Financial Statement Generation:** Income statements (P&L), Balance Sheets, and Cash Flow statements cannot be produced from the database without reconstructing transactions from disparate application tables.

---

## 4. INVOICING & GST TAXATION

### 4.1 Invoicing Architecture
- Invoices are generated **exclusively client-side in the browser** using `jsPDF` and `jspdf-autotable` ([`frontend/src/utils/InvoiceGenerator.ts`](file:///d:/Webzio/edrops/frontend/src/utils/InvoiceGenerator.ts)).
- The backend model `InvoiceRecord` ([`backend/prisma/schema.prisma:589`](file:///d:/Webzio/edrops/backend/prisma/schema.prisma#L589)) is completely orphaned: zero backend services query or populate it.
- **Audit Finding:** The server has no record of the generated invoice PDF, its digital signature, or its HSN/SAC compliance state.

### 4.2 Taxation Breakdown
- The client-side invoice generator computes 18% GST (9% CGST + 9% SGST) for intra-state Kerala/Karnataka orders.
- No automated GST e-Invoicing (IRN generation via NIC/Cleartax) or e-Way Bill integration is implemented.

---

*Report certified by Independent Financial Controls & Accounting Auditor.*
