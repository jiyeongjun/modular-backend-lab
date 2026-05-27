import { err, ok, type Result } from "../../../shared/result/index.js";
import { disableEmailCredential, type EmailCredential } from "../domain/index.js";
import type { AuthUnitOfWork } from "../ports/index.js";

export type DisableEmailCredentialCommand = Readonly<{
  credentialId: string;
}>;

export type DisableEmailCredentialUseCaseError = Readonly<{
  type: "AuthCredentialNotFound";
  credentialId: string;
  message: string;
}>;

export type DisableEmailCredentialUseCaseResult = Readonly<{
  credential: EmailCredential;
  idempotent: boolean;
}>;

export type DisableEmailCredentialUseCase = (
  command: DisableEmailCredentialCommand,
) => Promise<Result<DisableEmailCredentialUseCaseResult, DisableEmailCredentialUseCaseError>>;

export function createDisableEmailCredentialUseCase(deps: {
  uow: AuthUnitOfWork;
  now: () => Date;
}): DisableEmailCredentialUseCase {
  return async function disableEmailCredentialUseCase(command) {
    return deps.uow.withTransaction<
      DisableEmailCredentialUseCaseResult,
      DisableEmailCredentialUseCaseError
    >(async ({ credentials, outbox }) => {
      const current = await credentials.findByIdForUpdate(command.credentialId);
      if (current === null) {
        return err({
          type: "AuthCredentialNotFound",
          credentialId: command.credentialId,
          message: "Auth credential was not found",
        });
      }

      const disabled = disableEmailCredential(current, deps.now());
      await credentials.save(disabled.credential, disabled.events);
      await outbox.saveAll(disabled.events);

      return ok({
        credential: disabled.credential,
        idempotent: disabled.events.length === 0,
      });
    });
  };
}
