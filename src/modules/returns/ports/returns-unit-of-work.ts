import type { Result } from "../../../shared/result/index.js";
import type { ReturnRequestRepository } from "./return-request.repository.js";
import type { ReturnsOutboxRepository } from "./returns-outbox.repository.js";

export type ReturnsUnitOfWorkContext = Readonly<{
  returns: ReturnRequestRepository;
  outbox: ReturnsOutboxRepository;
}>;

export type ReturnsUnitOfWork = {
  withTransaction<TValue, TError>(
    work: (context: ReturnsUnitOfWorkContext) => Promise<Result<TValue, TError>>,
  ): Promise<Result<TValue, TError>>;
};
