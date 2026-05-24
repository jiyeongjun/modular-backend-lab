import type { OutboxEvent } from "./outbox.repository.js";

export type EventPublisher = {
  publish(event: OutboxEvent): Promise<void>;
};
