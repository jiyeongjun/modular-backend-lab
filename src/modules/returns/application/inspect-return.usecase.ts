import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type InspectReturnError,
  inspectReturn,
  type ReturnItem,
  type ReturnRequest,
} from "../domain/index.js";
import type { ReturnsUnitOfWork } from "../ports/index.js";

export type InspectReturnCommand = Readonly<{
  returnId: string;
  accepted: boolean;
  restockableItems: readonly ReturnItem[];
  note: string | null;
  rejectionReason: string | null;
}>;

export type InspectReturnUseCaseError =
  | InspectReturnError
  | {
      type: "ReturnRequestNotFound";
      returnId: string;
      message: string;
    };

export type InspectReturnUseCaseResult = Readonly<{
  returnRequest: ReturnRequest;
  idempotent: boolean;
}>;

export type InspectReturnUseCase = (
  command: InspectReturnCommand,
) => Promise<Result<InspectReturnUseCaseResult, InspectReturnUseCaseError>>;

export function createInspectReturnUseCase(deps: {
  uow: ReturnsUnitOfWork;
  now: () => Date;
}): InspectReturnUseCase {
  return async function inspectReturnUseCase(command) {
    return deps.uow.withTransaction<InspectReturnUseCaseResult, InspectReturnUseCaseError>(
      async ({ returns, outbox }) => {
        const returnRequest = await returns.findByIdForUpdate(command.returnId);
        if (returnRequest === null) {
          return err({
            type: "ReturnRequestNotFound",
            returnId: command.returnId,
            message: "Return request was not found",
          });
        }

        if (returnRequest.inspectedAt !== null) {
          return ok({ returnRequest, idempotent: true });
        }

        const inspected = inspectReturn(returnRequest, {
          accepted: command.accepted,
          restockableItems: command.restockableItems,
          note: command.note,
          rejectionReason: command.rejectionReason,
          now: deps.now(),
        });
        if (!inspected.ok) {
          return err(inspected.error);
        }

        await returns.save(inspected.value.returnRequest, inspected.value.events);
        await outbox.saveAll(inspected.value.events);

        return ok({ returnRequest: inspected.value.returnRequest, idempotent: false });
      },
    );
  };
}
