import { err, ok, type Result } from "../../../shared/result/index.js";
import { type Address, type DisableAddressError, disableAddress } from "../domain/index.js";
import type { AddressBookUnitOfWork } from "../ports/index.js";

export type DisableAddressCommand = Readonly<{
  addressId: string;
  reason: string;
}>;

export type DisableAddressUseCaseError =
  | DisableAddressError
  | {
      type: "AddressNotFound";
      addressId: string;
      message: string;
    };

export type DisableAddressUseCaseResult = Readonly<{
  address: Address;
  idempotent: boolean;
}>;

export type DisableAddressUseCase = (
  command: DisableAddressCommand,
) => Promise<Result<DisableAddressUseCaseResult, DisableAddressUseCaseError>>;

export function createDisableAddressUseCase(deps: {
  uow: AddressBookUnitOfWork;
  now: () => Date;
}): DisableAddressUseCase {
  return async function disableAddressUseCase(command) {
    return deps.uow.withTransaction<DisableAddressUseCaseResult, DisableAddressUseCaseError>(
      async ({ addresses, outbox }) => {
        const current = await addresses.findByIdForUpdate(command.addressId);
        if (current === null) {
          return err({
            type: "AddressNotFound",
            addressId: command.addressId,
            message: "Address was not found",
          });
        }

        const disabled = disableAddress(current, {
          reason: command.reason,
          now: deps.now(),
        });
        if (!disabled.ok) {
          return err(disabled.error);
        }

        await addresses.save(disabled.value.address, disabled.value.events);
        await outbox.saveAll(disabled.value.events);

        return ok({
          address: disabled.value.address,
          idempotent: disabled.value.events.length === 0,
        });
      },
    );
  };
}
