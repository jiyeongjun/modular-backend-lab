import type { Money } from "../../../shared/money/index.js";

export type OrderPaid = Readonly<{
  type: "OrderPaid";
  aggregateType: "Order";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    orderId: string;
    totalAmount: Money;
  };
}>;

export type OrderEvent = OrderPaid;
