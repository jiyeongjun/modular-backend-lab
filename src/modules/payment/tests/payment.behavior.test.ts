import { describe, expect, it } from "vitest";
import {
  authorizePayment,
  cancelPayment,
  type PaymentAuthorization,
  startPayment,
} from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const approvedAt = new Date("2026-01-01T00:00:01.000Z");

function createAuthorization(overrides: Partial<PaymentAuthorization> = {}): PaymentAuthorization {
  return {
    providerPaymentKey: "payment-key-1",
    orderId: "order-1",
    amount: { amount: 10_000, currency: "KRW" },
    providerStatus: "DONE",
    method: "CARD",
    receiptUrl: "https://receipt.example",
    authorizedAt: approvedAt,
    ...overrides,
  };
}

describe("payment domain behavior", () => {
  it("starts and authorizes a pending payment", () => {
    const started = startPayment({
      id: "payment-1",
      orderId: "order-1",
      providerPaymentKey: "payment-key-1",
      confirmIdempotencyKey: "confirm-1",
      amount: { amount: 10_000, currency: "KRW" },
      now,
    });

    expect(started.ok).toBe(true);
    if (!started.ok) {
      throw new Error("expected payment to start");
    }

    const authorized = authorizePayment(started.value, createAuthorization(), now);

    expect(authorized.ok).toBe(true);
    if (!authorized.ok) {
      throw new Error("expected payment to authorize");
    }
    expect(authorized.value.payment.status).toBe("AUTHORIZED");
    expect(authorized.value.payment.authorizedAt).toEqual(approvedAt);
    expect(authorized.value.events[0]?.type).toBe("PaymentAuthorized");
  });

  it("rejects provider amount mismatches before marking payment authorized", () => {
    const started = startPayment({
      id: "payment-1",
      orderId: "order-1",
      providerPaymentKey: "payment-key-1",
      confirmIdempotencyKey: "confirm-1",
      amount: { amount: 10_000, currency: "KRW" },
      now,
    });

    if (!started.ok) {
      throw new Error("expected payment to start");
    }

    const authorized = authorizePayment(
      started.value,
      createAuthorization({ amount: { amount: 9_000, currency: "KRW" } }),
      now,
    );

    expect(authorized).toEqual({
      ok: false,
      error: {
        type: "PaymentAuthorizationMismatch",
        field: "amount",
        message: "Provider amount did not match the pending payment",
      },
    });
  });

  it("cancels an authorized payment", () => {
    const started = startPayment({
      id: "payment-1",
      orderId: "order-1",
      providerPaymentKey: "payment-key-1",
      confirmIdempotencyKey: "confirm-1",
      amount: { amount: 10_000, currency: "KRW" },
      now,
    });

    if (!started.ok) {
      throw new Error("expected payment to start");
    }

    const authorized = authorizePayment(started.value, createAuthorization(), now);
    if (!authorized.ok) {
      throw new Error("expected payment to authorize");
    }

    const cancelled = cancelPayment(
      authorized.value.payment,
      {
        cancelIdempotencyKey: "cancel-1",
        cancelReason: "customer request",
        providerStatus: "CANCELED",
        cancelledAt: new Date("2026-01-01T00:00:02.000Z"),
      },
      now,
    );

    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) {
      throw new Error("expected payment to cancel");
    }
    expect(cancelled.value.payment.status).toBe("CANCELLED");
    expect(cancelled.value.payment.cancelIdempotencyKey).toBe("cancel-1");
    expect(cancelled.value.events[0]?.type).toBe("PaymentCancelled");
  });
});
