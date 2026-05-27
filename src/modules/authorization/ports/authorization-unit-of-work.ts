import type { Result } from "../../../shared/result/index.js";
import type { AuthorizationRepository } from "./authorization.repository.js";
import type { AuthorizationOutboxRepository } from "./authorization-outbox.repository.js";

export type AuthorizationUnitOfWorkContext = Readonly<{
  grants: AuthorizationRepository;
  outbox: AuthorizationOutboxRepository;
}>;

export type AuthorizationUnitOfWork = {
  withTransaction<TValue, TError>(
    work: (context: AuthorizationUnitOfWorkContext) => Promise<Result<TValue, TError>>,
  ): Promise<Result<TValue, TError>>;
};
