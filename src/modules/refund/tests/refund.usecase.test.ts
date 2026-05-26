import { describe, expect, it } from "vitest";
import { err, ok } from "../../../shared/result/index.js";
import { createProcessRefundUseCase, createRequestRefundUseCase } from "../application/index.js";
import type { Refund, RefundEvent } from "../domain/index.js";
import type {
  RefundFulfillmentPort,
  RefundInventoryPort,
  RefundOutboxRepository,
  RefundPaymentPort,
  RefundRepository,
  RefundUnitOfWork,
} from "../ports/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const amount = { amount: 10_000, currency: "KRW" } as const;

function createFakeUow(initialRefunds: readonly Refund[] = []): {
  uow: RefundUnitOfWork;
  refunds: Refund[];
  events: RefundEvent[];
} {
  const refundState: Refund[] = [...initialRefunds];
  const events: RefundEvent[] = [];

  function findBy(predicate: (refund: Refund) => boolean): Refund | null {
    return refundState.find(predicate) ?? null;
  }

  const refunds: RefundRepository = {
    findById: async (id) => findBy((refund) => refund.id === id),
    findByIdForUpdate: async (id) => findBy((refund) => refund.id === id),
    findByOrderId: async (orderId) => findBy((refund) => refund.orderId === orderId),
    findByIdempotencyKey: async (idempotencyKey) =>
      findBy((refund) => refund.idempotencyKey === idempotencyKey),
    create: async (refund) => {
      refundState.push(refund);
    },
    save: async (refund) => {
      const index = refundState.findIndex((existing) => existing.id === refund.id);
      if (index === -1) {
        throw new Error("refund missing");
      }
      refundState[index] = refund;
    },
  };

  const outbox: RefundOutboxRepository = {
    saveAll: async (newEvents) => {
      events.push(...newEvents);
    },
  };

  return {
    uow: {
      async withTransaction(work) {
        return work({ refunds, outbox });
      },
    },
    refunds: refundState,
    events,
  };
}

function createFulfillment(
  status: "SHIPPED" | "DELIVERED" | "READY" | null,
): RefundFulfillmentPort {
  return {
    async findByOrderId() {
      if (status === null) {
        return ok(null);
      }

      return ok({
        fulfillmentId: "fulfillment-1",
        orderId: "order-1",
        status,
      });
    },
  };
}

function createPayment(): RefundPaymentPort {
  return {
    async refund() {
      return ok({ paymentId: "payment-1", status: "REFUNDED" });
    },
  };
}

function createInventory(): RefundInventoryPort {
  return {
    async restock(command) {
      return ok({ sku: command.sku, quantity: command.quantity });
    },
  };
}

async function requestRefund(
  fake: ReturnType<typeof createFakeUow>,
  returnRequired: boolean,
): Promise<Refund> {
  const request = createRequestRefundUseCase({
    uow: fake.uow,
    fulfillment: createFulfillment(returnRequired ? "DELIVERED" : null),
    now: () => now,
    generateId: () => "refund-1",
  });
  const result = await request({
    orderId: "order-1",
    paymentId: "payment-1",
    amount,
    reason: "customer request",
    returnRequired,
    restock: returnRequired ? { sku: "sku-1", quantity: 2 } : null,
    idempotencyKey: "refund-request-1",
  });

  if (!result.ok) {
    throw new Error("expected refund request to succeed");
  }

  return result.value.refund;
}

describe("refund usecases", () => {
  it("requires return metadata for shipped fulfillments", async () => {
    const fake = createFakeUow();
    const request = createRequestRefundUseCase({
      uow: fake.uow,
      fulfillment: createFulfillment("SHIPPED"),
      now: () => now,
      generateId: () => "refund-1",
    });

    const result = await request({
      orderId: "order-1",
      paymentId: "payment-1",
      amount,
      reason: "customer request",
      returnRequired: false,
      restock: null,
      idempotencyKey: "refund-request-1",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        type: "RefundReturnRequired",
        fulfillmentStatus: "SHIPPED",
        message: "Shipped or delivered orders require a return before refund completion",
      },
    });
  });

  it("processes a non-return refund through payment refund and completion", async () => {
    const fake = createFakeUow();
    await requestRefund(fake, false);
    const process = createProcessRefundUseCase({
      uow: fake.uow,
      payment: createPayment(),
      inventory: createInventory(),
      now: () => now,
    });

    const result = await process({ refundId: "refund-1" });

    expect(result.ok).toBe(true);
    expect(fake.refunds[0]?.status).toBe("COMPLETED");
    expect(fake.events.map((event) => event.type)).toEqual([
      "RefundRequested",
      "RefundApproved",
      "RefundPaymentRefunded",
      "RefundCompleted",
    ]);
  });

  it("keeps payment-refunded state when restock fails after refunding payment", async () => {
    const fake = createFakeUow();
    await requestRefund(fake, true);
    const inventory: RefundInventoryPort = {
      async restock() {
        return err({
          type: "RefundInventoryItemNotFound",
          sku: "sku-1",
          message: "Inventory item was not found",
        });
      },
    };
    const process = createProcessRefundUseCase({
      uow: fake.uow,
      payment: createPayment(),
      inventory,
      now: () => now,
    });

    const result = await process({ refundId: "refund-1" });

    expect(result.ok).toBe(false);
    expect(fake.refunds[0]?.status).toBe("PAYMENT_REFUNDED");
    if (result.ok || result.error.type !== "RefundInventoryRestockFailed") {
      throw new Error("expected restock failure");
    }
    expect(result.error.paymentRefunded).toBe(true);
  });
});
