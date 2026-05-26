import type { Coupon, CouponEvent } from "../domain/index.js";

export type CouponRepository = {
  findById(id: string): Promise<Coupon | null>;
  findByIdForUpdate(id: string): Promise<Coupon | null>;
  findByCode(code: string): Promise<Coupon | null>;
  findByCodeForUpdate(code: string): Promise<Coupon | null>;
  create(coupon: Coupon, events: readonly CouponEvent[]): Promise<void>;
  save(coupon: Coupon, events: readonly CouponEvent[]): Promise<void>;
};
