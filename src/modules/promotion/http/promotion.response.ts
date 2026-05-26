import type { Result } from "../../../shared/result/index.js";
import type {
  CommitCouponRedemptionUseCaseError,
  CommitCouponRedemptionUseCaseResult,
  CreateCouponUseCaseError,
  CreateCouponUseCaseResult,
  QuoteCouponUseCaseError,
  ReleaseCouponRedemptionUseCaseError,
  ReleaseCouponRedemptionUseCaseResult,
  ReserveCouponUseCaseError,
  ReserveCouponUseCaseResult,
} from "../application/index.js";
import type { Coupon, CouponQuote, CouponRedemption } from "../domain/index.js";

export type PromotionHttpResponseShape = Readonly<{
  status: 200 | 201 | 400 | 404 | 409;
  body: unknown;
}>;

export function serializeCoupon(coupon: Coupon): Record<string, unknown> {
  return {
    id: coupon.id,
    code: coupon.code,
    status: coupon.status,
    discount: coupon.discount,
    minOrderAmount: coupon.minOrderAmount,
    eligibleSkus: coupon.eligibleSkus,
    maxRedemptions: coupon.maxRedemptions,
    redeemedCount: coupon.redeemedCount,
    startsAt: coupon.startsAt.toISOString(),
    expiresAt: coupon.expiresAt.toISOString(),
    disabledAt: coupon.disabledAt?.toISOString() ?? null,
    version: coupon.version,
    createdAt: coupon.createdAt.toISOString(),
    updatedAt: coupon.updatedAt.toISOString(),
  };
}

export function serializeCouponQuote(quote: CouponQuote): Record<string, unknown> {
  return {
    couponId: quote.couponId,
    couponCode: quote.couponCode,
    orderId: quote.orderId,
    orderAmount: quote.orderAmount,
    discountAmount: quote.discountAmount,
    finalAmount: quote.finalAmount,
  };
}

export function serializeCouponRedemption(redemption: CouponRedemption): Record<string, unknown> {
  return {
    id: redemption.id,
    couponId: redemption.couponId,
    couponCode: redemption.couponCode,
    orderId: redemption.orderId,
    idempotencyKey: redemption.idempotencyKey,
    status: redemption.status,
    orderAmount: redemption.orderAmount,
    discountAmount: redemption.discountAmount,
    reservedAt: redemption.reservedAt.toISOString(),
    committedAt: redemption.committedAt?.toISOString() ?? null,
    releasedAt: redemption.releasedAt?.toISOString() ?? null,
    releaseReason: redemption.releaseReason,
    version: redemption.version,
    createdAt: redemption.createdAt.toISOString(),
    updatedAt: redemption.updatedAt.toISOString(),
  };
}

export function mapCreateCouponResult(
  result: Result<CreateCouponUseCaseResult, CreateCouponUseCaseError>,
): PromotionHttpResponseShape {
  if (result.ok) {
    return {
      status: 201,
      body: { data: serializeCoupon(result.value.coupon) },
    };
  }

  return mapPromotionError(result.error);
}

export function mapQuoteCouponResult(
  result: Result<CouponQuote, QuoteCouponUseCaseError>,
): PromotionHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: { data: serializeCouponQuote(result.value) },
    };
  }

  return mapPromotionError(result.error);
}

export function mapReserveCouponResult(
  result: Result<ReserveCouponUseCaseResult, ReserveCouponUseCaseError>,
): PromotionHttpResponseShape {
  if (result.ok) {
    return {
      status: result.value.idempotent ? 200 : 201,
      body: {
        data: serializeCouponRedemption(result.value.redemption),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapPromotionError(result.error);
}

export function mapCommitCouponRedemptionResult(
  result: Result<CommitCouponRedemptionUseCaseResult, CommitCouponRedemptionUseCaseError>,
): PromotionHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeCouponRedemption(result.value.redemption),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapPromotionError(result.error);
}

export function mapReleaseCouponRedemptionResult(
  result: Result<ReleaseCouponRedemptionUseCaseResult, ReleaseCouponRedemptionUseCaseError>,
): PromotionHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeCouponRedemption(result.value.redemption),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapPromotionError(result.error);
}

function mapPromotionError(
  error:
    | CreateCouponUseCaseError
    | QuoteCouponUseCaseError
    | ReserveCouponUseCaseError
    | CommitCouponRedemptionUseCaseError
    | ReleaseCouponRedemptionUseCaseError,
): PromotionHttpResponseShape {
  switch (error.type) {
    case "InvalidCouponInput":
    case "CouponCurrencyMismatch":
      return { status: 400, body: { error } };

    case "CouponNotFound":
    case "CouponRedemptionNotFound":
      return { status: 404, body: { error } };

    case "CouponAlreadyExists":
    case "CouponAlreadyReservedForOrder":
    case "CouponExpired":
    case "CouponInactive":
    case "CouponMinimumOrderNotMet":
    case "CouponNotStarted":
    case "CouponRedemptionIdempotencyConflict":
    case "CouponRedemptionNotCommittable":
    case "CouponRedemptionNotReleasable":
    case "CouponSkuNotEligible":
    case "CouponUsageLimitReached":
      return { status: 409, body: { error } };
  }
}
