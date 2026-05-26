import { err, ok, type Result } from "../../../shared/result/index.js";
import type { PayOrderError } from "./order.errors.js";
import type { OrderEvent } from "./order.events.js";
import type { Order, PaidOrder, PendingOrder } from "./order.js";

export function orderCreatedEvent(order: PendingOrder): OrderEvent {
  return {
    type: "OrderCreated",
    aggregateType: "Order",
    aggregateId: order.id,
    occurredAt: order.createdAt,
    payload: {
      orderId: order.id,
      totalAmount: order.totalAmount,
    },
  };
}

export function payOrder(
  order: Order,
  now: Date,
): Result<{ order: Order; events: readonly OrderEvent[] }, PayOrderError> {
  switch (order.status) {
    case "PAID":
      return err({ type: "OrderAlreadyPaid", message: "Order is already paid" });

    case "CANCELLED":
      return err({ type: "OrderCancelled", message: "Cancelled orders cannot be paid" });

    case "PENDING": {
      if (order.totalAmount.amount <= 0) {
        return err({
          type: "InvalidOrderTotal",
          message: "Orders with non-positive totals cannot be paid",
        });
      }

      const paidOrder: PaidOrder = {
        ...order,
        status: "PAID",
        paidAt: now,
        updatedAt: now,
      };

      return ok({
        order: paidOrder,
        events: [
          {
            type: "OrderPaid",
            aggregateType: "Order",
            aggregateId: order.id,
            occurredAt: now,
            payload: {
              orderId: order.id,
              totalAmount: order.totalAmount,
            },
          },
        ],
      });
    }
  }
}
