import { ok } from "../../../shared/result/index.js";
import type { GetFulfillmentForRefundUseCase } from "../../fulfillment/application/index.js";
import type { RefundFulfillmentPort } from "../ports/index.js";

export function createRefundFulfillmentAdapter(deps: {
  getFulfillmentForRefundUseCase: GetFulfillmentForRefundUseCase;
}): RefundFulfillmentPort {
  return {
    async findByOrderId(orderId) {
      const result = await deps.getFulfillmentForRefundUseCase({ orderId });
      if (!result.ok) {
        return result;
      }

      if (result.value === null) {
        return ok(null);
      }

      return ok({
        fulfillmentId: result.value.fulfillmentId,
        orderId: result.value.orderId,
        status: result.value.status,
      });
    },
  };
}
