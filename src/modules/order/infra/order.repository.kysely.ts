import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { appendDomainEvents } from "../../../infra/db/domain-event-store.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { Order, OrderEvent, PendingOrder } from "../domain/index.js";
import type { OrderRepository } from "../ports/index.js";
import { toOrder, toOrderInsert, toOrderUpdate } from "./order.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyOrderRepository(db: DbExecutor): OrderRepository {
  return {
    async findById(id) {
      const row = await db.selectFrom("orders").selectAll().where("id", "=", id).executeTakeFirst();
      return row ? toOrder(row) : null;
    },

    async findByIdForUpdate(id) {
      const row = await db
        .selectFrom("orders")
        .selectAll()
        .where("id", "=", id)
        .forUpdate()
        .executeTakeFirst();
      return row ? toOrder(row) : null;
    },

    async create(order: PendingOrder, events: readonly OrderEvent[]) {
      await appendDomainEvents(db, events, -1);
      await db.insertInto("orders").values(toOrderInsert(order)).execute();
    },

    async save(order: Order, events: readonly OrderEvent[]) {
      const result = await db
        .updateTable("orders")
        .set({
          ...toOrderUpdate(order),
          version: order.version + events.length,
        })
        .where("id", "=", order.id)
        .where("version", "=", order.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(`Order ${order.id} has a stale version`);
      }

      await appendDomainEvents(db, events, order.version);
    },
  };
}
