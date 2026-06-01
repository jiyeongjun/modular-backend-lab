import { loadConfig } from "../infra/config/env.js";
import { createDatabase } from "../infra/db/db.js";
import { createLogger } from "../infra/logger/logger.js";
import { runWorkerJobOnce } from "./job-factory.js";

async function main(): Promise<void> {
  const jobName = process.argv[2];
  const config = loadConfig();
  const logger = createLogger(config);
  const db = createDatabase(config);

  try {
    const ran = await runWorkerJobOnce(jobName, {
      config,
      db,
      logger,
      now: () => new Date(),
    });

    if (!ran) {
      logger.error({ jobName }, "unknown worker job");
      process.exitCode = 1;
    }
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
