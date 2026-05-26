import { err, ok } from "../../../shared/result/index.js";
import type {
  RestockInventoryUseCase,
  RestockInventoryUseCaseError,
} from "../../inventory/application/index.js";
import type { RefundInventoryError, RefundInventoryPort } from "../ports/index.js";

export function createRefundInventoryAdapter(deps: {
  restockInventoryUseCase: RestockInventoryUseCase;
}): RefundInventoryPort {
  return {
    async restock(command) {
      const result = await deps.restockInventoryUseCase(command);
      if (!result.ok) {
        return err(mapInventoryError(result.error));
      }

      return ok({
        sku: result.value.sku,
        quantity: result.value.quantity,
      });
    },
  };
}

function mapInventoryError(error: RestockInventoryUseCaseError): RefundInventoryError {
  switch (error.type) {
    case "InventoryItemNotFound":
      return {
        type: "RefundInventoryItemNotFound",
        sku: error.sku,
        message: error.message,
      };

    case "InvalidRestockQuantity":
      return {
        type: "RefundInvalidInventoryRestock",
        message: error.message,
      };
  }
}
