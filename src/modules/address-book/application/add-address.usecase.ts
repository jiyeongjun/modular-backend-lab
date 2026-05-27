import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type Address,
  type AddressFields,
  type AddressPurpose,
  addressAddedEvent,
  type CreateAddressError,
  createAddress,
  type SetDefaultAddressError,
  setDefaultAddress,
} from "../domain/index.js";
import type { AddressBookUnitOfWork } from "../ports/index.js";

export type AddAddressCommand = AddressFields &
  Readonly<{
    customerId: string;
    idempotencyKey: string;
    purpose: AddressPurpose;
    makeDefault: boolean;
  }>;

export type AddAddressUseCaseError =
  | CreateAddressError
  | SetDefaultAddressError
  | {
      type: "AddressIdempotencyConflict";
      idempotencyKey: string;
      message: string;
    };

export type AddAddressUseCaseResult = Readonly<{
  address: Address;
  idempotent: boolean;
}>;

export type AddAddressUseCase = (
  command: AddAddressCommand,
) => Promise<Result<AddAddressUseCaseResult, AddAddressUseCaseError>>;

export function createAddAddressUseCase(deps: {
  uow: AddressBookUnitOfWork;
  now: () => Date;
  generateId: () => string;
}): AddAddressUseCase {
  return async function addAddressUseCase(command) {
    return deps.uow.withTransaction<AddAddressUseCaseResult, AddAddressUseCaseError>(
      async ({ addresses, outbox }) => {
        const existing = await addresses.findByIdempotencyKey(command.idempotencyKey);
        if (existing !== null) {
          if (existing.customerId !== command.customerId || existing.purpose !== command.purpose) {
            return err({
              type: "AddressIdempotencyConflict",
              idempotencyKey: command.idempotencyKey,
              message: "Address idempotency key belongs to another command",
            });
          }

          return ok({ address: existing, idempotent: true });
        }

        const now = deps.now();
        const created = createAddress({
          id: deps.generateId(),
          customerId: command.customerId,
          idempotencyKey: command.idempotencyKey,
          purpose: command.purpose,
          label: command.label,
          recipientName: command.recipientName,
          phone: command.phone,
          line1: command.line1,
          line2: command.line2,
          city: command.city,
          region: command.region,
          postalCode: command.postalCode,
          country: command.country,
          now,
        });

        if (!created.ok) {
          return err(created.error);
        }

        const addedEvents = [addressAddedEvent(created.value)];
        await addresses.create(created.value, addedEvents);

        if (!command.makeDefault) {
          await outbox.saveAll(addedEvents);
          return ok({ address: created.value, idempotent: false });
        }

        const previousDefault = await addresses.findDefault(
          created.value.customerId,
          created.value.purpose,
        );
        const defaulted = setDefaultAddress(created.value, {
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
          await addresses.save(defaulted.value.address, defaulted.value.events);
        }

        const events = [...addedEvents, ...defaulted.value.events];
        await outbox.saveAll(events);

        return ok({ address: defaulted.value.address, idempotent: false });
      },
    );
  };
}
