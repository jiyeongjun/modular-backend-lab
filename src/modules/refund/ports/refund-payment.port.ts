import type { Money } from "../../../shared/money/index.js";
import type { Result } from "../../../shared/result/index.js";

export type RefundPaymentCommand = Readonly<{
  paymentId: string;
  amount: Money;
  reason: string;
  idempotencyKey: string;
}>;

export type RefundedPayment = Readonly<{
  paymentId: string;
  status: "REFUNDED";
}>;

export type RefundPaymentError =
  | {
      type: "RefundPaymentProviderRejected";
      providerCode: string;
      statusCode: number;
      retryable: boolean;
      message: string;
    }
  | {
      type: "RefundPaymentRejected";
      reason: string;
      message: string;
    };

export type RefundPaymentPort = {
  refund(command: RefundPaymentCommand): Promise<Result<RefundedPayment, RefundPaymentError>>;
};
