import type { Money } from "../../../shared/money/index.js";
import type { RefundRestock } from "./refund.js";

export type RefundRequested = Readonly<{
  type: "RefundRequested";
  aggregateType: "Refund";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    refundId: string;
    orderId: string;
    paymentId: string;
    idempotencyKey: string;
    paymentRefundIdempotencyKey: string;
    restockIdempotencyKey: string | null;
    amount: Money;
    reason: string;
    returnRequired: boolean;
    restock: RefundRestock | null;
  };
}>;

export type RefundApproved = Readonly<{
  type: "RefundApproved";
  aggregateType: "Refund";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    refundId: string;
    orderId: string;
    paymentId: string;
    approvedAt: Date;
  };
}>;

export type RefundRejected = Readonly<{
  type: "RefundRejected";
  aggregateType: "Refund";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    refundId: string;
    orderId: string;
    paymentId: string;
    reason: string;
    rejectedAt: Date;
  };
}>;

export type RefundPaymentRefunded = Readonly<{
  type: "RefundPaymentRefunded";
  aggregateType: "Refund";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    refundId: string;
    orderId: string;
    paymentId: string;
    amount: Money;
    paymentRefundedAt: Date;
  };
}>;

export type RefundRestocked = Readonly<{
  type: "RefundRestocked";
  aggregateType: "Refund";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    refundId: string;
    orderId: string;
    restock: RefundRestock;
    restockIdempotencyKey: string;
    restockedAt: Date;
  };
}>;

export type RefundCompleted = Readonly<{
  type: "RefundCompleted";
  aggregateType: "Refund";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    refundId: string;
    orderId: string;
    paymentId: string;
    completedAt: Date;
  };
}>;

export type RefundEvent =
  | RefundRequested
  | RefundApproved
  | RefundRejected
  | RefundPaymentRefunded
  | RefundRestocked
  | RefundCompleted;
