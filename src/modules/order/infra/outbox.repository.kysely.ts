import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { toOutboxEventInsert } from "../../../infra/outbox/outbox-event.mapper.js";
import type { OutboxRepository } from "../ports/index.js";
import { toOutboxEvent } from "./outbox.mapper.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyOutboxRepository(db: DbExecutor): OutboxRepository {
  return {
    async saveAll(events) {
      if (events.length === 0) {
        return;
      }

      await db.insertInto("outbox_events").values(events.map(toOutboxEventInsert)).execute();
    },

    async *iterateUnprocessed(options) {
      if (options.batchSize < 1) {
        throw new Error("batchSize must be greater than zero");
      }

      while (true) {
        const rows = await db
          .selectFrom("outbox_events")
          .selectAll()
          .where("processed_at", "is", null)
          .orderBy("occurred_at", "asc")
          .orderBy("id", "asc")
          .limit(options.batchSize)
          .execute();

        if (rows.length === 0) {
          return;
        }

        for (const row of rows) {
          yield toOutboxEvent(row);
        }
      }
    },

    async markProcessed(eventId, processedAt) {
      await db
        .updateTable("outbox_events")
        .set({ processed_at: processedAt })
        .where("id", "=", eventId)
        .where("processed_at", "is", null)
        .execute();
    },
  };
}
