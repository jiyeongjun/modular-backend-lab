import { randomUUID } from "node:crypto";
import type { OutboxEventInsert, OutboxEventRow } from "../../../infra/db/database.js";
import type { OrderEvent } from "../domain/index.js";
import type { OutboxEvent } from "../ports/index.js";

export function toOutboxInsert(event: OrderEvent): OutboxEventInsert {
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

export function toOutboxEvent(row: OutboxEventRow): OutboxEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    payload: row.payload,
    occurredAt: row.occurred_at,
    processedAt: row.processed_at,
    createdAt: row.created_at,
  };
}
