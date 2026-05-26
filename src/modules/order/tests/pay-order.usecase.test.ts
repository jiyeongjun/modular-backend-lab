import { describe, expect, it } from "vitest";
import { createPayOrderUseCase } from "../application/index.js";
import type { CancelledOrder, Order, OrderEvent, PendingOrder } from "../domain/index.js";
import type { OrderRepository, OrderUnitOfWork, OutboxRepository } from "../ports/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");

function createPendingOrder(
  overrides: Partial<Omit<PendingOrder, "status" | "paidAt">> = {},
): PendingOrder {
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

function createCancelledOrder(
  overrides: Partial<Omit<CancelledOrder, "status" | "paidAt">> = {},
): CancelledOrder {
  return {
    id: "order-1",
    status: "CANCELLED",
    totalAmount: { amount: 10_000, currency: "KRW" },
    paidAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createFakeUow(order: Order | null): {
  uow: OrderUnitOfWork;
  savedOrders: Order[];
  savedEvents: OrderEvent[];
  transactions: number;
} {
  const state = {
    savedOrders: [] as Order[],
    savedEvents: [] as OrderEvent[],
    transactions: 0,
  };

  const orders: OrderRepository = {
    findById: async () => order,
    findByIdForUpdate: async () => order,
    create: async (saved, events) => {
      state.savedOrders.push(saved);
      state.savedEvents.push(...events);
    },
    save: async (saved) => {
      state.savedOrders.push(saved);
    },
  };

  const outbox: OutboxRepository = {
    saveAll: async (events) => {
      state.savedEvents.push(...events);
    },
    iterateUnprocessed: async function* () {
      for (const event of [] as never[]) {
        yield event;
      }
    },
    markProcessed: async () => undefined,
  };

  return {
    get savedOrders() {
      return state.savedOrders;
    },
    get savedEvents() {
      return state.savedEvents;
    },
    get transactions() {
      return state.transactions;
    },
    uow: {
      async withTransaction(work) {
        state.transactions += 1;
        return work({ orders, outbox });
      },
    },
  };
}

describe("createPayOrderUseCase", () => {
  it("returns not found without saving when the order does not exist", async () => {
    const fake = createFakeUow(null);
    const payOrder = createPayOrderUseCase({ uow: fake.uow, now: () => now });

    const result = await payOrder({ orderId: "missing" });

    expect(result).toEqual({
      ok: false,
      error: { type: "OrderNotFound", message: "Order was not found" },
    });
    expect(fake.savedOrders).toEqual([]);
    expect(fake.savedEvents).toEqual([]);
    expect(fake.transactions).toBe(1);
  });

  it("saves the paid order and outbox event on success", async () => {
    const fake = createFakeUow(createPendingOrder());
    const payOrder = createPayOrderUseCase({ uow: fake.uow, now: () => now });

    const result = await payOrder({ orderId: "order-1" });

    expect(result.ok).toBe(true);
    expect(fake.savedOrders).toHaveLength(1);
    expect(fake.savedOrders[0]?.status).toBe("PAID");
    expect(fake.savedEvents).toHaveLength(1);
    expect(fake.savedEvents[0]?.type).toBe("OrderPaid");
    expect(fake.transactions).toBe(1);
  });

  it("does not save order or outbox event on business failure", async () => {
    const fake = createFakeUow(createCancelledOrder());
    const payOrder = createPayOrderUseCase({ uow: fake.uow, now: () => now });

    const result = await payOrder({ orderId: "order-1" });

    expect(result).toEqual({
      ok: false,
      error: { type: "OrderCancelled", message: "Cancelled orders cannot be paid" },
    });
    expect(fake.savedOrders).toEqual([]);
    expect(fake.savedEvents).toEqual([]);
  });
});
