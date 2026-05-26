import type { Money } from "../../../shared/money/index.js";

export type OrderStatus = "PENDING" | "PAID" | "CANCELLED";

export type OrderBase = Readonly<{
  id: string;
  totalAmount: Money;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type PendingOrder = OrderBase &
  Readonly<{
    status: "PENDING";
    paidAt: null;
  }>;

export type PaidOrder = OrderBase &
  Readonly<{
    status: "PAID";
    paidAt: Date;
  }>;

export type CancelledOrder = OrderBase &
  Readonly<{
    status: "CANCELLED";
    paidAt: null;
  }>;

export type Order = PendingOrder | PaidOrder | CancelledOrder;
