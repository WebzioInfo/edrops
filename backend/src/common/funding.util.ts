import { WalletTransactionType, TransactionType } from '@prisma/client';

export interface OrderFundingMeta {
  prepaidJars?: number;
  walletDeducted?: number;
  codDue?: number;
  unitPrice?: number;
  totalJars?: number;
  totalAmount?: number;
  reversedAt?: string;
  reversalReason?: string;
  refundedPrepaidJars?: number;
  refundedWalletAmount?: number;
}

export interface ReversalResult {
  reversed: boolean;
  prepaidJarsRestored: number;
  walletAmountRestored: number;
  reason?: string;
}

export interface DeliveryAllocationResult {
  prepaidDelivered: number;
  prepaidToRefund: number;
  walletDelivered: number;
  walletToRefund: number;
  codDelivered: number;
  actualCODDue: number;
  jarsToDeductFromBalance: number;
}

/**
 * Safely parses the structured JSON funding metadata from adminNotes.
 */
export function parseFundingMeta(adminNotes?: string | null): OrderFundingMeta | null {
  if (!adminNotes || typeof adminNotes !== 'string') return null;
  try {
    const parsed = JSON.parse(adminNotes);
    if (parsed && typeof parsed === 'object') {
      return parsed as OrderFundingMeta;
    }
  } catch {
    // Not a JSON string (e.g., standard plain text notes)
  }
  return null;
}

/**
 * Calculates how actual delivered jars map across funding tiers (Prepaid -> Wallet -> COD)
 * and determines exact refunds for undelivered quantities.
 */
export function calculateDeliveryFundingAllocation(params: {
  fundingMeta: OrderFundingMeta | null;
  confirmedDeliveredQty: number;
  paymentMethod?: string | null;
}): DeliveryAllocationResult {
  const { fundingMeta, confirmedDeliveredQty, paymentMethod } = params;

  // Case 1: Standard subscription or split-funded order with metadata
  if (fundingMeta) {
    const prepaidAllocated = Math.max(0, Number(fundingMeta.prepaidJars || 0));
    const walletDeducted = Math.max(0, Number(fundingMeta.walletDeducted || 0));
    const unitPrice = Number(fundingMeta.unitPrice || 0) || (fundingMeta.totalAmount && fundingMeta.totalJars ? fundingMeta.totalAmount / fundingMeta.totalJars : 60);
    const walletAllocatedJars = unitPrice > 0 ? Math.floor(walletDeducted / unitPrice) : 0;
    const codDue = Math.max(0, Number(fundingMeta.codDue || 0));
    const codAllocatedJars = unitPrice > 0 ? Math.floor(codDue / unitPrice) : 0;

    // 1. Prepaid Tier
    const prepaidDelivered = Math.min(confirmedDeliveredQty, prepaidAllocated);
    const prepaidToRefund = Math.max(0, prepaidAllocated - prepaidDelivered);

    // 2. Wallet Tier
    const remainingAfterPrepaid = Math.max(0, confirmedDeliveredQty - prepaidDelivered);
    const walletDelivered = Math.min(remainingAfterPrepaid, walletAllocatedJars);
    const walletJarsUndelivered = Math.max(0, walletAllocatedJars - walletDelivered);
    const walletToRefund = walletJarsUndelivered * unitPrice;

    // 3. COD Tier
    const remainingAfterWallet = Math.max(0, remainingAfterPrepaid - walletDelivered);
    const codDelivered = Math.min(remainingAfterWallet, codAllocatedJars);
    const actualCODDue = codDelivered * unitPrice;

    return {
      prepaidDelivered,
      prepaidToRefund,
      walletDelivered,
      walletToRefund,
      codDelivered,
      actualCODDue,
      jarsToDeductFromBalance: 0, // Never deduct additional jars from balance for funded orders
    };
  }

  // Case 2: Legacy or one-time orders without metadata
  // Only deduct if explicit PREPAID_PACKAGE without pre-deductions
  const isPrepaidMethod = paymentMethod === 'PREPAID_PACKAGE';
  return {
    prepaidDelivered: isPrepaidMethod ? confirmedDeliveredQty : 0,
    prepaidToRefund: 0,
    walletDelivered: 0,
    walletToRefund: 0,
    codDelivered: isPrepaidMethod ? 0 : confirmedDeliveredQty,
    actualCODDue: 0,
    jarsToDeductFromBalance: isPrepaidMethod ? confirmedDeliveredQty : 0,
  };
}

