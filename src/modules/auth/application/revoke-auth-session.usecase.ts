import { err, ok, type Result } from "../../../shared/result/index.js";
import { type AuthSession, type AuthSessionNotUsable, revokeAuthSession } from "../domain/index.js";
import type { AuthTokenService, AuthUnitOfWork } from "../ports/index.js";

export type RevokeAuthSessionCommand = Readonly<{
  token: string;
}>;

export type RevokeAuthSessionUseCaseError =
  | AuthSessionNotUsable
  | {
      type: "AuthSessionNotFound";
      message: string;
    };

export type RevokeAuthSessionUseCaseResult = Readonly<{
  session: AuthSession;
  idempotent: boolean;
}>;

export type RevokeAuthSessionUseCase = (
  command: RevokeAuthSessionCommand,
) => Promise<Result<RevokeAuthSessionUseCaseResult, RevokeAuthSessionUseCaseError>>;

export function createRevokeAuthSessionUseCase(deps: {
  uow: AuthUnitOfWork;
  tokenService: AuthTokenService;
  now: () => Date;
}): RevokeAuthSessionUseCase {
  return async function revokeAuthSessionUseCase(command) {
    const tokenHash = await deps.tokenService.hash(command.token);

    return deps.uow.withTransaction<RevokeAuthSessionUseCaseResult, RevokeAuthSessionUseCaseError>(
      async ({ sessions, outbox }) => {
        const current = await sessions.findByTokenHashForUpdate(tokenHash);
        if (current === null) {
          return err({
            type: "AuthSessionNotFound",
            message: "Auth session was not found",
          });
        }

        const revoked = revokeAuthSession(current, deps.now());
        if (!revoked.ok) {
          return err(revoked.error);
        }

        await sessions.save(revoked.value.session, revoked.value.events);
        await outbox.saveAll(revoked.value.events);

        return ok({
          session: revoked.value.session,
          idempotent: revoked.value.events.length === 0,
        });
      },
    );
  };
}
