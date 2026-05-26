import type { CouponRepository } from "./coupon.repository.js";
import type { CouponOutboxRepository } from "./coupon-outbox.repository.js";
import type { CouponRedemptionRepository } from "./coupon-redemption.repository.js";

export type PromotionTransaction = Readonly<{
  coupons: CouponRepository;
  redemptions: CouponRedemptionRepository;
  outbox: CouponOutboxRepository;
}>;

export type PromotionUnitOfWork = {
  withTransaction<T>(work: (transaction: PromotionTransaction) => Promise<T>): Promise<T>;
};
