import { describe, expect, it } from "vitest";
import {
  approveRefund,
  completeRefund,
  createRefund,
  markPaymentRefunded,
  markRestocked,
} from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");
const amount = { amount: 10_000, currency: "KRW" } as const;

describe("refund domain behavior", () => {
  it("moves a return-required refund through payment refund, restock, and completion", () => {
    const created = createRefund({
      id: "refund-1",
      orderId: "order-1",
      paymentId: "payment-1",
      idempotencyKey: "refund-request-1",
      amount,
      reason: "customer return",
      returnRequired: true,
      restock: { sku: "sku-1", quantity: 2 },
      now,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("expected refund to be created");
    }

    const approved = approveRefund(created.value, later);
    if (!approved.ok) {
      throw new Error("expected refund to be approved");
    }

    const paymentRefunded = markPaymentRefunded(approved.value.refund, later);
    if (!paymentRefunded.ok) {
      throw new Error("expected payment refund to be recorded");
    }

    const restocked = markRestocked(paymentRefunded.value.refund, later);
    if (!restocked.ok) {
      throw new Error("expected restock to be recorded");
    }

    const completed = completeRefund(restocked.value.refund, later);

    expect(completed.ok).toBe(true);
    if (!completed.ok) {
      throw new Error("expected refund to complete");
    }
    expect(completed.value.refund.status).toBe("COMPLETED");
    expect(completed.value.refund.restockedAt).toEqual(later);
  });

  it("requires restock metadata when return is required", () => {
    const created = createRefund({
      id: "refund-1",
      orderId: "order-1",
      paymentId: "payment-1",
      idempotencyKey: "refund-request-1",
      amount,
      reason: "customer return",
      returnRequired: true,
      restock: null,
      now,
    });

    expect(created).toEqual({
      ok: false,
      error: {
        type: "RefundRestockRequired",
        message: "Return-required refunds must include restock metadata",
      },
    });
  });
});
