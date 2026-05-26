import type { Money } from "../../../shared/money/index.js";
import { err, ok, type Result } from "../../../shared/result/index.js";
import type { OrderStatus } from "../domain/index.js";
import type { OrderUnitOfWork } from "../ports/index.js";

export type ValidateOrderForCheckoutCommand = Readonly<{
  orderId: string;
  amount: Money;
}>;

export type ValidatedCheckoutOrder = Readonly<{
  orderId: string;
  amount: Money;
}>;

export type ValidateOrderForCheckoutError =
  | { type: "OrderNotFound"; orderId: string; message: string }
  | { type: "OrderNotPayable"; status: OrderStatus; message: string }
  | { type: "OrderAmountMismatch"; expected: Money; actual: Money; message: string };

export type ValidateOrderForCheckoutUseCase = (
  command: ValidateOrderForCheckoutCommand,
) => Promise<Result<ValidatedCheckoutOrder, ValidateOrderForCheckoutError>>;

export function createValidateOrderForCheckoutUseCase(deps: {
  uow: OrderUnitOfWork;
}): ValidateOrderForCheckoutUseCase {
  return async function validateOrderForCheckoutUseCase(command) {
    return deps.uow.withTransaction(async ({ orders }) => {
      const order = await orders.findById(command.orderId);

      if (order === null) {
        return err({
          type: "OrderNotFound",
          orderId: command.orderId,
          message: "Order was not found",
        });
      }

      if (order.status !== "PENDING") {
        return err({
          type: "OrderNotPayable",
          status: order.status,
          message: "Order is not payable",
        });
      }

      if (
        order.totalAmount.amount !== command.amount.amount ||
        order.totalAmount.currency !== command.amount.currency
      ) {
        return err({
          type: "OrderAmountMismatch",
          expected: order.totalAmount,
          actual: command.amount,
          message: "Checkout amount does not match order total",
        });
      }

      return ok({
        orderId: order.id,
        amount: order.totalAmount,
      });
    });
  };
}
