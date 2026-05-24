import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { Order } from "../domain/index.js";
import type { OrderRepository } from "../ports/index.js";
import { toOrder, toOrderUpdate } from "./order.mapper.js";

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

    async save(order: Order) {
      const result = await db
        .updateTable("orders")
        .set({
          ...toOrderUpdate(order),
          version: order.version + 1,
        })
        .where("id", "=", order.id)
        .where("version", "=", order.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(`Order ${order.id} has a stale version`);
      }
    },
  };
}
