import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type CouponRedemption,
  type ReleaseCouponRedemptionError,
  releaseCouponRedemption,
} from "../domain/index.js";
import type { PromotionUnitOfWork } from "../ports/index.js";

export type ReleaseCouponRedemptionCommand = Readonly<{
  redemptionId: string;
  reason: string;
}>;

export type ReleaseCouponRedemptionUseCaseError =
  | ReleaseCouponRedemptionError
  | {
      type: "CouponRedemptionNotFound";
      redemptionId: string;
      message: string;
    }
  | {
      type: "CouponNotFound";
      couponId: string;
      message: string;
    };

export type ReleaseCouponRedemptionUseCaseResult = Readonly<{
  redemption: CouponRedemption;
  idempotent: boolean;
}>;

export type ReleaseCouponRedemptionUseCase = (
  command: ReleaseCouponRedemptionCommand,
) => Promise<Result<ReleaseCouponRedemptionUseCaseResult, ReleaseCouponRedemptionUseCaseError>>;

export function createReleaseCouponRedemptionUseCase(deps: {
  uow: PromotionUnitOfWork;
  now: () => Date;
}): ReleaseCouponRedemptionUseCase {
  return async function releaseCouponRedemptionUseCase(command) {
    return deps.uow.withTransaction(async ({ coupons, redemptions, outbox }) => {
      const redemption = await redemptions.findByIdForUpdate(command.redemptionId);
      if (redemption === null) {
        return err({
          type: "CouponRedemptionNotFound",
          redemptionId: command.redemptionId,
          message: "Coupon redemption was not found",
        });
      }

      if (redemption.status === "RELEASED") {
        return ok({ redemption, idempotent: true });
      }

      const coupon = await coupons.findByIdForUpdate(redemption.couponId);
      if (coupon === null) {
        return err({
          type: "CouponNotFound",
          couponId: redemption.couponId,
          message: "Coupon was not found",
        });
      }

      const released = releaseCouponRedemption(coupon, redemption, {
        reason: command.reason,
        now: deps.now(),
      });
      if (!released.ok) {
        return err(released.error);
      }

      if (released.value.events.length > 0) {
        await coupons.save(released.value.coupon, released.value.events);
        await redemptions.save(released.value.redemption);
        await outbox.saveAll(released.value.events);
      }

      return ok({ redemption: released.value.redemption, idempotent: false });
    });
  };
}
