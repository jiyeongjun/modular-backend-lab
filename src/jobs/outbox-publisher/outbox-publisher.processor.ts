import type {
  EventPublisher,
  OutboxEvent,
  OutboxRepository,
} from "../../modules/order/ports/index.js";
import { parallelMapAsync } from "../../shared/iterable/index.js";

export type OutboxPublisherOptions = Readonly<{
  batchSize: number;
  concurrency: number;
}>;

export type OutboxPublisherResult = Readonly<{
  published: number;
}>;

export async function processOutboxEvents(deps: {
  outbox: OutboxRepository;
  publisher: EventPublisher;
  now: () => Date;
  options: OutboxPublisherOptions;
}): Promise<OutboxPublisherResult> {
  let published = 0;
  const events = deps.outbox.iterateUnprocessed({ batchSize: deps.options.batchSize });

  async function publishOne(event: OutboxEvent): Promise<void> {
    await deps.publisher.publish(event);
    await deps.outbox.markProcessed(event.id, deps.now());
  }

  for await (const _ of parallelMapAsync(events, publishOne, {
    concurrency: deps.options.concurrency,
  })) {
    published += 1;
  }

  return { published };
}
