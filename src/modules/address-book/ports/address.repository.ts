import type { Address, AddressEvent, AddressPurpose } from "../domain/index.js";

export type AddressRepository = {
  findById(id: string): Promise<Address | null>;
  findByIdForUpdate(id: string): Promise<Address | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<Address | null>;
  findDefault(customerId: string, purpose: AddressPurpose): Promise<Address | null>;
  clearDefaultForCustomerPurpose(
    customerId: string,
    purpose: AddressPurpose,
    exceptAddressId: string,
    now: Date,
  ): Promise<void>;
  create(address: Address, events: readonly AddressEvent[]): Promise<void>;
  save(address: Address, events: readonly AddressEvent[]): Promise<void>;
};