/**
 * Atomically and idempotently reverses prepaid jars and wallet cash deducted for an order.
 * Prevents double-reversals via metadata tagging and unique transaction reference checks.
 */
export async function revertOrderFunding(
  tx: any,
  params: {
    orderId: string;
    customerId: string;
    reason: string;
    referenceId: string;
    adminNotes?: string | null;
  },
): Promise<ReversalResult> {
  const meta = parseFundingMeta(params.adminNotes);
  if (!meta) {
    return {
      reversed: false,
      prepaidJarsRestored: 0,
      walletAmountRestored: 0,
      reason: 'No structured funding metadata found',
    };
  }

  // Idempotency: prevent double reversal if already marked reversed
  if (meta.reversedAt) {
    return {
      reversed: false,
      prepaidJarsRestored: 0,
      walletAmountRestored: 0,
      reason: `Order funding already reversed at ${meta.reversedAt}`,
    };
  }

  let jarsRestored = 0;
  let walletRestored = 0;

  // 1. Symmetrically restore wallet funds if deducted
  if (meta.walletDeducted && meta.walletDeducted > 0) {
    // Check if refund transaction already exists for this reference
    const existingRefund = await tx.walletTransaction.findFirst({
      where: {
        referenceId: params.referenceId,
        type: WalletTransactionType.REFUND,
      },
    });

    if (!existingRefund) {
      const wallet = await tx.wallet.findUnique({
        where: { customerId: params.customerId },
      });
      if (wallet) {
        const balanceBefore = Number(wallet.balance);
        const balanceAfter = balanceBefore + Number(meta.walletDeducted);
        await tx.wallet.update({
          where: { customerId: params.customerId },
          data: { balance: balanceAfter },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: WalletTransactionType.REFUND,
            amount: meta.walletDeducted,
            balanceBefore,
            balanceAfter,
            description: `Refund for order ${params.orderId}: ${params.reason}`,
            referenceId: params.referenceId,
          },
        });
        walletRestored = Number(meta.walletDeducted);
      }
    }
  }

  // 2. Symmetrically restore prepaid jars if deducted
  if (meta.prepaidJars && meta.prepaidJars > 0) {
    const existingJarRefund = await tx.transaction.findFirst({
      where: {
        referenceId: params.referenceId,
        type: TransactionType.REFUND,
      },
    });

    if (!existingJarRefund) {
      const jarBalance = await tx.jarBalance.findFirst({
        where: { customerId: params.customerId },
      });
      if (jarBalance) {
        const balanceBefore = jarBalance.availableJars;
        const balanceAfter = balanceBefore + meta.prepaidJars;
        await tx.jarBalance.update({
          where: { id: jarBalance.id },
          data: { availableJars: balanceAfter },
        });
        await tx.transaction.create({
          data: {
            customerId: params.customerId,
            type: TransactionType.REFUND,
            amountJars: meta.prepaidJars,
            balanceBefore,
            balanceAfter,
            referenceId: params.referenceId,
            description: `Restored ${meta.prepaidJars} jars for order ${params.orderId}: ${params.reason}`,
          },
        });
        jarsRestored = meta.prepaidJars;
      }
    }
  }

  // Stamp metadata with reversal audit details to guarantee idempotency
  meta.reversedAt = new Date().toISOString();
  meta.reversalReason = params.reason;
  meta.refundedPrepaidJars = jarsRestored;
  meta.refundedWalletAmount = walletRestored;

  await tx.order.update({
    where: { id: params.orderId },
    data: { adminNotes: JSON.stringify(meta) },
  });

  return {
    reversed: true,
    prepaidJarsRestored: jarsRestored,
    walletAmountRestored: walletRestored,
  };
}
