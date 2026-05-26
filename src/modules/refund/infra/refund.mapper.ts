import type { RefundInsert, RefundRow, RefundUpdate } from "../../../infra/db/database.js";
import type { Currency } from "../../../shared/money/index.js";
import type {
  ApprovedRefund,
  CompletedRefund,
  PaymentRefundedRefund,
  Refund,
  RefundRestock,
  RefundStatus,
  RequestedRefund,
  RestockedRefund,
} from "../domain/index.js";

function toRefundStatus(value: string): RefundStatus {
  if (
    value === "REQUESTED" ||
    value === "APPROVED" ||
    value === "REJECTED" ||
    value === "PAYMENT_REFUNDED" ||
    value === "RESTOCKED" ||
    value === "COMPLETED"
  ) {
    return value;
  }
  throw new Error(`Unknown refund status: ${value}`);
}

function toCurrency(value: string): Currency {
  if (value === "KRW" || value === "USD") {
    return value;
  }
  throw new Error(`Unknown refund currency: ${value}`);
}

function toRestock(row: RefundRow): RefundRestock | null {
  if (row.restock_sku === null && row.restock_quantity === null) {
    return null;
  }

  if (row.restock_sku === null || row.restock_quantity === null || row.restock_quantity <= 0) {
    throw new Error(`Refund ${row.id} has invalid restock metadata`);
  }

  return {
    sku: row.restock_sku,
    quantity: row.restock_quantity,
  };
}

function requireDate(value: Date | null, field: string, id: string): Date {
  if (value === null) {
    throw new Error(`Refund ${id} must have ${field}`);
  }
  return value;
}

