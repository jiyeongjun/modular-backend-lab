import { ok, type Result } from "../../../shared/result/index.js";
import { type AuthSession, expireAuthSession, isSessionCurrentlyActive } from "../domain/index.js";
import type { AuthTokenService, AuthUnitOfWork } from "../ports/index.js";

export type VerifyAuthSessionCommand = Readonly<{
  token: string;
}>;

export type VerifyAuthSessionUseCaseResult = Readonly<{
  active: boolean;
  session: AuthSession | null;
}>;

export type VerifyAuthSessionUseCase = (
  command: VerifyAuthSessionCommand,
) => Promise<Result<VerifyAuthSessionUseCaseResult, never>>;

export function createVerifyAuthSessionUseCase(deps: {
  uow: AuthUnitOfWork;
  tokenService: AuthTokenService;
  now: () => Date;
}): VerifyAuthSessionUseCase {
  return async function verifyAuthSessionUseCase(command) {
    const tokenHash = await deps.tokenService.hash(command.token);

    return deps.uow.withTransaction<VerifyAuthSessionUseCaseResult, never>(
      async ({ sessions, outbox }) => {
        const session = await sessions.findByTokenHashForUpdate(tokenHash);
        if (session === null) {
          return ok({ active: false, session: null });
        }

        const now = deps.now();
        if (isSessionCurrentlyActive(session, now)) {
          return ok({ active: true, session });
        }

        if (session.status === "ACTIVE") {
          const expired = expireAuthSession(session, now);
          if (expired.ok) {
            await sessions.save(expired.value.session, expired.value.events);
            await outbox.saveAll(expired.value.events);
            return ok({ active: false, session: expired.value.session });
          }
        }

        return ok({ active: false, session });
      },
    );
  };
}
