export function formatOrderStatus(status?: string | null): string {
  if (!status) return 'Order Placed';
  switch (status.toUpperCase()) {
    case 'PENDING_ASSIGNMENT':
    case 'PENDING':
    case 'PENDING_PAYMENT':
    case 'NEW':
      return 'Order Placed';
    case 'ASSIGNED':
    case 'ACCEPTED_BY_PARTNER':
    case 'CONFIRMED':
      return 'Confirmed';
    case 'PROCESSING':
      return 'Processing';
    case 'OUT_FOR_DELIVERY':
      return 'Out For Delivery';
    case 'DELIVERED':
    case 'COMPLETED':
      return 'Delivered';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function getOrderStatusBadgeClass(status?: string | null): string {
  switch (status?.toUpperCase()) {
    case 'CONFIRMED':
    case 'ASSIGNED':
    case 'ACCEPTED_BY_PARTNER':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'PROCESSING':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'OUT_FOR_DELIVERY':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'DELIVERED':
    case 'COMPLETED':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'PENDING':
    case 'PENDING_ASSIGNMENT':
    case 'PENDING_PAYMENT':
    case 'NEW':
    default:
      return 'bg-sky-100 text-sky-700 border-sky-200';
  }
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

export function formatPaymentDetails(order: any): { method: string; status: string; fullLabel: string } {
  if (!order) {
    return { method: 'N/A', status: 'Pending', fullLabel: 'N/A (Pending)' };
  }

  const deliveryStatus = (order.deliveryStatus || order.status || '').toUpperCase();
  const isDelivered = deliveryStatus === 'DELIVERED' || deliveryStatus === 'COMPLETED';
  const rawMethod = (order.paymentMethod || '').toUpperCase();
  const rawStatus = (order.paymentStatus || '').toUpperCase();

  // 1. CASH ON DELIVERY (COD)
  // Payment is collected only when delivery actually completes
  if (rawMethod === 'COD' || rawMethod === 'CASH_ON_DELIVERY' || rawMethod.includes('COD') || rawMethod.includes('CASH')) {
    if (isDelivered) {
      return {
        method: 'Cash on Delivery (COD)',
        status: 'Collected',
        fullLabel: 'COD (Collected)',
      };
    }
    return {
      method: 'Cash on Delivery (COD)',
      status: 'Pending — due on delivery',
      fullLabel: 'COD (Pending — due on delivery)',
    };
  }

  // 2. WALLET
  if (rawMethod === 'WALLET') {
    return {
      method: 'Wallet Balance',
      status: 'Paid',
      fullLabel: 'Wallet (Paid)',
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
      };
    }
    return {
      method: 'Razorpay Online',
      status: 'Pending',
      fullLabel: 'Online (Pending)',
    };
  }

  // 4. FALLBACK
  const isSuccess = rawStatus === 'SUCCESS' || rawStatus === 'PAID';
  const displayMethod = order.paymentMethod ? order.paymentMethod.replace(/_/g, ' ') : 'Payment';
  return {
    method: displayMethod,
    status: isSuccess ? 'Paid' : 'Pending',
    fullLabel: `${displayMethod} (${isSuccess ? 'Paid' : 'Pending'})`,
  };
}
