import { describe, expect, it } from "vitest";
import type { Order } from "../domain/index.js";
import { payOrder } from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");

function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    status: "PENDING",
    totalAmount: { amount: 10_000, currency: "KRW" },
    paidAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("payOrder", () => {
  it("pays a pending order and returns an OrderPaid event", () => {
    const order = createOrder();
    const result = payOrder(order, now);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected payOrder to succeed");
    }

    expect(result.value.order).not.toBe(order);
    expect(result.value.order.status).toBe("PAID");
    expect(result.value.order.paidAt).toEqual(now);
    expect(result.value.events).toEqual([
      {
        type: "OrderPaid",
        aggregateType: "Order",
        aggregateId: "order-1",
        occurredAt: now,
        payload: {
          orderId: "order-1",
          totalAmount: { amount: 10_000, currency: "KRW" },
        },
      },
    ]);
  });

  it("rejects non-pending orders", () => {
    const result = payOrder(createOrder({ status: "PAID", paidAt: now }), now);

    expect(result).toEqual({
      ok: false,
      error: { type: "OrderAlreadyPaid", message: "Order is already paid" },
    });
  });

  it("rejects empty orders", () => {
    const result = payOrder(createOrder({ totalAmount: { amount: 0, currency: "KRW" } }), now);

    expect(result).toEqual({
      ok: false,
      error: {
        type: "InvalidOrderTotal",
        message: "Orders with non-positive totals cannot be paid",
      },
    });
  });
});
