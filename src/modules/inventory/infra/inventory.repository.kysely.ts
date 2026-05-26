import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { appendDomainEvents } from "../../../infra/db/domain-event-store.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { InventoryEvent, InventoryItem } from "../domain/index.js";
import type { InventoryItemRepository } from "../ports/index.js";
import {
  toInventoryItem,
  toInventoryItemInsert,
  toInventoryItemUpdate,
} from "./inventory.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyInventoryItemRepository(db: DbExecutor): InventoryItemRepository {
  return {
    async findBySku(sku) {
      const row = await db
        .selectFrom("inventory_items")
        .selectAll()
        .where("sku", "=", sku)
        .executeTakeFirst();

      return row ? toInventoryItem(row) : null;
    },

    async findBySkuForUpdate(sku) {
      const row = await db
        .selectFrom("inventory_items")
        .selectAll()
        .where("sku", "=", sku)
        .forUpdate()
        .executeTakeFirst();

      return row ? toInventoryItem(row) : null;
    },

    async create(item: InventoryItem, events: readonly InventoryEvent[]) {
      await appendDomainEvents(db, events, -1);
      await db.insertInto("inventory_items").values(toInventoryItemInsert(item)).execute();
    },

    async save(item: InventoryItem, events: readonly InventoryEvent[]) {
      const result = await db
        .updateTable("inventory_items")
        .set({
          ...toInventoryItemUpdate(item),
          version: item.version + events.length,
        })
        .where("sku", "=", item.sku)
        .where("version", "=", item.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(`Inventory item ${item.sku} has a stale version`);
      }

      await appendDomainEvents(db, events, item.version);
    },
  };
}
