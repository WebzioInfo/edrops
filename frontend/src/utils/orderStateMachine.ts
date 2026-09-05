/**
 * Centralized Order State Machine and Action Helpers for Frontend
 */

export interface StatusConfig {
  label: string;
  badgeClass: string;
  dotColor: string;
  stepIndex: number;
}

export interface PartnerActionConfig {
  label: string;
  nextStatus: string;
  btnClass: string;
  actionType: 'CONFIRM' | 'START_DELIVERY' | 'COMPLETE_DELIVERY';
}

/**
 * Standard 4-step delivery progression timeline configuration
 */
export const STATUS_PROGRESSION_STEPS = [
  { key: 'PLACED', label: 'Placed' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { key: 'DELIVERED', label: 'Delivered' },
];

/**
 * Returns UI display configuration for any order status
 */
export function getOrderStatusConfig(status?: string | null): StatusConfig {
  const norm = (status || '').toUpperCase().trim();

  switch (norm) {
    case 'NEW':
    case 'PLACED':
    case 'PENDING':
    case 'PENDING_ASSIGNMENT':
    case 'PENDING_PAYMENT':
      return {
        label: 'Placed',
        badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
        dotColor: 'bg-amber-500',
        stepIndex: 0,
      };

    case 'ASSIGNED':
      return {
        label: 'Assigned',
        badgeClass: 'bg-sky-50 text-sky-700 border border-sky-200',
        dotColor: 'bg-sky-500',
        stepIndex: 1,
      };

    case 'ACCEPTED_BY_PARTNER':
      return {
        label: 'Accepted',
        badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
        dotColor: 'bg-[#1677C8]',
        stepIndex: 1,
      };

    case 'CONFIRMED':
    case 'PROCESSING':
    case 'PAYMENT_SUCCESS':
    case 'SHIPPED':
      return {
        label: 'Confirmed',
        badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
        dotColor: 'bg-[#1677C8]',
        stepIndex: 1,
      };

    case 'OUT_FOR_DELIVERY':
      return {
        label: 'Out for Delivery',
        badgeClass: 'bg-orange-50 text-orange-700 border border-orange-200',
        dotColor: 'bg-orange-500',
        stepIndex: 2,
      };

    case 'DELIVERED':
    case 'COMPLETED':
      return {
        label: 'Delivered',
        badgeClass: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
        dotColor: 'bg-emerald-600',
        stepIndex: 3,
      };

    case 'PARTIALLY_DELIVERED':
      return {
        label: 'Partial Drop',
        badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
        dotColor: 'bg-amber-500',
        stepIndex: 3,
      };

    case 'CANCELLED':
      return {
        label: 'Cancelled',
        badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
        dotColor: 'bg-rose-500',
        stepIndex: -1,
      };

    case 'CUSTOMER_NOT_AVAILABLE':
    case 'FAILED':
    case 'RESCHEDULED':
    case 'RETURNED':
      return {
        label: norm.replace(/_/g, ' '),
        badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
        dotColor: 'bg-slate-400',
        stepIndex: -1,
      };

    default:
      return {
        label: status || 'Placed',
        badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
        dotColor: 'bg-slate-400',
        stepIndex: 0,
      };
  }
}

/**
 * Determines the next action available for a delivery partner based on current order status.
 * Returns null if no action is available.
 */
export function getNextPartnerAction(currentStatus?: string | null): PartnerActionConfig | null {
  const norm = (currentStatus || '').toUpperCase().trim();

  switch (norm) {
    // 1. Initial/Placed states -> Delivery partner confirms / accepts order
    case 'NEW':
    case 'PLACED':
    case 'PENDING':
    case 'PENDING_ASSIGNMENT':
    case 'PENDING_PAYMENT':
      return {
        label: 'Confirm Order',
        nextStatus: 'ACCEPTED_BY_PARTNER',
        btnClass: 'bg-[#1677C8] hover:bg-[#1362a4]',
        actionType: 'CONFIRM',
      };

    // 2. Assigned by staff -> Delivery partner accepts
    case 'ASSIGNED':
      return {
        label: 'Accept Order',
        nextStatus: 'ACCEPTED_BY_PARTNER',
        btnClass: 'bg-[#1677C8] hover:bg-[#1362a4]',
        actionType: 'CONFIRM',
      };

    // 3. Accepted or Confirmed -> Delivery partner starts delivery
    case 'ACCEPTED_BY_PARTNER':
    case 'CONFIRMED':
    case 'PROCESSING':
    case 'PAYMENT_SUCCESS':
    case 'SHIPPED':
      return {
        label: 'Start Delivery (Out for Delivery)',
        nextStatus: 'OUT_FOR_DELIVERY',
        btnClass: 'bg-orange-600 hover:bg-orange-700',
        actionType: 'START_DELIVERY',
      };

    // 4. Out for delivery -> Delivery partner completes delivery dropoff
    case 'OUT_FOR_DELIVERY':
      return {
        label: 'Complete Delivery',
        nextStatus: 'DELIVERED',
        btnClass: 'bg-emerald-600 hover:bg-emerald-700',
        actionType: 'COMPLETE_DELIVERY',
      };

    // 5. Final states -> No actions permitted
    case 'DELIVERED':
    case 'COMPLETED':
    case 'CANCELLED':
    case 'FAILED':
    default:
      return null;
  }
}

/**
 * Checks if target status is the same as current status
 */
export function isSameStatus(currentStatus?: string | null, targetStatus?: string | null): boolean {
  if (!currentStatus || !targetStatus) return false;
  return currentStatus.toUpperCase().trim() === targetStatus.toUpperCase().trim();
}
