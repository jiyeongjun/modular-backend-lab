import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { appendDomainEvents } from "../../../infra/db/domain-event-store.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { Coupon, CouponEvent } from "../domain/index.js";
import type { CouponRepository } from "../ports/index.js";
import { toCoupon, toCouponInsert, toCouponUpdate } from "./coupon.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyCouponRepository(db: DbExecutor): CouponRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom("coupons")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toCoupon(row) : null;
    },

    async findByIdForUpdate(id) {
      const row = await db
        .selectFrom("coupons")
        .selectAll()
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      return row ? toCoupon(row) : null;
    },

    async findByCode(code) {
      const row = await db
        .selectFrom("coupons")
        .selectAll()
        .where("code", "=", code)
        .executeTakeFirst();
      return row ? toCoupon(row) : null;
    },

    async findByCodeForUpdate(code) {
      const row = await db
        .selectFrom("coupons")
        .selectAll()
        .where("code", "=", code)
        .forUpdate()
        .executeTakeFirst();
      return row ? toCoupon(row) : null;
    },

    async create(coupon, events) {
      await appendDomainEvents(db, events, -1);
      await db.insertInto("coupons").values(toCouponInsert(coupon)).execute();
    },

    async save(coupon: Coupon, events: readonly CouponEvent[]) {
      if (events.length === 0) {
        return;
      }

      const result = await db
        .updateTable("coupons")
        .set({
          ...toCouponUpdate(coupon),
          version: coupon.version + events.length,
        })
        .where("id", "=", coupon.id)
        .where("version", "=", coupon.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(`Coupon ${coupon.id} has a stale version`);
      }

      await appendDomainEvents(db, events, coupon.version);
    },
  };
}
