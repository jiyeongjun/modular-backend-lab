import { err, ok, type Result } from "../../../shared/result/index.js";
import { type ReceiveReturnError, type ReturnRequest, receiveReturn } from "../domain/index.js";
import type { ReturnsUnitOfWork } from "../ports/index.js";

export type ReceiveReturnCommand = Readonly<{
  returnId: string;
}>;

export type ReceiveReturnUseCaseError =
  | ReceiveReturnError
  | {
      type: "ReturnRequestNotFound";
      returnId: string;
      message: string;
    };

export type ReceiveReturnUseCaseResult = Readonly<{
  returnRequest: ReturnRequest;
  idempotent: boolean;
}>;

export type ReceiveReturnUseCase = (
  command: ReceiveReturnCommand,
) => Promise<Result<ReceiveReturnUseCaseResult, ReceiveReturnUseCaseError>>;

export function createReceiveReturnUseCase(deps: {
  uow: ReturnsUnitOfWork;
  now: () => Date;
}): ReceiveReturnUseCase {
  return async function receiveReturnUseCase(command) {
    return deps.uow.withTransaction<ReceiveReturnUseCaseResult, ReceiveReturnUseCaseError>(
      async ({ returns, outbox }) => {
        const returnRequest = await returns.findByIdForUpdate(command.returnId);
        if (returnRequest === null) {
          return err({
            type: "ReturnRequestNotFound",
            returnId: command.returnId,
            message: "Return request was not found",
          });
        }

        if (returnRequest.receivedAt !== null) {
          return ok({ returnRequest, idempotent: true });
        }

        const received = receiveReturn(returnRequest, deps.now());
        if (!received.ok) {
          return err(received.error);
        }

        await returns.save(received.value.returnRequest, received.value.events);
        await outbox.saveAll(received.value.events);

        return ok({ returnRequest: received.value.returnRequest, idempotent: false });
      },
    );
  };
}
