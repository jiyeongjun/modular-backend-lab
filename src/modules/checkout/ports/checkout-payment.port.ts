import type { Money } from "../../../shared/money/index.js";
import type { Result } from "../../../shared/result/index.js";

export type CheckoutPayment = Readonly<{
  paymentId: string;
  orderId: string;
  status: "AUTHORIZED" | "CANCELLED";
}>;

export type CheckoutPaymentError =
  | {
      type: "CheckoutPaymentProviderRejected";
      providerCode: string;
      statusCode: number;
      retryable: boolean;
      message: string;
    }
  | { type: "CheckoutPaymentNotAuthorized"; status: string; message: string }
  | { type: "CheckoutPaymentRejected"; reason: string; message: string };

export type ConfirmCheckoutPaymentCommand = Readonly<{
  orderId: string;
  paymentKey: string;
  amount: Money;
  idempotencyKey: string;
}>;

export type CancelCheckoutPaymentCommand = Readonly<{
  paymentId: string;
  idempotencyKey: string;
  reason: string;
}>;

export type CheckoutPaymentPort = {
  confirm(
    command: ConfirmCheckoutPaymentCommand,
  ): Promise<Result<CheckoutPayment, CheckoutPaymentError>>;
  cancel(
    command: CancelCheckoutPaymentCommand,
  ): Promise<Result<CheckoutPayment, CheckoutPaymentError>>;
};
