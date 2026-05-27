import type { AddressStatus } from "./address.js";

export type InvalidAddressInput = Readonly<{
  type: "InvalidAddressInput";
  field:
    | "id"
    | "customerId"
    | "idempotencyKey"
    | "recipientName"
    | "phone"
    | "line1"
    | "city"
    | "postalCode"
    | "country"
    | "reason";
  message: string;
}>;

export type AddressNotUpdatable = Readonly<{
  type: "AddressNotUpdatable";
  status: AddressStatus;
  message: string;
}>;

export type AddressNotDefaultable = Readonly<{
  type: "AddressNotDefaultable";
  status: AddressStatus;
  message: string;
}>;

export type CreateAddressError = InvalidAddressInput;
export type UpdateAddressError = InvalidAddressInput | AddressNotUpdatable;
export type SetDefaultAddressError = AddressNotDefaultable;
export type DisableAddressError = InvalidAddressInput;
