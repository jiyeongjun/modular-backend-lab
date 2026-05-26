import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type ApproveRefundError,
  approveRefund,
  type CompleteRefundError,
  completeRefund,
  type MarkPaymentRefundedError,
  type MarkRestockedError,
  markPaymentRefunded,
  markRestocked,
  type Refund,
} from "../domain/index.js";
import type {
  RefundInventoryError,
  RefundInventoryPort,
  RefundPaymentError,
  RefundPaymentPort,
  RefundUnitOfWork,
} from "../ports/index.js";

export type ProcessRefundCommand = Readonly<{
  refundId: string;
}>;

export type ProcessRefundUseCaseError =
  | ApproveRefundError
  | MarkPaymentRefundedError
  | MarkRestockedError
  | CompleteRefundError
  | {
      type: "RefundNotFound";
      refundId: string;
      message: string;
    }
  | {
      type: "RefundRejected";
      refundId: string;
      message: string;
    }
  | {
      type: "RefundPaymentFailed";
      refundId: string;
      paymentError: RefundPaymentError;
      message: string;
    }
  | {
      type: "RefundInventoryRestockFailed";
      refundId: string;
      inventoryError: RefundInventoryError;
      paymentRefunded: true;
      message: string;
    };

export type ProcessRefundUseCaseResult = Readonly<{
  refund: Refund;
  idempotent: boolean;
}>;

export type ProcessRefundUseCase = (
  command: ProcessRefundCommand,
) => Promise<Result<ProcessRefundUseCaseResult, ProcessRefundUseCaseError>>;

export function createProcessRefundUseCase(deps: {
  uow: RefundUnitOfWork;
  payment: RefundPaymentPort;
  inventory: RefundInventoryPort;
  now: () => Date;
}): ProcessRefundUseCase {
  async function approveIfNeeded(
    refundId: string,
  ): Promise<Result<Refund, ProcessRefundUseCaseError>> {
    return deps.uow.withTransaction(async ({ refunds, outbox }) => {
      const refund = await refunds.findByIdForUpdate(refundId);
      if (refund === null) {
        return err({
          type: "RefundNotFound",
          refundId,
          message: "Refund was not found",
        });
      }

      if (refund.status === "REJECTED") {
        return err({
          type: "RefundRejected",
          refundId,
          message: "Rejected refunds cannot be processed",
        });
      }

      if (refund.status !== "REQUESTED") {
        return ok(refund);
      }

      const approved = approveRefund(refund, deps.now());
      if (!approved.ok) {
        return err(approved.error);
      }

      await refunds.save(approved.value.refund, approved.value.events);
      await outbox.saveAll(approved.value.events);

      return ok(approved.value.refund);
    });
  }

  async function recordPaymentRefunded(
    refundId: string,
  ): Promise<Result<Refund, ProcessRefundUseCaseError>> {
    return deps.uow.withTransaction(async ({ refunds, outbox }) => {
      const current = await refunds.findByIdForUpdate(refundId);
      if (current === null) {
        throw new Error(`Refund ${refundId} disappeared during payment refund recording`);
      }

      if (
        current.status === "PAYMENT_REFUNDED" ||
        current.status === "RESTOCKED" ||
        current.status === "COMPLETED"
      ) {
        return ok(current);
      }

      const paymentRefunded = markPaymentRefunded(current, deps.now());
      if (!paymentRefunded.ok) {
        return err(paymentRefunded.error);
      }

      await refunds.save(paymentRefunded.value.refund, paymentRefunded.value.events);
      await outbox.saveAll(paymentRefunded.value.events);

      return ok(paymentRefunded.value.refund);
    });
  }

  async function recordRestocked(
    refundId: string,
  ): Promise<Result<Refund, ProcessRefundUseCaseError>> {
    return deps.uow.withTransaction(async ({ refunds, outbox }) => {
      const current = await refunds.findByIdForUpdate(refundId);
      if (current === null) {
        throw new Error(`Refund ${refundId} disappeared during restock recording`);
      }

      if (current.status === "RESTOCKED" || current.status === "COMPLETED") {
        return ok(current);
      }

      const restocked = markRestocked(current, deps.now());
      if (!restocked.ok) {
        return err(restocked.error);
      }

      await refunds.save(restocked.value.refund, restocked.value.events);
      await outbox.saveAll(restocked.value.events);

      return ok(restocked.value.refund);
    });
  }

  async function complete(refundId: string): Promise<Result<Refund, ProcessRefundUseCaseError>> {
    return deps.uow.withTransaction(async ({ refunds, outbox }) => {
      const current = await refunds.findByIdForUpdate(refundId);
      if (current === null) {
        throw new Error(`Refund ${refundId} disappeared during completion`);
      }

      const completed = completeRefund(current, deps.now());
      if (!completed.ok) {
        return err(completed.error);
      }

      if (completed.value.events.length === 0) {
        return ok(completed.value.refund);
      }

      await refunds.save(completed.value.refund, completed.value.events);
      await outbox.saveAll(completed.value.events);

      return ok(completed.value.refund);
    });
  }

  return async function processRefundUseCase(command) {
    const approved = await approveIfNeeded(command.refundId);
    if (!approved.ok) {
      return approved;
    }

    if (approved.value.status === "COMPLETED") {
      return ok({ refund: approved.value, idempotent: true });
    }

    let current: Refund = approved.value;

    if (current.status === "APPROVED") {
      const paymentRefund = await deps.payment.refund({
        paymentId: current.paymentId,
        amount: current.amount,
        reason: current.reason,
        idempotencyKey: current.paymentRefundIdempotencyKey,
      });
      if (!paymentRefund.ok) {
        return err({
          type: "RefundPaymentFailed",
          refundId: current.id,
          paymentError: paymentRefund.error,
          message: "Payment refund failed",
        });
      }

      const recorded = await recordPaymentRefunded(current.id);
      if (!recorded.ok) {
        return recorded;
      }
      current = recorded.value;
    }

    if (current.returnRequired && current.status === "PAYMENT_REFUNDED") {
      if (current.restock === null || current.restockIdempotencyKey === null) {
        return err({
          type: "RefundRestockNotRequired",
          message: "Refund restock metadata is missing",
        });
      }

      const restock = await deps.inventory.restock({
        sku: current.restock.sku,
        quantity: current.restock.quantity,
        idempotencyKey: current.restockIdempotencyKey,
      });
      if (!restock.ok) {
        return err({
          type: "RefundInventoryRestockFailed",
          refundId: current.id,
          inventoryError: restock.error,
          paymentRefunded: true,
          message: "Inventory restock failed after payment refund",
        });
      }

      const recorded = await recordRestocked(current.id);
      if (!recorded.ok) {
        return recorded;
      }
      current = recorded.value;
    }

    const completed = await complete(current.id);
    if (!completed.ok) {
      return completed;
    }

    return ok({ refund: completed.value, idempotent: false });
  };
}
