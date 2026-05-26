import type { OutboxEventRow } from "../../../infra/db/database.js";
import type { OutboxEvent } from "../ports/index.js";

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
