import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import type { OutboxEvent } from "../../../modules/order/ports/index.js";

export function createBullMqWorker(options: {
  connection: Redis;
  queueName: string;
  prefix: string;
  handle: (event: OutboxEvent) => Promise<void>;
}): Worker<OutboxEvent> {
  return new Worker<OutboxEvent>(
    options.queueName,
    async (job) => {
      await options.handle(job.data);
    },
    {
      connection: options.connection,
      prefix: options.prefix,
    },
  );
}
