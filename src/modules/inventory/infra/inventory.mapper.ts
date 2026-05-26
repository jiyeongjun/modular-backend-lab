import type {
  InventoryItemInsert,
  InventoryItemRow,
  InventoryItemUpdate,
  InventoryReservationInsert,
  InventoryReservationRow,
  InventoryReservationUpdate,
} from "../../../infra/db/database.js";
import type {
  ActiveInventoryReservation,
  InventoryItem,
  InventoryReservation,
  InventoryReservationStatus,
} from "../domain/index.js";

function toReservationStatus(value: string): InventoryReservationStatus {
  if (value === "ACTIVE" || value === "RELEASED" || value === "COMMITTED" || value === "EXPIRED") {
    return value;
  }
  throw new Error(`Unknown inventory reservation status: ${value}`);
}

export function toInventoryItem(row: InventoryItemRow): InventoryItem {
  if (row.on_hand < 0 || row.reserved < 0 || row.reserved > row.on_hand) {
    throw new Error(`Inventory item ${row.sku} has invalid counters`);
  }

  return {
    sku: row.sku,
    onHand: row.on_hand,
    reserved: row.reserved,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toInventoryItemInsert(item: InventoryItem): InventoryItemInsert {
  return {
    sku: item.sku,
    on_hand: item.onHand,
    reserved: item.reserved,
    version: item.version,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export function toInventoryItemUpdate(item: InventoryItem): InventoryItemUpdate {
  return {
    on_hand: item.onHand,
    reserved: item.reserved,
    updated_at: item.updatedAt,
  };
}

export function toInventoryReservation(row: InventoryReservationRow): InventoryReservation {
  const base = {
    id: row.id,
    sku: row.sku,
    idempotencyKey: row.idempotency_key,
    quantity: row.quantity,
    expiresAt: row.expires_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.quantity <= 0) {
    throw new Error(`Inventory reservation ${row.id} has invalid quantity`);
  }

  switch (toReservationStatus(row.status)) {
    case "ACTIVE":
      if (row.released_at !== null || row.committed_at !== null || row.expired_at !== null) {
        throw new Error(`Active reservation ${row.id} must not have terminal timestamps`);
      }
      return {
        ...base,
        status: "ACTIVE",
        releasedAt: null,
        committedAt: null,
        expiredAt: null,
      };

    case "RELEASED":
      if (row.released_at === null || row.committed_at !== null || row.expired_at !== null) {
        throw new Error(`Released reservation ${row.id} must have only released_at`);
      }
      return {
        ...base,
        status: "RELEASED",
        releasedAt: row.released_at,
        committedAt: null,
        expiredAt: null,
      };

    case "COMMITTED":
      if (row.committed_at === null || row.released_at !== null || row.expired_at !== null) {
        throw new Error(`Committed reservation ${row.id} must have only committed_at`);
      }
      return {
        ...base,
        status: "COMMITTED",
        releasedAt: null,
        committedAt: row.committed_at,
        expiredAt: null,
      };

    case "EXPIRED":
      if (row.expired_at === null || row.released_at !== null || row.committed_at !== null) {
        throw new Error(`Expired reservation ${row.id} must have only expired_at`);
      }
      return {
        ...base,
        status: "EXPIRED",
        releasedAt: null,
        committedAt: null,
        expiredAt: row.expired_at,
      };
  }
}

export function toInventoryReservationInsert(
  reservation: ActiveInventoryReservation,
): InventoryReservationInsert {
  return {
    id: reservation.id,
    sku: reservation.sku,
    idempotency_key: reservation.idempotencyKey,
    quantity: reservation.quantity,
    status: reservation.status,
    expires_at: reservation.expiresAt,
    released_at: reservation.releasedAt,
    committed_at: reservation.committedAt,
    expired_at: reservation.expiredAt,
    version: reservation.version,
    created_at: reservation.createdAt,
    updated_at: reservation.updatedAt,
  };
}

export function toInventoryReservationUpdate(
  reservation: InventoryReservation,
): InventoryReservationUpdate {
  return {
    status: reservation.status,
    released_at: reservation.releasedAt,
    committed_at: reservation.committedAt,
    expired_at: reservation.expiredAt,
    updated_at: reservation.updatedAt,
  };
}
