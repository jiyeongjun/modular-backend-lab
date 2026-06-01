import { loadConfig } from "../infra/config/env.js";
import { createDatabase } from "../infra/db/db.js";
import { createLogger } from "../infra/logger/logger.js";
import { createScheduledJobs } from "./job-factory.js";
import { startIntervalScheduler } from "./scheduler.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const db = createDatabase(config);
  const scheduler = startIntervalScheduler(
    createScheduledJobs({
      config,
      db,
      logger,
      now: () => new Date(),
    }),
    { runImmediately: true },
  );

  logger.info("scheduler started");

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    logger.info({ signal }, "scheduler shutdown requested");
    await scheduler.stop();
    await db.destroy();
    logger.info({ signal }, "scheduler shutdown complete");
  }

  await new Promise<void>((resolve) => {
    const stop = (signal: NodeJS.Signals): void => {
      void shutdown(signal)
        .catch((error) => {
          logger.error({ error, signal }, "scheduler shutdown failed");
          process.exitCode = 1;
        })
        .finally(resolve);
    };

    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
