import { describe, expect, it } from "vitest";
import type { SettlementSourceFacts } from "../domain/index.js";
import { syncSettlement } from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const deliveredAt = new Date("2026-01-02T00:00:00.000Z");
const amount = { amount: 10_000, currency: "KRW" } as const;

function createFacts(overrides: Partial<SettlementSourceFacts> = {}): SettlementSourceFacts {
  return {
    orderId: "order-1",
    payment: {
      paymentId: "payment-1",
      amount,
      authorizedAt: now,
    },
    refunds: [],
    fulfillment: {
      fulfillmentId: "fulfillment-1",
      deliveredAt,
    },
    ...overrides,
  };
}

describe("settlement behavior", () => {
  it("opens and marks a settlement ready from authorized payment and delivered fulfillment", () => {
    const result = syncSettlement({
      id: "settlement:order-1",
      existing: null,
      facts: createFacts(),
      now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected settlement sync to succeed");
    }
    expect(result.value.settlement.status).toBe("READY");
    expect(result.value.settlement.netAmount).toEqual(amount);
    expect(result.value.events.map((event) => event.type)).toEqual([
      "SettlementOpened",
      "SettlementMarkedReady",
    ]);
  });

  it("keeps settlement open until delivery exists", () => {
    const result = syncSettlement({
      id: "settlement:order-1",
      existing: null,
      facts: createFacts({ fulfillment: null }),
      now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected settlement sync to succeed");
    }
    expect(result.value.settlement.status).toBe("OPEN");
    expect(result.value.events.map((event) => event.type)).toEqual(["SettlementOpened"]);
  });

  it("updates refunded and net amounts after a settlement is ready", () => {
    const initial = syncSettlement({
      id: "settlement:order-1",
      existing: null,
      facts: createFacts(),
      now,
    });
    if (!initial.ok) {
      throw new Error("expected initial settlement sync to succeed");
    }

    const refundFacts = createFacts({
      refunds: [
        {
          refundId: "refund-1",
          paymentId: "payment-1",
          amount: { amount: 3_000, currency: "KRW" },
          refundedAt: new Date("2026-01-03T00:00:00.000Z"),
        },
      ],
    });
    const updated = syncSettlement({
      id: "settlement:order-1",
      existing: initial.value.settlement,
      facts: refundFacts,
      now: new Date("2026-01-03T00:10:00.000Z"),
    });

    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      throw new Error("expected refund settlement sync to succeed");
    }
    expect(updated.value.settlement.status).toBe("READY");
    expect(updated.value.settlement.refundedAmount.amount).toBe(3_000);
    expect(updated.value.settlement.netAmount.amount).toBe(7_000);
    expect(updated.value.events.map((event) => event.type)).toEqual(["SettlementRefundsUpdated"]);

    const repeated = syncSettlement({
      id: "settlement:order-1",
      existing: updated.value.settlement,
      facts: refundFacts,
      now: new Date("2026-01-03T00:20:00.000Z"),
    });
    expect(repeated.ok).toBe(true);
    if (!repeated.ok) {
      throw new Error("expected repeated settlement sync to succeed");
    }
    expect(repeated.value.events).toEqual([]);
  });

  it("rejects refunded totals greater than the authorized payment", () => {
    const result = syncSettlement({
      id: "settlement:order-1",
      existing: null,
      facts: createFacts({
        refunds: [
          {
            refundId: "refund-1",
            paymentId: "payment-1",
            amount: { amount: 10_001, currency: "KRW" },
            refundedAt: new Date("2026-01-03T00:00:00.000Z"),
          },
        ],
      }),
      now,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        type: "SettlementRefundExceedsGross",
        orderId: "order-1",
        grossAmount: amount,
        refundedAmount: { amount: 10_001, currency: "KRW" },
        message: "Refunded amount cannot exceed gross payment amount",
      },
    });
  });
});
