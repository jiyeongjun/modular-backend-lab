import type { Money } from "../../../shared/money/index.js";

export type RefundStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "PAYMENT_REFUNDED"
  | "RESTOCKED"
  | "COMPLETED";

export type RefundRestock = Readonly<{
  sku: string;
  quantity: number;
}>;

type RefundBase = Readonly<{
  id: string;
  orderId: string;
  paymentId: string;
  idempotencyKey: string;
  paymentRefundIdempotencyKey: string;
  restockIdempotencyKey: string | null;
  amount: Money;
  reason: string;
  returnRequired: boolean;
  restock: RefundRestock | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

type InitialTimeline = Readonly<{
  approvedAt: null;
  rejectedAt: null;
  rejectionReason: null;
  paymentRefundedAt: null;
  restockedAt: null;
  completedAt: null;
}>;

type ApprovedTimeline = Readonly<{
  approvedAt: Date;
  rejectedAt: null;
  rejectionReason: null;
  paymentRefundedAt: null;
  restockedAt: null;
  completedAt: null;
}>;

type PaymentRefundedTimeline = Readonly<{
  approvedAt: Date;
  rejectedAt: null;
  rejectionReason: null;
  paymentRefundedAt: Date;
  restockedAt: null;
  completedAt: null;
}>;

type RestockedTimeline = Readonly<{
  approvedAt: Date;
  rejectedAt: null;
  rejectionReason: null;
  paymentRefundedAt: Date;
  restockedAt: Date;
  completedAt: null;
}>;

export type RequestedRefund = RefundBase &
  InitialTimeline &
  Readonly<{
    status: "REQUESTED";
  }>;

export type ApprovedRefund = RefundBase &
  ApprovedTimeline &
  Readonly<{
    status: "APPROVED";
  }>;

export type RejectedRefund = RefundBase &
  Readonly<{
    status: "REJECTED";
    approvedAt: null;
    rejectedAt: Date;
    rejectionReason: string;
    paymentRefundedAt: null;
    restockedAt: null;
    completedAt: null;
  }>;

export type PaymentRefundedRefund = RefundBase &
  PaymentRefundedTimeline &
  Readonly<{
    status: "PAYMENT_REFUNDED";
  }>;

export type RestockedRefund = RefundBase &
  RestockedTimeline &
  Readonly<{
    status: "RESTOCKED";
    returnRequired: true;
    restock: RefundRestock;
    restockIdempotencyKey: string;
  }>;

export type CompletedRefund = RefundBase &
  Readonly<{
    status: "COMPLETED";
    approvedAt: Date;
    rejectedAt: null;
    rejectionReason: null;
    paymentRefundedAt: Date;
    completedAt: Date;
  }> &
  (
    | Readonly<{
        returnRequired: false;
        restock: null;
        restockIdempotencyKey: null;
        restockedAt: null;
      }>
    | Readonly<{
        returnRequired: true;
        restock: RefundRestock;
        restockIdempotencyKey: string;
        restockedAt: Date;
      }>
  );

export type Refund =
  | RequestedRefund
  | ApprovedRefund
  | RejectedRefund
  | PaymentRefundedRefund
  | RestockedRefund
  | CompletedRefund;
