import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type Fulfillment,
  markFulfillmentPacked,
  type PackFulfillmentError,
} from "../domain/index.js";
import type { FulfillmentUnitOfWork } from "../ports/index.js";

export type MarkFulfillmentPackedCommand = Readonly<{
  fulfillmentId: string;
}>;

export type MarkFulfillmentPackedUseCaseError =
  | PackFulfillmentError
  | {
      type: "FulfillmentNotFound";
      fulfillmentId: string;
      message: string;
    };

export type MarkFulfillmentPackedUseCaseResult = Readonly<{
  fulfillment: Fulfillment;
  idempotent: boolean;
}>;

export type MarkFulfillmentPackedUseCase = (
  command: MarkFulfillmentPackedCommand,
) => Promise<Result<MarkFulfillmentPackedUseCaseResult, MarkFulfillmentPackedUseCaseError>>;

export function createMarkFulfillmentPackedUseCase(deps: {
  uow: FulfillmentUnitOfWork;
  now: () => Date;
}): MarkFulfillmentPackedUseCase {
  return async function markFulfillmentPackedUseCase(command) {
    return deps.uow.withTransaction(async ({ fulfillments, outbox }) => {
      const fulfillment = await fulfillments.findByIdForUpdate(command.fulfillmentId);
      if (fulfillment === null) {
        return err({
          type: "FulfillmentNotFound",
          fulfillmentId: command.fulfillmentId,
          message: "Fulfillment was not found",
        });
      }

      if (
        fulfillment.status === "PACKED" ||
        fulfillment.status === "LABEL_PURCHASED" ||
        fulfillment.status === "SHIPPED" ||
        fulfillment.status === "DELIVERED"
      ) {
        return ok({ fulfillment, idempotent: true });
      }

      const packed = markFulfillmentPacked(fulfillment, deps.now());
      if (!packed.ok) {
        return err(packed.error);
      }

      await fulfillments.save(packed.value.fulfillment, packed.value.events);
      await outbox.saveAll(packed.value.events);

      return ok({ fulfillment: packed.value.fulfillment, idempotent: false });
    });
  };
}
