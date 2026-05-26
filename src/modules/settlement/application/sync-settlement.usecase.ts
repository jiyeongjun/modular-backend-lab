import { err, ok, type Result } from "../../../shared/result/index.js";
import { type Settlement, type SyncSettlementError, syncSettlement } from "../domain/index.js";
import type { SettlementSourceReader, SettlementUnitOfWork } from "../ports/index.js";

export type SyncSettlementCommand = Readonly<{
  orderId: string;
}>;

export type SyncSettlementUseCaseError = SyncSettlementError;

export type SyncSettlementUseCaseResult = Readonly<{
  settlement: Settlement;
  updated: boolean;
}>;

export type SyncSettlementUseCase = (
  command: SyncSettlementCommand,
) => Promise<Result<SyncSettlementUseCaseResult, SyncSettlementUseCaseError>>;

export function createSyncSettlementUseCase(deps: {
  sourceReader: SettlementSourceReader;
  uow: SettlementUnitOfWork;
  now: () => Date;
}): SyncSettlementUseCase {
  return async function syncSettlementUseCase(command) {
    const facts = await deps.sourceReader.findFactsByOrderId(command.orderId);

    return deps.uow.withTransaction(async ({ settlements, outbox }) => {
      const existing = await settlements.findByOrderIdForUpdate(command.orderId);
      const synced = syncSettlement({
        id: settlementIdForOrder(command.orderId),
        existing,
        facts,
        now: deps.now(),
      });

      if (!synced.ok) {
        return err(synced.error);
      }

      if (synced.value.events.length === 0) {
        return ok({ settlement: synced.value.settlement, updated: false });
      }

      if (existing === null) {
        await settlements.create(synced.value.settlement, synced.value.events);
      } else {
        await settlements.save(synced.value.settlement, synced.value.events);
      }
      await outbox.saveAll(synced.value.events);

      return ok({ settlement: synced.value.settlement, updated: true });
    });
  };
}

function settlementIdForOrder(orderId: string): string {
  return `settlement:${orderId}`;
}
