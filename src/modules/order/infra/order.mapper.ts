import type { OrderRow, OrderUpdate } from "../../../infra/db/database.js";
import type { Currency } from "../../../shared/money/index.js";
import type { Order, OrderStatus } from "../domain/index.js";

function toOrderStatus(value: string): OrderStatus {
  if (value === "PENDING" || value === "PAID" || value === "CANCELLED") {
    return value;
  }
  throw new Error(`Unknown order status: ${value}`);
}

function toCurrency(value: string): Currency {
  if (value === "KRW" || value === "USD") {
    return value;
  }
  throw new Error(`Unknown currency: ${value}`);
}

export function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    status: toOrderStatus(row.status),
    totalAmount: {
      amount: row.total_amount,
      currency: toCurrency(row.currency),
    },
    paidAt: row.paid_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toOrderUpdate(order: Order): OrderUpdate {
  return {
    status: order.status,
    total_amount: order.totalAmount.amount,
    currency: order.totalAmount.currency,
    paid_at: order.paidAt,
    updated_at: order.updatedAt,
  };
}
