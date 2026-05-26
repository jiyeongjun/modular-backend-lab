import type { Money } from "../../../shared/money/index.js";

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
    failureCode: string;
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
    reason: string;
  };
}>;

export type PaymentEvent = PaymentAuthorized | PaymentAuthorizationFailed | PaymentCancelled;
