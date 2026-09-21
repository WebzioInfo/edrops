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

export function formatPaymentDetails(order: any): { method: string; status: 'Collected' | 'Paid' | 'Pending'; fullLabel: string; badgeClass: string } {
  if (!order) {
    return {
      method: 'N/A',
      status: 'Pending',
      fullLabel: 'N/A (Pending)',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }

  const deliveryStatus = (order.deliveryStatus || order.status || '').toUpperCase();
  const isDelivered = deliveryStatus === 'DELIVERED' || deliveryStatus === 'COMPLETED';
  const rawMethod = (order.paymentMethod || '').toUpperCase();
  const rawStatus = (order.paymentStatus || '').toUpperCase();

  // 1. CASH ON DELIVERY (COD)
  // Payment is collected only if order is delivered AND payment was explicitly confirmed/collected
  if (rawMethod === 'COD' || rawMethod === 'CASH_ON_DELIVERY' || rawMethod.includes('COD') || rawMethod.includes('CASH')) {
    const isCollected = isDelivered && (rawStatus === 'SUCCESS' || rawStatus === 'PAID' || rawStatus === 'COLLECTED' || !!order.paymentCollected);
    if (isCollected) {
      return {
        method: 'Cash on Delivery (COD)',
        status: 'Collected',
        fullLabel: 'COD (Collected)',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    return {
      method: 'Cash on Delivery (COD)',
      status: 'Pending',
      fullLabel: isDelivered ? 'COD (Pending)' : 'COD (Pending — due on delivery)',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }

  // 2. WALLET
  if (rawMethod === 'WALLET') {
    return {
      method: 'Wallet Balance',
      status: 'Paid',
      fullLabel: 'Wallet (Paid)',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }

  // 3. ONLINE / RAZORPAY / GATEWAY
  // Online payment is confirmed at checkout regardless of delivery progress
  if (rawMethod === 'RAZORPAY' || rawMethod === 'ONLINE' || rawMethod === 'PREPAID') {
    const isPaidOnline = rawStatus === 'SUCCESS' || rawStatus === 'PAID' || !order.paymentStatus;
    if (isPaidOnline) {
      return {
        method: 'Razorpay Online',
        status: 'Paid',
        fullLabel: 'Online (Paid)',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    return {
      method: 'Razorpay Online',
      status: 'Pending',
      fullLabel: 'Online (Pending)',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }

  // 4. FALLBACK
  const isSuccess = rawStatus === 'SUCCESS' || rawStatus === 'PAID';
  const displayMethod = order.paymentMethod ? order.paymentMethod.replace(/_/g, ' ') : 'Payment';
  return {
    method: displayMethod,
    status: isSuccess ? 'Paid' : 'Pending',
    fullLabel: `${displayMethod} (${isSuccess ? 'Paid' : 'Pending'})`,
    badgeClass: isSuccess
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-amber-50 text-amber-700 border-amber-200',
  };
}

export function getPaymentStatusLabel(order: any): { label: string; badgeClass: string; isPaid: boolean } {
  const details = formatPaymentDetails(order);
  const isPaid = details.status === 'Paid' || details.status === 'Collected';
  return {
    label: details.status.toUpperCase(),
    badgeClass: details.badgeClass,
    isPaid,
  };
}
