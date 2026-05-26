import type { InventoryRestock } from "../domain/index.js";

export type InventoryRestockRepository = {
  findByIdempotencyKey(idempotencyKey: string): Promise<InventoryRestock | null>;
  create(restock: InventoryRestock): Promise<void>;
};
