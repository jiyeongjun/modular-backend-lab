import type { Logger } from "pino";
import type { AppConfig } from "../infra/config/env.js";
import type { Db } from "../infra/db/db.js";
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
import type { ScheduledJob } from "./scheduler.js";

export type WorkerJobName =
  | "outbox-publisher"
  | "inventory-reservation-expirer"
  | "fulfillment-status-syncer"
  | "settlement-syncer";

type JobDeps = Readonly<{
  config: AppConfig;
  db: Db;
  logger: Logger;
  now: () => Date;
}>;

export async function runOutboxPublisherOnce(deps: JobDeps): Promise<void> {
  const connection = createBullMqConnection(deps.config);

  try {
    const publisher = createBullMqEventPublisher({
      connection,
      queueName: "outbox-events",
      prefix: deps.config.bullmqQueuePrefix,
    });

    await runOutboxPublisherJob({
      outbox: createKyselyOutboxRepository(deps.db),
      publisher,
      logger: deps.logger,
      now: deps.now,
    });
  } finally {
    await connection.quit();
  }
}

export async function runInventoryReservationExpirerOnce(deps: JobDeps): Promise<void> {
  await runInventoryReservationExpirerJob({
    expireReservationsUseCase: createExpireReservationsUseCase({
      reader: createKyselyInventoryReservationReader(deps.db),
      uow: createKyselyInventoryUnitOfWork(deps.db),
      now: deps.now,
    }),
    logger: deps.logger,
  });
}

export async function runFulfillmentStatusSyncerOnce(deps: JobDeps): Promise<void> {
  const carrier = createLocalShippingCarrier({ now: deps.now });
  const syncOne = createSyncFulfillmentCarrierStatusUseCase({
    uow: createKyselyFulfillmentUnitOfWork(deps.db),
    carrier,
    now: deps.now,
  });

  await runFulfillmentStatusSyncerJob({
    syncFulfillmentStatusesUseCase: createSyncFulfillmentStatusesUseCase({
      reader: createKyselyFulfillmentReader(deps.db),
      syncOne,
    }),
    logger: deps.logger,
  });
}

export async function runSettlementSyncerOnce(deps: JobDeps): Promise<void> {
  const sourceReader = createKyselySettlementSourceReader(deps.db);
  const syncOne = createSyncSettlementUseCase({
    sourceReader,
    uow: createKyselySettlementUnitOfWork(deps.db),
    now: deps.now,
  });

  await runSettlementSyncerJob({
    syncPendingSettlementsUseCase: createSyncPendingSettlementsUseCase({
      sourceReader,
      syncOne,
    }),
    logger: deps.logger,
  });
}

export async function runWorkerJobOnce(
  jobName: string | undefined,
  deps: JobDeps,
): Promise<boolean> {
  switch (jobName) {
    case "outbox-publisher":
      await runOutboxPublisherOnce(deps);
      return true;
    case "inventory-reservation-expirer":
      await runInventoryReservationExpirerOnce(deps);
      return true;
    case "fulfillment-status-syncer":
      await runFulfillmentStatusSyncerOnce(deps);
      return true;
    case "settlement-syncer":
      await runSettlementSyncerOnce(deps);
      return true;
    default:
      return false;
  }
}

export function createScheduledJobs(deps: JobDeps): readonly ScheduledJob[] {
  return [
    {
      name: "inventory-reservation-expirer",
      intervalMs: deps.config.scheduler.inventoryReservationExpirerIntervalMs,
      run: () =>
        runLoggedScheduledJob(deps, "inventory-reservation-expirer", () =>
          runInventoryReservationExpirerOnce(deps),
        ),
    },
    {
      name: "fulfillment-status-syncer",
      intervalMs: deps.config.scheduler.fulfillmentStatusSyncerIntervalMs,
      run: () =>
        runLoggedScheduledJob(deps, "fulfillment-status-syncer", () =>
          runFulfillmentStatusSyncerOnce(deps),
        ),
    },
    {
      name: "settlement-syncer",
      intervalMs: deps.config.scheduler.settlementSyncerIntervalMs,
      run: () =>
        runLoggedScheduledJob(deps, "settlement-syncer", () => runSettlementSyncerOnce(deps)),
    },
  ];
}

async function runLoggedScheduledJob(
  deps: JobDeps,
  jobName: WorkerJobName,
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    deps.logger.error({ error, job: jobName }, "scheduled job failed");
  }
}
