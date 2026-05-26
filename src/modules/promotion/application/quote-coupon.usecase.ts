import type { Money } from "../../../shared/money/index.js";
import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type CouponQuote,
  normalizeCode,
  type QuoteCouponError,
  quoteCoupon,
} from "../domain/index.js";
import type { PromotionUnitOfWork } from "../ports/index.js";

export type QuoteCouponCommand = Readonly<{
  code: string;
  orderId: string;
  orderAmount: Money;
  skus: readonly string[];
}>;

export type QuoteCouponUseCaseError =
  | QuoteCouponError
  | {
      type: "CouponNotFound";
      code: string;
      message: string;
    };

export type QuoteCouponUseCase = (
  command: QuoteCouponCommand,
) => Promise<Result<CouponQuote, QuoteCouponUseCaseError>>;

export function createQuoteCouponUseCase(deps: {
  uow: PromotionUnitOfWork;
  now: () => Date;
}): QuoteCouponUseCase {
  return async function quoteCouponUseCase(command) {
    const coupon = await deps.uow.withTransaction(({ coupons }) =>
      coupons.findByCode(normalizeCode(command.code)),
    );

    if (coupon === null) {
      return err({
        type: "CouponNotFound",
        code: normalizeCode(command.code),
        message: "Coupon was not found",
      });
    }

    const quoted = quoteCoupon(coupon, {
      orderId: command.orderId,
      orderAmount: command.orderAmount,
      skus: command.skus,
      now: deps.now(),
    });

    if (!quoted.ok) {
      return err(quoted.error);
    }

    return ok(quoted.value);
  };
}
