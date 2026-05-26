import type {
  CouponInsert,
  CouponRedemptionInsert,
  CouponRedemptionRow,
  CouponRedemptionUpdate,
  CouponRow,
  CouponUpdate,
} from "../../../infra/db/database.js";
import type { Currency, Money } from "../../../shared/money/index.js";
import type {
  CommittedCouponRedemption,
  Coupon,
  CouponDiscount,
  CouponRedemption,
  CouponRedemptionStatus,
  CouponStatus,
  ReleasedCouponRedemption,
  ReservedCouponRedemption,
} from "../domain/index.js";

function toCouponStatus(value: string): CouponStatus {
  if (value === "ACTIVE" || value === "DISABLED") {
    return value;
  }
  throw new Error(`Unknown coupon status: ${value}`);
}

function toRedemptionStatus(value: string): CouponRedemptionStatus {
  if (value === "RESERVED" || value === "COMMITTED" || value === "RELEASED") {
    return value;
  }
  throw new Error(`Unknown coupon redemption status: ${value}`);
}

function toCurrency(value: string): Currency {
  if (value === "KRW" || value === "USD") {
    return value;
  }
  throw new Error(`Unknown promotion currency: ${value}`);
}

function toMoney(amount: number, currency: Currency): Money {
  return { amount, currency };
}

function toEligibleSkus(value: unknown | null): readonly string[] | null {
  if (value === null) {
    return null;
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error("Coupon eligible_skus must be a string array");
  }
  return value;
}

function toDiscount(row: CouponRow, currency: Currency): CouponDiscount {
  if (row.discount_type === "FIXED_AMOUNT") {
    if (row.discount_amount === null || row.discount_basis_points !== null) {
      throw new Error(`Fixed coupon ${row.id} has invalid discount columns`);
    }
    return {
      type: "FIXED_AMOUNT",
      amount: toMoney(row.discount_amount, currency),
    };
  }

  if (row.discount_type === "PERCENTAGE") {
    if (row.discount_basis_points === null || row.discount_amount !== null) {
      throw new Error(`Percentage coupon ${row.id} has invalid discount columns`);
    }
    return {
      type: "PERCENTAGE",
      basisPoints: row.discount_basis_points,
      currency,
      maxDiscountAmount:
        row.max_discount_amount === null ? null : toMoney(row.max_discount_amount, currency),
    };
  }

  throw new Error(`Unknown coupon discount type: ${row.discount_type}`);
}

export function toCoupon(row: CouponRow): Coupon {
  const currency = toCurrency(row.currency);
  return {
    id: row.id,
    code: row.code,
    status: toCouponStatus(row.status),
    discount: toDiscount(row, currency),
    minOrderAmount: toMoney(row.min_order_amount, currency),
    eligibleSkus: toEligibleSkus(row.eligible_skus),
    maxRedemptions: row.max_redemptions,
    redeemedCount: row.redeemed_count,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    disabledAt: row.disabled_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCouponInsert(coupon: Coupon): CouponInsert {
  return {
    id: coupon.id,
    code: coupon.code,
    status: coupon.status,
    discount_type: coupon.discount.type,
    discount_amount: coupon.discount.type === "FIXED_AMOUNT" ? coupon.discount.amount.amount : null,
    discount_basis_points:
      coupon.discount.type === "PERCENTAGE" ? coupon.discount.basisPoints : null,
    max_discount_amount:
      coupon.discount.type === "PERCENTAGE"
        ? (coupon.discount.maxDiscountAmount?.amount ?? null)
        : null,
    currency: coupon.minOrderAmount.currency,
    min_order_amount: coupon.minOrderAmount.amount,
    eligible_skus: coupon.eligibleSkus === null ? null : JSON.stringify(coupon.eligibleSkus),
    max_redemptions: coupon.maxRedemptions,
    redeemed_count: coupon.redeemedCount,
    starts_at: coupon.startsAt,
    expires_at: coupon.expiresAt,
    disabled_at: coupon.disabledAt,
    version: coupon.version,
    created_at: coupon.createdAt,
    updated_at: coupon.updatedAt,
  };
}

export function toCouponUpdate(coupon: Coupon): CouponUpdate {
  return {
    status: coupon.status,
    redeemed_count: coupon.redeemedCount,
    disabled_at: coupon.disabledAt,
    updated_at: coupon.updatedAt,
  };
}

function redemptionBase(row: CouponRedemptionRow) {
  const currency = toCurrency(row.currency);
  return {
    id: row.id,
    couponId: row.coupon_id,
    couponCode: row.coupon_code,
    orderId: row.order_id,
    idempotencyKey: row.idempotency_key,
    orderAmount: toMoney(row.order_amount, currency),
    discountAmount: toMoney(row.discount_amount, currency),
    reservedAt: row.reserved_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCouponRedemption(row: CouponRedemptionRow): CouponRedemption {
  switch (toRedemptionStatus(row.status)) {
    case "RESERVED": {
      if (row.committed_at !== null || row.released_at !== null || row.release_reason !== null) {
        throw new Error(`Reserved coupon redemption ${row.id} has terminal columns`);
      }
      const redemption: ReservedCouponRedemption = {
        ...redemptionBase(row),
        status: "RESERVED",
        committedAt: null,
        releasedAt: null,
        releaseReason: null,
      };
      return redemption;
    }

    case "COMMITTED": {
      if (row.committed_at === null || row.released_at !== null || row.release_reason !== null) {
        throw new Error(`Committed coupon redemption ${row.id} has invalid columns`);
      }
      const redemption: CommittedCouponRedemption = {
        ...redemptionBase(row),
        status: "COMMITTED",
        committedAt: row.committed_at,
        releasedAt: null,
        releaseReason: null,
      };
      return redemption;
    }

    case "RELEASED": {
      if (row.committed_at !== null || row.released_at === null || row.release_reason === null) {
        throw new Error(`Released coupon redemption ${row.id} has invalid columns`);
      }
      const redemption: ReleasedCouponRedemption = {
        ...redemptionBase(row),
        status: "RELEASED",
        committedAt: null,
        releasedAt: row.released_at,
        releaseReason: row.release_reason,
      };
      return redemption;
    }
  }
}

export function toCouponRedemptionInsert(redemption: CouponRedemption): CouponRedemptionInsert {
  return {
    id: redemption.id,
    coupon_id: redemption.couponId,
    coupon_code: redemption.couponCode,
    order_id: redemption.orderId,
    idempotency_key: redemption.idempotencyKey,
    status: redemption.status,
    order_amount: redemption.orderAmount.amount,
    discount_amount: redemption.discountAmount.amount,
    currency: redemption.orderAmount.currency,
    reserved_at: redemption.reservedAt,
    committed_at: redemption.committedAt,
    released_at: redemption.releasedAt,
    release_reason: redemption.releaseReason,
    version: redemption.version,
    created_at: redemption.createdAt,
    updated_at: redemption.updatedAt,
  };
}

export function toCouponRedemptionUpdate(redemption: CouponRedemption): CouponRedemptionUpdate {
  return {
    status: redemption.status,
    committed_at: redemption.committedAt,
    released_at: redemption.releasedAt,
    release_reason: redemption.releaseReason,
    updated_at: redemption.updatedAt,
  };
}
