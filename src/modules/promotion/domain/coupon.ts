import type { Currency, Money } from "../../../shared/money/index.js";

export type CouponStatus = "ACTIVE" | "DISABLED";

export type CouponDiscount =
  | Readonly<{
      type: "FIXED_AMOUNT";
      amount: Money;
    }>
  | Readonly<{
      type: "PERCENTAGE";
      basisPoints: number;
      currency: Currency;
      maxDiscountAmount: Money | null;
    }>;

export type Coupon = Readonly<{
  id: string;
  code: string;
  status: CouponStatus;
  discount: CouponDiscount;
  minOrderAmount: Money;
  eligibleSkus: readonly string[] | null;
  maxRedemptions: number;
  redeemedCount: number;
  startsAt: Date;
  expiresAt: Date;
  disabledAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type CouponRedemptionStatus = "RESERVED" | "COMMITTED" | "RELEASED";

export type CouponRedemptionBase = Readonly<{
  id: string;
  couponId: string;
  couponCode: string;
  orderId: string;
  idempotencyKey: string;
  orderAmount: Money;
  discountAmount: Money;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type ReservedCouponRedemption = CouponRedemptionBase &
  Readonly<{
    status: "RESERVED";
    reservedAt: Date;
    committedAt: null;
    releasedAt: null;
    releaseReason: null;
  }>;

export type CommittedCouponRedemption = CouponRedemptionBase &
  Readonly<{
    status: "COMMITTED";
    reservedAt: Date;
    committedAt: Date;
    releasedAt: null;
    releaseReason: null;
  }>;

export type ReleasedCouponRedemption = CouponRedemptionBase &
  Readonly<{
    status: "RELEASED";
    reservedAt: Date;
    committedAt: null;
    releasedAt: Date;
    releaseReason: string;
  }>;

export type CouponRedemption =
  | ReservedCouponRedemption
  | CommittedCouponRedemption
  | ReleasedCouponRedemption;

export type CouponQuoteInput = Readonly<{
  orderId: string;
  orderAmount: Money;
  skus: readonly string[];
  now: Date;
}>;

export type CouponQuote = Readonly<{
  couponId: string;
  couponCode: string;
  orderId: string;
  orderAmount: Money;
  discountAmount: Money;
  finalAmount: Money;
}>;
