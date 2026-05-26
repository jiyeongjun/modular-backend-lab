import { serve } from "@hono/node-server";
import { createApp } from "./http/app.js";
import { loadConfig } from "./infra/config/env.js";
import { createDatabase } from "./infra/db/db.js";
import { createLogger } from "./infra/logger/logger.js";
import { createMetricsRegistry } from "./infra/telemetry/metrics.js";
import { initializeTelemetry } from "./infra/telemetry/telemetry.js";
import {
  createCommitReservationUseCase,
  createReleaseReservationUseCase,
  createReserveInventoryUseCase,
} from "./modules/inventory/application/index.js";
import { createKyselyInventoryUnitOfWork } from "./modules/inventory/infra/index.js";
import { createPayOrderUseCase } from "./modules/order/application/index.js";
import { createKyselyOrderUnitOfWork } from "./modules/order/infra/index.js";
import {
  createCancelPaymentUseCase,
  createConfirmPaymentUseCase,
} from "./modules/payment/application/index.js";
import {
  createKyselyPaymentUnitOfWork,
  createTossPaymentsGateway,
  createUnavailablePaymentGateway,
} from "./modules/payment/infra/index.js";
import { uuidGenerator } from "./shared/id/index.js";

const config = loadConfig();
const logger = createLogger(config);
const telemetry = initializeTelemetry(config, logger);
const db = createDatabase(config);
const payOrderUseCase = createPayOrderUseCase({
  uow: createKyselyOrderUnitOfWork(db),
  now: () => new Date(),
});
const inventoryUow = createKyselyInventoryUnitOfWork(db);
const reserveInventoryUseCase = createReserveInventoryUseCase({
  uow: inventoryUow,
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const releaseReservationUseCase = createReleaseReservationUseCase({
  uow: inventoryUow,
  now: () => new Date(),
});
const commitReservationUseCase = createCommitReservationUseCase({
  uow: inventoryUow,
  now: () => new Date(),
});
const paymentGateway =
  config.tossPayments.secretKey === null
    ? createUnavailablePaymentGateway("TOSS_PAYMENTS_SECRET_KEY is not configured")
    : createTossPaymentsGateway({
        secretKey: config.tossPayments.secretKey,
        baseUrl: config.tossPayments.baseUrl,
      });
const paymentUow = createKyselyPaymentUnitOfWork(db);
const confirmPaymentUseCase = createConfirmPaymentUseCase({
  uow: paymentUow,
  gateway: paymentGateway,
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const cancelPaymentUseCase = createCancelPaymentUseCase({
  uow: paymentUow,
  gateway: paymentGateway,
  now: () => new Date(),
});
const app = createApp({
  logger,
  metrics: createMetricsRegistry(),
  payOrderUseCase,
  reserveInventoryUseCase,
  releaseReservationUseCase,
  commitReservationUseCase,
  confirmPaymentUseCase,
  cancelPaymentUseCase,
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
