import type { InventoryEvent } from "../domain/index.js";

export type InventoryOutboxRepository = {
  saveAll(events: readonly InventoryEvent[]): Promise<void>;
};
