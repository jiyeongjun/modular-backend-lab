export type InventoryReservationStatus = "ACTIVE" | "RELEASED" | "COMMITTED" | "EXPIRED";

export type InventoryReservationBase = Readonly<{
  id: string;
  sku: string;
  idempotencyKey: string;
  quantity: number;
  expiresAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type ActiveInventoryReservation = InventoryReservationBase &
  Readonly<{
    status: "ACTIVE";
    releasedAt: null;
    committedAt: null;
    expiredAt: null;
  }>;

export type ReleasedInventoryReservation = InventoryReservationBase &
  Readonly<{
    status: "RELEASED";
    releasedAt: Date;
    committedAt: null;
    expiredAt: null;
  }>;

export type CommittedInventoryReservation = InventoryReservationBase &
  Readonly<{
    status: "COMMITTED";
    releasedAt: null;
    committedAt: Date;
    expiredAt: null;
  }>;

export type ExpiredInventoryReservation = InventoryReservationBase &
  Readonly<{
    status: "EXPIRED";
    releasedAt: null;
    committedAt: null;
    expiredAt: Date;
  }>;

export type InventoryReservation =
  | ActiveInventoryReservation
  | ReleasedInventoryReservation
  | CommittedInventoryReservation
  | ExpiredInventoryReservation;
