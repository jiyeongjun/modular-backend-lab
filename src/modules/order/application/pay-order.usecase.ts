import type { Result } from "../../../shared/result/index.js";
import { err, ok } from "../../../shared/result/index.js";
import { type Order, type PayOrderError, payOrder } from "../domain/index.js";
import type { OrderUnitOfWork } from "../ports/index.js";

export type PayOrderCommand = Readonly<{
  orderId: string;
}>;

export type PayOrderUseCaseError = { type: "OrderNotFound"; message: string } | PayOrderError;

export type PayOrderUseCase = (
  command: PayOrderCommand,
) => Promise<Result<Order, PayOrderUseCaseError>>;

export function createPayOrderUseCase(deps: {
  uow: OrderUnitOfWork;
  now: () => Date;
}): PayOrderUseCase {
  return async function payOrderUseCase(command) {
    return deps.uow.withTransaction(async ({ orders, outbox }) => {
      const order = await orders.findByIdForUpdate(command.orderId);

      if (order === null) {
        return err({ type: "OrderNotFound", message: "Order was not found" });
      }

      const paid = payOrder(order, deps.now());
      if (!paid.ok) {
        return paid;
      }

      await orders.save(paid.value.order, paid.value.events);
      await outbox.saveAll(paid.value.events);

      return ok(paid.value.order);
    });
  };
}
