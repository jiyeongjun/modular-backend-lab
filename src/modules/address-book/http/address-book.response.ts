import type { Result } from "../../../shared/result/index.js";
import type {
  AddAddressUseCaseError,
  AddAddressUseCaseResult,
  DisableAddressUseCaseError,
  DisableAddressUseCaseResult,
  SetDefaultAddressUseCaseError,
  SetDefaultAddressUseCaseResult,
  UpdateAddressUseCaseError,
  UpdateAddressUseCaseResult,
} from "../application/index.js";
import type { Address } from "../domain/index.js";

export type AddressBookHttpResponseShape = Readonly<{
  status: 200 | 201 | 400 | 404 | 409;
  body: unknown;
}>;

export function serializeAddress(address: Address): Record<string, unknown> {
  return {
    id: address.id,
    customerId: address.customerId,
    idempotencyKey: address.idempotencyKey,
    purpose: address.purpose,
    status: address.status,
    label: address.label,
    recipientName: address.recipientName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    country: address.country,
    isDefault: address.isDefault,
    disabledAt: address.disabledAt?.toISOString() ?? null,
    disableReason: address.disableReason,
    addedAt: address.addedAt.toISOString(),
    version: address.version,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}

export function mapAddAddressResult(
  result: Result<AddAddressUseCaseResult, AddAddressUseCaseError>,
): AddressBookHttpResponseShape {
  if (result.ok) {
    return {
      status: result.value.idempotent ? 200 : 201,
      body: {
        data: serializeAddress(result.value.address),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapAddressBookError(result.error);
}

export function mapUpdateAddressResult(
  result: Result<UpdateAddressUseCaseResult, UpdateAddressUseCaseError>,
): AddressBookHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeAddress(result.value.address),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapAddressBookError(result.error);
}

export function mapSetDefaultAddressResult(
  result: Result<SetDefaultAddressUseCaseResult, SetDefaultAddressUseCaseError>,
): AddressBookHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeAddress(result.value.address),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapAddressBookError(result.error);
}

export function mapDisableAddressResult(
  result: Result<DisableAddressUseCaseResult, DisableAddressUseCaseError>,
): AddressBookHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeAddress(result.value.address),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapAddressBookError(result.error);
}

function mapAddressBookError(
  error:
    | AddAddressUseCaseError
    | UpdateAddressUseCaseError
    | SetDefaultAddressUseCaseError
    | DisableAddressUseCaseError,
): AddressBookHttpResponseShape {
  switch (error.type) {
    case "InvalidAddressInput":
      return { status: 400, body: { error } };

    case "AddressNotFound":
      return { status: 404, body: { error } };

    case "AddressIdempotencyConflict":
    case "AddressNotUpdatable":
    case "AddressNotDefaultable":
      return { status: 409, body: { error } };
  }
}
