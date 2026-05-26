import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type CancelFulfillmentError,
  cancelFulfillment,
  type Fulfillment,
} from "../domain/index.js";
import type { FulfillmentUnitOfWork } from "../ports/index.js";

export type CancelFulfillmentCommand = Readonly<{
  fulfillmentId: string;
  reason: string;
}>;

export type CancelFulfillmentUseCaseError =
  | CancelFulfillmentError
  | {
      type: "FulfillmentNotFound";
      fulfillmentId: string;
      message: string;
    };

export type CancelFulfillmentUseCaseResult = Readonly<{
  fulfillment: Fulfillment;
  idempotent: boolean;
}>;

export type CancelFulfillmentUseCase = (
  command: CancelFulfillmentCommand,
) => Promise<Result<CancelFulfillmentUseCaseResult, CancelFulfillmentUseCaseError>>;

export function createCancelFulfillmentUseCase(deps: {
  uow: FulfillmentUnitOfWork;
  now: () => Date;
}): CancelFulfillmentUseCase {
  return async function cancelFulfillmentUseCase(command) {
    return deps.uow.withTransaction(async ({ fulfillments, outbox }) => {
      const fulfillment = await fulfillments.findByIdForUpdate(command.fulfillmentId);
      if (fulfillment === null) {
        return err({
          type: "FulfillmentNotFound",
          fulfillmentId: command.fulfillmentId,
          message: "Fulfillment was not found",
        });
      }

      if (fulfillment.status === "CANCELLED") {
        return ok({ fulfillment, idempotent: true });
      }

      const cancelled = cancelFulfillment(fulfillment, {
        reason: command.reason,
        now: deps.now(),
      });
      if (!cancelled.ok) {
        return err(cancelled.error);
      }

      await fulfillments.save(cancelled.value.fulfillment, cancelled.value.events);
      await outbox.saveAll(cancelled.value.events);

      return ok({ fulfillment: cancelled.value.fulfillment, idempotent: false });
    });
  };
}
