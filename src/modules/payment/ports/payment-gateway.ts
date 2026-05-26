import type { Money } from "../../../shared/money/index.js";
import type { Result } from "../../../shared/result/index.js";
import type { PaymentProvider } from "../domain/index.js";

export type PaymentGatewayPayment = Readonly<{
  provider: PaymentProvider;
  providerPaymentKey: string;
  orderId: string;
  amount: Money;
  providerStatus: string;
  method: string | null;
  receiptUrl: string | null;
  approvedAt: Date | null;
  cancelledAt: Date | null;
}>;

export type PaymentGatewayError = Readonly<{
  type: "PaymentGatewayRejected";
  provider: PaymentProvider;
  code: string;
  message: string;
  statusCode: number;
  retryable: boolean;
}>;

export type ConfirmGatewayPaymentCommand = Readonly<{
  paymentKey: string;
  orderId: string;
  amount: Money;
  idempotencyKey: string;
}>;

export type CancelGatewayPaymentCommand = Readonly<{
  paymentKey: string;
  cancelReason: string;
  idempotencyKey: string;
}>;

export type PaymentGateway = {
  confirmPayment(
    command: ConfirmGatewayPaymentCommand,
  ): Promise<Result<PaymentGatewayPayment, PaymentGatewayError>>;
  cancelPayment(
    command: CancelGatewayPaymentCommand,
  ): Promise<Result<PaymentGatewayPayment, PaymentGatewayError>>;
};
