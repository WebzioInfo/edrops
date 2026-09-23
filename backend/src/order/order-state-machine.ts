import { OrderStatus } from '@prisma/client';

/**
 * Single source of truth for all valid order status transitions in Edrops.
 */
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  // Canonical 4-stage lifecycle
  ORDER_PLACED: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  OUT_FOR_DELIVERY: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  DELIVERED: [],

  // Legacy mappings strictly channeling to canonical progression
  NEW: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  PENDING_ASSIGNMENT: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  PENDING_PAYMENT: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  PAYMENT_SUCCESS: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  ASSIGNED: [OrderStatus.CONFIRMED, OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  ACCEPTED_BY_PARTNER: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  READY: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  PARTIALLY_DELIVERED: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  CUSTOMER_NOT_AVAILABLE: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  FAILED: [],
  RESCHEDULED: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  RETURNED: [],
  CANCELLED: [],
  COMPLETED: [],
};

/**
 * Status transitions permitted for delivery partners on orders assigned to them.
 * Delivery partners cannot perform cancellations or administrative completions.
 */
export const PARTNER_ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  NEW: [OrderStatus.ACCEPTED_BY_PARTNER],
  PENDING_ASSIGNMENT: [OrderStatus.ACCEPTED_BY_PARTNER],
  ASSIGNED: [
    OrderStatus.ACCEPTED_BY_PARTNER,
    OrderStatus.OUT_FOR_DELIVERY,
  ],
  ACCEPTED_BY_PARTNER: [
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
  ],
  OUT_FOR_DELIVERY: [
    OrderStatus.DELIVERED,
    OrderStatus.PARTIALLY_DELIVERED,
    OrderStatus.CUSTOMER_NOT_AVAILABLE,
    OrderStatus.FAILED,
  ],
};

/**
 * Validates whether a status transition is permitted generally.
 */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Validates whether a delivery partner is permitted to perform this status transition.
 */
export function isPartnerAllowedTransition(from: OrderStatus, to: OrderStatus): boolean {
  return PARTNER_ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
