import type { Result } from "../../../shared/result/index.js";

export type CheckoutInventoryReservationStatus = "ACTIVE" | "RELEASED" | "COMMITTED" | "EXPIRED";

export type CheckoutInventoryReservation = Readonly<{
  reservationId: string;
  sku: string;
  quantity: number;
  status: CheckoutInventoryReservationStatus;
}>;

export type CheckoutInventoryError =
  | { type: "CheckoutInventoryItemNotFound"; sku: string; message: string }
  | { type: "CheckoutInsufficientInventory"; available: number; requested: number; message: string }
  | { type: "CheckoutInvalidInventoryRequest"; message: string }
  | { type: "CheckoutInventoryReservationRejected"; reason: string; message: string };

export type ReserveCheckoutInventoryCommand = Readonly<{
  sku: string;
  quantity: number;
  idempotencyKey: string;
  expiresAt: Date;
}>;

export type CommitCheckoutInventoryCommand = Readonly<{
  reservationId: string;
}>;

export type ReleaseCheckoutInventoryCommand = Readonly<{
  reservationId: string;
}>;

export type CheckoutInventoryPort = {
  reserve(
    command: ReserveCheckoutInventoryCommand,
  ): Promise<Result<CheckoutInventoryReservation, CheckoutInventoryError>>;
  commit(
    command: CommitCheckoutInventoryCommand,
  ): Promise<Result<CheckoutInventoryReservation, CheckoutInventoryError>>;
  release(
    command: ReleaseCheckoutInventoryCommand,
  ): Promise<Result<CheckoutInventoryReservation, CheckoutInventoryError>>;
};
