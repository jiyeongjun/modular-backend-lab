import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type AuthCredentialNotUsable,
  type AuthSession,
  authSessionIssuedEvent,
  createAuthSession,
  type EmailCredential,
  type InvalidAuthInput,
  normalizeAuthEmail,
  recordLoginFailed,
  recordLoginSucceeded,
  validatePlainPassword,
} from "../domain/index.js";
import type { AuthTokenService, AuthUnitOfWork, PasswordHasher } from "../ports/index.js";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;

export type LoginWithEmailCommand = Readonly<{
  email: string;
  password: string;
}>;

export type InvalidAuthCredentials = Readonly<{
  type: "InvalidAuthCredentials";
  message: string;
}>;

export type LoginWithEmailUseCaseError =
  | InvalidAuthInput
  | InvalidAuthCredentials
  | AuthCredentialNotUsable;

export type LoginWithEmailUseCaseResult = Readonly<{
  credential: EmailCredential;
  session: AuthSession;
  token: string;
}>;

export type LoginWithEmailUseCase = (
  command: LoginWithEmailCommand,
) => Promise<Result<LoginWithEmailUseCaseResult, LoginWithEmailUseCaseError>>;

export function createLoginWithEmailUseCase(deps: {
  uow: AuthUnitOfWork;
  passwordHasher: PasswordHasher;
  tokenService: AuthTokenService;
  now: () => Date;
  generateSessionId: () => string;
  sessionTtlMs: number;
}): LoginWithEmailUseCase {
  return async function loginWithEmailUseCase(command) {
    const passwordValidation = validatePlainPassword(command.password);
    if (passwordValidation !== null) {
      return err(passwordValidation);
    }

    const email = normalizeAuthEmail(command.email);
    const credentialResult = await loadCredential(email);
    if (!credentialResult.ok) {
      return credentialResult;
    }

    const passwordMatches = await deps.passwordHasher.verify(
      command.password,
      credentialResult.value.passwordHash,
    );
    if (!passwordMatches) {
      return recordFailedLogin(email);
    }

    const issuedAt = deps.now();
    const expiresAt = new Date(issuedAt.getTime() + deps.sessionTtlMs);
    const sessionId = deps.generateSessionId();
    const issuedToken = await deps.tokenService.issue({
      sessionId,
      customerId: credentialResult.value.customerId,
      credentialId: credentialResult.value.id,
      issuedAt,
      expiresAt,
    });

    return deps.uow.withTransaction<LoginWithEmailUseCaseResult, LoginWithEmailUseCaseError>(
      async ({ credentials, sessions, outbox }) => {
        const current = await credentials.findByEmailForUpdate(email);
        if (current === null) {
          return err(invalidCredentials());
        }

        const login = recordLoginSucceeded(current, issuedAt);
        if (!login.ok) {
          return err(login.error);
        }

        const session = createAuthSession({
          id: sessionId,
          customerId: login.value.credential.customerId,
          credentialId: login.value.credential.id,
          tokenHash: issuedToken.tokenHash,
          issuedAt,
          expiresAt,
        });
        if (!session.ok) {
          return err(session.error);
        }

        const sessionEvents = [authSessionIssuedEvent(session.value)];
        await credentials.save(login.value.credential, login.value.events);
        await sessions.create(session.value, sessionEvents);
        await outbox.saveAll([...login.value.events, ...sessionEvents]);

        return ok({
          credential: login.value.credential,
          session: session.value,
          token: issuedToken.token,
        });
      },
    );

    async function loadCredential(
      emailAddress: string,
    ): Promise<Result<EmailCredential, LoginWithEmailUseCaseError>> {
      return deps.uow.withTransaction<EmailCredential, LoginWithEmailUseCaseError>(
        async ({ credentials }) => {
          const credential = await credentials.findByEmail(emailAddress);
          if (credential === null) {
            return err(invalidCredentials());
          }

          if (credential.status !== "ACTIVE") {
            return err({
              type: "AuthCredentialNotUsable",
              status: credential.status,
              message: "Auth credential cannot be used in its current status",
            });
          }

          return ok(credential);
        },
      );
    }

    async function recordFailedLogin(
      emailAddress: string,
    ): Promise<Result<LoginWithEmailUseCaseResult, LoginWithEmailUseCaseError>> {
      await deps.uow.withTransaction<undefined, never>(async ({ credentials, outbox }) => {
        const current = await credentials.findByEmailForUpdate(emailAddress);
        if (current === null || current.status !== "ACTIVE") {
          return ok(undefined);
        }

        const failed = recordLoginFailed(current, {
          maxFailedAttempts: MAX_FAILED_LOGIN_ATTEMPTS,
          now: deps.now(),
        });
        if (!failed.ok) {
          return ok(undefined);
        }

        await credentials.save(failed.value.credential, failed.value.events);
        await outbox.saveAll(failed.value.events);

        return ok(undefined);
      });

      return err(invalidCredentials());
    }
  };
}

function invalidCredentials(): InvalidAuthCredentials {
  return {
    type: "InvalidAuthCredentials",
    message: "Email or password is invalid",
  };
}
