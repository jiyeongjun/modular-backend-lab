import pino from "pino";
import { describe, expect, it } from "vitest";
import { createApp } from "../../../http/app.js";
import { createMetricsRegistry } from "../../../infra/telemetry/metrics.js";
import { err, ok } from "../../../shared/result/index.js";
import type { GetSettlementUseCase, SyncSettlementUseCase } from "../application/index.js";
import type { ReadySettlement } from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");

function createSettlement(): ReadySettlement {
  return {
    id: "settlement:order-1",
    orderId: "order-1",
    paymentId: "payment-1",
    status: "READY",
    grossAmount: { amount: 10_000, currency: "KRW" },
    refundedAmount: { amount: 0, currency: "KRW" },
    netAmount: { amount: 10_000, currency: "KRW" },
    deliveredAt: now,
    readyAt: now,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function createTestApp(overrides: {
  syncSettlementUseCase?: SyncSettlementUseCase;
  getSettlementUseCase?: GetSettlementUseCase;
}) {
  return createApp({
    logger: pino({ enabled: false }),
    metrics: createMetricsRegistry(),
    payOrderUseCase: async () => {
      throw new Error("unexpected order route call");
    },
    reserveInventoryUseCase: async () => {
      throw new Error("unexpected inventory route call");
    },
    releaseReservationUseCase: async () => {
      throw new Error("unexpected inventory route call");
    },
    commitReservationUseCase: async () => {
      throw new Error("unexpected inventory route call");
    },
    confirmPaymentUseCase: async () => {
      throw new Error("unexpected payment route call");
    },
    cancelPaymentUseCase: async () => {
      throw new Error("unexpected payment route call");
    },
    submitCheckoutUseCase: async () => {
      throw new Error("unexpected checkout route call");
    },
    createFulfillmentUseCase: async () => {
      throw new Error("unexpected fulfillment route call");
    },
    markFulfillmentPackedUseCase: async () => {
      throw new Error("unexpected fulfillment route call");
    },
    purchaseShippingLabelUseCase: async () => {
      throw new Error("unexpected fulfillment route call");
    },
    cancelFulfillmentUseCase: async () => {
      throw new Error("unexpected fulfillment route call");
    },
    syncFulfillmentCarrierStatusUseCase: async () => {
      throw new Error("unexpected fulfillment route call");
    },
    requestRefundUseCase: async () => {
      throw new Error("unexpected refund route call");
    },
    processRefundUseCase: async () => {
      throw new Error("unexpected refund route call");
    },
    rejectRefundUseCase: async () => {
      throw new Error("unexpected refund route call");
    },
    syncSettlementUseCase:
      overrides.syncSettlementUseCase ??
      (async () => ok({ settlement: createSettlement(), updated: true })),
    getSettlementUseCase: overrides.getSettlementUseCase ?? (async () => ok(createSettlement())),
  });
}

describe("settlement routes", () => {
  it("returns 200 when settlement sync succeeds", async () => {
    const app = createTestApp({});

    const response = await app.request("/settlements/sync", {
      method: "POST",
      body: JSON.stringify({ orderId: "order-1" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
  });

  it("returns 400 for invalid sync body", async () => {
    const app = createTestApp({});

    const response = await app.request("/settlements/sync", {
      method: "POST",
      body: JSON.stringify({ orderId: "" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
  });

  it("maps missing source facts to 409", async () => {
    const app = createTestApp({
      syncSettlementUseCase: async () =>
        err({
          type: "SettlementSourcePaymentMissing",
          orderId: "order-1",
          message: "Settlement requires an authorized payment source event",
        }),
    });

    const response = await app.request("/settlements/sync", {
      method: "POST",
      body: JSON.stringify({ orderId: "order-1" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(409);
  });

  it("returns 200 when settlement lookup succeeds", async () => {
    const app = createTestApp({});

    const response = await app.request("/settlements/order-1", { method: "GET" });

    expect(response.status).toBe(200);
  });

  it("maps missing settlement lookup to 404", async () => {
    const app = createTestApp({
      getSettlementUseCase: async () =>
        err({
          type: "SettlementNotFound",
          orderId: "missing-order",
          message: "Settlement was not found",
        }),
    });

    const response = await app.request("/settlements/missing-order", { method: "GET" });

    expect(response.status).toBe(404);
  });
});
