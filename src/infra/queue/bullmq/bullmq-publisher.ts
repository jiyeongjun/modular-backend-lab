import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { EventPublisher, OutboxEvent } from "../../../modules/order/ports/index.js";

export function createBullMqEventPublisher(options: {
  connection: Redis;
  queueName: string;
  prefix: string;
}): EventPublisher {
  const queue = new Queue<OutboxEvent>(options.queueName, {
    connection: options.connection,
    prefix: options.prefix,
  });

  return {
    async publish(event) {
      await queue.add(event.eventType, event, {
        jobId: event.id,
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      });
    },
  };
}
