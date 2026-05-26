import { randomUUID } from "node:crypto";
import type { Kysely, Transaction } from "kysely";
import type { Database, OutboxEventInsert } from "../../../infra/db/database.js";
import type { RefundEvent } from "../domain/index.js";
import type { RefundOutboxRepository } from "../ports/index.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

function toOutboxInsert(event: RefundEvent): OutboxEventInsert {
  return {
    id: randomUUID(),
    event_type: event.type,
    aggregate_type: event.aggregateType,
    aggregate_id: event.aggregateId,
    payload: event.payload,
    occurred_at: event.occurredAt,
    processed_at: null,
    created_at: new Date(),
  };
}

export function createKyselyRefundOutboxRepository(db: DbExecutor): RefundOutboxRepository {
  return {
    async saveAll(events) {
      if (events.length === 0) {
        return;
      }

      await db.insertInto("outbox_events").values(events.map(toOutboxInsert)).execute();
    },
  };
}
