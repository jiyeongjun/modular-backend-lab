import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type Customer,
  type ReactivateCustomerError,
  reactivateCustomer,
} from "../domain/index.js";
import type { CustomerUnitOfWork } from "../ports/index.js";

export type ReactivateCustomerCommand = Readonly<{
  customerId: string;
}>;

export type ReactivateCustomerUseCaseError =
  | ReactivateCustomerError
  | {
      type: "CustomerNotFound";
      customerId: string;
      message: string;
    };

export type ReactivateCustomerUseCaseResult = Readonly<{
  customer: Customer;
  idempotent: boolean;
}>;

export type ReactivateCustomerUseCase = (
  command: ReactivateCustomerCommand,
) => Promise<Result<ReactivateCustomerUseCaseResult, ReactivateCustomerUseCaseError>>;

export function createReactivateCustomerUseCase(deps: {
  uow: CustomerUnitOfWork;
  now: () => Date;
}): ReactivateCustomerUseCase {
  return async function reactivateCustomerUseCase(command) {
    return deps.uow.withTransaction<
      ReactivateCustomerUseCaseResult,
      ReactivateCustomerUseCaseError
    >(async ({ customers, outbox }) => {
      const current = await customers.findByIdForUpdate(command.customerId);
      if (current === null) {
        return err({
          type: "CustomerNotFound",
          customerId: command.customerId,
          message: "Customer was not found",
        });
      }

      const active = reactivateCustomer(current, deps.now());
      if (!active.ok) {
        return err(active.error);
      }

      await customers.save(active.value.customer, active.value.events);
      await outbox.saveAll(active.value.events);

      return ok({
        customer: active.value.customer,
        idempotent: active.value.events.length === 0,
      });
    });
  };
}
