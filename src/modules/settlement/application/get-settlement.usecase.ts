import { err, ok, type Result } from "../../../shared/result/index.js";
import type { Settlement } from "../domain/index.js";
import type { SettlementUnitOfWork } from "../ports/index.js";

export type GetSettlementCommand = Readonly<{
  orderId: string;
}>;

export type GetSettlementUseCaseError = {
  type: "SettlementNotFound";
  orderId: string;
  message: string;
};

export type GetSettlementUseCase = (
  command: GetSettlementCommand,
) => Promise<Result<Settlement, GetSettlementUseCaseError>>;

export function createGetSettlementUseCase(deps: {
  uow: SettlementUnitOfWork;
}): GetSettlementUseCase {
  return async function getSettlementUseCase(command) {
    const settlement = await deps.uow.withTransaction(({ settlements }) =>
      settlements.findByOrderId(command.orderId),
    );

    if (settlement === null) {
      return err({
        type: "SettlementNotFound",
        orderId: command.orderId,
        message: "Settlement was not found",
      });
    }

    return ok(settlement);
  };
}
