import type { Money } from "../../../shared/money/index.js";

export type OrderCreated = Readonly<{
  type: "OrderCreated";
  aggregateType: "Order";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    orderId: string;
    totalAmount: Money;
  };
}>;

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

export type OrderEvent = OrderCreated | OrderPaid;
