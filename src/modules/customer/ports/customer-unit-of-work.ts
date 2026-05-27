import type { Result } from "../../../shared/result/index.js";
import type { CustomerRepository } from "./customer.repository.js";
import type { CustomerOutboxRepository } from "./customer-outbox.repository.js";

export type CustomerUnitOfWorkContext = Readonly<{
  customers: CustomerRepository;
  outbox: CustomerOutboxRepository;
}>;

export type CustomerUnitOfWork = {
  withTransaction<TValue, TError>(
    work: (context: CustomerUnitOfWorkContext) => Promise<Result<TValue, TError>>,
  ): Promise<Result<TValue, TError>>;
};
