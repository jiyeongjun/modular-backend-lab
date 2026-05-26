import { describe, expect, it } from "vitest";
import {
  createCreateCouponUseCase,
  createReleaseCouponRedemptionUseCase,
  createReserveCouponUseCase,
} from "../application/index.js";
import type { Coupon, CouponEvent, CouponRedemption } from "../domain/index.js";
import type {
  CouponOutboxRepository,
  CouponRedemptionRepository,
  CouponRepository,
  PromotionUnitOfWork,
} from "../ports/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");
const startsAt = new Date("2025-12-31T00:00:00.000Z");
const expiresAt = new Date("2026-12-31T00:00:00.000Z");

function createFakeUow(): {
  uow: PromotionUnitOfWork;
  coupons: Coupon[];
  redemptions: CouponRedemption[];
  outboxEvents: CouponEvent[];
} {
  const couponState: Coupon[] = [];
  const redemptionState: CouponRedemption[] = [];
  const outboxEvents: CouponEvent[] = [];

  function findCouponBy(predicate: (coupon: Coupon) => boolean): Coupon | null {
    return couponState.find(predicate) ?? null;
  }

  function findRedemptionBy(
    predicate: (redemption: CouponRedemption) => boolean,
  ): CouponRedemption | null {
    return redemptionState.find(predicate) ?? null;
  }

  const coupons: CouponRepository = {
    findById: async (id) => findCouponBy((coupon) => coupon.id === id),
    findByIdForUpdate: async (id) => findCouponBy((coupon) => coupon.id === id),
    findByCode: async (code) => findCouponBy((coupon) => coupon.code === code),
    findByCodeForUpdate: async (code) => findCouponBy((coupon) => coupon.code === code),
    create: async (coupon) => {
      couponState.push(coupon);
    },
    save: async (coupon) => {
      const index = couponState.findIndex((current) => current.id === coupon.id);
      if (index === -1) {
        throw new Error("coupon missing");
      }
      couponState[index] = coupon;
    },
  };

  const redemptions: CouponRedemptionRepository = {
    findById: async (id) => findRedemptionBy((redemption) => redemption.id === id),
    findByIdForUpdate: async (id) => findRedemptionBy((redemption) => redemption.id === id),
    findByIdempotencyKey: async (idempotencyKey) =>
      findRedemptionBy((redemption) => redemption.idempotencyKey === idempotencyKey),
    findActiveByOrderIdAndCouponCode: async (orderId, couponCode) =>
      findRedemptionBy(
        (redemption) =>
          redemption.orderId === orderId &&
          redemption.couponCode === couponCode &&
          (redemption.status === "RESERVED" || redemption.status === "COMMITTED"),
      ),
    create: async (redemption) => {
      redemptionState.push(redemption);
    },
    save: async (redemption) => {
      const index = redemptionState.findIndex((current) => current.id === redemption.id);
      if (index === -1) {
        throw new Error("redemption missing");
      }
      redemptionState[index] = redemption;
    },
  };

  const outbox: CouponOutboxRepository = {
    saveAll: async (events) => {
      outboxEvents.push(...events);
    },
  };

  return {
    uow: {
      async withTransaction(work) {
        return work({ coupons, redemptions, outbox });
      },
    },
    coupons: couponState,
    redemptions: redemptionState,
    outboxEvents,
  };
}

async function createCouponFixture(fake: ReturnType<typeof createFakeUow>): Promise<void> {
  const createCoupon = createCreateCouponUseCase({
    uow: fake.uow,
    now: () => now,
    generateId: () => "coupon-1",
  });
  const result = await createCoupon({
    code: "save-3000",
    discount: {
      type: "FIXED_AMOUNT",
      amount: { amount: 3_000, currency: "KRW" },
    },
    minOrderAmount: { amount: 5_000, currency: "KRW" },
    eligibleSkus: ["sku-1"],
    maxRedemptions: 1,
    startsAt,
    expiresAt,
  });
  if (!result.ok) {
    throw new Error("expected coupon fixture to be created");
  }
}

describe("promotion usecases", () => {
  it("reserves coupons idempotently by idempotency key", async () => {
    const fake = createFakeUow();
    await createCouponFixture(fake);
    const reserve = createReserveCouponUseCase({
      uow: fake.uow,
      now: () => now,
      generateId: () => "redemption-1",
    });

    const first = await reserve({
      code: "save-3000",
      orderId: "order-1",
      orderAmount: { amount: 10_000, currency: "KRW" },
      skus: ["sku-1"],
      idempotencyKey: "reserve-1",
    });
    const second = await reserve({
      code: "save-3000",
      orderId: "order-1",
      orderAmount: { amount: 10_000, currency: "KRW" },
      skus: ["sku-1"],
      idempotencyKey: "reserve-1",
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      throw new Error("expected reserve to succeed");
    }
    expect(first.value.idempotent).toBe(false);
    expect(second.value.idempotent).toBe(true);
    expect(fake.coupons[0]?.redeemedCount).toBe(1);
    expect(fake.redemptions).toHaveLength(1);
  });

  it("releases a reserved coupon and returns usage capacity", async () => {
    const fake = createFakeUow();
    await createCouponFixture(fake);
    const reserve = createReserveCouponUseCase({
      uow: fake.uow,
      now: () => now,
      generateId: () => "redemption-1",
    });
    await reserve({
      code: "save-3000",
      orderId: "order-1",
      orderAmount: { amount: 10_000, currency: "KRW" },
      skus: ["sku-1"],
      idempotencyKey: "reserve-1",
    });
    const release = createReleaseCouponRedemptionUseCase({
      uow: fake.uow,
      now: () => later,
    });

    const result = await release({
      redemptionId: "redemption-1",
      reason: "checkout failed",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected release to succeed");
    }
    expect(result.value.redemption.status).toBe("RELEASED");
    expect(fake.coupons[0]?.redeemedCount).toBe(0);
    expect(fake.outboxEvents.map((event) => event.type)).toEqual([
      "CouponCreated",
      "CouponRedemptionReserved",
      "CouponRedemptionReleased",
    ]);
  });
});
