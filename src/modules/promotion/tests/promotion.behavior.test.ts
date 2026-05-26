import { describe, expect, it } from "vitest";
import type { Coupon } from "../domain/index.js";
import {
  commitCouponRedemption,
  createCoupon,
  quoteCoupon,
  releaseCouponRedemption,
  reserveCoupon,
} from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");
const startsAt = new Date("2025-12-31T00:00:00.000Z");
const expiresAt = new Date("2026-12-31T00:00:00.000Z");
const orderAmount = { amount: 10_000, currency: "KRW" } as const;

function createFixedCoupon(overrides: Partial<Coupon> = {}): Coupon {
  const created = createCoupon({
    id: "coupon-1",
    code: "save-3000",
    discount: {
      type: "FIXED_AMOUNT",
      amount: { amount: 3_000, currency: "KRW" },
    },
    minOrderAmount: { amount: 5_000, currency: "KRW" },
    eligibleSkus: ["sku-1"],
    maxRedemptions: 2,
    startsAt,
    expiresAt,
    now,
  });

  if (!created.ok) {
    throw new Error("expected coupon creation to succeed");
  }

  return {
    ...created.value,
    ...overrides,
  };
}

describe("promotion coupon behavior", () => {
  it("quotes a fixed discount without exceeding the order amount", () => {
    const result = quoteCoupon(createFixedCoupon(), {
      orderId: "order-1",
      orderAmount,
      skus: ["sku-1"],
      now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected quote to succeed");
    }
    expect(result.value.discountAmount).toEqual({ amount: 3_000, currency: "KRW" });
    expect(result.value.finalAmount).toEqual({ amount: 7_000, currency: "KRW" });
  });

  it("quotes a capped percentage discount", () => {
    const created = createCoupon({
      id: "coupon-1",
      code: "rate-20",
      discount: {
        type: "PERCENTAGE",
        basisPoints: 2_000,
        currency: "KRW",
        maxDiscountAmount: { amount: 1_500, currency: "KRW" },
      },
      minOrderAmount: { amount: 0, currency: "KRW" },
      eligibleSkus: null,
      maxRedemptions: 10,
      startsAt,
      expiresAt,
      now,
    });
    if (!created.ok) {
      throw new Error("expected coupon creation to succeed");
    }

    const result = quoteCoupon(created.value, {
      orderId: "order-1",
      orderAmount,
      skus: ["sku-1"],
      now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected quote to succeed");
    }
    expect(result.value.discountAmount).toEqual({ amount: 1_500, currency: "KRW" });
  });

  it("rejects ineligible SKUs and usage-limit overflow", () => {
    const skuResult = quoteCoupon(createFixedCoupon(), {
      orderId: "order-1",
      orderAmount,
      skus: ["sku-2"],
      now,
    });
    expect(skuResult.ok).toBe(false);
    if (skuResult.ok) {
      throw new Error("expected SKU eligibility failure");
    }
    expect(skuResult.error.type).toBe("CouponSkuNotEligible");

    const limitResult = quoteCoupon(createFixedCoupon({ redeemedCount: 2 }), {
      orderId: "order-1",
      orderAmount,
      skus: ["sku-1"],
      now,
    });
    expect(limitResult.ok).toBe(false);
    if (limitResult.ok) {
      throw new Error("expected usage limit failure");
    }
    expect(limitResult.error.type).toBe("CouponUsageLimitReached");
  });

  it("reserves, commits, and releases coupon redemptions through explicit states", () => {
    const reserved = reserveCoupon(createFixedCoupon(), {
      redemptionId: "redemption-1",
      orderId: "order-1",
      orderAmount,
      skus: ["sku-1"],
      idempotencyKey: "reserve-1",
      now,
    });
    expect(reserved.ok).toBe(true);
    if (!reserved.ok) {
      throw new Error("expected reserve to succeed");
    }
    expect(reserved.value.coupon.redeemedCount).toBe(1);
    expect(reserved.value.redemption.status).toBe("RESERVED");

    const committed = commitCouponRedemption(
      reserved.value.coupon,
      reserved.value.redemption,
      later,
    );
    expect(committed.ok).toBe(true);
    if (!committed.ok) {
      throw new Error("expected commit to succeed");
    }
    expect(committed.value.redemption.status).toBe("COMMITTED");

    const released = releaseCouponRedemption(reserved.value.coupon, reserved.value.redemption, {
      reason: "checkout failed",
      now: later,
    });
    expect(released.ok).toBe(true);
    if (!released.ok) {
      throw new Error("expected release to succeed");
    }
    expect(released.value.coupon.redeemedCount).toBe(0);
    expect(released.value.redemption.status).toBe("RELEASED");
  });
});
