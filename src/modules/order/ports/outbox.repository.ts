import type { OrderEvent } from "../domain/index.js";

export type OutboxEvent = Readonly<{
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  occurredAt: Date;
  processedAt: Date | null;
  createdAt: Date;
}>;

export type OutboxRepository = {
  saveAll(events: readonly OrderEvent[]): Promise<void>;
  iterateUnprocessed(options: { batchSize: number }): AsyncIterable<OutboxEvent>;
  markProcessed(eventId: string, processedAt: Date): Promise<void>;
};
