import type { InventoryReservationStatus } from "./inventory-reservation.js";

export type ReserveInventoryError =
  | { type: "InvalidReservationQuantity"; message: string }
  | { type: "InvalidReservationExpiry"; message: string }
  | { type: "InsufficientInventory"; available: number; requested: number; message: string };

export type ReleaseReservationError =
  | { type: "ReservationAlreadyReleased"; message: string }
  | {
      type: "ReservationNotReleasable";
      status: Exclude<InventoryReservationStatus, "ACTIVE" | "RELEASED">;
      message: string;
    }
  | { type: "InventoryInvariantViolation"; message: string };

export type CommitReservationError =
  | { type: "ReservationAlreadyCommitted"; message: string }
  | {
      type: "ReservationNotCommittable";
      status: Exclude<InventoryReservationStatus, "ACTIVE" | "COMMITTED">;
      message: string;
    }
  | { type: "InventoryInvariantViolation"; message: string };

export type ExpireReservationError =
  | { type: "ReservationNotExpired"; message: string }
  | {
      type: "ReservationNotExpirable";
      status: Exclude<InventoryReservationStatus, "ACTIVE">;
      message: string;
    }
  | { type: "InventoryInvariantViolation"; message: string };
