import { err, ok, type Result } from "../../../shared/result/index.js";
import { type Address, type SetDefaultAddressError, setDefaultAddress } from "../domain/index.js";
import type { AddressBookUnitOfWork } from "../ports/index.js";

export type SetDefaultAddressCommand = Readonly<{
  addressId: string;
}>;

export type SetDefaultAddressUseCaseError =
  | SetDefaultAddressError
  | {
      type: "AddressNotFound";
      addressId: string;
      message: string;
    };

export type SetDefaultAddressUseCaseResult = Readonly<{
  address: Address;
  idempotent: boolean;
}>;

export type SetDefaultAddressUseCase = (
  command: SetDefaultAddressCommand,
) => Promise<Result<SetDefaultAddressUseCaseResult, SetDefaultAddressUseCaseError>>;

export function createSetDefaultAddressUseCase(deps: {
  uow: AddressBookUnitOfWork;
  now: () => Date;
}): SetDefaultAddressUseCase {
  return async function setDefaultAddressUseCase(command) {
    return deps.uow.withTransaction<SetDefaultAddressUseCaseResult, SetDefaultAddressUseCaseError>(
      async ({ addresses, outbox }) => {
        const current = await addresses.findByIdForUpdate(command.addressId);
        if (current === null) {
          return err({
            type: "AddressNotFound",
            addressId: command.addressId,
            message: "Address was not found",
          });
        }

        const previousDefault = await addresses.findDefault(current.customerId, current.purpose);
        const now = deps.now();
        const defaulted = setDefaultAddress(current, {
          previousDefaultAddressId: previousDefault?.id ?? null,
          now,
        });
        if (!defaulted.ok) {
          return err(defaulted.error);
        }

        if (defaulted.value.events.length > 0) {
          await addresses.clearDefaultForCustomerPurpose(
            defaulted.value.address.customerId,
            defaulted.value.address.purpose,
            defaulted.value.address.id,
            now,
          );
        }
        await addresses.save(defaulted.value.address, defaulted.value.events);
        await outbox.saveAll(defaulted.value.events);

        return ok({
          address: defaulted.value.address,
          idempotent: defaulted.value.events.length === 0,
        });
      },
    );
  };
}
