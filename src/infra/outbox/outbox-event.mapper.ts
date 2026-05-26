import { randomUUID } from "node:crypto";
import type { OutboxEventInsert } from "../db/database.js";

export type PersistableOutboxEvent = Readonly<{
  type: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: Date;
  payload: unknown;
}>;

export function toOutboxEventInsert(event: PersistableOutboxEvent): OutboxEventInsert {
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
