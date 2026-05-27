import { err, ok, type Result } from "../../../shared/result/index.js";
import { type Customer, type SuspendCustomerError, suspendCustomer } from "../domain/index.js";
import type { CustomerUnitOfWork } from "../ports/index.js";

export type SuspendCustomerCommand = Readonly<{
  customerId: string;
  reason: string;
}>;

export type SuspendCustomerUseCaseError =
  | SuspendCustomerError
  | {
      type: "CustomerNotFound";
      customerId: string;
      message: string;
    };

export type SuspendCustomerUseCaseResult = Readonly<{
  customer: Customer;
  idempotent: boolean;
}>;

export type SuspendCustomerUseCase = (
  command: SuspendCustomerCommand,
) => Promise<Result<SuspendCustomerUseCaseResult, SuspendCustomerUseCaseError>>;

export function createSuspendCustomerUseCase(deps: {
  uow: CustomerUnitOfWork;
  now: () => Date;
}): SuspendCustomerUseCase {
  return async function suspendCustomerUseCase(command) {
    return deps.uow.withTransaction<SuspendCustomerUseCaseResult, SuspendCustomerUseCaseError>(
      async ({ customers, outbox }) => {
        const current = await customers.findByIdForUpdate(command.customerId);
        if (current === null) {
          return err({
            type: "CustomerNotFound",
            customerId: command.customerId,
            message: "Customer was not found",
          });
        }

        const suspended = suspendCustomer(current, { reason: command.reason, now: deps.now() });
        if (!suspended.ok) {
          return err(suspended.error);
        }

        await customers.save(suspended.value.customer, suspended.value.events);
        await outbox.saveAll(suspended.value.events);

        return ok({
          customer: suspended.value.customer,
          idempotent: suspended.value.events.length === 0,
        });
      },
    );
  };
}
