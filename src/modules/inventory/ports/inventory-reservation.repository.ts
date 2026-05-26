import type { ActiveInventoryReservation, InventoryReservation } from "../domain/index.js";

export type InventoryReservationRepository = {
  findById(id: string): Promise<InventoryReservation | null>;
  findByIdForUpdate(id: string): Promise<InventoryReservation | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<InventoryReservation | null>;
  create(reservation: ActiveInventoryReservation): Promise<void>;
  save(reservation: InventoryReservation): Promise<void>;
};

export type InventoryReservationReader = {
  iterateExpiredActive(options: {
    now: Date;
    batchSize: number;
  }): AsyncIterable<ActiveInventoryReservation>;
};
