import { getOrderStatusConfig } from './orderStateMachine';

export function formatOrderId(id?: string | null): string {
  if (!id) return '';
  let cleanId = id.trim();
  if (cleanId.startsWith('#ORD-')) cleanId = cleanId.slice(5);
  else if (cleanId.startsWith('ORD-')) cleanId = cleanId.slice(4);
  else if (cleanId.startsWith('#DEL-')) cleanId = cleanId.slice(5);
  else if (cleanId.startsWith('DEL-')) cleanId = cleanId.slice(4);
  else if (cleanId.startsWith('#')) cleanId = cleanId.slice(1);
  const canonical = cleanId.length >= 8 ? cleanId.substring(0, 8).toUpperCase() : cleanId.toUpperCase();
  return canonical;
}

export function formatOrderStatus(status?: string | null): string {
  return getOrderStatusConfig(status).label;
}

export function getOrderStatusBadgeClass(status?: string | null): string {
  return getOrderStatusConfig(status).badgeClass;
}

export function formatDeliverySlot(slot?: string | null): string {
  if (!slot) return 'Standard Delivery';
  const lower = slot.toLowerCase().trim();
  if (lower === 'morning') return '6AM - 9AM';
  if (lower === 'midday') return '9AM - 12PM';
  if (lower === 'afternoon') return '12PM - 3PM';
  if (lower === 'evening') return '3PM - 6PM';
  return slot;
}

export function formatPaymentDetails(order: any): { method: string; status: 'Paid' | 'Partially Paid' | 'Unpaid'; fullLabel: string; badgeClass: string } {
  if (!order) {
    return {
      method: 'N/A',
      status: 'Unpaid',
      fullLabel: 'Unpaid',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }

  const pst = getOrderPaymentState(order);
  const rawMethod = (order.paymentMethod || '').toUpperCase();

  let method = 'Online / Card';
  if (rawMethod === 'COD' || rawMethod === 'CASH_ON_DELIVERY' || rawMethod.includes('COD') || rawMethod.includes('CASH')) {
    method = 'Cash on Delivery (COD)';
  } else if (rawMethod === 'WALLET') {
    method = 'Wallet Balance';
  } else if (rawMethod === 'UPI') {
    method = 'UPI';
  } else if (rawMethod === 'BANK_TRANSFER') {
    method = 'Bank Transfer';
  } else if (order.paymentMethod) {
    method = order.paymentMethod.replace(/_/g, ' ');
  }

  const status: 'Paid' | 'Partially Paid' | 'Unpaid' =
    pst.canonicalStatus === 'PAID'
      ? 'Paid'
      : pst.canonicalStatus === 'PARTIALLY_PAID'
      ? 'Partially Paid'
      : 'Unpaid';

  return {
    method,
    status,
    fullLabel: `${method} · ${status}`,
    badgeClass: pst.badgeClass,
  };
}

export function getPaymentStatusLabel(order: any): { label: string; badgeClass: string; isPaid: boolean } {
  const pst = getOrderPaymentState(order);
  const label =
    pst.canonicalStatus === 'PAID'
      ? 'PAID'
      : pst.canonicalStatus === 'PARTIALLY_PAID'
      ? 'PARTIALLY PAID'
      : 'UNPAID';

  return {
    label,
    badgeClass: pst.badgeClass,
    isPaid: pst.canonicalStatus === 'PAID',
  };
}

/**
 * Canonical order payment state — reads backend-computed amountPaid/amountDue
 * and returns structured info for rendering in any portal.
 */
export function getOrderPaymentState(order: any): {
  total: number;
  paid: number;
  due: number;
  canonicalStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
  label: string;
  badgeClass: string;
  hasDue: boolean;
} {
  if (!order) {
    return {
      total: 0,
      paid: 0,
      due: 0,
      canonicalStatus: 'UNPAID',
      label: 'Unpaid',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      hasDue: false,
    };
  }

  const total = Number(order.totalAmount || 0);
  const paid = Number(order.amountPaid ?? order.totalPaid ?? 0);
  const due = Number(order.amountDue ?? order.dueAmount ?? Math.max(0, Number((total - paid).toFixed(2))));

  const rawStatus = (order.paymentStatus || '').toUpperCase();

  let canonicalStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
  if (rawStatus === 'PAID' || rawStatus === 'SUCCESS') {
    canonicalStatus = 'PAID';
  } else if (rawStatus === 'PARTIALLY_PAID') {
    canonicalStatus = 'PARTIALLY_PAID';
  } else if (paid > 0 && due > 0) {
    canonicalStatus = 'PARTIALLY_PAID';
  } else if (paid >= total && total > 0) {
    canonicalStatus = 'PAID';
  } else {
    canonicalStatus = 'UNPAID';
  }

  const label =
    canonicalStatus === 'PAID'
      ? 'Paid'
      : canonicalStatus === 'PARTIALLY_PAID'
      ? 'Partially Paid'
      : 'Unpaid';

  const badgeClass =
    canonicalStatus === 'PAID'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : canonicalStatus === 'PARTIALLY_PAID'
      ? 'bg-orange-50 text-orange-700 border-orange-200'
      : 'bg-amber-50 text-amber-700 border-amber-200';

  return { total, paid, due, canonicalStatus, label, badgeClass, hasDue: due > 0 };
}
