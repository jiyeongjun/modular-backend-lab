import type { Money } from "../../../shared/money/index.js";

export type PaymentProvider = "TOSS_PAYMENTS";

export type PaymentStatus = "PENDING" | "AUTHORIZED" | "FAILED" | "CANCELLED";

export type PaymentBase = Readonly<{
  id: string;
  orderId: string;
  provider: PaymentProvider;
  providerPaymentKey: string;
  confirmIdempotencyKey: string;
  cancelIdempotencyKey: string | null;
  amount: Money;
  providerStatus: string | null;
  method: string | null;
  receiptUrl: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  cancelReason: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type PendingPayment = PaymentBase &
  Readonly<{
    status: "PENDING";
    authorizedAt: null;
    failedAt: null;
    cancelledAt: null;
  }>;

export type AuthorizedPayment = PaymentBase &
  Readonly<{
    status: "AUTHORIZED";
    authorizedAt: Date;
    failedAt: null;
    cancelledAt: null;
  }>;

export type FailedPayment = PaymentBase &
  Readonly<{
    status: "FAILED";
    authorizedAt: null;
    failedAt: Date;
    cancelledAt: null;
  }>;

export type CancelledPayment = PaymentBase &
  Readonly<{
    status: "CANCELLED";
    authorizedAt: Date;
    failedAt: null;
    cancelledAt: Date;
    cancelIdempotencyKey: string;
    cancelReason: string;
  }>;

export type Payment = PendingPayment | AuthorizedPayment | FailedPayment | CancelledPayment;

export type PaymentAuthorization = Readonly<{
  providerPaymentKey: string;
  orderId: string;
  amount: Money;
  providerStatus: string;
  method: string | null;
  receiptUrl: string | null;
  authorizedAt: Date | null;
}>;

export type PaymentFailure = Readonly<{
  providerStatus: string | null;
  code: string;
  message: string;
}>;

export type PaymentCancellation = Readonly<{
  cancelIdempotencyKey: string;
  cancelReason: string;
  providerStatus: string;
  cancelledAt: Date | null;
}>;
