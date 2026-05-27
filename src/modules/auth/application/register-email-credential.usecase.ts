import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type CreateEmailCredentialError,
  createEmailCredential,
  type EmailCredential,
  emailCredentialRegisteredEvent,
  validatePlainPassword,
} from "../domain/index.js";
import type { AuthUnitOfWork, PasswordHasher } from "../ports/index.js";

export type RegisterEmailCredentialCommand = Readonly<{
  customerId: string;
  idempotencyKey: string;
  email: string;
  password: string;
}>;

export type RegisterEmailCredentialUseCaseError =
  | CreateEmailCredentialError
  | {
      type: "AuthCredentialIdempotencyConflict";
      idempotencyKey: string;
      message: string;
    }
  | {
      type: "AuthEmailAlreadyRegistered";
      email: string;
      message: string;
    };

export type RegisterEmailCredentialUseCaseResult = Readonly<{
  credential: EmailCredential;
  idempotent: boolean;
}>;

export type RegisterEmailCredentialUseCase = (
  command: RegisterEmailCredentialCommand,
) => Promise<Result<RegisterEmailCredentialUseCaseResult, RegisterEmailCredentialUseCaseError>>;

export function createRegisterEmailCredentialUseCase(deps: {
  uow: AuthUnitOfWork;
  passwordHasher: PasswordHasher;
  now: () => Date;
  generateId: () => string;
}): RegisterEmailCredentialUseCase {
  return async function registerEmailCredentialUseCase(command) {
    const passwordValidation = validatePlainPassword(command.password);
    if (passwordValidation !== null) {
      return err(passwordValidation);
    }

    const passwordHash = await deps.passwordHasher.hash(command.password);
    const candidate = createEmailCredential({
      id: deps.generateId(),
      customerId: command.customerId,
      idempotencyKey: command.idempotencyKey,
      email: command.email,
      passwordHash,
      now: deps.now(),
    });

    if (!candidate.ok) {
      return err(candidate.error);
    }

    return deps.uow.withTransaction<
      RegisterEmailCredentialUseCaseResult,
      RegisterEmailCredentialUseCaseError
    >(async ({ credentials, outbox }) => {
      const existingByKey = await credentials.findByIdempotencyKey(candidate.value.idempotencyKey);
      if (existingByKey !== null) {
        if (
          existingByKey.customerId !== candidate.value.customerId ||
          existingByKey.email !== candidate.value.email
        ) {
          return err({
            type: "AuthCredentialIdempotencyConflict",
            idempotencyKey: candidate.value.idempotencyKey,
            message: "Auth credential idempotency key belongs to another command",
          });
        }

        return ok({ credential: existingByKey, idempotent: true });
      }

      const existingByEmail = await credentials.findByEmail(candidate.value.email);
      if (existingByEmail !== null) {
        return err({
          type: "AuthEmailAlreadyRegistered",
          email: candidate.value.email,
          message: "Auth email is already registered",
        });
      }

      const events = [emailCredentialRegisteredEvent(candidate.value)];
      await credentials.create(candidate.value, events);
      await outbox.saveAll(events);

      return ok({ credential: candidate.value, idempotent: false });
    });
  };
}
