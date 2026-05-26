import { err, ok, type Result } from "../../../shared/result/index.js";
import type {
  CommitReservationError,
  ExpireReservationError,
  ReleaseReservationError,
  ReserveInventoryError,
} from "./inventory.errors.js";
import type { InventoryEvent } from "./inventory.events.js";
import { getAvailableQuantity, type InventoryItem } from "./inventory-item.js";
import type {
  ActiveInventoryReservation,
  CommittedInventoryReservation,
  ExpiredInventoryReservation,
  InventoryReservation,
  ReleasedInventoryReservation,
} from "./inventory-reservation.js";

export function reserveInventory(
  item: InventoryItem,
  input: {
    reservationId: string;
    idempotencyKey: string;
    quantity: number;
    expiresAt: Date;
    now: Date;
  },
): Result<
  {
    item: InventoryItem;
    reservation: ActiveInventoryReservation;
    events: readonly InventoryEvent[];
  },
  ReserveInventoryError
> {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return err({
      type: "InvalidReservationQuantity",
      message: "Reservation quantity must be a positive integer",
    });
  }

  if (input.expiresAt <= input.now) {
    return err({
      type: "InvalidReservationExpiry",
      message: "Reservation expiry must be in the future",
    });
  }

  const available = getAvailableQuantity(item);
  if (available < input.quantity) {
    return err({
      type: "InsufficientInventory",
      available,
      requested: input.quantity,
      message: "Insufficient inventory available",
    });
  }

  const updatedItem: InventoryItem = {
    ...item,
    reserved: item.reserved + input.quantity,
    updatedAt: input.now,
  };

  const reservation: ActiveInventoryReservation = {
    id: input.reservationId,
    sku: item.sku,
    idempotencyKey: input.idempotencyKey,
    quantity: input.quantity,
    status: "ACTIVE",
    expiresAt: input.expiresAt,
    releasedAt: null,
    committedAt: null,
    expiredAt: null,
    version: 0,
    createdAt: input.now,
    updatedAt: input.now,
  };

  return ok({
    item: updatedItem,
    reservation,
    events: [
      {
        type: "InventoryReserved",
        aggregateType: "InventoryReservation",
        aggregateId: reservation.id,
        occurredAt: input.now,
        payload: {
          reservationId: reservation.id,
          sku: reservation.sku,
          quantity: reservation.quantity,
          expiresAt: reservation.expiresAt,
        },
      },
    ],
  });
}

export function releaseReservation(
  item: InventoryItem,
  reservation: InventoryReservation,
  now: Date,
): Result<
  {
    item: InventoryItem;
    reservation: ReleasedInventoryReservation;
    events: readonly InventoryEvent[];
  },
  ReleaseReservationError
> {
  switch (reservation.status) {
    case "RELEASED":
      return err({
        type: "ReservationAlreadyReleased",
        message: "Reservation is already released",
      });

    case "COMMITTED":
    case "EXPIRED":
      return err({
        type: "ReservationNotReleasable",
        status: reservation.status,
        message: "Reservation cannot be released from its current status",
      });

    case "ACTIVE": {
      const releasedItem = releaseReservedQuantity(item, reservation, now);
      if (!releasedItem.ok) {
        return releasedItem;
      }

      return ok({
        item: releasedItem.value,
        reservation: {
          ...reservation,
          status: "RELEASED",
          releasedAt: now,
          committedAt: null,
          expiredAt: null,
          updatedAt: now,
        },
        events: [
          {
            type: "InventoryReservationReleased",
            aggregateType: "InventoryReservation",
            aggregateId: reservation.id,
            occurredAt: now,
            payload: {
              reservationId: reservation.id,
              sku: reservation.sku,
              quantity: reservation.quantity,
            },
          },
        ],
      });
    }
  }
}

export function commitReservation(
  item: InventoryItem,
  reservation: InventoryReservation,
  now: Date,
): Result<
  {
    item: InventoryItem;
    reservation: CommittedInventoryReservation;
    events: readonly InventoryEvent[];
  },
  CommitReservationError
> {
  switch (reservation.status) {
    case "COMMITTED":
      return err({
        type: "ReservationAlreadyCommitted",
        message: "Reservation is already committed",
      });

    case "RELEASED":
    case "EXPIRED":
      return err({
        type: "ReservationNotCommittable",
        status: reservation.status,
        message: "Reservation cannot be committed from its current status",
      });

    case "ACTIVE":
      if (reservation.quantity > item.reserved || reservation.quantity > item.onHand) {
        return err({
          type: "InventoryInvariantViolation",
          message: "Reservation quantity exceeds current inventory counters",
        });
      }

      return ok({
        item: {
          ...item,
          onHand: item.onHand - reservation.quantity,
          reserved: item.reserved - reservation.quantity,
          updatedAt: now,
        },
        reservation: {
          ...reservation,
          status: "COMMITTED",
          releasedAt: null,
          committedAt: now,
          expiredAt: null,
          updatedAt: now,
        },
        events: [
          {
            type: "InventoryReservationCommitted",
            aggregateType: "InventoryReservation",
            aggregateId: reservation.id,
            occurredAt: now,
            payload: {
              reservationId: reservation.id,
              sku: reservation.sku,
              quantity: reservation.quantity,
            },
          },
        ],
      });
  }
}

export function expireReservation(
  item: InventoryItem,
  reservation: InventoryReservation,
  now: Date,
): Result<
  {
    item: InventoryItem;
    reservation: ExpiredInventoryReservation;
    events: readonly InventoryEvent[];
  },
  ExpireReservationError
> {
  if (reservation.status !== "ACTIVE") {
    return err({
      type: "ReservationNotExpirable",
      status: reservation.status,
      message: "Only active reservations can expire",
    });
  }

  if (reservation.expiresAt > now) {
    return err({ type: "ReservationNotExpired", message: "Reservation has not expired yet" });
  }

  const expiredItem = releaseReservedQuantity(item, reservation, now);
  if (!expiredItem.ok) {
    return expiredItem;
  }

  return ok({
    item: expiredItem.value,
    reservation: {
      ...reservation,
      status: "EXPIRED",
      releasedAt: null,
      committedAt: null,
      expiredAt: now,
      updatedAt: now,
    },
    events: [
      {
        type: "InventoryReservationExpired",
        aggregateType: "InventoryReservation",
        aggregateId: reservation.id,
        occurredAt: now,
        payload: {
          reservationId: reservation.id,
          sku: reservation.sku,
          quantity: reservation.quantity,
        },
      },
    ],
  });
}

function releaseReservedQuantity(
  item: InventoryItem,
  reservation: ActiveInventoryReservation,
  now: Date,
): Result<InventoryItem, { type: "InventoryInvariantViolation"; message: string }> {
  if (reservation.quantity > item.reserved) {
    return err({
      type: "InventoryInvariantViolation",
      message: "Reservation quantity exceeds reserved inventory",
    });
  }

  return ok({
    ...item,
    reserved: item.reserved - reservation.quantity,
    updatedAt: now,
  });
}
