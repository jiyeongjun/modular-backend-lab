import type { OrderInsert, OrderRow, OrderUpdate } from "../../../infra/db/database.js";
import type { Currency } from "../../../shared/money/index.js";
import type { Order, OrderBase, OrderStatus, PendingOrder } from "../domain/index.js";

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
  const base: OrderBase = {
    id: row.id,
    totalAmount: {
      amount: row.total_amount,
      currency: toCurrency(row.currency),
    },
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  switch (toOrderStatus(row.status)) {
    case "PENDING":
      if (row.paid_at !== null) {
        throw new Error(`Pending order ${row.id} must not have paid_at`);
      }
      return {
        ...base,
        status: "PENDING",
        paidAt: null,
      };

    case "PAID":
      if (row.paid_at === null) {
        throw new Error(`Paid order ${row.id} must have paid_at`);
      }
      return {
        ...base,
        status: "PAID",
        paidAt: row.paid_at,
      };

    case "CANCELLED":
      if (row.paid_at !== null) {
        throw new Error(`Cancelled order ${row.id} must not have paid_at`);
      }
      return {
        ...base,
        status: "CANCELLED",
        paidAt: null,
      };
  }
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

export function toOrderInsert(order: PendingOrder): OrderInsert {
  return {
    id: order.id,
    status: order.status,
    total_amount: order.totalAmount.amount,
    currency: order.totalAmount.currency,
    paid_at: order.paidAt,
    version: order.version,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  };
}
