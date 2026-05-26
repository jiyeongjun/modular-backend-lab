import type { Logger } from "pino";
import type { SyncFulfillmentStatusesUseCase } from "../../modules/fulfillment/application/index.js";
import {
  type FulfillmentStatusSyncerOptions,
  type FulfillmentStatusSyncerResult,
  processFulfillmentStatusSync,
} from "./fulfillment-status-syncer.processor.js";

export async function runFulfillmentStatusSyncerJob(deps: {
  syncFulfillmentStatusesUseCase: SyncFulfillmentStatusesUseCase;
  logger: Logger;
  options?: Partial<FulfillmentStatusSyncerOptions>;
}): Promise<FulfillmentStatusSyncerResult> {
  const options: FulfillmentStatusSyncerOptions = {
    batchSize: deps.options?.batchSize ?? 100,
  };

  deps.logger.info({ job: "fulfillment-status-syncer", options }, "job started");
  const result = await processFulfillmentStatusSync({
    syncFulfillmentStatusesUseCase: deps.syncFulfillmentStatusesUseCase,
    options,
  });
  deps.logger.info({ job: "fulfillment-status-syncer", result }, "job finished");

  return result;
}
