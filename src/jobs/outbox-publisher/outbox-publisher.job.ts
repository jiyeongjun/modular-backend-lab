import type { Logger } from "pino";
import type { EventPublisher, OutboxRepository } from "../../modules/order/ports/index.js";
import { type OutboxPublisherOptions, processOutboxEvents } from "./outbox-publisher.processor.js";

export async function runOutboxPublisherJob(deps: {
  outbox: OutboxRepository;
  publisher: EventPublisher;
  logger: Logger;
  now: () => Date;
  options?: Partial<OutboxPublisherOptions>;
}): Promise<{ published: number }> {
  const options: OutboxPublisherOptions = {
    batchSize: deps.options?.batchSize ?? 100,
    concurrency: deps.options?.concurrency ?? 1,
  };

  deps.logger.info({ job: "outbox-publisher", options }, "job started");
  const result = await processOutboxEvents({
    outbox: deps.outbox,
    publisher: deps.publisher,
    now: deps.now,
    options,
  });
  deps.logger.info({ job: "outbox-publisher", result }, "job finished");

  return result;
}
