import { err, ok, type Result } from "../../../shared/result/index.js";
import { type AuthorizeReturnError, authorizeReturn, type ReturnRequest } from "../domain/index.js";
import type { ReturnsUnitOfWork } from "../ports/index.js";

export type AuthorizeReturnCommand = Readonly<{
  returnId: string;
}>;

export type AuthorizeReturnUseCaseError =
  | AuthorizeReturnError
  | {
      type: "ReturnRequestNotFound";
      returnId: string;
      message: string;
    };

export type AuthorizeReturnUseCaseResult = Readonly<{
  returnRequest: ReturnRequest;
  idempotent: boolean;
}>;

export type AuthorizeReturnUseCase = (
  command: AuthorizeReturnCommand,
) => Promise<Result<AuthorizeReturnUseCaseResult, AuthorizeReturnUseCaseError>>;

export function createAuthorizeReturnUseCase(deps: {
  uow: ReturnsUnitOfWork;
  now: () => Date;
  generateRmaNumber: () => string;
}): AuthorizeReturnUseCase {
  return async function authorizeReturnUseCase(command) {
    return deps.uow.withTransaction<AuthorizeReturnUseCaseResult, AuthorizeReturnUseCaseError>(
      async ({ returns, outbox }) => {
        const returnRequest = await returns.findByIdForUpdate(command.returnId);
        if (returnRequest === null) {
          return err({
            type: "ReturnRequestNotFound",
            returnId: command.returnId,
            message: "Return request was not found",
          });
        }

        if (returnRequest.rmaNumber !== null) {
          return ok({ returnRequest, idempotent: true });
        }

        const authorized = authorizeReturn(returnRequest, {
          rmaNumber: deps.generateRmaNumber(),
          now: deps.now(),
        });
        if (!authorized.ok) {
          return err(authorized.error);
        }

        await returns.save(authorized.value.returnRequest, authorized.value.events);
        await outbox.saveAll(authorized.value.events);

        return ok({ returnRequest: authorized.value.returnRequest, idempotent: false });
      },
    );
  };
}
