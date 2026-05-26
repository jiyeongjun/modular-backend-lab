import { describe, expect, it } from "vitest";
import {
  createValidateOrderForCheckoutUseCase,
  type ValidateOrderForCheckoutUseCase,
} from "../application/index.js";
import type { Order, PaidOrder, PendingOrder } from "../domain/index.js";
import type {
  OrderRepository,
  OrderUnitOfWork,
  OutboxEvent,
  OutboxRepository,
} from "../ports/index.js";

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

function createPaidOrder(overrides: Partial<Omit<PaidOrder, "status" | "paidAt">> = {}): PaidOrder {
  return {
    id: "order-1",
    status: "PAID",
    totalAmount: { amount: 10_000, currency: "KRW" },
    paidAt: now,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createUseCase(order: Order | null): ValidateOrderForCheckoutUseCase {
  const orders: OrderRepository = {
    findById: async () => order,
    findByIdForUpdate: async () => order,
    create: async () => undefined,
    save: async () => undefined,
  };
  const outbox: OutboxRepository = {
    saveAll: async () => undefined,
    iterateUnprocessed: async function* (options): AsyncIterable<OutboxEvent> {
      if (options.batchSize < 0) {
        yield {
          id: "unused",
          eventType: "unused",
          aggregateType: "Order",
          aggregateId: "unused",
          payload: {},
          occurredAt: now,
          processedAt: null,
          createdAt: now,
        };
      }
    },
    markProcessed: async () => undefined,
  };
  const uow: OrderUnitOfWork = {
    async withTransaction(work) {
      return work({ orders, outbox });
    },
  };

  return createValidateOrderForCheckoutUseCase({ uow });
}

describe("validate order for checkout usecase", () => {
  it("returns the order when it is pending and the amount matches", async () => {
    const validate = createUseCase(createPendingOrder());

    const result = await validate({
      orderId: "order-1",
      amount: { amount: 10_000, currency: "KRW" },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        orderId: "order-1",
        amount: { amount: 10_000, currency: "KRW" },
      },
    });
  });

  it("rejects non-pending orders", async () => {
    const validate = createUseCase(createPaidOrder());

    const result = await validate({
      orderId: "order-1",
      amount: { amount: 10_000, currency: "KRW" },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        type: "OrderNotPayable",
        status: "PAID",
        message: "Order is not payable",
      },
    });
  });

  it("rejects amount mismatches", async () => {
    const validate = createUseCase(createPendingOrder());

    const result = await validate({
      orderId: "order-1",
      amount: { amount: 9_000, currency: "KRW" },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        type: "OrderAmountMismatch",
        expected: { amount: 10_000, currency: "KRW" },
        actual: { amount: 9_000, currency: "KRW" },
        message: "Checkout amount does not match order total",
      },
    });
  });
});
