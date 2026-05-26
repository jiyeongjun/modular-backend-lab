import type { Money } from "../../../shared/money/index.js";
import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type CreateRefundError,
  createRefund,
  type Refund,
  type RefundRestock,
  refundRequestedEvent,
} from "../domain/index.js";
import type {
  RefundFulfillmentError,
  RefundFulfillmentPort,
  RefundUnitOfWork,
} from "../ports/index.js";

export type RequestRefundCommand = Readonly<{
  orderId: string;
  paymentId: string;
  amount: Money;
  reason: string;
  returnRequired: boolean;
  restock: RefundRestock | null;
  idempotencyKey: string;
}>;

export type RequestRefundUseCaseError =
  | CreateRefundError
  | RefundFulfillmentError
  | {
      type: "RefundAlreadyExists";
      orderId: string;
      message: string;
    }
  | {
      type: "RefundReturnRequired";
      fulfillmentStatus: "SHIPPED" | "DELIVERED";
      message: string;
    };

export type RequestRefundUseCaseResult = Readonly<{
  refund: Refund;
  idempotent: boolean;
}>;

export type RequestRefundUseCase = (
  command: RequestRefundCommand,
) => Promise<Result<RequestRefundUseCaseResult, RequestRefundUseCaseError>>;

export function createRequestRefundUseCase(deps: {
  uow: RefundUnitOfWork;
  fulfillment: RefundFulfillmentPort;
  now: () => Date;
  generateId: () => string;
}): RequestRefundUseCase {
  return async function requestRefundUseCase(command) {
    const existingByKey = await deps.uow.withTransaction(({ refunds }) =>
      refunds.findByIdempotencyKey(command.idempotencyKey),
    );
    if (existingByKey !== null) {
      return ok({ refund: existingByKey, idempotent: true });
    }

    const existingByOrder = await deps.uow.withTransaction(({ refunds }) =>
      refunds.findByOrderId(command.orderId),
    );
    if (existingByOrder !== null) {
      return err({
        type: "RefundAlreadyExists",
        orderId: command.orderId,
        message: "A refund already exists for this order",
      });
    }

    const fulfillment = await deps.fulfillment.findByOrderId(command.orderId);
    if (!fulfillment.ok) {
      return err(fulfillment.error);
    }

    if (
      fulfillment.value !== null &&
      (fulfillment.value.status === "SHIPPED" || fulfillment.value.status === "DELIVERED") &&
      !command.returnRequired
    ) {
      return err({
        type: "RefundReturnRequired",
        fulfillmentStatus: fulfillment.value.status,
        message: "Shipped or delivered orders require a return before refund completion",
      });
    }

    const created = createRefund({
      id: deps.generateId(),
      orderId: command.orderId,
      paymentId: command.paymentId,
      idempotencyKey: command.idempotencyKey,
      amount: command.amount,
      reason: command.reason,
      returnRequired: command.returnRequired,
      restock: command.restock,
      now: deps.now(),
    });
    if (!created.ok) {
      return err(created.error);
    }

    return deps.uow.withTransaction(async ({ refunds, outbox }) => {
      const concurrentExisting = await refunds.findByIdempotencyKey(command.idempotencyKey);
      if (concurrentExisting !== null) {
        return ok({ refund: concurrentExisting, idempotent: true });
      }

      const events = [refundRequestedEvent(created.value)];
      await refunds.create(created.value, events);
      await outbox.saveAll(events);

      return ok({ refund: created.value, idempotent: false });
    });
  };
}
