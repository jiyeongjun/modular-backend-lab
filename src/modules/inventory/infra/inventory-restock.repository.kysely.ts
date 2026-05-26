import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import type { InventoryRestockRepository } from "../ports/index.js";
import { toInventoryRestock, toInventoryRestockInsert } from "./inventory.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyInventoryRestockRepository(db: DbExecutor): InventoryRestockRepository {
  return {
    async findByIdempotencyKey(idempotencyKey) {
      const row = await db
        .selectFrom("inventory_restocks")
        .selectAll()
        .where("idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();

      return row ? toInventoryRestock(row) : null;
    },

    async create(restock) {
      await db.insertInto("inventory_restocks").values(toInventoryRestockInsert(restock)).execute();
    },
  };
}
