import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { CouponRedemption } from "../domain/index.js";
import type { CouponRedemptionRepository } from "../ports/index.js";
import {
  toCouponRedemption,
  toCouponRedemptionInsert,
  toCouponRedemptionUpdate,
} from "./coupon.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyCouponRedemptionRepository(db: DbExecutor): CouponRedemptionRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom("coupon_redemptions")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toCouponRedemption(row) : null;
    },

    async findByIdForUpdate(id) {
      const row = await db
        .selectFrom("coupon_redemptions")
        .selectAll()
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      return row ? toCouponRedemption(row) : null;
    },

    async findByIdempotencyKey(idempotencyKey) {
      const row = await db
        .selectFrom("coupon_redemptions")
        .selectAll()
        .where("idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();
      return row ? toCouponRedemption(row) : null;
    },

    async findActiveByOrderIdAndCouponCode(orderId, couponCode) {
      const row = await db
        .selectFrom("coupon_redemptions")
        .selectAll()
        .where("order_id", "=", orderId)
        .where("coupon_code", "=", couponCode)
        .where("status", "in", ["RESERVED", "COMMITTED"])
        .executeTakeFirst();
      return row ? toCouponRedemption(row) : null;
    },

    async create(redemption) {
      await db
        .insertInto("coupon_redemptions")
        .values(toCouponRedemptionInsert(redemption))
        .execute();
    },

    async save(redemption: CouponRedemption) {
      const result = await db
        .updateTable("coupon_redemptions")
        .set({
          ...toCouponRedemptionUpdate(redemption),
          version: redemption.version + 1,
        })
        .where("id", "=", redemption.id)
        .where("version", "=", redemption.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(
          `Coupon redemption ${redemption.id} has a stale version`,
        );
      }
    },
  };
}
