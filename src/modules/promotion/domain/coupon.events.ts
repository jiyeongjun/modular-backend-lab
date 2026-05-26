import type { Money } from "../../../shared/money/index.js";
import type { CouponDiscount } from "./coupon.js";

export type CouponCreated = Readonly<{
  type: "CouponCreated";
  aggregateType: "Coupon";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    couponId: string;
    code: string;
    discount: CouponDiscount;
    minOrderAmount: Money;
    eligibleSkus: readonly string[] | null;
    maxRedemptions: number;
    startsAt: Date;
    expiresAt: Date;
  };
}>;

export type CouponRedemptionReserved = Readonly<{
  type: "CouponRedemptionReserved";
  aggregateType: "Coupon";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    couponId: string;
    couponCode: string;
    redemptionId: string;
    orderId: string;
    idempotencyKey: string;
    orderAmount: Money;
    discountAmount: Money;
    reservedAt: Date;
  };
}>;

export type CouponRedemptionCommitted = Readonly<{
  type: "CouponRedemptionCommitted";
  aggregateType: "Coupon";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    couponId: string;
    couponCode: string;
    redemptionId: string;
    orderId: string;
    committedAt: Date;
  };
}>;

export type CouponRedemptionReleased = Readonly<{
  type: "CouponRedemptionReleased";
  aggregateType: "Coupon";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    couponId: string;
    couponCode: string;
    redemptionId: string;
    orderId: string;
    reason: string;
    releasedAt: Date;
  };
}>;

export type CouponEvent =
  | CouponCreated
  | CouponRedemptionReserved
  | CouponRedemptionCommitted
  | CouponRedemptionReleased;
