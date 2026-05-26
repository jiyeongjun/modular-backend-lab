export type InventoryReserved = Readonly<{
  type: "InventoryReserved";
  aggregateType: "InventoryReservation";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    reservationId: string;
    sku: string;
    quantity: number;
    expiresAt: Date;
  };
}>;

export type InventoryReservationReleased = Readonly<{
  type: "InventoryReservationReleased";
  aggregateType: "InventoryReservation";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    reservationId: string;
    sku: string;
    quantity: number;
  };
}>;

export type InventoryReservationCommitted = Readonly<{
  type: "InventoryReservationCommitted";
  aggregateType: "InventoryReservation";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    reservationId: string;
    sku: string;
    quantity: number;
  };
}>;

export type InventoryReservationExpired = Readonly<{
  type: "InventoryReservationExpired";
  aggregateType: "InventoryReservation";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    reservationId: string;
    sku: string;
    quantity: number;
  };
}>;

export type InventoryEvent =
  | InventoryReserved
  | InventoryReservationReleased
  | InventoryReservationCommitted
  | InventoryReservationExpired;
