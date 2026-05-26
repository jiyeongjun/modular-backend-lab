import pino from "pino";
import { describe, expect, it } from "vitest";
import { createApp } from "../../../http/app.js";
import { createMetricsRegistry } from "../../../infra/telemetry/metrics.js";
import { err, ok } from "../../../shared/result/index.js";
import type {
  CommitReservationUseCase,
  ReleaseReservationUseCase,
  ReserveInventoryUseCase,
} from "../application/index.js";
import type { ActiveInventoryReservation } from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const expiresAt = new Date("2026-01-02T00:00:00.000Z");

function createReservation(): ActiveInventoryReservation {
  return {
    id: "reservation-1",
    sku: "sku-1",
    idempotencyKey: "idem-1",
    quantity: 2,
    status: "ACTIVE",
    expiresAt,
    releasedAt: null,
    committedAt: null,
    expiredAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function createTestApp(overrides: {
  reserveInventoryUseCase?: ReserveInventoryUseCase;
  releaseReservationUseCase?: ReleaseReservationUseCase;
  commitReservationUseCase?: CommitReservationUseCase;
}) {
  return createApp({
    logger: pino({ enabled: false }),
    metrics: createMetricsRegistry(),
    payOrderUseCase: async () => {
      throw new Error("unexpected order route call");
    },
    reserveInventoryUseCase:
      overrides.reserveInventoryUseCase ??
      (async () => ok({ reservation: createReservation(), idempotent: false })),
    releaseReservationUseCase:
      overrides.releaseReservationUseCase ?? (async () => ok(createReservation())),
    commitReservationUseCase:
      overrides.commitReservationUseCase ?? (async () => ok(createReservation())),
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
  });
}

describe("inventory routes", () => {
  it("returns 201 when reservation is created", async () => {
    const app = createTestApp({});

    const response = await app.request("/inventory/sku-1/reservations", {
      method: "POST",
      body: JSON.stringify({
        quantity: 2,
        idempotencyKey: "idem-1",
        expiresAt: expiresAt.toISOString(),
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(201);
  });

  it("returns 400 for invalid reservation body", async () => {
    const app = createTestApp({});

    const response = await app.request("/inventory/sku-1/reservations", {
      method: "POST",
      body: JSON.stringify({
        quantity: 0,
        idempotencyKey: "idem-1",
        expiresAt: expiresAt.toISOString(),
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
  });

  it("maps missing inventory item to 404", async () => {
    const app = createTestApp({
      reserveInventoryUseCase: async () =>
        err({
          type: "InventoryItemNotFound",
          sku: "sku-1",
          message: "Inventory item was not found",
        }),
    });

    const response = await app.request("/inventory/sku-1/reservations", {
      method: "POST",
      body: JSON.stringify({
        quantity: 2,
        idempotencyKey: "idem-1",
        expiresAt: expiresAt.toISOString(),
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(404);
  });

  it("maps insufficient inventory to 409", async () => {
    const app = createTestApp({
      reserveInventoryUseCase: async () =>
        err({
          type: "InsufficientInventory",
          available: 1,
          requested: 2,
          message: "Insufficient inventory available",
        }),
    });

    const response = await app.request("/inventory/sku-1/reservations", {
      method: "POST",
      body: JSON.stringify({
        quantity: 2,
        idempotencyKey: "idem-1",
        expiresAt: expiresAt.toISOString(),
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(409);
  });

  it("maps release command success to 200", async () => {
    const app = createTestApp({});

    const response = await app.request("/inventory/reservations/reservation-1/release", {
      method: "POST",
    });

    expect(response.status).toBe(200);
  });
});