function base(row: RefundRow) {
  if (row.amount <= 0) {
    throw new Error(`Refund ${row.id} has invalid amount`);
  }

  return {
    id: row.id,
    orderId: row.order_id,
    paymentId: row.payment_id,
    idempotencyKey: row.idempotency_key,
    paymentRefundIdempotencyKey: row.payment_refund_idempotency_key,
    restockIdempotencyKey: row.restock_idempotency_key,
    amount: {
      amount: row.amount,
      currency: toCurrency(row.currency),
    },
    reason: row.reason,
    returnRequired: row.return_required,
    restock: toRestock(row),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertRestockShape(row: RefundRow): void {
  if (row.return_required) {
    if (
      row.restock_sku === null ||
      row.restock_quantity === null ||
      row.restock_idempotency_key === null
    ) {
      throw new Error(`Return-required refund ${row.id} must have restock metadata`);
    }
  } else if (
    row.restock_sku !== null ||
    row.restock_quantity !== null ||
    row.restock_idempotency_key !== null ||
    row.restocked_at !== null
  ) {
    throw new Error(`Non-return refund ${row.id} must not have restock metadata`);
  }
}

export function toRefund(row: RefundRow): Refund {
  assertRestockShape(row);

  switch (toRefundStatus(row.status)) {
    case "REQUESTED": {
      if (
        row.approved_at !== null ||
        row.rejected_at !== null ||
        row.rejection_reason !== null ||
        row.payment_refunded_at !== null ||
        row.restocked_at !== null ||
        row.completed_at !== null
      ) {
        throw new Error(`Requested refund ${row.id} has invalid timestamps`);
      }
      const refund: RequestedRefund = {
        ...base(row),
        status: "REQUESTED",
        approvedAt: null,
        rejectedAt: null,
        rejectionReason: null,
        paymentRefundedAt: null,
        restockedAt: null,
        completedAt: null,
      };
      return refund;
    }

    case "APPROVED": {
      if (
        row.approved_at === null ||
        row.rejected_at !== null ||
        row.rejection_reason !== null ||
        row.payment_refunded_at !== null ||
        row.restocked_at !== null ||
        row.completed_at !== null
      ) {
        throw new Error(`Approved refund ${row.id} has invalid timestamps`);
      }
      const refund: ApprovedRefund = {
        ...base(row),
        status: "APPROVED",
        approvedAt: row.approved_at,
        rejectedAt: null,
        rejectionReason: null,
        paymentRefundedAt: null,
        restockedAt: null,
        completedAt: null,
      };
      return refund;
    }

    case "REJECTED":
      if (
        row.approved_at !== null ||
        row.rejected_at === null ||
        row.rejection_reason === null ||
        row.payment_refunded_at !== null ||
        row.restocked_at !== null ||
        row.completed_at !== null
      ) {
        throw new Error(`Rejected refund ${row.id} has invalid timestamps`);
      }
      return {
        ...base(row),
        status: "REJECTED",
        approvedAt: null,
        rejectedAt: row.rejected_at,
        rejectionReason: row.rejection_reason,
        paymentRefundedAt: null,
        restockedAt: null,
        completedAt: null,
      };

    case "PAYMENT_REFUNDED": {
      if (
        row.approved_at === null ||
        row.rejected_at !== null ||
        row.rejection_reason !== null ||
        row.payment_refunded_at === null ||
        row.restocked_at !== null ||
        row.completed_at !== null
      ) {
        throw new Error(`Payment refunded refund ${row.id} has invalid timestamps`);
      }
      const refund: PaymentRefundedRefund = {
        ...base(row),
        status: "PAYMENT_REFUNDED",
        approvedAt: row.approved_at,
        rejectedAt: null,
        rejectionReason: null,
        paymentRefundedAt: row.payment_refunded_at,
        restockedAt: null,
        completedAt: null,
      };
      return refund;
    }

    case "RESTOCKED": {
      if (!row.return_required || row.restock_sku === null || row.restock_quantity === null) {
        throw new Error(`Restocked refund ${row.id} must require return`);
      }
      const refund: RestockedRefund = {
        ...base(row),
        status: "RESTOCKED",
        returnRequired: true,
        restock: {
          sku: row.restock_sku,
          quantity: row.restock_quantity,
        },
        restockIdempotencyKey: row.restock_idempotency_key ?? "",
        approvedAt: requireDate(row.approved_at, "approved_at", row.id),
        rejectedAt: null,
        rejectionReason: null,
        paymentRefundedAt: requireDate(row.payment_refunded_at, "payment_refunded_at", row.id),
        restockedAt: requireDate(row.restocked_at, "restocked_at", row.id),
        completedAt: null,
      };
      if (refund.restockIdempotencyKey.length === 0 || row.completed_at !== null) {
        throw new Error(`Restocked refund ${row.id} has invalid state`);
      }
      return refund;
    }

    case "COMPLETED":
      if (
        row.approved_at === null ||
        row.rejected_at !== null ||
        row.rejection_reason !== null ||
        row.payment_refunded_at === null ||
        row.completed_at === null
      ) {
        throw new Error(`Completed refund ${row.id} has invalid timestamps`);
      }
      return toCompletedRefund(row);
  }
}

function toCompletedRefund(row: RefundRow): CompletedRefund {
  const shared = {
    ...base(row),
    status: "COMPLETED" as const,
    approvedAt: requireDate(row.approved_at, "approved_at", row.id),
    rejectedAt: null,
    rejectionReason: null,
    paymentRefundedAt: requireDate(row.payment_refunded_at, "payment_refunded_at", row.id),
    completedAt: requireDate(row.completed_at, "completed_at", row.id),
  };

  if (!row.return_required) {
    return {
      ...shared,
      returnRequired: false,
      restock: null,
      restockIdempotencyKey: null,
      restockedAt: null,
    };
  }

  if (
    row.restock_sku === null ||
    row.restock_quantity === null ||
    row.restock_idempotency_key === null ||
    row.restocked_at === null
  ) {
    throw new Error(`Completed return refund ${row.id} must have restock state`);
  }

  return {
    ...shared,
    returnRequired: true,
    restock: {
      sku: row.restock_sku,
      quantity: row.restock_quantity,
    },
    restockIdempotencyKey: row.restock_idempotency_key,
    restockedAt: row.restocked_at,
  };
}

export function toRefundInsert(refund: RequestedRefund): RefundInsert {
  return {
    id: refund.id,
    order_id: refund.orderId,
    payment_id: refund.paymentId,
    idempotency_key: refund.idempotencyKey,
    payment_refund_idempotency_key: refund.paymentRefundIdempotencyKey,
    restock_idempotency_key: refund.restockIdempotencyKey,
    status: refund.status,
    amount: refund.amount.amount,
    currency: refund.amount.currency,
    reason: refund.reason,
    return_required: refund.returnRequired,
    restock_sku: refund.restock?.sku ?? null,
    restock_quantity: refund.restock?.quantity ?? null,
    approved_at: refund.approvedAt,
    rejected_at: refund.rejectedAt,
    rejection_reason: refund.rejectionReason,
    payment_refunded_at: refund.paymentRefundedAt,
    restocked_at: refund.restockedAt,
    completed_at: refund.completedAt,
    version: refund.version,
    created_at: refund.createdAt,
    updated_at: refund.updatedAt,
  };
}

export function toRefundUpdate(refund: Refund): RefundUpdate {
  return {
    status: refund.status,
    reason: refund.reason,
    return_required: refund.returnRequired,
    restock_sku: refund.restock?.sku ?? null,
    restock_quantity: refund.restock?.quantity ?? null,
    approved_at: refund.approvedAt,
    rejected_at: refund.rejectedAt,
    rejection_reason: refund.rejectionReason,
    payment_refunded_at: refund.paymentRefundedAt,
    restocked_at: refund.restockedAt,
    completed_at: refund.completedAt,
    updated_at: refund.updatedAt,
  };
}
