import type { Db } from "../../../infra/db/db.js";
import type { PromotionUnitOfWork } from "../ports/index.js";
import { createKyselyCouponRepository } from "./coupon.repository.kysely.js";
import { createKyselyCouponOutboxRepository } from "./coupon-outbox.repository.kysely.js";
import { createKyselyCouponRedemptionRepository } from "./coupon-redemption.repository.kysely.js";

export function createKyselyPromotionUnitOfWork(db: Db): PromotionUnitOfWork {
  return {
    withTransaction(work) {
      return db.transaction().execute((trx) =>
        work({
          coupons: createKyselyCouponRepository(trx),
          redemptions: createKyselyCouponRedemptionRepository(trx),
          outbox: createKyselyCouponOutboxRepository(trx),
        }),
      );
    },
  };
}
