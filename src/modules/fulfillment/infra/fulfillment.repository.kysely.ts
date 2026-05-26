import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { appendDomainEvents } from "../../../infra/db/domain-event-store.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { Fulfillment, FulfillmentEvent, ReadyFulfillment } from "../domain/index.js";
import type { FulfillmentReader, FulfillmentRepository } from "../ports/index.js";
import { toFulfillment, toFulfillmentInsert, toFulfillmentUpdate } from "./fulfillment.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyFulfillmentRepository(db: DbExecutor): FulfillmentRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom("fulfillments")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toFulfillment(row) : null;
    },

    async findByIdForUpdate(id) {
      const row = await db
        .selectFrom("fulfillments")
        .selectAll()
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      return row ? toFulfillment(row) : null;
    },

    async findByOrderId(orderId) {
      const row = await db
        .selectFrom("fulfillments")
        .selectAll()
        .where("order_id", "=", orderId)
        .executeTakeFirst();
      return row ? toFulfillment(row) : null;
    },

    async findByIdempotencyKey(idempotencyKey) {
      const row = await db
        .selectFrom("fulfillments")
        .selectAll()
        .where("idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();
      return row ? toFulfillment(row) : null;
    },

    async findByLabelIdempotencyKey(idempotencyKey) {
      const row = await db
        .selectFrom("fulfillments")
        .selectAll()
        .where("label_idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();
      return row ? toFulfillment(row) : null;
    },

    async create(fulfillment: ReadyFulfillment, events: readonly FulfillmentEvent[]) {
      await appendDomainEvents(db, events, -1);
      await db.insertInto("fulfillments").values(toFulfillmentInsert(fulfillment)).execute();
    },

    async save(fulfillment: Fulfillment, events: readonly FulfillmentEvent[]) {
      const result = await db
        .updateTable("fulfillments")
        .set({
          ...toFulfillmentUpdate(fulfillment),
          version: fulfillment.version + events.length,
        })
        .where("id", "=", fulfillment.id)
        .where("version", "=", fulfillment.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(`Fulfillment ${fulfillment.id} has a stale version`);
      }

      await appendDomainEvents(db, events, fulfillment.version);
    },
  };
}

export function createKyselyFulfillmentReader(db: DbExecutor): FulfillmentReader {
  return {
    async *iterateTrackable(options) {
      if (options.batchSize < 1) {
        throw new Error("batchSize must be greater than zero");
      }

      const rows = await db
        .selectFrom("fulfillments")
        .selectAll()
        .where("status", "in", ["LABEL_PURCHASED", "SHIPPED"])
        .orderBy("updated_at", "asc")
        .orderBy("id", "asc")
        .limit(options.batchSize)
        .execute();

      for (const row of rows) {
        const fulfillment = toFulfillment(row);
        if (fulfillment.status === "LABEL_PURCHASED" || fulfillment.status === "SHIPPED") {
          yield fulfillment;
        }
      }
    },
  };
}
