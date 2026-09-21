/**
 * Centralized Canonical 4-Stage Order State Machine and Action Helpers
 * 
 * 1. ORDER PLACED (ORDER_PLACED)
 * 2. CONFIRMED (CONFIRMED)
 * 3. OUT FOR DELIVERY (OUT_FOR_DELIVERY)
 * 4. DELIVERED (DELIVERED)
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
 * Standard 4-step progression timeline configuration
 */
export const STATUS_PROGRESSION_STEPS = [
  { key: 'ORDER_PLACED', label: 'Order Placed' },
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
    case 'ORDER_PLACED':
    case 'PLACED':
    case 'NEW':
    case 'PENDING':
    case 'PENDING_ASSIGNMENT':
    case 'PENDING_PAYMENT':
      return {
        label: 'Order Placed',
        badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
        dotColor: 'bg-amber-500',
        stepIndex: 0,
      };

    case 'CONFIRMED':
    case 'ASSIGNED':
    case 'ACCEPTED_BY_PARTNER':
    case 'PAYMENT_SUCCESS':
      return {
        label: 'Confirmed',
        badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
        dotColor: 'bg-[#1677C8]',
        stepIndex: 1,
      };

    case 'OUT_FOR_DELIVERY':
      return {
        label: 'Out for Delivery',
        badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200',
        dotColor: 'bg-purple-600',
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

    default:
      return {
        label: 'Order Placed',
        badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
        dotColor: 'bg-amber-500',
        stepIndex: 0,
      };
  }
}

/**
 * Determines the next action available for an operator/partner based on current order status.
 * Returns null if no action is available.
 */
export function getNextPartnerAction(currentStatus?: string | null): PartnerActionConfig | null {
  const norm = (currentStatus || '').toUpperCase().trim();

  switch (norm) {
    // 1. Order Placed -> Confirm
    case 'ORDER_PLACED':
    case 'NEW':
    case 'PLACED':
    case 'PENDING':
    case 'PENDING_ASSIGNMENT':
    case 'PENDING_PAYMENT':
      return {
        label: 'Confirm Order',
        nextStatus: 'CONFIRMED',
        btnClass: 'bg-[#1677C8] hover:bg-[#1362a4]',
        actionType: 'CONFIRM',
      };

    // 2. Confirmed -> Out for Delivery
    case 'CONFIRMED':
    case 'ASSIGNED':
    case 'ACCEPTED_BY_PARTNER':
    case 'PAYMENT_SUCCESS':
      return {
        label: 'Out for Delivery',
        nextStatus: 'OUT_FOR_DELIVERY',
        btnClass: 'bg-purple-600 hover:bg-purple-700',
        actionType: 'START_DELIVERY',
      };

    // 3. Out for delivery -> Delivered
    case 'OUT_FOR_DELIVERY':
      return {
        label: 'Mark Delivered',
        nextStatus: 'DELIVERED',
        btnClass: 'bg-emerald-600 hover:bg-emerald-700',
        actionType: 'COMPLETE_DELIVERY',
      };

    // 4. Delivered / Final -> No action
    case 'DELIVERED':
    case 'COMPLETED':
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
