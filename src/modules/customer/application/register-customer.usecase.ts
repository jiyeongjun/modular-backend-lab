import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type CreateCustomerError,
  type Customer,
  createCustomer,
  customerRegisteredEvent,
} from "../domain/index.js";
import type { CustomerUnitOfWork } from "../ports/index.js";

export type RegisterCustomerCommand = Readonly<{
  idempotencyKey: string;
  email: string;
  displayName: string;
}>;

export type RegisterCustomerUseCaseError =
  | CreateCustomerError
  | {
      type: "CustomerRegistrationIdempotencyConflict";
      idempotencyKey: string;
      message: string;
    }
  | {
      type: "CustomerEmailAlreadyRegistered";
      email: string;
      message: string;
    };

export type RegisterCustomerUseCaseResult = Readonly<{
  customer: Customer;
  idempotent: boolean;
}>;

export type RegisterCustomerUseCase = (
  command: RegisterCustomerCommand,
) => Promise<Result<RegisterCustomerUseCaseResult, RegisterCustomerUseCaseError>>;

export function createRegisterCustomerUseCase(deps: {
  uow: CustomerUnitOfWork;
  now: () => Date;
  generateId: () => string;
}): RegisterCustomerUseCase {
  return async function registerCustomerUseCase(command) {
    const candidate = createCustomer({
      id: deps.generateId(),
      idempotencyKey: command.idempotencyKey,
      email: command.email,
      displayName: command.displayName,
      now: deps.now(),
    });

    if (!candidate.ok) {
      return err(candidate.error);
    }

    return deps.uow.withTransaction<RegisterCustomerUseCaseResult, RegisterCustomerUseCaseError>(
      async ({ customers, outbox }) => {
        const existingByKey = await customers.findByIdempotencyKey(candidate.value.idempotencyKey);
        if (existingByKey !== null) {
          if (
            existingByKey.email !== candidate.value.email ||
            existingByKey.displayName !== candidate.value.displayName
          ) {
            return err({
              type: "CustomerRegistrationIdempotencyConflict",
              idempotencyKey: candidate.value.idempotencyKey,
              message: "Customer registration idempotency key belongs to another command",
            });
          }

          return ok({ customer: existingByKey, idempotent: true });
        }

        const existingByEmail = await customers.findByEmail(candidate.value.email);
        if (existingByEmail !== null) {
          return err({
            type: "CustomerEmailAlreadyRegistered",
            email: candidate.value.email,
            message: "Customer email is already registered",
          });
        }

        const events = [customerRegisteredEvent(candidate.value)];
        await customers.create(candidate.value, events);
        await outbox.saveAll(events);

        return ok({ customer: candidate.value, idempotent: false });
      },
    );
  };
}
