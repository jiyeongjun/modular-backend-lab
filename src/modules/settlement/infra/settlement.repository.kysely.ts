import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { appendDomainEvents } from "../../../infra/db/domain-event-store.js";
import { OptimisticConcurrencyError } from "../../../shared/errors/index.js";
import type { Settlement, SettlementEvent } from "../domain/index.js";
import type { SettlementRepository } from "../ports/index.js";
import { toSettlement, toSettlementInsert, toSettlementUpdate } from "./settlement.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselySettlementRepository(db: DbExecutor): SettlementRepository {
  return {
    async findById(id) {
      const row = await db
        .selectFrom("settlements")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ? toSettlement(row) : null;
    },

    async findByOrderId(orderId) {
      const row = await db
        .selectFrom("settlements")
        .selectAll()
        .where("order_id", "=", orderId)
        .executeTakeFirst();
      return row ? toSettlement(row) : null;
    },

    async findByOrderIdForUpdate(orderId) {
      const row = await db
        .selectFrom("settlements")
        .selectAll()
        .where("order_id", "=", orderId)
        .forUpdate()
        .executeTakeFirst();
      return row ? toSettlement(row) : null;
    },

    async create(settlement, events) {
      await appendDomainEvents(db, events, -1);
      await db
        .insertInto("settlements")
        .values(toSettlementInsert(settlement, events.length - 1))
        .execute();
    },

    async save(settlement: Settlement, events: readonly SettlementEvent[]) {
      if (events.length === 0) {
        return;
      }

      const result = await db
        .updateTable("settlements")
        .set({
          ...toSettlementUpdate(settlement),
          version: settlement.version + events.length,
        })
        .where("id", "=", settlement.id)
        .where("version", "=", settlement.version)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new OptimisticConcurrencyError(`Settlement ${settlement.id} has a stale version`);
      }

      await appendDomainEvents(db, events, settlement.version);
    },
  };
}
