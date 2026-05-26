import type { Kysely, Transaction } from "kysely";
import type { Database, DomainEventInsert } from "./database.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

export type PersistableDomainEvent = Readonly<{
  type: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: Date;
  payload: unknown;
}>;

export async function appendDomainEvents(
  db: DbExecutor,
  events: readonly PersistableDomainEvent[],
  expectedVersion: number,
): Promise<void> {
  if (expectedVersion < -1) {
    throw new Error("expectedVersion must be -1 or greater");
  }

  const [first, ...rest] = events;
  if (first === undefined) {
    return;
  }

  for (const event of rest) {
    if (event.aggregateType !== first.aggregateType || event.aggregateId !== first.aggregateId) {
      throw new Error("domain event batch must belong to one aggregate stream");
    }
  }

  const rows: DomainEventInsert[] = events.map((event, index) => {
    const aggregateVersion = expectedVersion + index + 1;
    return {
      id: `${event.aggregateType}:${event.aggregateId}:${aggregateVersion}`,
      aggregate_type: event.aggregateType,
      aggregate_id: event.aggregateId,
      aggregate_version: aggregateVersion,
      event_type: event.type,
      event_schema_version: 1,
      payload: event.payload,
      occurred_at: event.occurredAt,
      created_at: new Date(),
    };
  });

  await db.insertInto("domain_events").values(rows).execute();
}
