import { ok, type Result } from "../../../shared/result/index.js";
import type { SettlementSourceReader } from "../ports/index.js";
import type { SyncSettlementUseCase } from "./sync-settlement.usecase.js";

export type SyncPendingSettlementsCommand = Readonly<{
  batchSize: number;
}>;

export type SyncPendingSettlementsResult = Readonly<{
  scanned: number;
  synced: number;
  failed: number;
}>;

export type SyncPendingSettlementsUseCase = (
  command: SyncPendingSettlementsCommand,
) => Promise<Result<SyncPendingSettlementsResult, never>>;

export function createSyncPendingSettlementsUseCase(deps: {
  sourceReader: SettlementSourceReader;
  syncOne: SyncSettlementUseCase;
}): SyncPendingSettlementsUseCase {
  return async function syncPendingSettlementsUseCase(command) {
    let scanned = 0;
    let synced = 0;
    let failed = 0;

    for await (const orderId of deps.sourceReader.iterateCandidateOrderIds({
      batchSize: command.batchSize,
    })) {
      scanned += 1;
      const result = await deps.syncOne({ orderId });
      if (!result.ok) {
        failed += 1;
      } else if (result.value.updated) {
        synced += 1;
      }
    }

    return ok({ scanned, synced, failed });
  };
}
