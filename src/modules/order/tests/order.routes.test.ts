import pino from "pino";
import { describe, expect, it } from "vitest";
import { createApp } from "../../../http/app.js";
import { createMetricsRegistry } from "../../../infra/telemetry/metrics.js";
import { err, ok } from "../../../shared/result/index.js";
import type { PayOrderUseCase } from "../application/index.js";
import type { PaidOrder } from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");

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

function createTestApp(payOrderUseCase: PayOrderUseCase) {
  return createApp({
    logger: pino({ enabled: false }),
    metrics: createMetricsRegistry(),
    payOrderUseCase,
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
  });
}

describe("order routes", () => {
  it("returns a success response", async () => {
    const app = createTestApp(async () => ok(createPaidOrder()));

    const response = await app.request("/orders/order-1/pay", { method: "POST" });
    const body = (await response.json()) as { data: { id: string; status: string } };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe("order-1");
    expect(body.data.status).toBe("PAID");
  });

  it("maps not found to 404", async () => {
    const app = createTestApp(async () =>
      err({ type: "OrderNotFound", message: "Order was not found" }),
    );

    const response = await app.request("/orders/missing/pay", { method: "POST" });

    expect(response.status).toBe(404);
  });

  it("maps business conflicts to 409", async () => {
    const app = createTestApp(async () =>
      err({ type: "OrderAlreadyPaid", message: "Order is already paid" }),
    );

    const response = await app.request("/orders/order-1/pay", { method: "POST" });

    expect(response.status).toBe(409);
  });

  it("maps invalid parameters to 400", async () => {
    const app = createTestApp(async () => ok(createPaidOrder()));

    const response = await app.request("/orders/%20/pay", { method: "POST" });

    expect(response.status).toBe(400);
  });

  it("handles unexpected errors through global middleware", async () => {
    const app = createTestApp(async () => {
      throw new Error("database unavailable");
    });

    const response = await app.request("/orders/order-1/pay", { method: "POST" });

    expect(response.status).toBe(500);
  });
});
