import { describe, expect, it } from "vitest";
import type {
  EventPublisher,
  OutboxEvent,
  OutboxRepository,
} from "../../modules/order/ports/index.js";
import { processOutboxEvents } from "./outbox-publisher.processor.js";

const now = new Date("2026-01-01T00:00:00.000Z");

function createOutboxEvent(id: string): OutboxEvent {
  return {
    id,
    eventType: "OrderPaid",
    aggregateType: "Order",
    aggregateId: "order-1",
    payload: { orderId: "order-1" },
    occurredAt: now,
    processedAt: null,
    createdAt: now,
  };
}

function createFakeOutbox(events: readonly OutboxEvent[]): {
  outbox: OutboxRepository;
  processed: string[];
} {
  const processed: string[] = [];

  return {
    processed,
    outbox: {
      saveAll: async () => undefined,
      iterateUnprocessed: async function* () {
        for (const event of events) {
          yield event;
        }
      },
      markProcessed: async (eventId) => {
        processed.push(eventId);
      },
    },
  };
}

describe("processOutboxEvents", () => {
  it("publishes events from an AsyncIterable and marks them processed", async () => {
    const events = [createOutboxEvent("event-1"), createOutboxEvent("event-2")];
    const fake = createFakeOutbox(events);
    const published: string[] = [];
    const publisher: EventPublisher = {
      publish: async (event) => {
        published.push(event.id);
      },
    };

    const result = await processOutboxEvents({
      outbox: fake.outbox,
      publisher,
      now: () => now,
      options: { batchSize: 100, concurrency: 1 },
    });

    expect(result).toEqual({ published: 2 });
    expect(published).toEqual(["event-1", "event-2"]);
    expect(fake.processed).toEqual(["event-1", "event-2"]);
  });

  it("does not mark an event processed when publish fails", async () => {
    const fake = createFakeOutbox([createOutboxEvent("event-1")]);
    const publisher: EventPublisher = {
      publish: async () => {
        throw new Error("queue unavailable");
      },
    };

    await expect(
      processOutboxEvents({
        outbox: fake.outbox,
        publisher,
        now: () => now,
        options: { batchSize: 100, concurrency: 1 },
      }),
    ).rejects.toThrow("queue unavailable");
    expect(fake.processed).toEqual([]);
  });

  it("uses an explicit bounded concurrency limit", async () => {
    const events = Array.from({ length: 5 }, (_, index) => createOutboxEvent(`event-${index}`));
    const fake = createFakeOutbox(events);
    let active = 0;
    let maxActive = 0;
    const publisher: EventPublisher = {
      publish: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
      },
    };

    await processOutboxEvents({
      outbox: fake.outbox,
      publisher,
      now: () => now,
      options: { batchSize: 100, concurrency: 2 },
    });

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(fake.processed).toHaveLength(5);
  });
});
