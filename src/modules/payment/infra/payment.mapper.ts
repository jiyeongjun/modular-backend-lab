import type { PaymentInsert, PaymentRow, PaymentUpdate } from "../../../infra/db/database.js";
import type { Currency } from "../../../shared/money/index.js";
import type {
  AuthorizedPayment,
  CancelledPayment,
  FailedPayment,
  Payment,
  PaymentProvider,
  PaymentStatus,
  PendingPayment,
} from "../domain/index.js";

function toPaymentProvider(value: string): PaymentProvider {
  if (value === "TOSS_PAYMENTS") {
    return value;
  }
  throw new Error(`Unknown payment provider: ${value}`);
}

function toPaymentStatus(value: string): PaymentStatus {
  if (
    value === "PENDING" ||
    value === "AUTHORIZED" ||
    value === "FAILED" ||
    value === "CANCELLED"
  ) {
    return value;
  }
  throw new Error(`Unknown payment status: ${value}`);
}

function toCurrency(value: string): Currency {
  if (value === "KRW" || value === "USD") {
    return value;
  }
  throw new Error(`Unknown payment currency: ${value}`);
}

export function toPayment(row: PaymentRow): Payment {
  const base = {
    id: row.id,
    orderId: row.order_id,
    provider: toPaymentProvider(row.provider),
    providerPaymentKey: row.provider_payment_key,
    confirmIdempotencyKey: row.confirm_idempotency_key,
    cancelIdempotencyKey: row.cancel_idempotency_key,
    amount: {
      amount: row.amount,
      currency: toCurrency(row.currency),
    },
    providerStatus: row.provider_status,
    method: row.method,
    receiptUrl: row.receipt_url,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    cancelReason: row.cancel_reason,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.amount <= 0) {
    throw new Error(`Payment ${row.id} has invalid amount`);
  }

  switch (toPaymentStatus(row.status)) {
    case "PENDING":
      if (row.authorized_at !== null || row.failed_at !== null || row.cancelled_at !== null) {
        throw new Error(`Pending payment ${row.id} must not have terminal timestamps`);
      }
      return {
        ...base,
        status: "PENDING",
        authorizedAt: null,
        failedAt: null,
        cancelledAt: null,
      };

    case "AUTHORIZED":
      if (row.authorized_at === null || row.failed_at !== null || row.cancelled_at !== null) {
        throw new Error(`Authorized payment ${row.id} must have only authorized_at`);
      }
      return {
        ...base,
        status: "AUTHORIZED",
        authorizedAt: row.authorized_at,
        failedAt: null,
        cancelledAt: null,
      };

    case "FAILED":
      if (
        row.failed_at === null ||
        row.authorized_at !== null ||
        row.cancelled_at !== null ||
        row.failure_code === null ||
        row.failure_message === null
      ) {
        throw new Error(`Failed payment ${row.id} must have failure details`);
      }
      return {
        ...base,
        status: "FAILED",
        authorizedAt: null,
        failedAt: row.failed_at,
        cancelledAt: null,
      };

    case "CANCELLED":
      if (
        row.authorized_at === null ||
        row.cancelled_at === null ||
        row.failed_at !== null ||
        row.cancel_idempotency_key === null ||
        row.cancel_reason === null
      ) {
        throw new Error(`Cancelled payment ${row.id} must have cancellation details`);
      }
      return {
        ...base,
        status: "CANCELLED",
        cancelIdempotencyKey: row.cancel_idempotency_key,
        cancelReason: row.cancel_reason,
        authorizedAt: row.authorized_at,
        failedAt: null,
        cancelledAt: row.cancelled_at,
      };
  }
}

export function toPaymentInsert(payment: PendingPayment): PaymentInsert {
  return {
    id: payment.id,
    order_id: payment.orderId,
    provider: payment.provider,
    provider_payment_key: payment.providerPaymentKey,
    confirm_idempotency_key: payment.confirmIdempotencyKey,
    cancel_idempotency_key: payment.cancelIdempotencyKey,
    status: payment.status,
    amount: payment.amount.amount,
    currency: payment.amount.currency,
    provider_status: payment.providerStatus,
    method: payment.method,
    receipt_url: payment.receiptUrl,
    failure_code: payment.failureCode,
    failure_message: payment.failureMessage,
    cancel_reason: payment.cancelReason,
    authorized_at: payment.authorizedAt,
    failed_at: payment.failedAt,
    cancelled_at: payment.cancelledAt,
    version: payment.version,
    created_at: payment.createdAt,
    updated_at: payment.updatedAt,
  };
}

export function toPaymentUpdate(payment: Payment): PaymentUpdate {
  return {
    status: payment.status,
    provider_status: payment.providerStatus,
    method: payment.method,
    receipt_url: payment.receiptUrl,
    failure_code: payment.failureCode,
    failure_message: payment.failureMessage,
    cancel_idempotency_key: payment.cancelIdempotencyKey,
    cancel_reason: payment.cancelReason,
    authorized_at: payment.authorizedAt,
    failed_at: payment.failedAt,
    cancelled_at: payment.cancelledAt,
    updated_at: payment.updatedAt,
  };
}

export function toAuthorizedPaymentUpdate(payment: AuthorizedPayment): PaymentUpdate {
  return toPaymentUpdate(payment);
}

export function toFailedPaymentUpdate(payment: FailedPayment): PaymentUpdate {
  return toPaymentUpdate(payment);
}

export function toCancelledPaymentUpdate(payment: CancelledPayment): PaymentUpdate {
  return toPaymentUpdate(payment);
}
