/**
 * Canonical Delivery Settlement Calculation Utility (Frontend)
 *
 * Implements authoritative business logic for delivery-time order settlement:
 *
 * Per item:
 * - baseDeposit = itemDeliveredQty × itemDepositRate
 * - returnDeduction = itemReturnedQty × itemDepositRate
 * - finalDeposit = max(0, baseDeposit - returnDeduction)
 * - refillAmount = itemDeliveredQty × itemRefillRate
 * - itemTotal = refillAmount + finalDeposit
 *
 * Grand total:
 * - grandCalculatedAmount = sum(itemTotal)
 *
 * Core Invariants:
 * 1. Undelivered jars do not generate payment.
 * 2. Returned empty jars directly offset today's deposit.
 * 3. returnedQty cannot exceed deliveredQty for each item.
 * 4. deliveredQty cannot exceed outForDeliveryQty for each item.
 * 5. Actual delivery-time counts supersede order-time return intentions.
 */

export interface ItemDeliveryCalculationParams {
  id?: string;
  name?: string;
  outQty?: number;
  deliveredQty: number;
  returnedQty: number;
  refillRate: number;
  depositRate: number;
}

export interface ItemDeliveryCalculationResult {
  id?: string;
  name?: string;
  outQty?: number;
  deliveredQty: number;
  returnedQty: number;
  refillRate: number;
  depositRate: number;
  refillAmount: number;
  baseDeposit: number;
  returnDeduction: number;
  finalDeposit: number;
  depositQty: number;
  depositAmount: number; // alias to finalDeposit
  totalAmount: number;
  calculatedAmount: number; // alias to totalAmount
}

export type DeliveryCalculationParams = ItemDeliveryCalculationParams;
export type DeliveryCalculationResult = ItemDeliveryCalculationResult;

export interface MultiItemDeliveryCalculationResult {
  items: ItemDeliveryCalculationResult[];
  totalOutQty: number;
  totalDeliveredQty: number;
  totalReturnedQty: number;
  totalUndeliveredQty: number;
  totalRefillAmount: number;
  totalBaseDeposit: number;
  totalReturnDeduction: number;
  totalFinalDeposit: number;
  grandCalculatedAmount: number;
  // Aliases for compatibility
  refillAmount: number;
  depositAmount: number;
  depositQty: number;
  calculatedAmount: number;
  refillRate: number;
  depositRate: number;
}

export function calculateItemDelivery(params: ItemDeliveryCalculationParams): ItemDeliveryCalculationResult {
  const rawDelivered = Math.max(0, Math.floor(Number(params.deliveredQty) || 0));
  const outQty = params.outQty !== undefined ? Math.max(0, Math.floor(Number(params.outQty) || 0)) : undefined;
  // Safe clamp: deliveredQty cannot exceed outQty if outQty is given
  const deliveredQty = outQty !== undefined ? Math.min(rawDelivered, outQty) : rawDelivered;

  // Safe clamp: returnedQty cannot exceed deliveredQty or be negative
  const rawReturned = Math.max(0, Math.floor(Number(params.returnedQty) || 0));
  const returnedQty = Math.min(rawReturned, deliveredQty);

  const refillRate = Math.max(0, Number(params.refillRate) || 0);
  const depositRate = Math.max(0, Number(params.depositRate) || 0);

  const refillAmount = Number((deliveredQty * refillRate).toFixed(2));
  const baseDeposit = Number((deliveredQty * depositRate).toFixed(2));
  const returnDeduction = Number((returnedQty * depositRate).toFixed(2));
  const finalDeposit = Number(Math.max(0, baseDeposit - returnDeduction).toFixed(2));
  const depositQty = Math.max(0, deliveredQty - returnedQty);
  const totalAmount = Number((refillAmount + finalDeposit).toFixed(2));

  return {
    id: params.id,
    name: params.name,
    outQty,
    deliveredQty,
    returnedQty,
    refillRate,
    depositRate,
    refillAmount,
    baseDeposit,
    returnDeduction,
    finalDeposit,
    depositQty,
    depositAmount: finalDeposit,
    totalAmount,
    calculatedAmount: totalAmount,
  };
}

export function calculateDeliveryAmount(params: DeliveryCalculationParams): DeliveryCalculationResult {
  return calculateItemDelivery(params);
}

export function calculateMultiItemDelivery(
  items: ItemDeliveryCalculationParams[]
): MultiItemDeliveryCalculationResult {
  const itemResults = items.map((item) => calculateItemDelivery(item));

  const totalOutQty = itemResults.reduce((sum, i) => sum + (i.outQty ?? i.deliveredQty), 0);
  const totalDeliveredQty = itemResults.reduce((sum, i) => sum + i.deliveredQty, 0);
  const totalReturnedQty = itemResults.reduce((sum, i) => sum + i.returnedQty, 0);
  const totalUndeliveredQty = Math.max(0, totalOutQty - totalDeliveredQty);

  const totalRefillAmount = Number(itemResults.reduce((sum, i) => sum + i.refillAmount, 0).toFixed(2));
  const totalBaseDeposit = Number(itemResults.reduce((sum, i) => sum + i.baseDeposit, 0).toFixed(2));
  const totalReturnDeduction = Number(itemResults.reduce((sum, i) => sum + i.returnDeduction, 0).toFixed(2));
  const totalFinalDeposit = Number(itemResults.reduce((sum, i) => sum + i.finalDeposit, 0).toFixed(2));
  const grandCalculatedAmount = Number((totalRefillAmount + totalFinalDeposit).toFixed(2));

  const defaultRefillRate = itemResults.length > 0 ? itemResults[0].refillRate : 0;
  const defaultDepositRate = itemResults.length > 0 ? itemResults[0].depositRate : 0;
  const totalDepositQty = itemResults.reduce((sum, i) => sum + i.depositQty, 0);

  return {
    items: itemResults,
    totalOutQty,
    totalDeliveredQty,
    totalReturnedQty,
    totalUndeliveredQty,
    totalRefillAmount,
    totalBaseDeposit,
    totalReturnDeduction,
    totalFinalDeposit,
    grandCalculatedAmount,
    refillAmount: totalRefillAmount,
    depositAmount: totalFinalDeposit,
    depositQty: totalDepositQty,
    calculatedAmount: grandCalculatedAmount,
    refillRate: defaultRefillRate,
    depositRate: defaultDepositRate,
  };
}
