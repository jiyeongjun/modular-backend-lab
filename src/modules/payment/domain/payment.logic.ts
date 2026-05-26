import { isPositiveMoney } from "../../../shared/money/index.js";
import { err, ok, type Result } from "../../../shared/result/index.js";
import type {
  AuthorizePaymentError,
  CancelPaymentError,
  FailPaymentError,
  StartPaymentError,
} from "./payment.errors.js";
import type { PaymentEvent } from "./payment.events.js";
import type {
  AuthorizedPayment,
  CancelledPayment,
  FailedPayment,
  Payment,
  PaymentAuthorization,
  PaymentCancellation,
  PaymentFailure,
  PendingPayment,
} from "./payment.js";

export type StartPaymentInput = Readonly<{
  id: string;
  orderId: string;
  providerPaymentKey: string;
  confirmIdempotencyKey: string;
  amount: PendingPayment["amount"];
  now: Date;
}>;

export function startPayment(input: StartPaymentInput): Result<PendingPayment, StartPaymentError> {
  if (!isPositiveMoney(input.amount)) {
    return err({
      type: "InvalidPaymentAmount",
      amount: input.amount,
      message: "Payment amount must be positive",
    });
  }

  return ok({
    id: input.id,
    orderId: input.orderId,
    provider: "TOSS_PAYMENTS",
    providerPaymentKey: input.providerPaymentKey,
    confirmIdempotencyKey: input.confirmIdempotencyKey,
    cancelIdempotencyKey: null,
    amount: input.amount,
    status: "PENDING",
    providerStatus: null,
    method: null,
    receiptUrl: null,
    failureCode: null,
    failureMessage: null,
    cancelReason: null,
    authorizedAt: null,
    failedAt: null,
    cancelledAt: null,
    version: 0,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function authorizePayment(
  payment: Payment,
  authorization: PaymentAuthorization,
  now: Date,
): Result<{ payment: AuthorizedPayment; events: readonly PaymentEvent[] }, AuthorizePaymentError> {
  switch (payment.status) {
    case "AUTHORIZED":
    case "CANCELLED":
    case "FAILED":
      return err({
        type: "PaymentNotConfirmable",
        status: payment.status,
        message: "Payment is not waiting for confirmation",
      });

    case "PENDING": {
      const mismatch = findAuthorizationMismatch(payment, authorization);
      if (mismatch !== null) {
        return err(mismatch);
      }

      const authorizedAt = authorization.authorizedAt ?? now;
      const authorized: AuthorizedPayment = {
        ...payment,
        status: "AUTHORIZED",
        providerStatus: authorization.providerStatus,
        method: authorization.method,
        receiptUrl: authorization.receiptUrl,
        authorizedAt,
        updatedAt: now,
      };

      return ok({
        payment: authorized,
        events: [
          {
            type: "PaymentAuthorized",
            aggregateType: "Payment",
            aggregateId: payment.id,
            occurredAt: now,
            payload: {
              paymentId: payment.id,
              orderId: payment.orderId,
              amount: payment.amount,
              providerPaymentKey: payment.providerPaymentKey,
            },
          },
        ],
      });
    }
  }
}

export function failPayment(
  payment: Payment,
  failure: PaymentFailure,
  now: Date,
): Result<{ payment: FailedPayment; events: readonly PaymentEvent[] }, FailPaymentError> {
  switch (payment.status) {
    case "AUTHORIZED":
    case "CANCELLED":
    case "FAILED":
      return err({
        type: "PaymentNotFailable",
        status: payment.status,
        message: "Payment is not waiting for failure recording",
      });

    case "PENDING": {
      const failed: FailedPayment = {
        ...payment,
        status: "FAILED",
        providerStatus: failure.providerStatus,
        failureCode: failure.code,
        failureMessage: failure.message,
        failedAt: now,
        updatedAt: now,
      };

      return ok({
        payment: failed,
        events: [
          {
            type: "PaymentAuthorizationFailed",
            aggregateType: "Payment",
            aggregateId: payment.id,
            occurredAt: now,
            payload: {
              paymentId: payment.id,
              orderId: payment.orderId,
              amount: payment.amount,
              providerPaymentKey: payment.providerPaymentKey,
              failureCode: failure.code,
            },
          },
        ],
      });
    }
  }
}

export function cancelPayment(
  payment: Payment,
  cancellation: PaymentCancellation,
  now: Date,
): Result<{ payment: CancelledPayment; events: readonly PaymentEvent[] }, CancelPaymentError> {
  switch (payment.status) {
    case "PENDING":
    case "FAILED":
    case "CANCELLED":
      return err({
        type: "PaymentNotCancellable",
        status: payment.status,
        message: "Payment is not authorized and cannot be cancelled",
      });

    case "AUTHORIZED": {
      const cancelled: CancelledPayment = {
        ...payment,
        status: "CANCELLED",
        cancelIdempotencyKey: cancellation.cancelIdempotencyKey,
        cancelReason: cancellation.cancelReason,
        providerStatus: cancellation.providerStatus,
        cancelledAt: cancellation.cancelledAt ?? now,
        updatedAt: now,
      };

      return ok({
        payment: cancelled,
        events: [
          {
            type: "PaymentCancelled",
            aggregateType: "Payment",
            aggregateId: payment.id,
            occurredAt: now,
            payload: {
              paymentId: payment.id,
              orderId: payment.orderId,
              amount: payment.amount,
              providerPaymentKey: payment.providerPaymentKey,
              reason: cancellation.cancelReason,
            },
          },
        ],
      });
    }
  }
}

function findAuthorizationMismatch(
  payment: PendingPayment,
  authorization: PaymentAuthorization,
): AuthorizePaymentError | null {
  if (payment.providerPaymentKey !== authorization.providerPaymentKey) {
    return {
      type: "PaymentAuthorizationMismatch",
      field: "paymentKey",
      message: "Provider payment key did not match the pending payment",
    };
  }

  if (payment.orderId !== authorization.orderId) {
    return {
      type: "PaymentAuthorizationMismatch",
      field: "orderId",
      message: "Provider order id did not match the pending payment",
    };
  }

  if (payment.amount.amount !== authorization.amount.amount) {
    return {
      type: "PaymentAuthorizationMismatch",
      field: "amount",
      message: "Provider amount did not match the pending payment",
    };
  }

  if (payment.amount.currency !== authorization.amount.currency) {
    return {
      type: "PaymentAuthorizationMismatch",
      field: "currency",
      message: "Provider currency did not match the pending payment",
    };
  }

  return null;
}
