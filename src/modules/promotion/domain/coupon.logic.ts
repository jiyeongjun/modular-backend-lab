import { isPositiveMoney, type Money } from "../../../shared/money/index.js";
import { err, ok, type Result } from "../../../shared/result/index.js";
import type {
  CommitCouponRedemptionError,
  CreateCouponError,
  QuoteCouponError,
  ReleaseCouponRedemptionError,
  ReserveCouponError,
} from "./coupon.errors.js";
import type { CouponEvent } from "./coupon.events.js";
import type {
  CommittedCouponRedemption,
  Coupon,
  CouponDiscount,
  CouponQuote,
  CouponQuoteInput,
  CouponRedemption,
  ReleasedCouponRedemption,
  ReservedCouponRedemption,
} from "./coupon.js";

export type CreateCouponInput = Readonly<{
  id: string;
  code: string;
  discount: CouponDiscount;
  minOrderAmount: Money;
  eligibleSkus: readonly string[] | null;
  maxRedemptions: number;
  startsAt: Date;
  expiresAt: Date;
  now: Date;
}>;

export type ReserveCouponInput = CouponQuoteInput &
  Readonly<{
    redemptionId: string;
    idempotencyKey: string;
  }>;

export type CouponRedemptionTransition<T extends CouponRedemption> = Readonly<{
  coupon: Coupon;
  redemption: T;
  events: readonly CouponEvent[];
}>;

export function createCoupon(input: CreateCouponInput): Result<Coupon, CreateCouponError> {
  const invalidInput = validateCouponInput(input);
  if (invalidInput !== null) {
    return err(invalidInput);
  }

  const coupon: Coupon = {
    id: input.id,
    code: normalizeCode(input.code),
    status: "ACTIVE",
    discount: input.discount,
    minOrderAmount: input.minOrderAmount,
    eligibleSkus: input.eligibleSkus,
    maxRedemptions: input.maxRedemptions,
    redeemedCount: 0,
    startsAt: input.startsAt,
    expiresAt: input.expiresAt,
    disabledAt: null,
    version: 0,
    createdAt: input.now,
    updatedAt: input.now,
  };

  return ok(coupon);
}

export function couponCreatedEvent(coupon: Coupon): CouponEvent {
  return {
    type: "CouponCreated",
    aggregateType: "Coupon",
    aggregateId: coupon.id,
    occurredAt: coupon.createdAt,
    payload: {
      couponId: coupon.id,
      code: coupon.code,
      discount: coupon.discount,
      minOrderAmount: coupon.minOrderAmount,
      eligibleSkus: coupon.eligibleSkus,
      maxRedemptions: coupon.maxRedemptions,
      startsAt: coupon.startsAt,
      expiresAt: coupon.expiresAt,
    },
  };
}

export function quoteCoupon(
  coupon: Coupon,
  input: CouponQuoteInput,
): Result<CouponQuote, QuoteCouponError> {
  const eligibility = validateCouponEligibility(coupon, input);
  if (eligibility !== null) {
    return err(eligibility);
  }

  const discountAmount = calculateDiscountAmount(coupon.discount, input.orderAmount);
  const finalAmount: Money = {
    amount: input.orderAmount.amount - discountAmount.amount,
    currency: input.orderAmount.currency,
  };

  return ok({
    couponId: coupon.id,
    couponCode: coupon.code,
    orderId: input.orderId,
    orderAmount: input.orderAmount,
    discountAmount,
    finalAmount,
  });
}

export function reserveCoupon(
  coupon: Coupon,
  input: ReserveCouponInput,
): Result<CouponRedemptionTransition<ReservedCouponRedemption>, ReserveCouponError> {
  const quoted = quoteCoupon(coupon, input);
  if (!quoted.ok) {
    return err(quoted.error);
  }

  const reservedCoupon: Coupon = {
    ...coupon,
    redeemedCount: coupon.redeemedCount + 1,
    updatedAt: input.now,
  };
  const redemption: ReservedCouponRedemption = {
    id: input.redemptionId,
    couponId: coupon.id,
    couponCode: coupon.code,
    orderId: input.orderId,
    idempotencyKey: input.idempotencyKey,
    orderAmount: input.orderAmount,
    discountAmount: quoted.value.discountAmount,
    status: "RESERVED",
    reservedAt: input.now,
    committedAt: null,
    releasedAt: null,
    releaseReason: null,
    version: 0,
    createdAt: input.now,
    updatedAt: input.now,
  };
  const events: readonly CouponEvent[] = [
    {
      type: "CouponRedemptionReserved",
      aggregateType: "Coupon",
      aggregateId: coupon.id,
      occurredAt: input.now,
      payload: {
        couponId: coupon.id,
        couponCode: coupon.code,
        redemptionId: redemption.id,
        orderId: input.orderId,
        idempotencyKey: input.idempotencyKey,
        orderAmount: input.orderAmount,
        discountAmount: redemption.discountAmount,
        reservedAt: redemption.reservedAt,
      },
    },
  ];

  return ok({ coupon: reservedCoupon, redemption, events });
}

