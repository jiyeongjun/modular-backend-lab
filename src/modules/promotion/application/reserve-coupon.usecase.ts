import type { Money } from "../../../shared/money/index.js";
import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type CouponRedemption,
  normalizeCode,
  type ReserveCouponError,
  reserveCoupon,
} from "../domain/index.js";
import type { PromotionUnitOfWork } from "../ports/index.js";

export type ReserveCouponCommand = Readonly<{
  code: string;
  orderId: string;
  orderAmount: Money;
  skus: readonly string[];
  idempotencyKey: string;
}>;

export type ReserveCouponUseCaseError =
  | ReserveCouponError
  | {
      type: "CouponNotFound";
      code: string;
      message: string;
    }
  | {
      type: "CouponRedemptionIdempotencyConflict";
      idempotencyKey: string;
      message: string;
    }
  | {
      type: "CouponAlreadyReservedForOrder";
      orderId: string;
      couponCode: string;
      message: string;
    };

export type ReserveCouponUseCaseResult = Readonly<{
  redemption: CouponRedemption;
  idempotent: boolean;
}>;

export type ReserveCouponUseCase = (
  command: ReserveCouponCommand,
) => Promise<Result<ReserveCouponUseCaseResult, ReserveCouponUseCaseError>>;

export function createReserveCouponUseCase(deps: {
  uow: PromotionUnitOfWork;
  now: () => Date;
  generateId: () => string;
}): ReserveCouponUseCase {
  return async function reserveCouponUseCase(command) {
    const code = normalizeCode(command.code);

    return deps.uow.withTransaction(async ({ coupons, redemptions, outbox }) => {
      const existingByKey = await redemptions.findByIdempotencyKey(command.idempotencyKey);
      if (existingByKey !== null) {
        if (existingByKey.orderId !== command.orderId || existingByKey.couponCode !== code) {
          return err({
            type: "CouponRedemptionIdempotencyConflict",
            idempotencyKey: command.idempotencyKey,
            message: "Coupon redemption idempotency key belongs to another command",
          });
        }

        return ok({ redemption: existingByKey, idempotent: true });
      }

      const coupon = await coupons.findByCodeForUpdate(code);
      if (coupon === null) {
        return err({
          type: "CouponNotFound",
          code,
          message: "Coupon was not found",
        });
      }

      const activeForOrder = await redemptions.findActiveByOrderIdAndCouponCode(
        command.orderId,
        code,
      );
      if (activeForOrder !== null) {
        return err({
          type: "CouponAlreadyReservedForOrder",
          orderId: command.orderId,
          couponCode: code,
          message: "An active coupon redemption already exists for this order",
        });
      }

      const reserved = reserveCoupon(coupon, {
        redemptionId: deps.generateId(),
        orderId: command.orderId,
        orderAmount: command.orderAmount,
        skus: command.skus,
        idempotencyKey: command.idempotencyKey,
        now: deps.now(),
      });

      if (!reserved.ok) {
        return err(reserved.error);
      }

      await coupons.save(reserved.value.coupon, reserved.value.events);
      await redemptions.create(reserved.value.redemption);
      await outbox.saveAll(reserved.value.events);

      return ok({ redemption: reserved.value.redemption, idempotent: false });
    });
  };
}
