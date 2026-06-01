import { loadConfig } from "../infra/config/env.js";
import { createDatabase } from "../infra/db/db.js";
import { createLogger } from "../infra/logger/logger.js";
import { runOutboxPublisherOnce } from "./job-factory.js";
import { startRuntimeLoop } from "./runtime-loop.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const db = createDatabase(config);

  const worker = startRuntimeLoop({
    name: "outbox-publisher-worker",
    intervalMs: config.worker.outboxPollIntervalMs,
    logger,
    run: () =>
      runOutboxPublisherOnce({
        config,
        db,
        logger,
        now: () => new Date(),
      }),
    shutdown: () => db.destroy(),
  });

  function stop(signal: NodeJS.Signals): void {
    logger.info({ signal }, "outbox worker shutdown requested");
    void worker.stop().catch((error) => {
      logger.error({ error, signal }, "outbox worker shutdown failed");
      process.exitCode = 1;
    });
  }

  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);

  await worker.done;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
