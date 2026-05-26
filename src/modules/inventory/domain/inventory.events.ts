export type InventoryStockOpened = Readonly<{
  type: "InventoryStockOpened";
  aggregateType: "InventoryItem";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    sku: string;
    onHand: number;
    reserved: number;
  };
}>;

export type InventoryReserved = Readonly<{
  type: "InventoryReserved";
  aggregateType: "InventoryItem";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    reservationId: string;
    sku: string;
    idempotencyKey: string;
    quantity: number;
    expiresAt: Date;
  };
}>;

export type InventoryReservationReleased = Readonly<{
  type: "InventoryReservationReleased";
  aggregateType: "InventoryItem";
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
  aggregateType: "InventoryItem";
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
  aggregateType: "InventoryItem";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    reservationId: string;
    sku: string;
    quantity: number;
  };
}>;

export type InventoryRestocked = Readonly<{
  type: "InventoryRestocked";
  aggregateType: "InventoryItem";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    sku: string;
    quantity: number;
  };
}>;

export type InventoryEvent =
  | InventoryStockOpened
  | InventoryReserved
  | InventoryReservationReleased
  | InventoryReservationCommitted
  | InventoryReservationExpired
  | InventoryRestocked;
