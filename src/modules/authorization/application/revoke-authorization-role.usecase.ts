import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type RevokeAuthorizationRoleError,
  type RoleGrant,
  revokeAuthorizationRole,
} from "../domain/index.js";
import type { AuthorizationUnitOfWork } from "../ports/index.js";

export type RevokeAuthorizationRoleCommand = Readonly<{
  grantId: string;
  revokedByActorId: string;
  revokeReason: string;
}>;

export type RevokeAuthorizationRoleUseCaseError =
  | RevokeAuthorizationRoleError
  | {
      type: "AuthorizationRoleGrantNotFound";
      grantId: string;
      message: string;
    };

export type RevokeAuthorizationRoleUseCaseResult = Readonly<{
  grant: RoleGrant;
  idempotent: boolean;
}>;

export type RevokeAuthorizationRoleUseCase = (
  command: RevokeAuthorizationRoleCommand,
) => Promise<Result<RevokeAuthorizationRoleUseCaseResult, RevokeAuthorizationRoleUseCaseError>>;

export function createRevokeAuthorizationRoleUseCase(deps: {
  uow: AuthorizationUnitOfWork;
  now: () => Date;
}): RevokeAuthorizationRoleUseCase {
  return async function revokeAuthorizationRoleUseCase(command) {
    return deps.uow.withTransaction<
      RevokeAuthorizationRoleUseCaseResult,
      RevokeAuthorizationRoleUseCaseError
    >(async ({ grants, outbox }) => {
      const current = await grants.findByIdForUpdate(command.grantId);
      if (current === null) {
        return err({
          type: "AuthorizationRoleGrantNotFound",
          grantId: command.grantId,
          message: "Authorization role grant was not found",
        });
      }

      const revoked = revokeAuthorizationRole(current, {
        revokedByActorId: command.revokedByActorId,
        revokeReason: command.revokeReason,
        now: deps.now(),
      });
      if (!revoked.ok) {
        return err(revoked.error);
      }

      await grants.save(revoked.value.grant, revoked.value.events);
      await outbox.saveAll(revoked.value.events);

      return ok({
        grant: revoked.value.grant,
        idempotent: revoked.value.events.length === 0,
      });
    });
  };
}
