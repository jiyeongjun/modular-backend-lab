import type { SyncPendingSettlementsUseCase } from "../../modules/settlement/application/index.js";

export type SettlementSyncerOptions = Readonly<{
  batchSize: number;
}>;

export type SettlementSyncerResult = Readonly<{
  scanned: number;
  synced: number;
  failed: number;
}>;

export async function processSettlementSync(deps: {
  syncPendingSettlementsUseCase: SyncPendingSettlementsUseCase;
  options: SettlementSyncerOptions;
}): Promise<SettlementSyncerResult> {
  const result = await deps.syncPendingSettlementsUseCase({ batchSize: deps.options.batchSize });
  if (!result.ok) {
    throw new Error("Sync pending settlements usecase returned an unexpected error");
  }

  return result.value;
}
