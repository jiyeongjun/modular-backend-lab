import type { Logger } from "pino";
import type { SyncPendingSettlementsUseCase } from "../../modules/settlement/application/index.js";
import {
  processSettlementSync,
  type SettlementSyncerOptions,
  type SettlementSyncerResult,
} from "./settlement-syncer.processor.js";

export async function runSettlementSyncerJob(deps: {
  syncPendingSettlementsUseCase: SyncPendingSettlementsUseCase;
  logger: Logger;
  options?: Partial<SettlementSyncerOptions>;
}): Promise<SettlementSyncerResult> {
  const options: SettlementSyncerOptions = {
    batchSize: deps.options?.batchSize ?? 100,
  };

  deps.logger.info({ job: "settlement-syncer", options }, "job started");
  const result = await processSettlementSync({
    syncPendingSettlementsUseCase: deps.syncPendingSettlementsUseCase,
    options,
  });
  deps.logger.info({ job: "settlement-syncer", result }, "job finished");

  return result;
}
