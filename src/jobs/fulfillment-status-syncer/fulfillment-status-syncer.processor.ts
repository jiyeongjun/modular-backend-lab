import type { SyncFulfillmentStatusesUseCase } from "../../modules/fulfillment/application/index.js";

export type FulfillmentStatusSyncerOptions = Readonly<{
  batchSize: number;
}>;

export type FulfillmentStatusSyncerResult = Readonly<{
  scanned: number;
  updated: number;
  failed: number;
}>;

export async function processFulfillmentStatusSync(deps: {
  syncFulfillmentStatusesUseCase: SyncFulfillmentStatusesUseCase;
  options: FulfillmentStatusSyncerOptions;
}): Promise<FulfillmentStatusSyncerResult> {
  const result = await deps.syncFulfillmentStatusesUseCase({ batchSize: deps.options.batchSize });
  if (!result.ok) {
    throw new Error("Sync fulfillment statuses usecase returned an unexpected error");
  }

  return result.value;
}
