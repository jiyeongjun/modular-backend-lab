import { ok, type Result } from "../../../shared/result/index.js";
import {
  type AuthorizationDecision,
  type AuthorizationPermission,
  type AuthorizationResource,
  evaluateAuthorization,
} from "../domain/index.js";
import type { AuthorizationUnitOfWork } from "../ports/index.js";

export type CheckAuthorizationCommand = Readonly<{
  actorId: string;
  permission: AuthorizationPermission;
  resource: AuthorizationResource;
}>;

export type CheckAuthorizationUseCaseResult = Readonly<{
  decision: AuthorizationDecision;
}>;

export type CheckAuthorizationUseCase = (
  command: CheckAuthorizationCommand,
) => Promise<Result<CheckAuthorizationUseCaseResult, never>>;

export function createCheckAuthorizationUseCase(deps: {
  uow: AuthorizationUnitOfWork;
}): CheckAuthorizationUseCase {
  return async function checkAuthorizationUseCase(command) {
    return deps.uow.withTransaction<CheckAuthorizationUseCaseResult, never>(async ({ grants }) => {
      const activeGrants = await grants.findActiveByActorId(command.actorId);
      return ok({
        decision: evaluateAuthorization(activeGrants, command),
      });
    });
  };
}
