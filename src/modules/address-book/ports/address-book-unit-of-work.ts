import type { Result } from "../../../shared/result/index.js";
import type { AddressRepository } from "./address.repository.js";
import type { AddressOutboxRepository } from "./address-outbox.repository.js";

export type AddressBookUnitOfWorkContext = Readonly<{
  addresses: AddressRepository;
  outbox: AddressOutboxRepository;
}>;

export type AddressBookUnitOfWork = {
  withTransaction<TValue, TError>(
    work: (context: AddressBookUnitOfWorkContext) => Promise<Result<TValue, TError>>,
  ): Promise<Result<TValue, TError>>;
};
