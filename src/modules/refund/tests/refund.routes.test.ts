import { describe, expect, it } from "vitest";
import { createRouteTestApp } from "../../../../test/http/create-test-app.js";
import { err, ok } from "../../../shared/result/index.js";
import type {
  ProcessRefundUseCase,
  RejectRefundUseCase,
  RequestRefundUseCase,
} from "../application/index.js";
import type { RequestedRefund } from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const amount = { amount: 10_000, currency: "KRW" } as const;

function createRefund(overrides: Partial<RequestedRefund> = {}): RequestedRefund {
  return {
    id: "refund-1",
    orderId: "order-1",
    paymentId: "payment-1",
    idempotencyKey: "refund-request-1",
    paymentRefundIdempotencyKey: "refund-1:payment-refund",
    restockIdempotencyKey: null,
    amount,
    reason: "customer request",
    returnRequired: false,
    restock: null,
    status: "REQUESTED",
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    paymentRefundedAt: null,
    restockedAt: null,
    completedAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createTestApp(overrides: {
  requestRefundUseCase?: RequestRefundUseCase;
  processRefundUseCase?: ProcessRefundUseCase;
  rejectRefundUseCase?: RejectRefundUseCase;
}) {
  return createRouteTestApp({
    requestRefundUseCase:
      overrides.requestRefundUseCase ??
      (async () => ok({ refund: createRefund(), idempotent: false })),
    processRefundUseCase:
      overrides.processRefundUseCase ??
      (async () => ok({ refund: createRefund({ status: "REQUESTED" }), idempotent: false })),
    rejectRefundUseCase:
      overrides.rejectRefundUseCase ??
      (async () => ok({ refund: createRefund({ status: "REQUESTED" }), idempotent: false })),
  });
}

function validRequestBody(): string {
  return JSON.stringify({
    orderId: "order-1",
    paymentId: "payment-1",
    amount: 10_000,
    currency: "KRW",
    reason: "customer request",
    returnRequired: false,
    restock: null,
    idempotencyKey: "refund-request-1",
  });
}

describe("refund routes", () => {
  it("returns 201 when refund is requested", async () => {
    const app = createTestApp({});

    const response = await app.request("/refunds", {
      method: "POST",
      body: validRequestBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(201);
  });

  it("returns 400 when restock metadata does not match returnRequired", async () => {
    const app = createTestApp({});

    const response = await app.request("/refunds", {
      method: "POST",
      body: JSON.stringify({
        orderId: "order-1",
        paymentId: "payment-1",
        amount: 10_000,
        currency: "KRW",
        reason: "customer request",
        returnRequired: false,
        restock: { sku: "sku-1", quantity: 2 },
        idempotencyKey: "refund-request-1",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
  });

  it("maps shipped refund without return to 409", async () => {
    const app = createTestApp({
      requestRefundUseCase: async () =>
        err({
          type: "RefundReturnRequired",
          fulfillmentStatus: "SHIPPED",
          message: "Shipped or delivered orders require a return before refund completion",
        }),
    });

    const response = await app.request("/refunds", {
      method: "POST",
      body: validRequestBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(409);
  });

  it("maps provider refund failure to 502", async () => {
    const app = createTestApp({
      processRefundUseCase: async () =>
        err({
          type: "RefundPaymentFailed",
          refundId: "refund-1",
          paymentError: {
            type: "RefundPaymentProviderRejected",
            providerCode: "REJECT_REFUND",
            statusCode: 400,
            retryable: false,
            message: "Provider rejected refund",
          },
          message: "Payment refund failed",
        }),
    });

    const response = await app.request("/refunds/refund-1/process", { method: "POST" });

    expect(response.status).toBe(502);
  });
});
