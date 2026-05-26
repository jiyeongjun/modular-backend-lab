import pino from "pino";
import { describe, expect, it } from "vitest";
import { createApp } from "../../../http/app.js";
import { createMetricsRegistry } from "../../../infra/telemetry/metrics.js";
import { err, ok } from "../../../shared/result/index.js";
import type { CancelPaymentUseCase, ConfirmPaymentUseCase } from "../application/index.js";
import type { AuthorizedPayment, CancelledPayment } from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");

function createPayment(
  overrides: Partial<
    Omit<AuthorizedPayment, "status" | "authorizedAt" | "failedAt" | "cancelledAt">
  > = {},
): AuthorizedPayment {
  return {
    id: "payment-1",
    orderId: "order-1",
    provider: "TOSS_PAYMENTS",
    providerPaymentKey: "payment-key-1",
    confirmIdempotencyKey: "confirm-1",
    cancelIdempotencyKey: null,
    amount: { amount: 10_000, currency: "KRW" },
    status: "AUTHORIZED",
    providerStatus: "DONE",
    method: "CARD",
    receiptUrl: "https://receipt.example",
    failureCode: null,
    failureMessage: null,
    cancelReason: null,
    authorizedAt: now,
    failedAt: null,
    cancelledAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createCancelledPayment(): CancelledPayment {
  return {
    ...createPayment(),
    status: "CANCELLED",
    cancelIdempotencyKey: "cancel-1",
    cancelReason: "customer request",
    cancelledAt: now,
  };
}

function createTestApp(overrides: {
  confirmPaymentUseCase?: ConfirmPaymentUseCase;
  cancelPaymentUseCase?: CancelPaymentUseCase;
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
    confirmPaymentUseCase:
      overrides.confirmPaymentUseCase ??
      (async () => ok({ payment: createPayment(), idempotent: false })),
    cancelPaymentUseCase:
      overrides.cancelPaymentUseCase ??
      (async () => ok({ payment: createCancelledPayment(), idempotent: false })),
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
    syncSettlementUseCase: async () => {
      throw new Error("unexpected settlement route call");
    },
    getSettlementUseCase: async () => {
      throw new Error("unexpected settlement route call");
    },
  });
}

describe("payment routes", () => {
  it("returns 201 when payment confirmation succeeds", async () => {
    const app = createTestApp({});

    const response = await app.request("/payments/confirm", {
      method: "POST",
      body: JSON.stringify({
        orderId: "order-1",
        paymentKey: "payment-key-1",
        amount: 10_000,
        currency: "KRW",
        idempotencyKey: "confirm-1",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(201);
  });

  it("returns 400 for invalid confirmation body", async () => {
    const app = createTestApp({});

    const response = await app.request("/payments/confirm", {
      method: "POST",
      body: JSON.stringify({
        orderId: "order-1",
        paymentKey: "payment-key-1",
        amount: 0,
        currency: "KRW",
        idempotencyKey: "confirm-1",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
  });

  it("maps provider rejection to 502", async () => {
    const app = createTestApp({
      confirmPaymentUseCase: async () =>
        err({
          type: "PaymentProviderRejected",
          providerCode: "REJECT_CARD_COMPANY",
          providerMessage: "Card company rejected the request",
          statusCode: 400,
          retryable: false,
          message: "Payment provider rejected the request",
        }),
    });

    const response = await app.request("/payments/confirm", {
      method: "POST",
      body: JSON.stringify({
        orderId: "order-1",
        paymentKey: "payment-key-1",
        amount: 10_000,
        currency: "KRW",
        idempotencyKey: "confirm-1",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(502);
  });

  it("returns 200 when cancellation succeeds", async () => {
    const app = createTestApp({});

    const response = await app.request("/payments/payment-1/cancel", {
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: "cancel-1",
        reason: "customer request",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
  });
});
