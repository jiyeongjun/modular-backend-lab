import type { Result } from "../../../shared/result/index.js";
import type { AuthCredentialRepository } from "./auth-credential.repository.js";
import type { AuthOutboxRepository } from "./auth-outbox.repository.js";
import type { AuthSessionRepository } from "./auth-session.repository.js";

export type AuthUnitOfWorkContext = Readonly<{
  credentials: AuthCredentialRepository;
  sessions: AuthSessionRepository;
  outbox: AuthOutboxRepository;
}>;

export type AuthUnitOfWork = {
  withTransaction<TValue, TError>(
    work: (context: AuthUnitOfWorkContext) => Promise<Result<TValue, TError>>,
  ): Promise<Result<TValue, TError>>;
};
