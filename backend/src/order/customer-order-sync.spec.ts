import { calculateDeliveryAmount } from './utils/delivery-calculation.util';

describe('Customer Order Detail & Row Delivery Synchronization (Scenarios 1-10)', () => {
  const standardRefillRate = 100;
  const standardDepositRate = 200;

  // Helper simulating OrderService.findOne and findAll settlement resolution
  function buildCustomerOrderView(order: {
    id: string;
    totalAmount: number;
    status: string;
    paidAmount?: number;
    paymentStatus?: string;
    items?: Array<{ quantity: number; unitPrice: number; deposit?: number }>;
    deliveryVerification?: {
      completedAt?: Date;
      isVerified?: boolean;
      deliveredQty: number;
      returnedQty: number;
      undeliveredQty?: number;
      shortDeliveryReason?: string;
      refillRate?: number;
      depositRate?: number;
      calculatedTotal?: number;
      amountReceived?: number;
      paymentMethod?: string;
    };
  }) {
    const isCompleted = order.status === 'DELIVERED' || order.status === 'COMPLETED';
    const dv = order.deliveryVerification;
    const hasDeliverySettlement = isCompleted && Boolean(dv);

    const delivery = hasDeliverySettlement && dv ? {
      completedAt: dv.completedAt,
      otpVerified: Boolean(dv.isVerified),
      dispatchedQty: (dv.deliveredQty ?? 0) + (dv.undeliveredQty ?? 0),
      deliveredQty: dv.deliveredQty ?? 0,
      returnedQty: dv.returnedQty ?? 0,
      shortQty: dv.undeliveredQty ?? 0,
      netCustomerHolding: (dv.deliveredQty ?? 0) - (dv.returnedQty ?? 0),
      shortDeliveryReason: dv.shortDeliveryReason || null,
    } : null;

    let settlement: any = null;
    let dueAmount = Math.max(0, Number(order.totalAmount || 0) - Number(order.paidAmount || 0));

    if (hasDeliverySettlement && dv) {
      const calc = calculateDeliveryAmount({
        deliveredQty: dv.deliveredQty ?? 0,
        returnedQty: dv.returnedQty ?? 0,
        refillRate: dv.refillRate ?? standardRefillRate,
        depositRate: dv.depositRate ?? standardDepositRate,
      });

      const finalCalculatedTotal = dv.calculatedTotal != null ? Number(dv.calculatedTotal) : calc.calculatedAmount;
      const actualReceived = dv.amountReceived != null ? Number(dv.amountReceived) : Number(order.paidAmount || 0);
      dueAmount = Math.max(0, finalCalculatedTotal - actualReceived);

      settlement = {
        refillAmount: calc.refillAmount,
        baseDepositAmount: calc.baseDeposit,
        returnDeduction: calc.returnDeduction,
        finalDepositAmount: calc.finalDeposit,
        calculatedTotal: finalCalculatedTotal,
        actualAmountReceived: actualReceived,
        remainingDue: dueAmount,
        paymentMethod: dv.paymentMethod || 'CASH',
      };
    }

    return {
      orderId: order.id,
      originalTotal: order.totalAmount, // Preserved historical
      status: order.status,
      hasDeliverySettlement,
      delivery,
      settlement,
      paidAmount: order.paidAmount ?? dv?.amountReceived ?? 0,
      dueAmount,
    };
  }

  it('TEST 1: Order: 5 jars (₹1,500). Delivery: 5 delivered, 0 returned -> Original ₹1,500, Final ₹1,500', () => {
    const view = buildCustomerOrderView({
      id: 'ORD-TEST-1',
      totalAmount: 1500,
      status: 'DELIVERED',
      paidAmount: 1500,
      deliveryVerification: {
        completedAt: new Date(),
        isVerified: true,
        deliveredQty: 5,
        returnedQty: 0,
        undeliveredQty: 0,
        refillRate: 100,
        depositRate: 200,
        calculatedTotal: 1500,
        amountReceived: 1500,
      },
    });

    expect(view.originalTotal).toBe(1500);
    expect(view.hasDeliverySettlement).toBe(true);
    expect(view.settlement?.calculatedTotal).toBe(1500);
    expect(view.settlement?.refillAmount).toBe(500);
    expect(view.settlement?.finalDepositAmount).toBe(1000);
    expect(view.settlement?.remainingDue).toBe(0);
    expect(view.delivery?.deliveredQty).toBe(5);
    expect(view.delivery?.returnedQty).toBe(0);
    expect(view.delivery?.netCustomerHolding).toBe(5);
  });

  it('TEST 2: Order: 5 jars (₹1,500). Delivery: 5 delivered, 2 returned -> Original ₹1,500, Final ₹1,100, Net holding +3', () => {
    const view = buildCustomerOrderView({
      id: 'ORD-TEST-2',
      totalAmount: 1500,
      status: 'DELIVERED',
      paidAmount: 1100,
      deliveryVerification: {
        completedAt: new Date(),
        isVerified: true,
        deliveredQty: 5,
        returnedQty: 2,
        undeliveredQty: 0,
        refillRate: 100,
        depositRate: 200,
        calculatedTotal: 1100,
        amountReceived: 1100,
      },
    });

    expect(view.originalTotal).toBe(1500);
    expect(view.settlement?.calculatedTotal).toBe(1100);
    expect(view.settlement?.refillAmount).toBe(500);
    expect(view.settlement?.baseDepositAmount).toBe(1000);
    expect(view.settlement?.returnDeduction).toBe(400);
    expect(view.settlement?.finalDepositAmount).toBe(600);
    expect(view.delivery?.returnedQty).toBe(2);
    expect(view.delivery?.netCustomerHolding).toBe(3);
    expect(view.dueAmount).toBe(0);
  });

  it('TEST 3: Order: 5 jars (₹1,500). Delivery: 4 delivered, 0 returned -> Original ₹1,500, Final ₹1,200, Short 1', () => {
    const view = buildCustomerOrderView({
      id: 'ORD-TEST-3',
      totalAmount: 1500,
      status: 'DELIVERED',
      paidAmount: 1200,
      deliveryVerification: {
        completedAt: new Date(),
        isVerified: true,
        deliveredQty: 4,
        returnedQty: 0,
        undeliveredQty: 1,
        shortDeliveryReason: 'Customer requested partial delivery',
        refillRate: 100,
        depositRate: 200,
        calculatedTotal: 1200,
        amountReceived: 1200,
      },
    });

    expect(view.originalTotal).toBe(1500);
    expect(view.settlement?.calculatedTotal).toBe(1200);
    expect(view.delivery?.deliveredQty).toBe(4);
    expect(view.delivery?.shortQty).toBe(1);
    expect(view.delivery?.shortDeliveryReason).toBe('Customer requested partial delivery');
    expect(view.dueAmount).toBe(0);
  });

  it('TEST 4: Order: 5 jars (₹1,500). Delivery: 4 delivered, 1 returned -> Original ₹1,500, Final ₹1,000, Short 1, Net holding +3', () => {
    const view = buildCustomerOrderView({
      id: 'ORD-TEST-4',
      totalAmount: 1500,
      status: 'DELIVERED',
      paidAmount: 1000,
      deliveryVerification: {
        completedAt: new Date(),
        isVerified: true,
        deliveredQty: 4,
        returnedQty: 1,
        undeliveredQty: 1,
        refillRate: 100,
        depositRate: 200,
        calculatedTotal: 1000,
        amountReceived: 1000,
      },
    });

    expect(view.originalTotal).toBe(1500);
    expect(view.settlement?.refillAmount).toBe(400);
    expect(view.settlement?.baseDepositAmount).toBe(800);
    expect(view.settlement?.returnDeduction).toBe(200);
    expect(view.settlement?.finalDepositAmount).toBe(600);
    expect(view.settlement?.calculatedTotal).toBe(1000);
    expect(view.delivery?.deliveredQty).toBe(4);
    expect(view.delivery?.returnedQty).toBe(1);
    expect(view.delivery?.shortQty).toBe(1);
    expect(view.delivery?.netCustomerHolding).toBe(3);
  });

  it('TEST 5: Partial payment: Final ₹1,000, Paid ₹800 -> Remaining Due ₹200', () => {
    const view = buildCustomerOrderView({
      id: 'ORD-TEST-5',
      totalAmount: 1500,
      status: 'DELIVERED',
      paidAmount: 800,
      deliveryVerification: {
        completedAt: new Date(),
        isVerified: true,
        deliveredQty: 4,
        returnedQty: 1,
        undeliveredQty: 1,
        calculatedTotal: 1000,
        amountReceived: 800,
      },
    });

    expect(view.settlement?.calculatedTotal).toBe(1000);
    expect(view.settlement?.actualAmountReceived).toBe(800);
    expect(view.settlement?.remainingDue).toBe(200);
    expect(view.dueAmount).toBe(200);
  });

  it('TEST 6: Manual payment amount: Calculated ₹1,000, Actual received ₹900 -> Paid ₹900, Due ₹100', () => {
    const view = buildCustomerOrderView({
      id: 'ORD-TEST-6',
      totalAmount: 1500,
      status: 'DELIVERED',
      paidAmount: 900,
      deliveryVerification: {
        completedAt: new Date(),
        isVerified: true,
        deliveredQty: 4,
        returnedQty: 1,
        calculatedTotal: 1000, // Calculated settlement stays 1000
        amountReceived: 900,  // Received manually entered as 900
      },
    });

    expect(view.settlement?.calculatedTotal).toBe(1000);
    expect(view.settlement?.actualAmountReceived).toBe(900);
    expect(view.settlement?.remainingDue).toBe(100);
  });

  it('TEST 7: Normal pending order -> Customer UI remains original, no settlement object', () => {
    const view = buildCustomerOrderView({
      id: 'ORD-TEST-7',
      totalAmount: 1500,
      status: 'PENDING',
      paidAmount: 0,
    });

    expect(view.originalTotal).toBe(1500);
    expect(view.hasDeliverySettlement).toBe(false);
    expect(view.delivery).toBeNull();
    expect(view.settlement).toBeNull();
    expect(view.dueAmount).toBe(1500);
  });

  it('TEST 8: Confirmed order -> Customer UI remains original', () => {
    const view = buildCustomerOrderView({
      id: 'ORD-TEST-8',
      totalAmount: 1500,
      status: 'CONFIRMED',
      paidAmount: 1500,
    });

    expect(view.hasDeliverySettlement).toBe(false);
    expect(view.delivery).toBeNull();
    expect(view.settlement).toBeNull();
    expect(view.dueAmount).toBe(0);
  });

  it('TEST 9: Out for Delivery -> Do not show completed delivery settlement until actual completion', () => {
    const view = buildCustomerOrderView({
      id: 'ORD-TEST-9',
      totalAmount: 1500,
      status: 'OUT_FOR_DELIVERY',
      paidAmount: 0,
      deliveryVerification: {
        deliveredQty: 0,
        returnedQty: 0,
        isVerified: false,
      },
    });

    expect(view.hasDeliverySettlement).toBe(false);
    expect(view.delivery).toBeNull();
    expect(view.settlement).toBeNull();
  });

  it('TEST 10: Two customer orders exist: Completing Order A does not affect Order B', () => {
    const orderA = buildCustomerOrderView({
      id: 'ORD-A',
      totalAmount: 1500,
      status: 'DELIVERED',
      paidAmount: 1100,
      deliveryVerification: {
        completedAt: new Date(),
        isVerified: true,
        deliveredQty: 5,
        returnedQty: 2,
        calculatedTotal: 1100,
        amountReceived: 1100,
      },
    });

    const orderB = buildCustomerOrderView({
      id: 'ORD-B',
      totalAmount: 1500,
      status: 'OUT_FOR_DELIVERY',
      paidAmount: 0,
    });

    // Order A is settled
    expect(orderA.hasDeliverySettlement).toBe(true);
    expect(orderA.settlement?.calculatedTotal).toBe(1100);

    // Order B remains unchanged
    expect(orderB.hasDeliverySettlement).toBe(false);
    expect(orderB.settlement).toBeNull();
    expect(orderB.originalTotal).toBe(1500);
    expect(orderB.dueAmount).toBe(1500);
  });
});
