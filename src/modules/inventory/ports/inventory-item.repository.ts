import type { InventoryEvent, InventoryItem } from "../domain/index.js";

export type InventoryItemRepository = {
  findBySku(sku: string): Promise<InventoryItem | null>;
  findBySkuForUpdate(sku: string): Promise<InventoryItem | null>;
  create(item: InventoryItem, events: readonly InventoryEvent[]): Promise<void>;
  save(item: InventoryItem, events: readonly InventoryEvent[]): Promise<void>;
};
