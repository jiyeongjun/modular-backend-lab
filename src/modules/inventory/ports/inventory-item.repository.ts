import type { InventoryItem } from "../domain/index.js";

export type InventoryItemRepository = {
  findBySku(sku: string): Promise<InventoryItem | null>;
  findBySkuForUpdate(sku: string): Promise<InventoryItem | null>;
  save(item: InventoryItem): Promise<void>;
};
