import type {
  AddressBookAddressInsert,
  AddressBookAddressRow,
  AddressBookAddressUpdate,
} from "../../../infra/db/database.js";
import type {
  ActiveAddress,
  Address,
  AddressPurpose,
  AddressStatus,
  DisabledAddress,
} from "../domain/index.js";

function toPurpose(value: string): AddressPurpose {
  if (value === "SHIPPING" || value === "BILLING") {
    return value;
  }
  throw new Error(`Unknown address purpose: ${value}`);
}

function toStatus(value: string): AddressStatus {
  if (value === "ACTIVE" || value === "DISABLED") {
    return value;
  }
  throw new Error(`Unknown address status: ${value}`);
}

function base(row: AddressBookAddressRow) {
  return {
    id: row.id,
    customerId: row.customer_id,
    idempotencyKey: row.idempotency_key,
    purpose: toPurpose(row.purpose),
    label: row.label,
    recipientName: row.recipient_name,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    region: row.region,
    postalCode: row.postal_code,
    country: row.country,
    isDefault: row.is_default,
    addedAt: row.added_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toAddress(row: AddressBookAddressRow): Address {
  switch (toStatus(row.status)) {
    case "ACTIVE": {
      if (row.disabled_at !== null || row.disable_reason !== null) {
        throw new Error(`Active address ${row.id} has non-active columns`);
      }
      const address: ActiveAddress = {
        ...base(row),
        status: "ACTIVE",
        disabledAt: null,
        disableReason: null,
      };
      return address;
    }

    case "DISABLED": {
      if (row.disabled_at === null || row.disable_reason === null || row.is_default) {
        throw new Error(`Disabled address ${row.id} has invalid columns`);
      }
      const address: DisabledAddress = {
        ...base(row),
        status: "DISABLED",
        isDefault: false,
        disabledAt: row.disabled_at,
        disableReason: row.disable_reason,
      };
      return address;
    }
  }
}

export function toAddressInsert(address: Address): AddressBookAddressInsert {
  return {
    id: address.id,
    customer_id: address.customerId,
    idempotency_key: address.idempotencyKey,
    purpose: address.purpose,
    status: address.status,
    label: address.label,
    recipient_name: address.recipientName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    region: address.region,
    postal_code: address.postalCode,
    country: address.country,
    is_default: address.isDefault,
    disabled_at: address.disabledAt,
    disable_reason: address.disableReason,
    added_at: address.addedAt,
    version: address.version,
    created_at: address.createdAt,
    updated_at: address.updatedAt,
  };
}

export function toAddressUpdate(address: Address): AddressBookAddressUpdate {
  return {
    purpose: address.purpose,
    status: address.status,
    label: address.label,
    recipient_name: address.recipientName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    region: address.region,
    postal_code: address.postalCode,
    country: address.country,
    is_default: address.isDefault,
    disabled_at: address.disabledAt,
    disable_reason: address.disableReason,
    updated_at: address.updatedAt,
  };
}
