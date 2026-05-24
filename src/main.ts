import { serve } from "@hono/node-server";
import { createApp } from "./http/app.js";
import { loadConfig } from "./infra/config/env.js";
import { createDatabase } from "./infra/db/db.js";
import { createLogger } from "./infra/logger/logger.js";
import { createMetricsRegistry } from "./infra/telemetry/metrics.js";
import { initializeTelemetry } from "./infra/telemetry/telemetry.js";
import { createPayOrderUseCase } from "./modules/order/application/index.js";
import { createKyselyOrderUnitOfWork } from "./modules/order/infra/index.js";

const config = loadConfig();
const logger = createLogger(config);
const telemetry = initializeTelemetry(config, logger);
const db = createDatabase(config);
const payOrderUseCase = createPayOrderUseCase({
  uow: createKyselyOrderUnitOfWork(db),
  now: () => new Date(),
});
const app = createApp({
  logger,
  metrics: createMetricsRegistry(),
  payOrderUseCase,
});

const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    logger.info({ port: info.port }, "http server listening");
  },
);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  server.close();
  await db.destroy();
  await telemetry.shutdown();
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
