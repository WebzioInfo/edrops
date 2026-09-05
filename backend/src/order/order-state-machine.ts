import { OrderStatus } from '@prisma/client';

/**
 * Single source of truth for all valid order status transitions in Edrops.
 */
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: [
    OrderStatus.PENDING_PAYMENT,
    OrderStatus.PENDING_ASSIGNMENT,
    OrderStatus.ASSIGNED,
    OrderStatus.ACCEPTED_BY_PARTNER,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ],
  PENDING_PAYMENT: [
    OrderStatus.PAYMENT_SUCCESS,
    OrderStatus.FAILED,
    OrderStatus.CANCELLED,
  ],
  PAYMENT_SUCCESS: [
    OrderStatus.PENDING_ASSIGNMENT,
    OrderStatus.ASSIGNED,
    OrderStatus.ACCEPTED_BY_PARTNER,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ],
  PENDING_ASSIGNMENT: [
    OrderStatus.ASSIGNED,
    OrderStatus.ACCEPTED_BY_PARTNER,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ],
  ASSIGNED: [
    OrderStatus.ACCEPTED_BY_PARTNER,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ],
  ACCEPTED_BY_PARTNER: [
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ],
  OUT_FOR_DELIVERY: [
    OrderStatus.DELIVERED,
    OrderStatus.PARTIALLY_DELIVERED,
    OrderStatus.CUSTOMER_NOT_AVAILABLE,
    OrderStatus.FAILED,
    OrderStatus.RETURNED,
    OrderStatus.CANCELLED,
  ],
  DELIVERED: [OrderStatus.COMPLETED],
  PARTIALLY_DELIVERED: [OrderStatus.COMPLETED],
  CUSTOMER_NOT_AVAILABLE: [OrderStatus.RESCHEDULED, OrderStatus.CANCELLED],
  FAILED: [OrderStatus.RESCHEDULED, OrderStatus.CANCELLED],
  RESCHEDULED: [OrderStatus.PENDING_ASSIGNMENT, OrderStatus.ASSIGNED],
  RETURNED: [OrderStatus.COMPLETED],
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
