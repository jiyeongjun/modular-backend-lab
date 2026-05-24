import { loadConfig } from "../infra/config/env.js";
import { createDatabase } from "../infra/db/db.js";
import { createLogger } from "../infra/logger/logger.js";
import { createBullMqConnection } from "../infra/queue/bullmq/bullmq-connection.js";
import { createBullMqEventPublisher } from "../infra/queue/bullmq/bullmq-publisher.js";
import { runOutboxPublisherJob } from "../jobs/outbox-publisher/outbox-publisher.job.js";
import { createKyselyOutboxRepository } from "../modules/order/infra/index.js";

async function main(): Promise<void> {
  const jobName = process.argv[2];
  const config = loadConfig();
  const logger = createLogger(config);
  const db = createDatabase(config);

  try {
    if (jobName !== "outbox-publisher") {
      logger.error({ jobName }, "unknown worker job");
      process.exitCode = 1;
      return;
    }

    const connection = createBullMqConnection(config);
    const publisher = createBullMqEventPublisher({
      connection,
      queueName: "outbox-events",
      prefix: config.bullmqQueuePrefix,
    });

    await runOutboxPublisherJob({
      outbox: createKyselyOutboxRepository(db),
      publisher,
      logger,
      now: () => new Date(),
    });

    await connection.quit();
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
