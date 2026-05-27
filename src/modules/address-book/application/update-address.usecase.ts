import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type Address,
  type AddressFields,
  type UpdateAddressError,
  updateAddress,
} from "../domain/index.js";
import type { AddressBookUnitOfWork } from "../ports/index.js";

export type UpdateAddressCommand = AddressFields &
  Readonly<{
    addressId: string;
  }>;

export type UpdateAddressUseCaseError =
  | UpdateAddressError
  | {
      type: "AddressNotFound";
      addressId: string;
      message: string;
    };

export type UpdateAddressUseCaseResult = Readonly<{
  address: Address;
  idempotent: boolean;
}>;

export type UpdateAddressUseCase = (
  command: UpdateAddressCommand,
) => Promise<Result<UpdateAddressUseCaseResult, UpdateAddressUseCaseError>>;

export function createUpdateAddressUseCase(deps: {
  uow: AddressBookUnitOfWork;
  now: () => Date;
}): UpdateAddressUseCase {
  return async function updateAddressUseCase(command) {
    return deps.uow.withTransaction<UpdateAddressUseCaseResult, UpdateAddressUseCaseError>(
      async ({ addresses, outbox }) => {
        const current = await addresses.findByIdForUpdate(command.addressId);
        if (current === null) {
          return err({
            type: "AddressNotFound",
            addressId: command.addressId,
            message: "Address was not found",
          });
        }

        const updated = updateAddress(current, {
          label: command.label,
          recipientName: command.recipientName,
          phone: command.phone,
          line1: command.line1,
          line2: command.line2,
          city: command.city,
          region: command.region,
          postalCode: command.postalCode,
          country: command.country,
          now: deps.now(),
        });
        if (!updated.ok) {
          return err(updated.error);
        }

        await addresses.save(updated.value.address, updated.value.events);
        await outbox.saveAll(updated.value.events);

        return ok({
          address: updated.value.address,
          idempotent: updated.value.events.length === 0,
        });
      },
    );
  };
}
