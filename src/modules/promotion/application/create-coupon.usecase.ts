import type { Money } from "../../../shared/money/index.js";
import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type Coupon,
  type CouponDiscount,
  type CreateCouponError,
  couponCreatedEvent,
  createCoupon,
  normalizeCode,
} from "../domain/index.js";
import type { PromotionUnitOfWork } from "../ports/index.js";

export type CreateCouponCommand = Readonly<{
  code: string;
  discount: CouponDiscount;
  minOrderAmount: Money;
  eligibleSkus: readonly string[] | null;
  maxRedemptions: number;
  startsAt: Date;
  expiresAt: Date;
}>;

export type CreateCouponUseCaseError =
  | CreateCouponError
  | {
      type: "CouponAlreadyExists";
      code: string;
      message: string;
    };

export type CreateCouponUseCaseResult = Readonly<{
  coupon: Coupon;
}>;

export type CreateCouponUseCase = (
  command: CreateCouponCommand,
) => Promise<Result<CreateCouponUseCaseResult, CreateCouponUseCaseError>>;

export function createCreateCouponUseCase(deps: {
  uow: PromotionUnitOfWork;
  now: () => Date;
  generateId: () => string;
}): CreateCouponUseCase {
  return async function createCouponUseCase(command) {
    const coupon = createCoupon({
      id: deps.generateId(),
      code: command.code,
      discount: command.discount,
      minOrderAmount: command.minOrderAmount,
      eligibleSkus: command.eligibleSkus,
      maxRedemptions: command.maxRedemptions,
      startsAt: command.startsAt,
      expiresAt: command.expiresAt,
      now: deps.now(),
    });

    if (!coupon.ok) {
      return err(coupon.error);
    }

    return deps.uow.withTransaction(async ({ coupons, outbox }) => {
      const existing = await coupons.findByCode(normalizeCode(command.code));
      if (existing !== null) {
        return err({
          type: "CouponAlreadyExists",
          code: normalizeCode(command.code),
          message: "A coupon already exists for this code",
        });
      }

      const events = [couponCreatedEvent(coupon.value)];
      await coupons.create(coupon.value, events);
      await outbox.saveAll(events);

      return ok({ coupon: coupon.value });
    });
  };
}
