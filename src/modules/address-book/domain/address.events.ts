import type { AddressFields, AddressPurpose } from "./address.js";

export type AddressAdded = Readonly<{
  type: "AddressAdded";
  aggregateType: "Address";
  aggregateId: string;
  occurredAt: Date;
  payload: AddressFields & {
    addressId: string;
    customerId: string;
    idempotencyKey: string;
    purpose: AddressPurpose;
    addedAt: Date;
  };
}>;

export type AddressUpdated = Readonly<{
  type: "AddressUpdated";
  aggregateType: "Address";
  aggregateId: string;
  occurredAt: Date;
  payload: AddressFields & {
    addressId: string;
    customerId: string;
    purpose: AddressPurpose;
    updatedAt: Date;
  };
}>;

export type DefaultAddressChanged = Readonly<{
  type: "DefaultAddressChanged";
  aggregateType: "Address";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    addressId: string;
    customerId: string;
    purpose: AddressPurpose;
    previousDefaultAddressId: string | null;
    changedAt: Date;
  };
}>;

export type AddressDisabled = Readonly<{
  type: "AddressDisabled";
  aggregateType: "Address";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    addressId: string;
    customerId: string;
    purpose: AddressPurpose;
    wasDefault: boolean;
    reason: string;
    disabledAt: Date;
  };
}>;

export type AddressEvent = AddressAdded | AddressUpdated | DefaultAddressChanged | AddressDisabled;
