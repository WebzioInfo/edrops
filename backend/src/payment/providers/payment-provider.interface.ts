export interface CreateOrderParams {
  amount: number;
  currency?: string;
  receiptId: string;
}

export interface PaymentOrderInfo {
  providerOrderId: string;
  amount: number;
  currency: string;
}

export interface VerifySignatureParams {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface WebhookVerifyParams {
  signature: string;
  payload: string;
}

export interface RefundParams {
  providerPaymentId: string;
  amount: number;
  receiptId: string;
}

export interface PaymentProvider {
  getProviderName(): string;
  createOrder(params: CreateOrderParams): Promise<PaymentOrderInfo>;
  verifyPaymentSignature(params: VerifySignatureParams): boolean;
  verifyWebhookSignature(params: WebhookVerifyParams): boolean;
  processRefund(
    params: RefundParams,
  ): Promise<{ refundId: string; status: string }>;
}
