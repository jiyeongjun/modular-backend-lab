import type { Settlement, SettlementEvent } from "../domain/index.js";

export type SettlementRepository = {
  findById(id: string): Promise<Settlement | null>;
  findByOrderId(orderId: string): Promise<Settlement | null>;
  findByOrderIdForUpdate(orderId: string): Promise<Settlement | null>;
  create(settlement: Settlement, events: readonly SettlementEvent[]): Promise<void>;
  save(settlement: Settlement, events: readonly SettlementEvent[]): Promise<void>;
};
