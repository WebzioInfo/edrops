# Edrops V2 Phase 0 Audit

Date: 2026-06-03

## Executive Summary

Edrops is moving in the right direction from a prepaid/subscription-first jar system toward a water commerce platform, but the codebase is currently between architectures.

The backend contains a NestJS/Prisma modular structure with newer commerce models for brands, categories, products, warehouses, carts, orders, payments, and deposits. However, several critical flows are incomplete or split across legacy and V2 concepts. The frontend already presents a modern shop/cart/admin/staff experience, but some screens call API routes that do not exist or do not match the backend.

Do not start broad feature work yet. The next phase should stabilize contracts and correctness for commerce checkout, inventory reservation, RBAC, payment webhooks, and customer order history.

## Current Architecture

Stack:

- Backend: NestJS 11, Prisma 7, PostgreSQL, Razorpay, JWT auth.
- Frontend: React 19, Vite 8, React Router, TanStack Query, local auth/cart state.
- Marketing: Astro.

Backend modules are organized by feature, but many generated CRUD modules are still thin pass-throughs. There is no consistent command/query boundary, no shared pagination contract, and no consistent policy guard across admin/staff/customer resources.

Positive:

- Environment validation exists before Nest bootstrap.
- Global validation pipe uses whitelist, forbidNonWhitelisted, and transform.
- Swagger is enabled.
- Prisma schema already includes V2 commerce entities.
- Some high-risk operations use transactions.

Risks:

- Multiple business models coexist: packages/recharge/deliveries and products/cart/order/warehouse.
- Some controllers expose admin-like CRUD without guards.
- Several frontend routes call missing backend endpoints.
- Money uses Float in the Prisma schema.
- Inventory correctness is not yet enforced for commerce orders.

## Current Database

Key V2 models exist:

- Brand, Category, Product, ProductImage.
- Warehouse, WarehouseStock, StockMovement.
- Cart, CartItem.
- Order, OrderItem.
- Payment, PaymentAttempt, PaymentRefund, PaymentWebhookLog.
- DepositTransaction, JarLedger.

Main issues:

- Monetary columns use Float. This is unsafe for payments, wallet balances, deposits, refunds, and invoices.
- Inventory is split between legacy singleton Inventory/InventoryLog and V2 WarehouseStock/StockMovement.
- StockMovement uses free-form string type instead of enum.
- PaymentAttempt and PaymentLog status use strings instead of PaymentStatus or provider-specific enums.
- No clear idempotency keys for order creation, stock reservation, wallet credit, or refund flows.
- CartItem lacks a unique constraint on cartId + productId.
- Order querying lacks indexes for customerId, status, paymentStatus, createdAt, and scheduledDate.
- WarehouseStock lacks database check constraints for quantity >= 0 and reservedQty >= 0.
- Role/Permission tables exist, but User still stores enum role and the app uses hardcoded role checks.

Required migration direction:

- Convert money to Decimal with fixed precision.
- Add reservation ledger separate from final stock movement.
- Normalize order payment state transitions.
- Add unique constraints for cart/order/payment idempotency.
- Add query-focused indexes before dashboard/report scale-up.

## Current APIs

Working or partially working:

- Auth: register, login, profile, update profile, password reset/change.
- Catalog: public list/get for brands, categories, products.
- Wallet: wallet, transactions, admin ledger, own jar.
- Schedule: customer schedule update.
- Delivery: generate, assign, report, confirm, list.
- Recharge: package purchase and package management.
- Payment: create intent and verify.
- Webhook: Razorpay webhook capture/order paid processing.

Broken or missing:

- CheckoutController is empty, while frontend calls POST /checkout/initialize.
- Frontend calls POST /cart/sync, but no cart controller exists.
- Frontend Recharge calls /payment/create-order, but backend exposes /payment/create-intent.
- Frontend Track calls /deliveries/history, but backend exposes /delivery/customer/:customerId.
- Frontend Support calls /support/tickets, but no support module/controller exists.
- Order API only lists all orders and has no customer-scoped order history, details, status transition actions, cancellation, invoices, or repeat order.
- Warehouse controller appears present but is not feature-complete for stock movements, transfers, reservations, and adjustments.

## Current Permissions

Current state:

