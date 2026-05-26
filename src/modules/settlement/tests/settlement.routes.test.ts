import { describe, expect, it } from "vitest";
import { createRouteTestApp } from "../../../../test/http/create-test-app.js";
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
  return createRouteTestApp({
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
