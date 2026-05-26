import type { Money } from "../../../shared/money/index.js";
import type { PaymentProvider } from "./payment.js";

export type PaymentStarted = Readonly<{
  type: "PaymentStarted";
  aggregateType: "Payment";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    paymentId: string;
    orderId: string;
    provider: PaymentProvider;
    amount: Money;
    providerPaymentKey: string;
    confirmIdempotencyKey: string;
  };
}>;

export type PaymentAuthorized = Readonly<{
  type: "PaymentAuthorized";
  aggregateType: "Payment";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    paymentId: string;
    orderId: string;
    amount: Money;
    providerPaymentKey: string;
    providerStatus: string;
    method: string | null;
    receiptUrl: string | null;
    authorizedAt: Date;
  };
}>;

export type PaymentAuthorizationFailed = Readonly<{
  type: "PaymentAuthorizationFailed";
  aggregateType: "Payment";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    paymentId: string;
    orderId: string;
    amount: Money;
    providerPaymentKey: string;
    providerStatus: string | null;
    failureCode: string;
    failureMessage: string;
    failedAt: Date;
  };
}>;

export type PaymentCancelled = Readonly<{
  type: "PaymentCancelled";
  aggregateType: "Payment";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    paymentId: string;
    orderId: string;
    amount: Money;
    providerPaymentKey: string;
    cancelIdempotencyKey: string;
    providerStatus: string;
    reason: string;
    cancelledAt: Date;
  };
}>;

export type PaymentEvent =
  | PaymentStarted
  | PaymentAuthorized
  | PaymentAuthorizationFailed
  | PaymentCancelled;
