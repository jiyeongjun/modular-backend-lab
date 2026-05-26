import { randomUUID } from "node:crypto";
import type { Kysely, Transaction } from "kysely";
import type { Database, OutboxEventInsert } from "../../../infra/db/database.js";
import type { FulfillmentEvent } from "../domain/index.js";
import type { FulfillmentOutboxRepository } from "../ports/index.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

function toOutboxInsert(event: FulfillmentEvent): OutboxEventInsert {
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

export function createKyselyFulfillmentOutboxRepository(
  db: DbExecutor,
): FulfillmentOutboxRepository {
  return {
    async saveAll(events) {
      if (events.length === 0) {
        return;
      }

      await db.insertInto("outbox_events").values(events.map(toOutboxInsert)).execute();
    },
  };
}
