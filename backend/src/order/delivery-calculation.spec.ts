import {
  calculateDeliveryAmount,
  calculateItemDelivery,
  calculateMultiItemDelivery,
} from './utils/delivery-calculation.util';

describe('Delivery Settlement Calculation Engine (Business Rules & Edge Cases)', () => {
  const standardRefillRate = 100;
  const standardDepositRate = 200;

  it('CASE 1: Ordered 5, Delivered 5, Returned 0 -> Refill: ₹500, Deposit: ₹1,000, Total: ₹1,500', () => {
    const res = calculateDeliveryAmount({
      deliveredQty: 5,
      returnedQty: 0,
      refillRate: standardRefillRate,
      depositRate: standardDepositRate,
    });

    expect(res.deliveredQty).toBe(5);
    expect(res.returnedQty).toBe(0);
    expect(res.refillAmount).toBe(500);
    expect(res.baseDeposit).toBe(1000);
    expect(res.returnDeduction).toBe(0);
    expect(res.finalDeposit).toBe(1000);
    expect(res.depositQty).toBe(5);
    expect(res.depositAmount).toBe(1000);
    expect(res.calculatedAmount).toBe(1500);
  });

  it('CASE 2: Ordered 5, Delivered 4, Returned 0 -> Refill: ₹400, Deposit: ₹800, Total: ₹1,200', () => {
    const res = calculateDeliveryAmount({
      deliveredQty: 4,
      returnedQty: 0,
      refillRate: standardRefillRate,
      depositRate: standardDepositRate,
    });

    expect(res.deliveredQty).toBe(4);
    expect(res.returnedQty).toBe(0);
    expect(res.refillAmount).toBe(400);
    expect(res.baseDeposit).toBe(800);
    expect(res.returnDeduction).toBe(0);
    expect(res.finalDeposit).toBe(800);
    expect(res.depositQty).toBe(4);
    expect(res.depositAmount).toBe(800);
    expect(res.calculatedAmount).toBe(1200);
  });

  it('CASE 3: Ordered 5, Delivered 4, Returned 1 -> Refill: ₹400, Base Deposit: ₹800, Return Deduction: -₹200, Final Deposit: ₹600, Total: ₹1,000', () => {
    const res = calculateDeliveryAmount({
      deliveredQty: 4,
      returnedQty: 1,
      refillRate: standardRefillRate,
      depositRate: standardDepositRate,
    });

    expect(res.deliveredQty).toBe(4);
    expect(res.returnedQty).toBe(1);
    expect(res.refillAmount).toBe(400);
    expect(res.baseDeposit).toBe(800);
    expect(res.returnDeduction).toBe(200);
    expect(res.finalDeposit).toBe(600);
    expect(res.depositQty).toBe(3);
    expect(res.depositAmount).toBe(600);
    expect(res.calculatedAmount).toBe(1000);
  });

  it('CASE 4: Ordered 5, Delivered 4, Returned 2 -> Refill: ₹400, Base Deposit: ₹800, Return Deduction: -₹400, Final Deposit: ₹400, Total: ₹800', () => {
    const res = calculateDeliveryAmount({
      deliveredQty: 4,
      returnedQty: 2,
      refillRate: standardRefillRate,
      depositRate: standardDepositRate,
    });

    expect(res.deliveredQty).toBe(4);
    expect(res.returnedQty).toBe(2);
    expect(res.refillAmount).toBe(400);
    expect(res.baseDeposit).toBe(800);
    expect(res.returnDeduction).toBe(400);
    expect(res.finalDeposit).toBe(400);
    expect(res.depositQty).toBe(2);
    expect(res.depositAmount).toBe(400);
    expect(res.calculatedAmount).toBe(800);
  });

  it('CASE 5: Ordered 5, Delivered 5, Returned 5 -> Refill: ₹500, Base Deposit: ₹1,000, Return Deduction: -₹1,000, Final Deposit: ₹0, Total: ₹500', () => {
    const res = calculateDeliveryAmount({
      deliveredQty: 5,
      returnedQty: 5,
      refillRate: standardRefillRate,
      depositRate: standardDepositRate,
    });

    expect(res.deliveredQty).toBe(5);
    expect(res.returnedQty).toBe(5);
    expect(res.refillAmount).toBe(500);
    expect(res.baseDeposit).toBe(1000);
    expect(res.returnDeduction).toBe(1000);
    expect(res.finalDeposit).toBe(0);
    expect(res.depositQty).toBe(0);
    expect(res.depositAmount).toBe(0);
    expect(res.calculatedAmount).toBe(500);
  });

  it('CASE 6 — MULTIPLE ITEMS: Item A (3 out, 3 delv, 1 ret) + Item B (2 out, 1 delv, 1 ret) -> Grand total ₹800', () => {
    const itemA = {
      id: 'alloc-a',
      name: 'Biodrops / Company Owned',
      outQty: 3,
      deliveredQty: 3,
      returnedQty: 1,
      refillRate: 100,
      depositRate: 200,
    };

    const itemB = {
      id: 'alloc-b',
      name: 'Distributor Owned',
      outQty: 2,
      deliveredQty: 1,
      returnedQty: 1,
      refillRate: 100,
      depositRate: 200,
    };

    const calcA = calculateItemDelivery(itemA);
    expect(calcA.refillAmount).toBe(300);
    expect(calcA.baseDeposit).toBe(600);
    expect(calcA.returnDeduction).toBe(200);
    expect(calcA.finalDeposit).toBe(400);
    expect(calcA.totalAmount).toBe(700);

    const calcB = calculateItemDelivery(itemB);
    expect(calcB.refillAmount).toBe(100);
    expect(calcB.baseDeposit).toBe(200);
    expect(calcB.returnDeduction).toBe(200);
    expect(calcB.finalDeposit).toBe(0);
    expect(calcB.totalAmount).toBe(100);

    const multi = calculateMultiItemDelivery([itemA, itemB]);
    expect(multi.totalOutQty).toBe(5);
    expect(multi.totalDeliveredQty).toBe(4);
    expect(multi.totalReturnedQty).toBe(2);
    expect(multi.totalUndeliveredQty).toBe(1);
    expect(multi.totalRefillAmount).toBe(400);
    expect(multi.totalBaseDeposit).toBe(800);
    expect(multi.totalReturnDeduction).toBe(400);
    expect(multi.totalFinalDeposit).toBe(400);
    expect(multi.grandCalculatedAmount).toBe(800);
  });

  it('CASE 7: Returned empty jars cannot exceed delivered jars -> Clamped safely per item', () => {
    const res = calculateDeliveryAmount({
      deliveredQty: 3,
      returnedQty: 5,
      refillRate: 100,
      depositRate: 200,
    });

    expect(res.deliveredQty).toBe(3);
    expect(res.returnedQty).toBe(3);
    expect(res.baseDeposit).toBe(600);
    expect(res.returnDeduction).toBe(600);
    expect(res.finalDeposit).toBe(0);
    expect(res.depositQty).toBe(0);
    expect(res.refillAmount).toBe(300);
    expect(res.calculatedAmount).toBe(300);
  });

  it('CASE 8: Delivered cannot exceed Out for Delivery if outQty is provided', () => {
    const res = calculateItemDelivery({
      outQty: 4,
      deliveredQty: 6,
      returnedQty: 1,
      refillRate: 100,
      depositRate: 200,
    });

    expect(res.deliveredQty).toBe(4);
    expect(res.returnedQty).toBe(1);
    expect(res.refillAmount).toBe(400);
    expect(res.baseDeposit).toBe(800);
    expect(res.returnDeduction).toBe(200);
    expect(res.finalDeposit).toBe(600);
    expect(res.totalAmount).toBe(1000);
  });

  it('CASE 9: Negative quantities are clamped to 0', () => {
    const res = calculateDeliveryAmount({
      deliveredQty: -2,
      returnedQty: -1,
      refillRate: 100,
      depositRate: 200,
    });

    expect(res.deliveredQty).toBe(0);
    expect(res.returnedQty).toBe(0);
    expect(res.calculatedAmount).toBe(0);
  });

  it('CASE 10: Non-standard rates (e.g. ₹85 refill, ₹150 deposit)', () => {
    const res = calculateDeliveryAmount({
      deliveredQty: 4,
      returnedQty: 2,
      refillRate: 85,
      depositRate: 150,
    });

    expect(res.refillAmount).toBe(340); // 4 * 85
    expect(res.baseDeposit).toBe(600);  // 4 * 150
    expect(res.returnDeduction).toBe(300); // 2 * 150
    expect(res.finalDeposit).toBe(300); // 600 - 300
    expect(res.depositQty).toBe(2);     // 4 - 2
    expect(res.depositAmount).toBe(300);
    expect(res.calculatedAmount).toBe(640);
  });
});
