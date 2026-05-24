import type { Money } from "../../../shared/money/index.js";

export type OrderStatus = "PENDING" | "PAID" | "CANCELLED";

export type Order = Readonly<{
  id: string;
  status: OrderStatus;
  totalAmount: Money;
  paidAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;