export function commitCouponRedemption(
  coupon: Coupon,
  redemption: CouponRedemption,
  now: Date,
): Result<CouponRedemptionTransition<CommittedCouponRedemption>, CommitCouponRedemptionError> {
  switch (redemption.status) {
    case "COMMITTED":
      return ok({ coupon, redemption, events: [] });

    case "RELEASED":
      return err({
        type: "CouponRedemptionNotCommittable",
        status: redemption.status,
        message: "Released coupon redemptions cannot be committed",
      });

    case "RESERVED": {
      const committed: CommittedCouponRedemption = {
        ...redemption,
        status: "COMMITTED",
        committedAt: now,
        updatedAt: now,
      };
      const updatedCoupon: Coupon = {
        ...coupon,
        updatedAt: now,
      };
      const events: readonly CouponEvent[] = [
        {
          type: "CouponRedemptionCommitted",
          aggregateType: "Coupon",
          aggregateId: coupon.id,
          occurredAt: now,
          payload: {
            couponId: coupon.id,
            couponCode: coupon.code,
            redemptionId: committed.id,
            orderId: committed.orderId,
            committedAt: now,
          },
        },
      ];

      return ok({ coupon: updatedCoupon, redemption: committed, events });
    }
  }
}

export function releaseCouponRedemption(
  coupon: Coupon,
  redemption: CouponRedemption,
  input: Readonly<{ reason: string; now: Date }>,
): Result<CouponRedemptionTransition<ReleasedCouponRedemption>, ReleaseCouponRedemptionError> {
  switch (redemption.status) {
    case "RELEASED":
      return ok({ coupon, redemption, events: [] });

    case "COMMITTED":
      return err({
        type: "CouponRedemptionNotReleasable",
        status: redemption.status,
        message: "Committed coupon redemptions cannot be released",
      });

    case "RESERVED": {
      const released: ReleasedCouponRedemption = {
        ...redemption,
        status: "RELEASED",
        committedAt: null,
        releasedAt: input.now,
        releaseReason: input.reason,
        updatedAt: input.now,
      };
      const updatedCoupon: Coupon = {
        ...coupon,
        redeemedCount: Math.max(0, coupon.redeemedCount - 1),
        updatedAt: input.now,
      };
      const events: readonly CouponEvent[] = [
        {
          type: "CouponRedemptionReleased",
          aggregateType: "Coupon",
          aggregateId: coupon.id,
          occurredAt: input.now,
          payload: {
            couponId: coupon.id,
            couponCode: coupon.code,
            redemptionId: released.id,
            orderId: released.orderId,
            reason: input.reason,
            releasedAt: input.now,
          },
        },
      ];

      return ok({ coupon: updatedCoupon, redemption: released, events });
    }
  }
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function validateCouponInput(input: CreateCouponInput): CreateCouponError | null {
  if (input.id.length === 0) {
    return { type: "InvalidCouponInput", field: "id", message: "Coupon id is required" };
  }
  if (normalizeCode(input.code).length === 0) {
    return { type: "InvalidCouponInput", field: "code", message: "Coupon code is required" };
  }
  if (input.minOrderAmount.amount < 0) {
    return {
      type: "InvalidCouponInput",
      field: "minOrderAmount",
      message: "Minimum order amount cannot be negative",
    };
  }
  if (input.maxRedemptions < 1 || !Number.isInteger(input.maxRedemptions)) {
    return {
      type: "InvalidCouponInput",
      field: "maxRedemptions",
      message: "Max redemptions must be a positive integer",
    };
  }
  if (input.expiresAt <= input.startsAt) {
    return {
      type: "InvalidCouponInput",
      field: "expiresAt",
      message: "Coupon expiration must be after its start time",
    };
  }
  if (input.eligibleSkus?.some((sku) => sku.length === 0)) {
    return {
      type: "InvalidCouponInput",
      field: "eligibleSkus",
      message: "Eligible SKUs must not contain empty values",
    };
  }

  return validateDiscount(input.discount, input.minOrderAmount.currency);
}

function validateDiscount(
  discount: CouponDiscount,
  expectedCurrency: Money["currency"],
): CreateCouponError | null {
  switch (discount.type) {
    case "FIXED_AMOUNT":
      if (!isPositiveMoney(discount.amount)) {
        return {
          type: "InvalidCouponInput",
          field: "discount",
          message: "Fixed coupon discount must be positive",
        };
      }
      if (discount.amount.currency !== expectedCurrency) {
        return {
          type: "CouponCurrencyMismatch",
          expectedCurrency,
          actualCurrency: discount.amount.currency,
          message: "Coupon discount currency must match minimum order currency",
        };
      }
      return null;

    case "PERCENTAGE":
      if (
        discount.basisPoints < 1 ||
        discount.basisPoints > 10_000 ||
        !Number.isInteger(discount.basisPoints)
      ) {
        return {
          type: "InvalidCouponInput",
          field: "discount",
          message: "Percentage coupon discount must be between 1 and 10000 basis points",
        };
      }
      if (discount.currency !== expectedCurrency) {
        return {
          type: "CouponCurrencyMismatch",
          expectedCurrency,
          actualCurrency: discount.currency,
          message: "Coupon discount currency must match minimum order currency",
        };
      }
      if (discount.maxDiscountAmount !== null) {
        if (!isPositiveMoney(discount.maxDiscountAmount)) {
          return {
            type: "InvalidCouponInput",
            field: "discount",
            message: "Percentage coupon max discount must be positive",
          };
        }
        if (discount.maxDiscountAmount.currency !== expectedCurrency) {
          return {
            type: "CouponCurrencyMismatch",
            expectedCurrency,
            actualCurrency: discount.maxDiscountAmount.currency,
            message: "Coupon max discount currency must match minimum order currency",
          };
        }
      }
      return null;
  }
}

function validateCouponEligibility(
  coupon: Coupon,
  input: CouponQuoteInput,
): QuoteCouponError | null {
  if (coupon.status !== "ACTIVE") {
    return {
      type: "CouponInactive",
      status: coupon.status,
      message: "Coupon is not active",
    };
  }
  if (input.now < coupon.startsAt) {
    return {
      type: "CouponNotStarted",
      startsAt: coupon.startsAt,
      message: "Coupon is not active yet",
    };
  }
  if (input.now >= coupon.expiresAt) {
    return {
      type: "CouponExpired",
      expiresAt: coupon.expiresAt,
      message: "Coupon is expired",
    };
  }
  if (coupon.redeemedCount >= coupon.maxRedemptions) {
    return {
      type: "CouponUsageLimitReached",
      maxRedemptions: coupon.maxRedemptions,
      message: "Coupon usage limit has been reached",
    };
  }
  if (input.orderAmount.currency !== coupon.minOrderAmount.currency) {
    return {
      type: "CouponCurrencyMismatch",
      expectedCurrency: coupon.minOrderAmount.currency,
      actualCurrency: input.orderAmount.currency,
      message: "Order currency must match coupon currency",
    };
  }
  if (input.orderAmount.amount < coupon.minOrderAmount.amount) {
    return {
      type: "CouponMinimumOrderNotMet",
      minOrderAmount: coupon.minOrderAmount,
      orderAmount: input.orderAmount,
      message: "Order amount does not meet coupon minimum",
    };
  }
  const eligibleSkus = coupon.eligibleSkus;
  if (eligibleSkus !== null && !input.skus.some((sku) => eligibleSkus.includes(sku))) {
    return {
      type: "CouponSkuNotEligible",
      eligibleSkus,
      requestedSkus: input.skus,
      message: "Coupon is not eligible for the requested SKUs",
    };
  }

  return null;
}

function calculateDiscountAmount(discount: CouponDiscount, orderAmount: Money): Money {
  switch (discount.type) {
    case "FIXED_AMOUNT":
      return {
        amount: Math.min(discount.amount.amount, orderAmount.amount),
        currency: orderAmount.currency,
      };

    case "PERCENTAGE": {
      const rawDiscount = Math.floor((orderAmount.amount * discount.basisPoints) / 10_000);
      const cappedDiscount =
        discount.maxDiscountAmount === null
          ? rawDiscount
          : Math.min(rawDiscount, discount.maxDiscountAmount.amount);
      return {
        amount: Math.min(cappedDiscount, orderAmount.amount),
        currency: orderAmount.currency,
      };
    }
  }
}
