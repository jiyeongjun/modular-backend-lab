import { err, ok } from "../../../shared/result/index.js";
import type {
  PayOrderUseCase,
  PayOrderUseCaseError,
  ValidateOrderForCheckoutError,
  ValidateOrderForCheckoutUseCase,
} from "../../order/application/index.js";
import type { CheckoutOrderError, CheckoutOrderPort } from "../ports/index.js";

export function createCheckoutOrderAdapter(deps: {
  validateOrderForCheckoutUseCase: ValidateOrderForCheckoutUseCase;
  payOrderUseCase: PayOrderUseCase;
}): CheckoutOrderPort {
  return {
    async validateForCheckout(command) {
      const result = await deps.validateOrderForCheckoutUseCase(command);
      if (!result.ok) {
        return err(mapValidateOrderError(result.error));
      }

      return ok({
        orderId: result.value.orderId,
        amount: result.value.amount,
      });
    },

    async markPaid(command) {
      const result = await deps.payOrderUseCase(command);
      if (!result.ok) {
        if (result.error.type === "OrderAlreadyPaid") {
          return ok({
            orderId: command.orderId,
            status: "PAID",
            idempotent: true,
          });
        }

        return err(mapPayOrderError(command.orderId, result.error));
      }

      return ok({
        orderId: result.value.id,
        status: "PAID",
        idempotent: false,
      });
    },
  };
}

function mapValidateOrderError(error: ValidateOrderForCheckoutError): CheckoutOrderError {
  switch (error.type) {
    case "OrderNotFound":
      return {
        type: "CheckoutOrderNotFound",
        orderId: error.orderId,
        message: error.message,
      };

    case "OrderNotPayable":
      return {
        type: "CheckoutOrderNotPayable",
        status: error.status,
        message: error.message,
      };

    case "OrderAmountMismatch":
      return {
        type: "CheckoutOrderAmountMismatch",
        expected: error.expected,
        actual: error.actual,
        message: error.message,
      };
  }
}

function mapPayOrderError(orderId: string, error: PayOrderUseCaseError): CheckoutOrderError {
  switch (error.type) {
    case "OrderNotFound":
      return {
        type: "CheckoutOrderNotFound",
        orderId,
        message: error.message,
      };

    case "OrderAlreadyPaid":
      return {
        type: "CheckoutOrderPaymentRejected",
        reason: error.type,
        message: error.message,
      };

    case "OrderCancelled":
      return {
        type: "CheckoutOrderNotPayable",
        status: "CANCELLED",
        message: error.message,
      };

    case "InvalidOrderTotal":
      return {
        type: "CheckoutOrderPaymentRejected",
        reason: error.type,
        message: error.message,
      };
  }
}
