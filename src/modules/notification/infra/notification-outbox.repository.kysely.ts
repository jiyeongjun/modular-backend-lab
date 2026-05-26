import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../infra/db/database.js";
import { toOutboxEventInsert } from "../../../infra/outbox/outbox-event.mapper.js";
import type { NotificationOutboxRepository } from "../ports/index.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export function createKyselyNotificationOutboxRepository(
  db: DbExecutor,
): NotificationOutboxRepository {
  return {
    async saveAll(events) {
      if (events.length === 0) {
        return;
      }

      await db.insertInto("outbox_events").values(events.map(toOutboxEventInsert)).execute();
    },
  };
}
