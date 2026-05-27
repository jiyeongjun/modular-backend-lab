import { err, ok, type Result } from "../../../shared/result/index.js";
import type {
  CreateAddressError,
  DisableAddressError,
  InvalidAddressInput,
  SetDefaultAddressError,
  UpdateAddressError,
} from "./address.errors.js";
import type { AddressEvent } from "./address.events.js";
import type {
  ActiveAddress,
  Address,
  AddressFields,
  AddressPurpose,
  DisabledAddress,
} from "./address.js";

export type CreateAddressInput = AddressFields &
  Readonly<{
    id: string;
    customerId: string;
    idempotencyKey: string;
    purpose: AddressPurpose;
    now: Date;
  }>;

export type UpdateAddressInput = AddressFields & Readonly<{ now: Date }>;

export type AddressTransition<T extends Address> = Readonly<{
  address: T;
  events: readonly AddressEvent[];
}>;

export function createAddress(
  input: CreateAddressInput,
): Result<ActiveAddress, CreateAddressError> {
  const fields = normalizeAddressFields(input);
  const invalidInput = validateRequiredFields([
    ["id", input.id],
    ["customerId", input.customerId],
    ["idempotencyKey", input.idempotencyKey],
    ["recipientName", fields.recipientName],
    ["phone", fields.phone],
    ["line1", fields.line1],
    ["city", fields.city],
    ["postalCode", fields.postalCode],
    ["country", fields.country],
  ]);
  if (invalidInput !== null) {
    return err(invalidInput);
  }

  return ok({
    id: input.id.trim(),
    customerId: input.customerId.trim(),
    idempotencyKey: input.idempotencyKey.trim(),
    purpose: input.purpose,
    ...fields,
    status: "ACTIVE",
    isDefault: false,
    disabledAt: null,
    disableReason: null,
    addedAt: input.now,
    version: 0,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function addressAddedEvent(address: ActiveAddress): AddressEvent {
  return {
    type: "AddressAdded",
    aggregateType: "Address",
    aggregateId: address.id,
    occurredAt: address.addedAt,
    payload: {
      addressId: address.id,
      customerId: address.customerId,
      idempotencyKey: address.idempotencyKey,
      purpose: address.purpose,
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      region: address.region,
      postalCode: address.postalCode,
      country: address.country,
      addedAt: address.addedAt,
    },
  };
}

export function updateAddress(
  address: Address,
  input: UpdateAddressInput,
): Result<AddressTransition<ActiveAddress>, UpdateAddressError> {
  if (address.status !== "ACTIVE") {
    return err({
      type: "AddressNotUpdatable",
      status: address.status,
      message: "Address cannot be updated from its current status",
    });
  }

  const fields = normalizeAddressFields(input);
  const invalidInput = validateRequiredFields([
    ["recipientName", fields.recipientName],
    ["phone", fields.phone],
    ["line1", fields.line1],
    ["city", fields.city],
    ["postalCode", fields.postalCode],
    ["country", fields.country],
  ]);
  if (invalidInput !== null) {
    return err(invalidInput);
  }

  const updated: ActiveAddress = {
    ...address,
    ...fields,
    updatedAt: input.now,
  };

  if (sameAddressFields(address, fields)) {
    return ok({ address, events: [] });
  }

  return ok({
    address: updated,
    events: [
      {
        type: "AddressUpdated",
        aggregateType: "Address",
        aggregateId: updated.id,
        occurredAt: input.now,
        payload: {
          addressId: updated.id,
          customerId: updated.customerId,
          purpose: updated.purpose,
          label: updated.label,
          recipientName: updated.recipientName,
          phone: updated.phone,
          line1: updated.line1,
          line2: updated.line2,
          city: updated.city,
          region: updated.region,
          postalCode: updated.postalCode,
          country: updated.country,
          updatedAt: updated.updatedAt,
        },
      },
    ],
  });
}

export function setDefaultAddress(
  address: Address,
  input: Readonly<{ previousDefaultAddressId: string | null; now: Date }>,
): Result<AddressTransition<ActiveAddress>, SetDefaultAddressError> {
  if (address.status !== "ACTIVE") {
    return err({
      type: "AddressNotDefaultable",
      status: address.status,
      message: "Address cannot be made default from its current status",
    });
  }

  if (address.isDefault && input.previousDefaultAddressId === address.id) {
    return ok({ address, events: [] });
  }

  const defaultAddress: ActiveAddress = {
    ...address,
    isDefault: true,
    updatedAt: input.now,
  };

  return ok({
    address: defaultAddress,
    events: [
      {
        type: "DefaultAddressChanged",
        aggregateType: "Address",
        aggregateId: defaultAddress.id,
        occurredAt: input.now,
        payload: {
          addressId: defaultAddress.id,
          customerId: defaultAddress.customerId,
          purpose: defaultAddress.purpose,
          previousDefaultAddressId: input.previousDefaultAddressId,
          changedAt: input.now,
        },
      },
    ],
  });
}

export function disableAddress(
  address: Address,
  input: Readonly<{ reason: string; now: Date }>,
): Result<AddressTransition<DisabledAddress>, DisableAddressError> {
  const reason = input.reason.trim();
  const invalidInput = validateRequiredFields([["reason", reason]]);
  if (invalidInput !== null) {
    return err(invalidInput);
  }

  if (address.status === "DISABLED") {
    return ok({ address, events: [] });
  }

  const disabled: DisabledAddress = {
    ...address,
    status: "DISABLED",
    isDefault: false,
    disabledAt: input.now,
    disableReason: reason,
    updatedAt: input.now,
  };

  return ok({
    address: disabled,
    events: [
      {
        type: "AddressDisabled",
        aggregateType: "Address",
        aggregateId: disabled.id,
        occurredAt: input.now,
        payload: {
          addressId: disabled.id,
          customerId: disabled.customerId,
          purpose: disabled.purpose,
          wasDefault: address.isDefault,
          reason,
          disabledAt: disabled.disabledAt,
        },
      },
    ],
  });
}

function normalizeAddressFields(input: AddressFields): AddressFields {
  return {
    label: normalizeNullable(input.label),
    recipientName: input.recipientName.trim(),
    phone: input.phone.trim(),
    line1: input.line1.trim(),
    line2: normalizeNullable(input.line2),
    city: input.city.trim(),
    region: normalizeNullable(input.region),
    postalCode: input.postalCode.trim(),
    country: input.country.trim().toUpperCase(),
  };
}

function normalizeNullable(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function validateRequiredFields(
  entries: readonly (readonly [InvalidAddressInput["field"], string])[],
): InvalidAddressInput | null {
  for (const [field, value] of entries) {
    if (value.trim().length === 0) {
      return {
        type: "InvalidAddressInput",
        field,
        message: `Address ${field} is required`,
      };
    }
  }

  return null;
}

function sameAddressFields(address: AddressFields, fields: AddressFields): boolean {
  return (
    address.label === fields.label &&
    address.recipientName === fields.recipientName &&
    address.phone === fields.phone &&
    address.line1 === fields.line1 &&
    address.line2 === fields.line2 &&
    address.city === fields.city &&
    address.region === fields.region &&
    address.postalCode === fields.postalCode &&
    address.country === fields.country
  );
}
