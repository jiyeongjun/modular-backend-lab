import { err, ok, type Result } from "../../../shared/result/index.js";
import { type CloseCustomerError, type Customer, closeCustomer } from "../domain/index.js";
import type { CustomerUnitOfWork } from "../ports/index.js";

export type CloseCustomerCommand = Readonly<{
  customerId: string;
  reason: string;
}>;

export type CloseCustomerUseCaseError =
  | CloseCustomerError
  | {
      type: "CustomerNotFound";
      customerId: string;
      message: string;
    };

export type CloseCustomerUseCaseResult = Readonly<{
  customer: Customer;
  idempotent: boolean;
}>;

export type CloseCustomerUseCase = (
  command: CloseCustomerCommand,
) => Promise<Result<CloseCustomerUseCaseResult, CloseCustomerUseCaseError>>;

export function createCloseCustomerUseCase(deps: {
  uow: CustomerUnitOfWork;
  now: () => Date;
}): CloseCustomerUseCase {
  return async function closeCustomerUseCase(command) {
    return deps.uow.withTransaction<CloseCustomerUseCaseResult, CloseCustomerUseCaseError>(
      async ({ customers, outbox }) => {
        const current = await customers.findByIdForUpdate(command.customerId);
        if (current === null) {
          return err({
            type: "CustomerNotFound",
            customerId: command.customerId,
            message: "Customer was not found",
          });
        }

        const closed = closeCustomer(current, { reason: command.reason, now: deps.now() });
        if (!closed.ok) {
          return err(closed.error);
        }

        await customers.save(closed.value.customer, closed.value.events);
        await outbox.saveAll(closed.value.events);

        return ok({
          customer: closed.value.customer,
          idempotent: closed.value.events.length === 0,
        });
      },
    );
  };
}
