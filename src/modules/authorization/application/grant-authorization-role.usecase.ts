import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type AuthorizationRole,
  authorizationRoleGrantedEvent,
  type GrantAuthorizationRoleError,
  grantAuthorizationRole,
  type RoleGrant,
} from "../domain/index.js";
import type { AuthorizationUnitOfWork } from "../ports/index.js";

export type GrantAuthorizationRoleCommand = Readonly<{
  actorId: string;
  role: AuthorizationRole;
  idempotencyKey: string;
  grantedByActorId: string;
  grantReason: string | null;
}>;

export type GrantAuthorizationRoleUseCaseError =
  | GrantAuthorizationRoleError
  | {
      type: "AuthorizationRoleGrantIdempotencyConflict";
      idempotencyKey: string;
      message: string;
    }
  | {
      type: "AuthorizationRoleAlreadyGranted";
      actorId: string;
      role: AuthorizationRole;
      message: string;
    };

export type GrantAuthorizationRoleUseCaseResult = Readonly<{
  grant: RoleGrant;
  idempotent: boolean;
}>;

export type GrantAuthorizationRoleUseCase = (
  command: GrantAuthorizationRoleCommand,
) => Promise<Result<GrantAuthorizationRoleUseCaseResult, GrantAuthorizationRoleUseCaseError>>;

export function createGrantAuthorizationRoleUseCase(deps: {
  uow: AuthorizationUnitOfWork;
  now: () => Date;
  generateId: () => string;
}): GrantAuthorizationRoleUseCase {
  return async function grantAuthorizationRoleUseCase(command) {
    return deps.uow.withTransaction<
      GrantAuthorizationRoleUseCaseResult,
      GrantAuthorizationRoleUseCaseError
    >(async ({ grants, outbox }) => {
      const existing = await grants.findByIdempotencyKey(command.idempotencyKey);
      if (existing !== null) {
        if (!sameGrantCommand(existing, command)) {
          return err({
            type: "AuthorizationRoleGrantIdempotencyConflict",
            idempotencyKey: command.idempotencyKey,
            message: "Authorization role grant idempotency key belongs to another command",
          });
        }

        return ok({ grant: existing, idempotent: true });
      }

      const activeGrant = await grants.findActiveByActorAndRole(command.actorId, command.role);
      if (activeGrant !== null) {
        return err({
          type: "AuthorizationRoleAlreadyGranted",
          actorId: command.actorId,
          role: command.role,
          message: "Authorization role is already active for this actor",
        });
      }

      const created = grantAuthorizationRole({
        id: deps.generateId(),
        actorId: command.actorId,
        role: command.role,
        idempotencyKey: command.idempotencyKey,
        grantedByActorId: command.grantedByActorId,
        grantReason: command.grantReason,
        now: deps.now(),
      });
      if (!created.ok) {
        return err(created.error);
      }

      const events = [authorizationRoleGrantedEvent(created.value)];
      await grants.create(created.value, events);
      await outbox.saveAll(events);

      return ok({ grant: created.value, idempotent: false });
    });
  };
}

function sameGrantCommand(grant: RoleGrant, command: GrantAuthorizationRoleCommand): boolean {
  return (
    grant.actorId === command.actorId &&
    grant.role === command.role &&
    grant.grantedByActorId === command.grantedByActorId &&
    grant.grantReason === normalizeNullable(command.grantReason)
  );
}

function normalizeNullable(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}
