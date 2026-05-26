import type { Money } from "../../../shared/money/index.js";
import { err, ok, type Result } from "../../../shared/result/index.js";
import type {
  ApproveRefundError,
  CompleteRefundError,
  CreateRefundError,
  MarkPaymentRefundedError,
  MarkRestockedError,
  RejectRefundError,
} from "./refund.errors.js";
import type { RefundEvent } from "./refund.events.js";
import type {
  ApprovedRefund,
  CompletedRefund,
  PaymentRefundedRefund,
  Refund,
  RefundRestock,
  RequestedRefund,
  RestockedRefund,
} from "./refund.js";

export type CreateRefundInput = Readonly<{
  id: string;
  orderId: string;
  paymentId: string;
  idempotencyKey: string;
  amount: Money;
  reason: string;
  returnRequired: boolean;
  restock: RefundRestock | null;
  now: Date;
}>;

export type RefundTransition<T extends Refund> = Readonly<{
  refund: T;
  events: readonly RefundEvent[];
}>;

export function createRefund(input: CreateRefundInput): Result<RequestedRefund, CreateRefundError> {
  const invalidInput = validateRequiredFields(input);
  if (invalidInput !== null) {
    return err(invalidInput);
  }

  if (input.amount.amount <= 0) {
    return err({
      type: "InvalidRefundAmount",
      message: "Refund amount must be positive",
    });
  }

  if (input.returnRequired && input.restock === null) {
    return err({
      type: "RefundRestockRequired",
      message: "Return-required refunds must include restock metadata",
    });
  }

  if (!input.returnRequired && input.restock !== null) {
    return err({
      type: "RefundRestockNotAllowed",
      message: "Restock metadata is only allowed when a return is required",
    });
  }

  if (input.restock !== null && input.restock.quantity <= 0) {
    return err({
      type: "RefundRestockRequired",
      message: "Restock quantity must be positive",
    });
  }

  return ok({
    id: input.id,
    orderId: input.orderId,
    paymentId: input.paymentId,
    idempotencyKey: input.idempotencyKey,
    paymentRefundIdempotencyKey: childIdempotencyKey(input.id, "payment-refund"),
    restockIdempotencyKey: input.returnRequired ? childIdempotencyKey(input.id, "restock") : null,
    amount: input.amount,
    reason: input.reason,
    returnRequired: input.returnRequired,
    restock: input.restock,
    status: "REQUESTED",
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    paymentRefundedAt: null,
    restockedAt: null,
    completedAt: null,
    version: 0,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function refundRequestedEvent(refund: RequestedRefund): RefundEvent {
  return {
    type: "RefundRequested",
    aggregateType: "Refund",
    aggregateId: refund.id,
    occurredAt: refund.createdAt,
    payload: {
      refundId: refund.id,
      orderId: refund.orderId,
      paymentId: refund.paymentId,
      idempotencyKey: refund.idempotencyKey,
      paymentRefundIdempotencyKey: refund.paymentRefundIdempotencyKey,
      restockIdempotencyKey: refund.restockIdempotencyKey,
      amount: refund.amount,
      reason: refund.reason,
      returnRequired: refund.returnRequired,
      restock: refund.restock,
    },
  };
}

export function approveRefund(
  refund: Refund,
  now: Date,
): Result<RefundTransition<ApprovedRefund>, ApproveRefundError> {
  switch (refund.status) {
    case "REQUESTED": {
      const approved: ApprovedRefund = {
        ...refund,
        status: "APPROVED",
        approvedAt: now,
        updatedAt: now,
      };
      return ok({
        refund: approved,
        events: [
          {
            type: "RefundApproved",
            aggregateType: "Refund",
            aggregateId: approved.id,
            occurredAt: now,
            payload: {
              refundId: approved.id,
              orderId: approved.orderId,
              paymentId: approved.paymentId,
              approvedAt: approved.approvedAt,
            },
          },
        ],
      });
    }

    case "APPROVED":
      return ok({ refund, events: [] });

    case "REJECTED":
    case "PAYMENT_REFUNDED":
    case "RESTOCKED":
    case "COMPLETED":
      return err({
        type: "RefundNotApprovable",
        status: refund.status,
        message: "Refund cannot be approved from its current status",
      });
  }
}

export function rejectRefund(
  refund: Refund,
  input: Readonly<{ reason: string; now: Date }>,
): Result<RefundTransition<Refund>, RejectRefundError> {
  switch (refund.status) {
    case "REQUESTED": {
      const rejected = {
        ...refund,
        status: "REJECTED",
        rejectedAt: input.now,
        rejectionReason: input.reason,
        updatedAt: input.now,
      } satisfies Refund;
      return ok({
        refund: rejected,
        events: [
          {
            type: "RefundRejected",
            aggregateType: "Refund",
            aggregateId: rejected.id,
            occurredAt: input.now,
            payload: {
              refundId: rejected.id,
              orderId: rejected.orderId,
              paymentId: rejected.paymentId,
              reason: input.reason,
              rejectedAt: rejected.rejectedAt,
            },
          },
        ],
      });
    }

    case "REJECTED":
      return ok({ refund, events: [] });

    case "APPROVED":
    case "PAYMENT_REFUNDED":
    case "RESTOCKED":
    case "COMPLETED":
      return err({
        type: "RefundNotRejectable",
        status: refund.status,
        message: "Refund cannot be rejected from its current status",
      });
  }
}

export function markPaymentRefunded(
  refund: Refund,
  now: Date,
): Result<RefundTransition<PaymentRefundedRefund>, MarkPaymentRefundedError> {
  switch (refund.status) {
    case "APPROVED": {
      const paymentRefunded: PaymentRefundedRefund = {
        ...refund,
        status: "PAYMENT_REFUNDED",
        paymentRefundedAt: now,
        updatedAt: now,
      };
      return ok({
        refund: paymentRefunded,
        events: [
          {
            type: "RefundPaymentRefunded",
            aggregateType: "Refund",
            aggregateId: paymentRefunded.id,
            occurredAt: now,
            payload: {
              refundId: paymentRefunded.id,
              orderId: paymentRefunded.orderId,
              paymentId: paymentRefunded.paymentId,
              amount: paymentRefunded.amount,
              paymentRefundedAt: paymentRefunded.paymentRefundedAt,
            },
          },
        ],
      });
    }

    case "PAYMENT_REFUNDED":
      return ok({ refund, events: [] });

    case "RESTOCKED":
    case "COMPLETED":
      return ok({
        refund: {
          ...refund,
          status: "PAYMENT_REFUNDED",
          restockedAt: null,
          completedAt: null,
        },
        events: [],
      });

    case "REQUESTED":
    case "REJECTED":
      return err({
        type: "RefundPaymentNotRecordable",
        status: refund.status,
        message: "Payment refund cannot be recorded from the current refund status",
      });
  }
}

export function markRestocked(
  refund: Refund,
  now: Date,
): Result<RefundTransition<RestockedRefund>, MarkRestockedError> {
  if (!refund.returnRequired || refund.restock === null || refund.restockIdempotencyKey === null) {
    return err({
      type: "RefundRestockNotRequired",
      message: "Refund does not require restock",
    });
  }

  switch (refund.status) {
    case "PAYMENT_REFUNDED": {
      const restocked: RestockedRefund = {
        ...refund,
        status: "RESTOCKED",
        returnRequired: true,
        restock: refund.restock,
        restockIdempotencyKey: refund.restockIdempotencyKey,
        restockedAt: now,
        updatedAt: now,
      };
      return ok({
        refund: restocked,
        events: [
          {
            type: "RefundRestocked",
            aggregateType: "Refund",
            aggregateId: restocked.id,
            occurredAt: now,
            payload: {
              refundId: restocked.id,
              orderId: restocked.orderId,
              restock: restocked.restock,
              restockIdempotencyKey: restocked.restockIdempotencyKey,
              restockedAt: restocked.restockedAt,
            },
          },
        ],
      });
    }

    case "RESTOCKED":
      return ok({ refund, events: [] });

    case "COMPLETED":
      return ok({
        refund: {
          ...refund,
          status: "RESTOCKED",
          completedAt: null,
        },
        events: [],
      });

    case "REQUESTED":
    case "APPROVED":
    case "REJECTED":
      return err({
        type: "RefundRestockNotRecordable",
        status: refund.status,
        message: "Restock cannot be recorded from the current refund status",
      });
  }
}

export function completeRefund(
  refund: Refund,
  now: Date,
): Result<RefundTransition<CompletedRefund>, CompleteRefundError> {
  switch (refund.status) {
    case "PAYMENT_REFUNDED":
      if (refund.returnRequired) {
        return err({
          type: "RefundNotCompletable",
          status: refund.status,
          message: "Return-required refund must be restocked before completion",
        });
      }

      return ok({
        refund: {
          ...refund,
          status: "COMPLETED",
          returnRequired: false,
          restock: null,
          restockIdempotencyKey: null,
          restockedAt: null,
          completedAt: now,
          updatedAt: now,
        },
        events: [refundCompletedEvent(refund, now)],
      });

    case "RESTOCKED":
      return ok({
        refund: {
          ...refund,
          status: "COMPLETED",
          completedAt: now,
          updatedAt: now,
        },
        events: [refundCompletedEvent(refund, now)],
      });

    case "COMPLETED":
      return ok({ refund, events: [] });

    case "REQUESTED":
    case "APPROVED":
    case "REJECTED":
      return err({
        type: "RefundNotCompletable",
        status: refund.status,
        message: "Refund cannot be completed from its current status",
      });
  }
}

function validateRequiredFields(input: CreateRefundInput): CreateRefundError | null {
  if (input.id.length === 0) {
    return { type: "InvalidRefundInput", field: "id", message: "Refund id is required" };
  }
  if (input.orderId.length === 0) {
    return { type: "InvalidRefundInput", field: "orderId", message: "Order id is required" };
  }
  if (input.paymentId.length === 0) {
    return { type: "InvalidRefundInput", field: "paymentId", message: "Payment id is required" };
  }
  if (input.idempotencyKey.length === 0) {
    return {
      type: "InvalidRefundInput",
      field: "idempotencyKey",
      message: "Idempotency key is required",
    };
  }
  if (input.reason.length === 0) {
    return { type: "InvalidRefundInput", field: "reason", message: "Refund reason is required" };
  }

  return null;
}

function refundCompletedEvent(refund: Refund, now: Date): RefundEvent {
  return {
    type: "RefundCompleted",
    aggregateType: "Refund",
    aggregateId: refund.id,
    occurredAt: now,
    payload: {
      refundId: refund.id,
      orderId: refund.orderId,
      paymentId: refund.paymentId,
      completedAt: now,
    },
  };
}

function childIdempotencyKey(root: string, suffix: string): string {
  return `${root}:${suffix}`;
}