- JwtAuthGuard exists.
- RolesGuard exists.
- Role and Permission tables exist.
- Some controllers use hardcoded @Roles(UserRole.ADMIN).

Major risks:

- Many controllers do not use guards at all.
- RolesGuard checks only user.role enum, not database permissions.
- Staff, manager, warehouse manager, driver, admin, and super admin are not represented as granular permissions.
- Staff can potentially access data through unguarded endpoints.
- Customer-scoped endpoints often accept customerId params and need ownership enforcement.

Required design:

- Keep a simple role label for UX, but enforce permissions through DB-backed role_permissions.
- Add policy decorators like RequirePermission(resource, action).
- Add ownership guards for customer-owned entities.
- Separate admin, staff, driver, customer route groups.

## Current Inventory Logic

Current state:

- Legacy Inventory tracks filledJars, emptyJars, damagedJars globally.
- V2 WarehouseStock tracks product quantity and reservedQty per warehouse.
- Checkout service explicitly says reservation is simplified and does not lock WarehouseStock rows.
- Webhook service confirms orders but does not deduct stock.

Major risks:

- Negative stock possible for V2 commerce.
- Double reservation possible.
- Double deduction possible if webhook and manual verification diverge.
- No transfer flow between warehouses.
- No product-level damaged/lost stock workflow.
- No auditable reservation lifecycle.

Required design:

- Use WarehouseStock as source of truth for commerce inventory.
- Introduce StockReservation with status: ACTIVE, RELEASED, CONSUMED, EXPIRED.
- Reserve inside transaction with row-level lock.
- Deduct only once when payment succeeds and reservation is consumed.
- Reconcile all changes through StockMovement.

## Current Payment Logic

Current state:

- Payment records are created before Razorpay order creation.
- Signature verification exists.
- Webhook log has unique eventId.
- Webhook marks payment SUCCESS and order CONFIRMED.

Major risks:

- Payment verify endpoint records an attempt but does not enforce customer ownership of the payment/order.
- Business processing is split between verify and webhook with no single payment state machine.
- Refund and failed payment events are ignored.
- Wallet recharge completion is not centralized.
- Amounts are Float.
- Webhook returns silently on invalid signature instead of a clear failed response path.
- No retry worker for failed webhook logs.

Required design:

- Central PaymentEngine with idempotent handlers.
- Treat Razorpay webhook as source of truth for capture/refund/failure.
- Client verify should only provide UX confirmation, not fulfill business effects.
- Add provider event id, provider payment id, provider order id uniqueness.
- Add retry/reconciliation job for FAILED webhooks.

## Current Subscription Logic

Current state:

- DeliverySchedule and DeliveryScheduleRule exist.
- Recharge packages and package purchases exist.
- Delivery engine can generate deliveries from schedules.

Gaps:

- Subscription is not modeled as an order source with billing/payment lifecycle.
- Pause/resume/skip/modify history is missing.
- Subscription order generation is not unified with Order/OrderItem.
- Wallet deductions/subscription consumption are not tied to commerce payment architecture.

Required design:

- Add Subscription model with frequency, nextRunAt, status, pause windows.
- Generate Order records with orderType SUBSCRIPTION_ORDER.
- Track skipped/paused runs as events.
- Use the same inventory and payment engines as one-time orders.

## Current Customer Flow

Good direction:

- Customer portal defaults to Shop, matching commerce-first strategy.
- Cart UI calculates product subtotal and jar deposits.
- Dashboard/wallet/schedule/recharge/support pages exist.

Critical gaps:

- Phone OTP login is not implemented; login is password-based.
- Cart is local-only and cannot checkout because backend cart API is missing.
- Checkout API is missing.
- Orders page/history is not complete.
- Deposits are shown through legacy jar deposit fields, not a full deposit ledger UX.
- Support frontend calls missing backend routes.

## Current Staff Flow

Good direction:

- Staff portal focuses on operations, customers, packages, inventory.
- Delivery assignment/report/confirm flows exist.

Critical gaps:

- Staff endpoints are guarded only by JWT in delivery/inventory, not granular staff permissions.
- Staff UI includes package/customer capabilities that may exceed operational permissions.
- No route optimization, proof upload, customer signature, or photo evidence storage.
- No attendance/performance/audit event trail.

## Current Admin Flow

Good direction:

