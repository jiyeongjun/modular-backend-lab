import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type CommitCouponRedemptionError,
  type CouponRedemption,
  commitCouponRedemption,
} from "../domain/index.js";
import type { PromotionUnitOfWork } from "../ports/index.js";

export type CommitCouponRedemptionCommand = Readonly<{
  redemptionId: string;
}>;

export type CommitCouponRedemptionUseCaseError =
  | CommitCouponRedemptionError
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

export type CommitCouponRedemptionUseCaseResult = Readonly<{
  redemption: CouponRedemption;
  idempotent: boolean;
}>;

export type CommitCouponRedemptionUseCase = (
  command: CommitCouponRedemptionCommand,
) => Promise<Result<CommitCouponRedemptionUseCaseResult, CommitCouponRedemptionUseCaseError>>;

export function createCommitCouponRedemptionUseCase(deps: {
  uow: PromotionUnitOfWork;
  now: () => Date;
}): CommitCouponRedemptionUseCase {
  return async function commitCouponRedemptionUseCase(command) {
    return deps.uow.withTransaction(async ({ coupons, redemptions, outbox }) => {
      const redemption = await redemptions.findByIdForUpdate(command.redemptionId);
      if (redemption === null) {
        return err({
          type: "CouponRedemptionNotFound",
          redemptionId: command.redemptionId,
          message: "Coupon redemption was not found",
        });
      }

      if (redemption.status === "COMMITTED") {
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

      const committed = commitCouponRedemption(coupon, redemption, deps.now());
      if (!committed.ok) {
        return err(committed.error);
      }

      if (committed.value.events.length > 0) {
        await coupons.save(committed.value.coupon, committed.value.events);
        await redemptions.save(committed.value.redemption);
        await outbox.saveAll(committed.value.events);
      }

      return ok({ redemption: committed.value.redemption, idempotent: false });
    });
  };
}
