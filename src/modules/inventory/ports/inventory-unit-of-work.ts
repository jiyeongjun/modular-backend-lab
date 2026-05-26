import type { InventoryItemRepository } from "./inventory-item.repository.js";
import type { InventoryOutboxRepository } from "./inventory-outbox.repository.js";
import type { InventoryReservationRepository } from "./inventory-reservation.repository.js";
import type { InventoryRestockRepository } from "./inventory-restock.repository.js";

export type InventoryUnitOfWork = {
  withTransaction<T>(
    work: (repos: {
      items: InventoryItemRepository;
      restocks: InventoryRestockRepository;
      reservations: InventoryReservationRepository;
      outbox: InventoryOutboxRepository;
    }) => Promise<T>,
  ): Promise<T>;
};
