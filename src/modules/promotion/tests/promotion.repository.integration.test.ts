import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import { couponCreatedEvent, createCoupon, reserveCoupon } from "../domain/index.js";
import {
  createKyselyCouponRedemptionRepository,
  createKyselyCouponRepository,
} from "../infra/index.js";

const dockerAvailable = isDockerAvailable();
const now = new Date("2026-01-01T00:00:00.000Z");
const startsAt = new Date("2025-12-31T00:00:00.000Z");
const expiresAt = new Date("2026-12-31T00:00:00.000Z");

function createCouponFixture() {
  const created = createCoupon({
    id: "coupon-1",
    code: "save-3000",
    discount: {
      type: "FIXED_AMOUNT",
      amount: { amount: 3_000, currency: "KRW" },
    },
    minOrderAmount: { amount: 5_000, currency: "KRW" },
    eligibleSkus: ["sku-1"],
    maxRedemptions: 10,
    startsAt,
    expiresAt,
    now,
  });
  if (!created.ok) {
    throw new Error("expected coupon to be created");
  }
  return created.value;
}

describe.runIf(dockerAvailable)("promotion repository integration", () => {
  it("persists coupon state, redemption projection, and domain events", async () => {
    await withTestDatabase(async (db) => {
      const coupons = createKyselyCouponRepository(db);
      const redemptions = createKyselyCouponRedemptionRepository(db);
      const coupon = createCouponFixture();
      await coupons.create(coupon, [couponCreatedEvent(coupon)]);

      const loaded = await coupons.findByCode("SAVE-3000");
      if (loaded === null) {
        throw new Error("expected coupon to be loaded");
      }

      const reserved = reserveCoupon(loaded, {
        redemptionId: "redemption-1",
        orderId: "order-1",
        orderAmount: { amount: 10_000, currency: "KRW" },
        skus: ["sku-1"],
        idempotencyKey: "reserve-1",
        now,
      });
      if (!reserved.ok) {
        throw new Error("expected coupon to reserve");
      }

      await coupons.save(reserved.value.coupon, reserved.value.events);
      await redemptions.create(reserved.value.redemption);

      const savedCoupon = await coupons.findByCode("SAVE-3000");
      const savedRedemption = await redemptions.findByIdempotencyKey("reserve-1");
      const domainEventRows = await db
        .selectFrom("domain_events")
        .selectAll()
        .where("aggregate_type", "=", "Coupon")
        .where("aggregate_id", "=", "coupon-1")
        .orderBy("aggregate_version", "asc")
        .execute();

      expect(savedCoupon?.redeemedCount).toBe(1);
      expect(savedCoupon?.version).toBe(1);
      expect(savedRedemption?.status).toBe("RESERVED");
      expect(domainEventRows.map((row) => row.event_type)).toEqual([
        "CouponCreated",
        "CouponRedemptionReserved",
      ]);
      expect(domainEventRows.map((row) => row.aggregate_version)).toEqual([0, 1]);
    });
  });
});

describe.runIf(!dockerAvailable)("promotion repository integration prerequisites", () => {
  it("documents that Docker is required for promotion repository integration tests", () => {
    expect(dockerAvailable).toBe(false);
  });
});
