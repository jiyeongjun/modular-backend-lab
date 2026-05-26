import pino from "pino";
import { describe, expect, it } from "vitest";
import { createApp } from "../../../http/app.js";
import { createMetricsRegistry } from "../../../infra/telemetry/metrics.js";
import { err, ok } from "../../../shared/result/index.js";
import type { SubmitCheckoutUseCase } from "../application/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");

function createTestApp(submitCheckoutUseCase: SubmitCheckoutUseCase) {
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
    submitCheckoutUseCase,
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
    syncSettlementUseCase: async () => {
      throw new Error("unexpected settlement route call");
    },
    getSettlementUseCase: async () => {
      throw new Error("unexpected settlement route call");
    },
  });
}

function validBody(): string {
  return JSON.stringify({
    orderId: "order-1",
    sku: "sku-1",
    quantity: 2,
    paymentKey: "payment-key-1",
    amount: 10_000,
    currency: "KRW",
    idempotencyKey: "checkout-1",
  });
}

describe("checkout routes", () => {
  it("returns 200 when checkout completes", async () => {
    const app = createTestApp(async () =>
      ok({
        type: "CheckoutCompleted",
        orderId: "order-1",
        sku: "sku-1",
        quantity: 2,
        amount: { amount: 10_000, currency: "KRW" },
        reservationId: "reservation-1",
        paymentId: "payment-1",
        completedAt: now,
      }),
    );

    const response = await app.request("/checkout/submit", {
      method: "POST",
      body: validBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
  });

  it("returns 400 for invalid checkout input", async () => {
    const app = createTestApp(async () => {
      throw new Error("unexpected checkout usecase call");
    });

    const response = await app.request("/checkout/submit", {
      method: "POST",
      body: JSON.stringify({
        orderId: "order-1",
        sku: "sku-1",
        quantity: 0,
        paymentKey: "payment-key-1",
        amount: 10_000,
        currency: "KRW",
        idempotencyKey: "checkout-1",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
  });

  it("maps missing order to 404", async () => {
    const app = createTestApp(async () =>
      err({
        type: "CheckoutOrderValidationFailed",
        orderError: {
          type: "CheckoutOrderNotFound",
          orderId: "order-1",
          message: "Order was not found",
        },
        message: "Order cannot enter checkout",
      }),
    );

    const response = await app.request("/checkout/submit", {
      method: "POST",
      body: validBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(404);
  });

  it("maps payment provider rejection to 502", async () => {
    const app = createTestApp(async () =>
      err({
        type: "CheckoutPaymentConfirmationFailed",
        paymentError: {
          type: "CheckoutPaymentProviderRejected",
          providerCode: "REJECT_CARD_COMPANY",
          statusCode: 400,
          retryable: false,
          message: "Card company rejected the request",
        },
        reservationId: "reservation-1",
        inventoryRelease: { status: "SUCCEEDED", completedAt: now },
        message: "Payment confirmation failed",
      }),
    );

    const response = await app.request("/checkout/submit", {
      method: "POST",
      body: validBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(502);
  });
});
