import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { appendDomainEvents } from "../../../infra/db/domain-event-store.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { Refund, RefundEvent, RequestedRefund } from "../domain/index.js";
import type { RefundRepository } from "../ports/index.js";
import { toRefund, toRefundInsert, toRefundUpdate } from "./refund.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyRefundRepository(db: DbExecutor): RefundRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom("refunds")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toRefund(row) : null;
    },

    async findByIdForUpdate(id) {
      const row = await db
        .selectFrom("refunds")
        .selectAll()
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      return row ? toRefund(row) : null;
    },

    async findByOrderId(orderId) {
      const row = await db
        .selectFrom("refunds")
        .selectAll()
        .where("order_id", "=", orderId)
        .executeTakeFirst();
      return row ? toRefund(row) : null;
    },

    async findByIdempotencyKey(idempotencyKey) {
      const row = await db
        .selectFrom("refunds")
        .selectAll()
        .where("idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();
      return row ? toRefund(row) : null;
    },

    async create(refund: RequestedRefund, events: readonly RefundEvent[]) {
      await appendDomainEvents(db, events, -1);
      await db.insertInto("refunds").values(toRefundInsert(refund)).execute();
    },

    async save(refund: Refund, events: readonly RefundEvent[]) {
      const result = await db
        .updateTable("refunds")
        .set({
          ...toRefundUpdate(refund),
          version: refund.version + events.length,
        })
        .where("id", "=", refund.id)
        .where("version", "=", refund.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(`Refund ${refund.id} has a stale version`);
      }

      await appendDomainEvents(db, events, refund.version);
    },
  };
}
