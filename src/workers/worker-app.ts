import { loadConfig } from "../infra/config/env.js";
import { createDatabase } from "../infra/db/db.js";
import { createLogger } from "../infra/logger/logger.js";
import { createBullMqConnection } from "../infra/queue/bullmq/bullmq-connection.js";
import { createBullMqEventPublisher } from "../infra/queue/bullmq/bullmq-publisher.js";
import { runFulfillmentStatusSyncerJob } from "../jobs/fulfillment-status-syncer/fulfillment-status-syncer.job.js";
import { runInventoryReservationExpirerJob } from "../jobs/inventory-reservation-expirer/inventory-reservation-expirer.job.js";
import { runOutboxPublisherJob } from "../jobs/outbox-publisher/outbox-publisher.job.js";
import { runSettlementSyncerJob } from "../jobs/settlement-syncer/settlement-syncer.job.js";
import {
  createSyncFulfillmentCarrierStatusUseCase,
  createSyncFulfillmentStatusesUseCase,
} from "../modules/fulfillment/application/index.js";
import {
  createKyselyFulfillmentReader,
  createKyselyFulfillmentUnitOfWork,
  createLocalShippingCarrier,
} from "../modules/fulfillment/infra/index.js";
import { createExpireReservationsUseCase } from "../modules/inventory/application/index.js";
import {
  createKyselyInventoryReservationReader,
  createKyselyInventoryUnitOfWork,
} from "../modules/inventory/infra/index.js";
import { createKyselyOutboxRepository } from "../modules/order/infra/index.js";
import {
  createSyncPendingSettlementsUseCase,
  createSyncSettlementUseCase,
} from "../modules/settlement/application/index.js";
import {
  createKyselySettlementSourceReader,
  createKyselySettlementUnitOfWork,
} from "../modules/settlement/infra/index.js";

async function main(): Promise<void> {
  const jobName = process.argv[2];
  const config = loadConfig();
  const logger = createLogger(config);
  const db = createDatabase(config);

  try {
    if (jobName === "inventory-reservation-expirer") {
      await runInventoryReservationExpirerJob({
        expireReservationsUseCase: createExpireReservationsUseCase({
          reader: createKyselyInventoryReservationReader(db),
          uow: createKyselyInventoryUnitOfWork(db),
          now: () => new Date(),
        }),
        logger,
      });
      return;
    }

    if (jobName === "fulfillment-status-syncer") {
      const carrier = createLocalShippingCarrier({ now: () => new Date() });
      const syncOne = createSyncFulfillmentCarrierStatusUseCase({
        uow: createKyselyFulfillmentUnitOfWork(db),
        carrier,
        now: () => new Date(),
      });
      await runFulfillmentStatusSyncerJob({
        syncFulfillmentStatusesUseCase: createSyncFulfillmentStatusesUseCase({
          reader: createKyselyFulfillmentReader(db),
          syncOne,
        }),
        logger,
      });
      return;
    }

    if (jobName === "settlement-syncer") {
      const sourceReader = createKyselySettlementSourceReader(db);
      const syncOne = createSyncSettlementUseCase({
        sourceReader,
        uow: createKyselySettlementUnitOfWork(db),
        now: () => new Date(),
      });
      await runSettlementSyncerJob({
        syncPendingSettlementsUseCase: createSyncPendingSettlementsUseCase({
          sourceReader,
          syncOne,
        }),
        logger,
      });
      return;
    }

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
