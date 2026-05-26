import { describe, expect, it } from "vitest";
import { createRouteTestApp } from "../../../../test/http/create-test-app.js";
import { err, ok } from "../../../shared/result/index.js";
import type {
  CommitCouponRedemptionUseCase,
  CreateCouponUseCase,
  QuoteCouponUseCase,
  ReleaseCouponRedemptionUseCase,
  ReserveCouponUseCase,
} from "../application/index.js";
import type { Coupon, CouponQuote, ReservedCouponRedemption } from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const expiresAt = new Date("2026-12-31T00:00:00.000Z");

function createCoupon(): Coupon {
  return {
    id: "coupon-1",
    code: "SAVE-3000",
    status: "ACTIVE",
    discount: {
      type: "FIXED_AMOUNT",
      amount: { amount: 3_000, currency: "KRW" },
    },
    minOrderAmount: { amount: 5_000, currency: "KRW" },
    eligibleSkus: ["sku-1"],
    maxRedemptions: 10,
    redeemedCount: 0,
    startsAt: now,
    expiresAt,
    disabledAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function createQuote(): CouponQuote {
  return {
    couponId: "coupon-1",
    couponCode: "SAVE-3000",
    orderId: "order-1",
    orderAmount: { amount: 10_000, currency: "KRW" },
    discountAmount: { amount: 3_000, currency: "KRW" },
    finalAmount: { amount: 7_000, currency: "KRW" },
  };
}

function createRedemption(): ReservedCouponRedemption {
  return {
    id: "redemption-1",
    couponId: "coupon-1",
    couponCode: "SAVE-3000",
    orderId: "order-1",
    idempotencyKey: "reserve-1",
    orderAmount: { amount: 10_000, currency: "KRW" },
    discountAmount: { amount: 3_000, currency: "KRW" },
    status: "RESERVED",
    reservedAt: now,
    committedAt: null,
    releasedAt: null,
    releaseReason: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function createTestApp(overrides: {
  createCouponUseCase?: CreateCouponUseCase;
  quoteCouponUseCase?: QuoteCouponUseCase;
  reserveCouponUseCase?: ReserveCouponUseCase;
  commitCouponRedemptionUseCase?: CommitCouponRedemptionUseCase;
  releaseCouponRedemptionUseCase?: ReleaseCouponRedemptionUseCase;
}) {
  return createRouteTestApp({
    createCouponUseCase:
      overrides.createCouponUseCase ?? (async () => ok({ coupon: createCoupon() })),
    quoteCouponUseCase: overrides.quoteCouponUseCase ?? (async () => ok(createQuote())),
    reserveCouponUseCase:
      overrides.reserveCouponUseCase ??
      (async () => ok({ redemption: createRedemption(), idempotent: false })),
    commitCouponRedemptionUseCase:
      overrides.commitCouponRedemptionUseCase ??
      (async () => ok({ redemption: createRedemption(), idempotent: false })),
    releaseCouponRedemptionUseCase:
      overrides.releaseCouponRedemptionUseCase ??
      (async () => ok({ redemption: createRedemption(), idempotent: false })),
  });
}

function createCouponBody(): string {
  return JSON.stringify({
    code: "save-3000",
    discount: {
      type: "FIXED_AMOUNT",
      amount: { amount: 3_000, currency: "KRW" },
    },
    minOrderAmount: { amount: 5_000, currency: "KRW" },
    eligibleSkus: ["sku-1"],
    maxRedemptions: 10,
    startsAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
}

function quoteBody(): string {
  return JSON.stringify({
    code: "save-3000",
    orderId: "order-1",
    orderAmount: { amount: 10_000, currency: "KRW" },
    skus: ["sku-1"],
  });
}

describe("promotion routes", () => {
  it("returns 201 when coupon is created", async () => {
    const app = createTestApp({});

    const response = await app.request("/promotions/coupons", {
      method: "POST",
      body: createCouponBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(201);
  });

  it("returns 400 for invalid coupon creation body", async () => {
    const app = createTestApp({});

    const response = await app.request("/promotions/coupons", {
      method: "POST",
      body: JSON.stringify({
        code: "",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
  });

  it("returns 200 when coupon quote succeeds", async () => {
    const app = createTestApp({});

    const response = await app.request("/promotions/coupons/quote", {
      method: "POST",
      body: quoteBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
  });

  it("maps quote eligibility failures to 409", async () => {
    const app = createTestApp({
      quoteCouponUseCase: async () =>
        err({
          type: "CouponMinimumOrderNotMet",
          minOrderAmount: { amount: 5_000, currency: "KRW" },
          orderAmount: { amount: 3_000, currency: "KRW" },
          message: "Order amount does not meet coupon minimum",
        }),
    });

    const response = await app.request("/promotions/coupons/quote", {
      method: "POST",
      body: quoteBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(409);
  });

  it("returns 201 when coupon is reserved", async () => {
    const app = createTestApp({});

    const response = await app.request("/promotions/coupons/reserve", {
      method: "POST",
      body: JSON.stringify({
        code: "save-3000",
        orderId: "order-1",
        orderAmount: { amount: 10_000, currency: "KRW" },
        skus: ["sku-1"],
        idempotencyKey: "reserve-1",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(201);
  });

  it("returns 200 when redemption commit succeeds", async () => {
    const app = createTestApp({});

    const response = await app.request("/promotions/coupon-redemptions/redemption-1/commit", {
      method: "POST",
    });

    expect(response.status).toBe(200);
  });

  it("returns 200 when redemption release succeeds", async () => {
    const app = createTestApp({});

    const response = await app.request("/promotions/coupon-redemptions/redemption-1/release", {
      method: "POST",
      body: JSON.stringify({ reason: "checkout failed" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
  });
});
