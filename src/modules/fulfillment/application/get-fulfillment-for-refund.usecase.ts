import { ok, type Result } from "../../../shared/result/index.js";
import type { FulfillmentStatus } from "../domain/index.js";
import type { FulfillmentUnitOfWork } from "../ports/index.js";

export type FulfillmentForRefund = Readonly<{
  fulfillmentId: string;
  orderId: string;
  status: FulfillmentStatus;
}>;

export type GetFulfillmentForRefundCommand = Readonly<{
  orderId: string;
}>;

export type GetFulfillmentForRefundUseCase = (
  command: GetFulfillmentForRefundCommand,
) => Promise<Result<FulfillmentForRefund | null, never>>;

export function createGetFulfillmentForRefundUseCase(deps: {
  uow: FulfillmentUnitOfWork;
}): GetFulfillmentForRefundUseCase {
  return async function getFulfillmentForRefundUseCase(command) {
    return deps.uow.withTransaction(async ({ fulfillments }) => {
      const fulfillment = await fulfillments.findByOrderId(command.orderId);
      if (fulfillment === null) {
        return ok(null);
      }

      return ok({
        fulfillmentId: fulfillment.id,
        orderId: fulfillment.orderId,
        status: fulfillment.status,
      });
    });
  };
}
