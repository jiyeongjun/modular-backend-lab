import type { CouponRedemption } from "../domain/index.js";

export type CouponRedemptionRepository = {
  findById(id: string): Promise<CouponRedemption | null>;
  findByIdForUpdate(id: string): Promise<CouponRedemption | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<CouponRedemption | null>;
  findActiveByOrderIdAndCouponCode(
    orderId: string,
    couponCode: string,
  ): Promise<CouponRedemption | null>;
  create(redemption: CouponRedemption): Promise<void>;
  save(redemption: CouponRedemption): Promise<void>;
};