- Admin portal has dashboard, catalog, operations, orders, finance, customers, settings, reports.
- Backend has reporting, analytics, customer, wallet, order, catalog, warehouse modules.

Critical gaps:

- Admin CRUD controllers are often unguarded.
- Product/catalog admin APIs are read-only from current CatalogController.
- Order dashboard has only list-all behavior, no filters, status transitions, refunds, invoices.
- Finance ledger is aggregate-only.
- Reports/export functionality is not production-ready.

## Performance Risks

- Many findMany calls use no pagination.
- Several admin queries include deep relation graphs.
- Search uses contains/insensitive without dedicated search index.
- Dashboards are not backed by materialized snapshots or caching.
- No clear server-side filtering contract for orders, customers, payments, inventory, and reports.

Performance requirements:

- Pagination everywhere.
- Cursor pagination for high-volume ledgers.
- Server-side filters and sorts.
- Query-specific indexes.
- Aggregation tables/snapshots for dashboards.
- Avoid including entire related entities by default.

## Security Risks

- Hardcoded enum roles instead of DB permissions.
- Unguarded admin/staff-like controllers.
- LocalStorage token storage increases XSS blast radius.
- Payment verify lacks strong ownership checks.
- Missing rate limiting for auth, OTP, payment, support.
- Missing audit logs for many admin/staff actions.
- File upload/evidence flow is not designed yet.

## Recommended Execution Phases

### Phase 1: Contract Stabilization

- Add missing cart and checkout endpoints.
- Align frontend endpoint names with backend.
- Add customer order history endpoint.
- Fix Recharge payment endpoint mismatch.
- Add support ticket backend or hide/disable unsupported UI.
- Add API DTOs for cart, checkout, order filters, status transitions.

### Phase 2: RBAC and Route Protection

- Implement DB-backed permission guard.
- Seed Super Admin, Admin, Manager, Warehouse Manager, Staff, Driver, Customer roles.
- Add permission metadata to all non-public controllers.
- Add ownership enforcement for customer resources.
- Add audit logs for sensitive mutations.

### Phase 3: Commerce Inventory

- Make WarehouseStock source of truth.
- Add StockReservation model.
- Lock stock rows during reservation.
- Consume reservation on payment success.
- Release reservation on payment failure/expiry/cancel.
- Add transfer, adjustment, damage, audit, reconciliation APIs.

### Phase 4: Payment Engine

- Replace scattered payment logic with PaymentEngine.
- Add idempotent provider event processing.
- Handle payment captured, failed, refunded, partially refunded.
- Add reconciliation job for failed webhook logs.
- Move money columns to Decimal.
- Add payment ownership and amount validation everywhere.

### Phase 5: Order and Deposit Platform

- Add full order lifecycle.
- Add invoices and receipts.
- Add deposit ledger as source of truth.
- Add jar return/refund request workflows.
- Add repeat order.
- Add customer-facing tracking.

### Phase 6: Subscription as Optional Module

- Add Subscription model and subscription event log.
- Generate subscription orders through the same order engine.
- Add pause, resume, skip, modify, history.
- Use wallet/payment/deposit/inventory engines consistently.

### Phase 7: Admin/Staff Production UX

- Complete admin catalog/product CRUD.
- Complete operations dashboard.
- Complete staff mobile delivery workflow.
- Add proof upload, notes, failed delivery, signature.
- Add reporting exports.
- Verify mobile viewports: 320, 375, 425, 768, 1024, 1440.

## Verification Performed

- Repository mapped.
- Backend Prisma schema reviewed.
- Backend auth, payment, webhook, checkout, catalog, inventory, delivery, schedule, order services reviewed.
- Frontend routing, auth context, cart context, customer portal, shop, cart checkout, admin portal, and staff portal reviewed.
- Backend TypeScript check passed with local tsc.
- Frontend TypeScript build check passed with local tsc.
- Full npm build commands timed out during audit and should be rerun after contract fixes.

## Immediate Priority List

1. Implement cart sync API and checkout controller, or update frontend to use the actual API.
2. Introduce permission guard before expanding staff/admin features.
3. Fix payment/checkout ownership and webhook idempotency semantics.
4. Unify inventory around WarehouseStock and add reservations.
5. Add customer order history and admin order filters.
6. Convert money fields to Decimal before production transactions.
7. Add pagination and indexes for high-volume list screens.

