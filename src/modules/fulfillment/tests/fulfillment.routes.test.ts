import pino from "pino";
import { describe, expect, it } from "vitest";
import { createApp } from "../../../http/app.js";
import { createMetricsRegistry } from "../../../infra/telemetry/metrics.js";
import { err, ok } from "../../../shared/result/index.js";
import type {
  CancelFulfillmentUseCase,
  CreateFulfillmentUseCase,
  MarkFulfillmentPackedUseCase,
  PurchaseShippingLabelUseCase,
  SyncFulfillmentCarrierStatusUseCase,
} from "../application/index.js";
import type { ReadyFulfillment } from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const recipient = {
  name: "Kim",
  phone: "010-0000-0000",
  line1: "Seoul",
  line2: null,
  postalCode: "12345",
  country: "KR",
} as const;
const shipmentPackage = {
  weightGrams: 500,
  description: "T-shirt",
} as const;

function createFulfillment(overrides: Partial<ReadyFulfillment> = {}): ReadyFulfillment {
  return {
    id: "fulfillment-1",
    orderId: "order-1",
    idempotencyKey: "create-1",
    recipient,
    package: shipmentPackage,
    status: "READY",
    packedAt: null,
    labelIdempotencyKey: null,
    carrier: null,
    carrierShipmentId: null,
    trackingNumber: null,
    carrierStatus: null,
    labelPurchasedAt: null,
    shippedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    cancelReason: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createTestApp(overrides: {
  createFulfillmentUseCase?: CreateFulfillmentUseCase;
  markFulfillmentPackedUseCase?: MarkFulfillmentPackedUseCase;
  purchaseShippingLabelUseCase?: PurchaseShippingLabelUseCase;
  cancelFulfillmentUseCase?: CancelFulfillmentUseCase;
  syncFulfillmentCarrierStatusUseCase?: SyncFulfillmentCarrierStatusUseCase;
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
    createFulfillmentUseCase:
      overrides.createFulfillmentUseCase ??
      (async () => ok({ fulfillment: createFulfillment(), idempotent: false })),
    markFulfillmentPackedUseCase:
      overrides.markFulfillmentPackedUseCase ??
      (async () => ok({ fulfillment: createFulfillment({ status: "READY" }), idempotent: false })),
    purchaseShippingLabelUseCase:
      overrides.purchaseShippingLabelUseCase ??
      (async () => ok({ fulfillment: createFulfillment(), idempotent: false })),
    cancelFulfillmentUseCase:
      overrides.cancelFulfillmentUseCase ??
      (async () => ok({ fulfillment: createFulfillment(), idempotent: false })),
    syncFulfillmentCarrierStatusUseCase:
      overrides.syncFulfillmentCarrierStatusUseCase ??
      (async () => ok({ fulfillment: createFulfillment(), updated: false })),
  });
}

function validCreateBody(): string {
  return JSON.stringify({
    orderId: "order-1",
    idempotencyKey: "create-1",
    recipient,
    package: shipmentPackage,
  });
}

describe("fulfillment routes", () => {
  it("returns 201 when fulfillment is created", async () => {
    const app = createTestApp({});

    const response = await app.request("/fulfillments", {
      method: "POST",
      body: validCreateBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(201);
  });

  it("returns 400 for invalid fulfillment body", async () => {
    const app = createTestApp({});

    const response = await app.request("/fulfillments", {
      method: "POST",
      body: JSON.stringify({
        orderId: "order-1",
        idempotencyKey: "create-1",
        recipient,
        package: { weightGrams: 0, description: "T-shirt" },
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
  });

  it("maps duplicate fulfillment to 409", async () => {
    const app = createTestApp({
      createFulfillmentUseCase: async () =>
        err({
          type: "FulfillmentAlreadyExists",
          orderId: "order-1",
          message: "A fulfillment already exists for this order",
        }),
    });

    const response = await app.request("/fulfillments", {
      method: "POST",
      body: validCreateBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(409);
  });

  it("maps carrier retryable failures to 503", async () => {
    const app = createTestApp({
      purchaseShippingLabelUseCase: async () =>
        err({
          type: "ShippingCarrierRejected",
          carrier: "LOCAL_TEST_CARRIER",
          code: "CARRIER_TIMEOUT",
          message: "Carrier request timed out",
          retryable: true,
        }),
    });

    const response = await app.request("/fulfillments/fulfillment-1/label", {
      method: "POST",
      body: JSON.stringify({ idempotencyKey: "label-1" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(503);
  });

  it("maps status sync success to 200", async () => {
    const app = createTestApp({
      syncFulfillmentCarrierStatusUseCase: async () =>
        ok({ fulfillment: createFulfillment(), updated: false }),
    });

    const response = await app.request("/fulfillments/fulfillment-1/sync-carrier-status", {
      method: "POST",
    });

    expect(response.status).toBe(200);
  });
});
